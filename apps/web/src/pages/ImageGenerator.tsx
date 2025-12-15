import { ApiConfigAccordion } from '@/components/feature/ApiConfigAccordion'
import { Header } from '@/components/feature/Header'
import { ImageResultCard } from '@/components/feature/ImageResultCard'
import { LLMSettingsAccordion } from '@/components/feature/LLMSettingsAccordion'
import { PromptCard } from '@/components/feature/PromptCard'
import { StatusCard } from '@/components/feature/StatusCard'
import { useImageGenerator } from '@/hooks/useImageGenerator'

export default function ImageGenerator() {
  const {
    tokens,
    currentToken,
    provider,
    model,
    availableModels,
    prompt,
    negativePrompt,
    width,
    height,
    steps,
    loading,
    imageDetails,
    status,
    elapsed,
    selectedRatio,
    uhd,
    showInfo,
    isBlurred,
    isUpscaled,
    isUpscaling,
    isOptimizing,
    isTranslating,
    llmSettings,
    setProvider,
    setModel,
    setPrompt,
    setNegativePrompt,
    setWidth,
    setHeight,
    setSteps,
    setShowInfo,
    setIsBlurred,
    setLLMProvider,
    setLLMModel,
    setAutoTranslate,
    setCustomSystemPrompt,
    saveToken,
    handleRatioSelect,
    handleUhdToggle,
    handleDownload,
    handleUpscale,
    handleDelete,
    handleGenerate,
    handleOptimize,
    handleTranslate,
  } = useImageGenerator()

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <Header />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left Panel - Controls */}
            <div className="lg:col-span-3 space-y-4">
              <ApiConfigAccordion
                provider={provider}
                model={model}
                currentToken={currentToken}
                availableModels={availableModels}
                setProvider={setProvider}
                setModel={setModel}
                saveToken={saveToken}
              />

              <LLMSettingsAccordion
                llmSettings={llmSettings}
                setLLMProvider={setLLMProvider}
                setLLMModel={setLLMModel}
                setAutoTranslate={setAutoTranslate}
                setCustomSystemPrompt={setCustomSystemPrompt}
              />

              <PromptCard
                prompt={prompt}
                negativePrompt={negativePrompt}
                steps={steps}
                width={width}
                height={height}
                selectedRatio={selectedRatio}
                uhd={uhd}
                loading={loading}
                setPrompt={setPrompt}
                setNegativePrompt={setNegativePrompt}
                setSteps={setSteps}
                setWidth={setWidth}
                setHeight={setHeight}
                handleRatioSelect={handleRatioSelect}
                handleUhdToggle={handleUhdToggle}
                handleGenerate={handleGenerate}
                onOptimize={handleOptimize}
                onTranslate={handleTranslate}
                isOptimizing={isOptimizing}
                isTranslating={isTranslating}
              />
            </div>

            {/* Right Panel - Output */}
            <div className="lg:col-span-2 space-y-4">
              <ImageResultCard
                imageDetails={imageDetails}
                loading={loading}
                elapsed={elapsed}
                showInfo={showInfo}
                isBlurred={isBlurred}
                isUpscaled={isUpscaled}
                isUpscaling={isUpscaling}
                giteeToken={tokens.gitee}
                setShowInfo={setShowInfo}
                setIsBlurred={setIsBlurred}
                handleUpscale={handleUpscale}
                handleDownload={handleDownload}
                handleDelete={handleDelete}
              />

              <StatusCard status={status} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
