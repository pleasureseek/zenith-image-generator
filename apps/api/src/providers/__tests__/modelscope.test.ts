/**
 * ModelScope Provider Tests
 * Tests with mocked fetch - no real API calls
 */

import { ApiErrorCode } from '@z-image/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModelScopeProvider } from '../modelscope'
import type { ProviderGenerateRequest } from '../types'

const defaultRequest: ProviderGenerateRequest = {
  prompt: 'a cat',
  model: 'Tongyi-MAI/Z-Image-Turbo',
  width: 1024,
  height: 1024,
  authToken: 'test-token-12345',
}

describe('ModelScopeProvider', () => {
  const provider = new ModelScopeProvider()

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    const pollingConfig = provider as unknown as { pollIntervalMs: number; maxPollAttempts: number }
    pollingConfig.pollIntervalMs = 0
    pollingConfig.maxPollAttempts = 3
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('properties', () => {
    it('should have correct id', () => {
      expect(provider.id).toBe('modelscope')
    })

    it('should have correct name', () => {
      expect(provider.name).toBe('ModelScope')
    })
  })

  describe('generate - auth validation', () => {
    it('should throw AUTH_REQUIRED when no token provided', async () => {
      await expect(
        provider.generate({ ...defaultRequest, authToken: undefined })
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_REQUIRED,
      })
    })

    it('should throw AUTH_INVALID when token too short', async () => {
      await expect(
        provider.generate({ ...defaultRequest, authToken: 'short' })
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_INVALID,
      })
    })
  })

  describe('generate - successful request', () => {
    it('should submit async task and poll for result', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task_id: 'task-123' }),
      } as Response)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task_status: 'SUCCEED',
          output_images: ['https://example.com/result.png'],
        }),
      } as Response)

      const result = await provider.generate({
        ...defaultRequest,
        seed: 42,
        steps: 9,
      })

      expect(result).toEqual({ url: 'https://example.com/result.png', seed: 42 })
      expect(mockFetch).toHaveBeenCalledTimes(2)

      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://api-inference.modelscope.cn/v1/images/generations',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token-12345',
            'X-ModelScope-Async-Mode': 'true',
          }),
        })
      )

      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://api-inference.modelscope.cn/v1/tasks/task-123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-12345',
            'X-ModelScope-Task-Type': 'image_generation',
          }),
        })
      )
    })

    it('should include negative prompt and loras when provided', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task_id: 'task-123' }),
      } as Response)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task_status: 'SUCCEED',
          output_images: ['https://example.com/result.png'],
        }),
      } as Response)

      await provider.generate({
        ...defaultRequest,
        negativePrompt: 'blurry, low quality',
        loras: { 'some/lora': 0.8 },
      })

      const call = mockFetch.mock.calls[0]
      const body = JSON.parse(call[1]?.body as string)
      expect(body.negative_prompt).toBe('blurry, low quality')
      expect(body.loras).toEqual({ 'some/lora': 0.8 })
    })
  })

  describe('generate - task failures', () => {
    it('should throw GENERATION_FAILED when task status is FAILED', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task_id: 'task-123' }),
      } as Response)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task_status: 'FAILED',
          error_message: 'bad things happened',
        }),
      } as Response)

      await expect(provider.generate(defaultRequest)).rejects.toMatchObject({
        code: ApiErrorCode.GENERATION_FAILED,
      })
    })

    it('should throw TIMEOUT when polling exceeds attempts', async () => {
      const mockFetch = vi.mocked(fetch)
      const pollingConfig = provider as unknown as { maxPollAttempts: number }
      pollingConfig.maxPollAttempts = 2

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task_id: 'task-123' }),
      } as Response)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task_status: 'RUNNING' }),
      } as Response)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task_status: 'RUNNING' }),
      } as Response)

      await expect(provider.generate(defaultRequest)).rejects.toMatchObject({
        code: ApiErrorCode.TIMEOUT,
      })
    })
  })
})
