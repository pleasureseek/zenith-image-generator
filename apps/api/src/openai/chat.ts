import { Errors, LLM_PROVIDER_CONFIGS } from '@z-image/shared'
import type { Context } from 'hono'
import { getLLMProvider, hasLLMProvider } from '../llm-providers'
import { sendError } from '../middleware'
import type { OpenAIChatRequest, OpenAIChatResponse } from './types'

type LLMProviderId = keyof typeof LLM_PROVIDER_CONFIGS

function parseChatBearerToken(authHeader?: string): {
  providerHint?: LLMProviderId
  token?: string
} {
  if (!authHeader) return {}
  if (!authHeader.startsWith('Bearer ')) return {}

  const raw = authHeader.slice('Bearer '.length).trim()
  if (!raw) return {}

  if (raw.startsWith('gitee:')) {
    const token = raw.slice('gitee:'.length).trim()
    return token ? { providerHint: 'gitee-llm', token } : {}
  }
  if (raw.startsWith('ms:')) {
    const token = raw.slice('ms:'.length).trim()
    return token ? { providerHint: 'modelscope-llm', token } : {}
  }
  if (raw.startsWith('hf:')) {
    const token = raw.slice('hf:'.length).trim()
    return token ? { providerHint: 'huggingface-llm', token } : {}
  }
  if (raw.startsWith('deepseek:')) {
    const token = raw.slice('deepseek:'.length).trim()
    return token ? { providerHint: 'deepseek', token } : {}
  }

  return { token: raw }
}

function resolveChatModel(model: string): { provider: LLMProviderId; model: string } {
  const trimmed = model.trim()
  if (!trimmed) return { provider: 'pollinations', model: 'openai-fast' }

  if (trimmed.startsWith('gitee/'))
    return { provider: 'gitee-llm', model: trimmed.slice('gitee/'.length) }
  if (trimmed.startsWith('ms/'))
    return { provider: 'modelscope-llm', model: trimmed.slice('ms/'.length) }
  if (trimmed.startsWith('hf/'))
    return { provider: 'huggingface-llm', model: trimmed.slice('hf/'.length) }
  if (trimmed.startsWith('deepseek/'))
    return { provider: 'deepseek', model: trimmed.slice('deepseek/'.length) }
  if (trimmed.startsWith('pollinations/'))
    return { provider: 'pollinations', model: trimmed.slice('pollinations/'.length) }

  // Default: treat as Pollinations model id.
  return { provider: 'pollinations', model: trimmed }
}

function getSystemPrompt(messages: OpenAIChatRequest['messages']): string {
  return messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n')
    .trim()
}

function getUserPrompt(messages: OpenAIChatRequest['messages']): string | null {
  const parts = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .filter((s) => s && s.trim().length > 0)
  if (parts.length === 0) return null
  return parts.join('\n').trim()
}

function makeChatResponse(model: string, content: string): OpenAIChatResponse {
  const id = `chatcmpl-${Math.random().toString(36).slice(2)}`
  return {
    id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
  }
}

export async function handleChatCompletion(c: Context) {
  let body: OpenAIChatRequest
  try {
    body = (await c.req.json()) as OpenAIChatRequest
  } catch {
    return sendError(c, Errors.invalidParams('body', 'Invalid JSON body'))
  }

  if (!body?.model || typeof body.model !== 'string') {
    return sendError(c, Errors.invalidParams('model', 'model is required'))
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return sendError(c, Errors.invalidParams('messages', 'messages is required'))
  }

  const userPrompt = getUserPrompt(body.messages)
  if (!userPrompt) {
    return sendError(c, Errors.invalidParams('messages', 'At least one user message is required'))
  }

  const systemPrompt = getSystemPrompt(body.messages)
  const resolved = resolveChatModel(body.model)
  const auth = parseChatBearerToken(c.req.header('Authorization'))

  if (auth.providerHint && auth.providerHint !== resolved.provider) {
    return sendError(
      c,
      Errors.invalidParams('Authorization', 'Token prefix does not match requested model provider')
    )
  }

  if (!hasLLMProvider(resolved.provider)) {
    return sendError(
      c,
      Errors.invalidParams('model', `Unsupported model provider: ${resolved.provider}`)
    )
  }

  const providerConfig = LLM_PROVIDER_CONFIGS[resolved.provider]
  if (providerConfig?.needsAuth && !auth.token) {
    return sendError(c, Errors.authRequired(providerConfig.name))
  }

  try {
    const llmProvider = getLLMProvider(resolved.provider)
    const result = await llmProvider.complete({
      prompt: userPrompt,
      systemPrompt,
      model: resolved.model || providerConfig.defaultModel,
      authToken: auth.token,
      maxTokens: body.max_tokens,
      temperature: body.temperature,
    })

    return c.json(makeChatResponse(result.model, result.content))
  } catch (err) {
    return sendError(c, err)
  }
}
