/* eslint-disable @next/next/no-img-element */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { sendGAEvent } from "@next/third-parties/google"

import { EditorCanvas } from "./components/EditorCanvas"
import { ChangelogDialog } from "./components/ChangelogDialog"
import { EditorProcessingDialog } from "./components/EditorProcessingDialog"
import { EditorToolbar } from "./components/EditorToolbar"
import { MobileRestriction } from "./components/MobileRestriction"
import { PWAInstallButton } from "./components/PWAInstallButton"
import { EditorLeftPanel } from "./components/panels/EditorLeftPanel"
import { EditorRightPanel } from "./components/panels/EditorRightPanel"
import {
  MODELS,
  TOOL_ACCENTS,
  UPSCALER_MODELS,
  getWasmCdnBase,
} from "./constants"
import { useImageQueue } from "./hooks/use-image-queue"
import { useOnnxSession } from "./hooks/use-onnx-session"
import { useProcessingDialog } from "./hooks/use-processing-dialog"
import { isModelCached } from "./lib/idb"
import { convertImageFormat } from "./lib/image-converter"
import { base64ToBlob, compositeOnColor, loadImage } from "./lib/image-utils"
import type { ActiveTool, ModelKey, UpscalerModelKey } from "./types"

const VALID_TOOLS: ActiveTool[] = ["remover", "upscaler", "colorizer"]
const VALID_MODELS = Object.keys(MODELS) as ModelKey[]
const APP_VERSION = "1.1.2"

interface EditorProps {
  initialTool?: ActiveTool
}

export const Editor = ({ initialTool = "remover" }: EditorProps) => {
  const ortRef = useRef<typeof import("onnxruntime-web") | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()

  const queue = useImageQueue()
  const onnx = useOnnxSession(ortRef)
  const { dialog, openDialog, updateDialog, closeDialog } =
    useProcessingDialog()

  const [showDust, setShowDust] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [showChangelog, setShowChangelog] = useState(false)
  const [activeTool, setActiveTool] = useState<ActiveTool>(initialTool)
  const [selectedModel, setSelectedModel] =
    useState<ModelKey>("ormbg_quantized")
  const [upscalerModel, setUpscalerModel] = useState<ModelKey>(
    "swin2sr_quantized"
  )
  const [colorizerModel, setColorizerModel] = useState<ModelKey>(
    "deoldify_artistic_quantized"
  )
  const [upscalerSettings, setUpscalerSettings] =
    useState<UpscalerModelKey>("balanced")
  const [applyBgColor, setApplyBgColor] = useState(false)
  const [bgColor, setBgColor] = useState("#ffffff")
  const [upscaledData, setUpscaledData] = useState<string | null>(null)
  const [colorizedData, setColorizedData] = useState<string | null>(null)
  const [exportQuality, setExportQuality] = useState(0.8)

  // WASM init
  useEffect(() => {
    let mounted = true

    import("onnxruntime-web").then((ort) => {
      if (!mounted) return

      ort.env.wasm.wasmPaths = getWasmCdnBase(
        ort.env.versions.web ?? ort.env.versions.common
      )
      ort.env.wasm.numThreads = 1

      ortRef.current = ort
    })

    return () => {
      mounted = false
    }
  }, [])

  // URL → state (once on mount)
  useEffect(() => {
    const toolParam = searchParams.get("tool") as ActiveTool | null
    const modelParam = searchParams.get("model") as ModelKey | null

    if (toolParam && VALID_TOOLS.includes(toolParam)) {
      setActiveTool(toolParam)
    }
    if (modelParam && VALID_MODELS.includes(modelParam)) {
      const model = MODELS[modelParam]
      if (model) {
        if (model.tool === "remover") setSelectedModel(modelParam)
        if (model.tool === "upscaler") setUpscalerModel(modelParam)
        if (model.tool === "colorizer") setColorizerModel(modelParam)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // IDB cache check on model switch
  useEffect(() => {
    const currentModel =
      activeTool === "remover"
        ? selectedModel
        : activeTool === "upscaler"
          ? upscalerModel
          : colorizerModel
    isModelCached(currentModel)
      .then((cached) => onnx.setModelStatus(cached ? "ready" : "idle"))
      .catch(() => onnx.setModelStatus("idle"))
  }, [selectedModel, upscalerModel, colorizerModel, activeTool]) // eslint-disable-line react-hooks/exhaustive-deps

  // URL sync helpers
  const pushUrl = useCallback(
    (tool: ActiveTool, model: ModelKey) => {
      const toolRoute = tool === "remover" ? "/removerized" : `/${tool}`
      const params = new URLSearchParams(searchParams.toString())
      params.delete("tool") // We use dedicated routes now
      params.set("model", model)
      const queryString = params.toString()
      router.replace(`${toolRoute}${queryString ? `?${queryString}` : ""}`, {
        scroll: false,
      })
    },
    [router, searchParams]
  )

  const handleToolChange = useCallback(
    (tool: ActiveTool) => {
      setActiveTool(tool)
      const model =
        tool === "remover"
          ? selectedModel
          : tool === "upscaler"
            ? upscalerModel
            : colorizerModel
      pushUrl(tool, model)
    },
    [selectedModel, upscalerModel, colorizerModel, pushUrl]
  )

  const handleModelChange = useCallback(
    (key: ModelKey) => {
      if (activeTool === "remover") setSelectedModel(key)
      if (activeTool === "upscaler") setUpscalerModel(key)
      if (activeTool === "colorizer") setColorizerModel(key)

      setUpscaledData(null)
      setColorizedData(null)
      pushUrl(activeTool, key)
    },
    [activeTool, pushUrl]
  )

  // Dust trigger
  const triggerDust = useCallback(() => {
    setShowDust(true)
    setTimeout(() => setShowDust(false), 100)
  }, [])

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.2, 3))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.2, 0.5))
  }, [])

  const handleZoomReset = useCallback(() => {
    setZoom(1)
  }, [])

  // Background composite
  const maybeComposite = useCallback(
    async (blob: Blob): Promise<Blob> => {
      if (!applyBgColor) return blob
      const objUrl = URL.createObjectURL(blob)
      const quality = 0.9 // Use standard quality during processing
      const composited = await compositeOnColor(objUrl, bgColor, quality)
      URL.revokeObjectURL(objUrl)
      return base64ToBlob(composited)
    },
    [applyBgColor, bgColor]
  )

  // Remove background
  const remove = useCallback(async () => {
    if (!queue.imageData) return

    const start = performance.now()
    openDialog("Starting…")

    try {
      const imgEl = await loadImage(queue.imageData)
      const quality = 0.85 // Use standard quality during processing
      const rawBlob = await onnx.runInference(
        imgEl,
        selectedModel,
        updateDialog,
        quality
      )
      const blob = await maybeComposite(rawBlob)
      const url = URL.createObjectURL(blob)

      queue.setResultsData((prev) => [
        ...prev.filter((r) => r.name !== queue.selectedImage),
        { data: blob, name: queue.selectedImage! },
      ])
      queue.setResultData(url)
      triggerDust()

      sendGAEvent({ event: "remove-background", value: "success" })
      const elapsed = Math.floor((performance.now() - start) / 1000)
      const { toast } = await import("sonner")
      toast.success(`🚀 Done in ${elapsed} s`)
    } catch (err) {
      console.error("[remove]", err)
      onnx.setModelStatus("error")
      const { toast } = await import("sonner")
      toast.error("Background removal failed.")
    } finally {
      closeDialog()
    }
  }, [
    queue,
    onnx,
    selectedModel,
    updateDialog,
    openDialog,
    closeDialog,
    maybeComposite,
    triggerDust,
  ])

  // Batch process
  const process = useCallback(async () => {
    if (!queue.files.length) return

    const start = performance.now()
    let accumulated: { data: Blob; name: string }[] = []

    openDialog("Starting batch…")

    try {
      for (let i = 0; i < queue.settings.length; i++) {
        const setting = queue.settings[i]
        const file = queue.files.find((f) => f.name === setting.name)
        if (!file) continue

        const label = setting.name.slice(0, 22)
        const imgEl = await loadImage(URL.createObjectURL(file))

        const quality = 0.85 // Use standard quality during processing
        const rawBlob = await onnx.runInference(
          imgEl,
          selectedModel,
          (text, pct) => {
            updateDialog(
              `[${i + 1}/${queue.settings.length}] ${label} — ${text}`,
              pct
            )
          },
          quality
        )

        const blob = await maybeComposite(rawBlob)
        accumulated = [...accumulated, { data: blob, name: setting.name }]
        queue.setResultsData(accumulated)
        queue.setResultData(URL.createObjectURL(blob))
        triggerDust()

        sendGAEvent({ event: "remove-background", value: "success" })
      }

      const elapsed = Math.floor((performance.now() - start) / 1000)
      const { toast } = await import("sonner")
      toast.success(`🚀 Batch done in ${elapsed} s`)
    } catch (err) {
      console.error("[process]", err)
      const { toast } = await import("sonner")
      toast.error("Batch processing failed.")
    } finally {
      closeDialog()
    }
  }, [
    queue,
    onnx,
    selectedModel,
    updateDialog,
    openDialog,
    closeDialog,
    maybeComposite,
    triggerDust,
  ])

  // Upscale
  const upscale = useCallback(async () => {
    const source = queue.resultData || queue.imageData
    if (!source) return

    const start = performance.now()
    openDialog("Initializing upscaler…")

    try {
      const imgEl = await loadImage(source)

      const quality = 0.85 // Use standard quality during processing
      const blob = await onnx.runImageToImage(
        imgEl,
        upscalerModel,
        updateDialog,
        {
          size: 512,
          quality: quality,
        }
      )
      const url = URL.createObjectURL(blob)

      setUpscaledData(url)
      queue.setResultData(url)

      sendGAEvent({ event: "upscale-image", value: "success" })
      const elapsed = Math.floor((performance.now() - start) / 1000)
      const { toast } = await import("sonner")
      toast.success(`🚀 Upscaled in ${elapsed} s`)
    } catch (err) {
      console.error("[upscale]", err)
      const { toast } = await import("sonner")
      toast.error("Upscaling failed.")
    } finally {
      closeDialog()
    }
  }, [queue, openDialog, onnx, upscalerModel, updateDialog, closeDialog])

  // Colorize
  const colorize = useCallback(async () => {
    const source = queue.resultData || queue.imageData
    if (!source) return

    const start = performance.now()
    openDialog("Initializing colorizer…")

    try {
      const imgEl = await loadImage(source)

      const quality = 0.85 // Use standard quality during processing
      const blob = await onnx.runImageToImage(
        imgEl,
        colorizerModel,
        updateDialog,
        { size: 512, quality: quality }
      )
      const url = URL.createObjectURL(blob)

      setColorizedData(url)
      queue.setResultData(url)

      sendGAEvent({ event: "colorize-image", value: "success" })
      const elapsed = Math.floor((performance.now() - start) / 1000)
      const { toast } = await import("sonner")
      toast.success(`🚀 Colorized in ${elapsed} s`)
    } catch (err) {
      console.error("[colorize]", err)
      const { toast } = await import("sonner")
      toast.error("Colorization failed.")
    } finally {
      closeDialog()
    }
  }, [queue, openDialog, onnx, colorizerModel, updateDialog, closeDialog])

  // Download
  const handleDownload = useCallback(async () => {
    if (activeTool === "upscaler" && upscaledData) {
      const setting = queue.settings.find((s) => s.name === queue.selectedImage)
      const format = setting?.format || "image/webp"
      const quality = (setting?.quality ?? 80) / 100

      // Fetch and convert format
      const response = await fetch(upscaledData)
      const blob = await response.blob()
      const convertedBlob = await convertImageFormat(blob, format, quality)

      const link = (globalThis as any).document.createElement("a")
      link.href = URL.createObjectURL(convertedBlob)
      const ext = format === "image/webp" ? "webp" : format === "image/jpeg" ? "jpg" : "png"
      link.download = `removerized-upscaled-${Date.now()}.${ext}`
      link.click()
      return
    }

    if (activeTool === "colorizer" && colorizedData) {
      const setting = queue.settings.find((s) => s.name === queue.selectedImage)
      const format = setting?.format || "image/webp"
      const quality = (setting?.quality ?? 80) / 100

      // Fetch and convert format
      const response = await fetch(colorizedData)
      const blob = await response.blob()
      const convertedBlob = await convertImageFormat(blob, format, quality)

      const link = (globalThis as any).document.createElement("a")
      link.href = URL.createObjectURL(convertedBlob)
      const ext = format === "image/webp" ? "webp" : format === "image/jpeg" ? "jpg" : "png"
      link.download = `removerized-colorized-${Date.now()}.${ext}`
      link.click()
      return
    }

    // Download all images in the queue with their respective formats
    for (const result of queue.resultsData) {
      const setting = queue.settings.find((s) => s.name === result.name)
      const format = setting?.format || "image/webp"
      const quality = (setting?.quality ?? 80) / 100

      // Convert format
      const convertedBlob = await convertImageFormat(result.data, format, quality)

      const link = (globalThis as any).document.createElement("a")
      link.href = URL.createObjectURL(convertedBlob)
      const ext = format === "image/webp" ? "webp" : format === "image/jpeg" ? "jpg" : "png"

      const nameWithoutExt = result.name.replace(/\.[^/.]+$/, "")
      link.download = `${nameWithoutExt}.${ext}`
      link.click()
    }
  }, [activeTool, upscaledData, colorizedData, queue.resultsData, queue.settings, queue.selectedImage])

  // Derived
  const canDownload =
    activeTool === "upscaler"
      ? !!upscaledData
      : activeTool === "colorizer"
        ? !!colorizedData
        : !!queue.resultsData.find((r) => r.name === queue.selectedImage)

  const accentColor = TOOL_ACCENTS[activeTool]
  const bgImage = queue.imageData || queue.resultData

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: any) => {
      const isMod = e.ctrlKey || e.metaKey

      if (isMod) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault()
          handleZoomIn()
        } else if (e.key === "-") {
          e.preventDefault()
          handleZoomOut()
        } else if (e.key === "0") {
          e.preventDefault()
          handleZoomReset()
        } else if (e.key === "Enter") {
          e.preventDefault()
          process()
        }
      }
    }

    globalThis.addEventListener("keydown", handleKeyDown)
    return () => globalThis.removeEventListener("keydown", handleKeyDown)
  }, [handleZoomIn, handleZoomOut, handleZoomReset, process])

  return (
    <div
      className="relative flex h-screen w-screen overflow-hidden bg-[#050505]"
      style={{ "--tool-accent": accentColor } as React.CSSProperties}
    >
      {/* Full-screen frosted background layer */}
      <div
        className="pointer-events-none absolute inset-0 z-0 scale-110 transition-opacity duration-700"
        style={{
          backgroundImage: bgImage ? `url(${bgImage})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(72px) brightness(0.13) saturate(1.6)",
          opacity: bgImage ? 1 : 0,
        }}
      />

      {/* Static dark noise texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundSize: "128px 128px",
        }}
      />

      {/* Accent ambient glow — top */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-64 opacity-20 transition-colors duration-700"
        style={{
          background: `radial-gradient(ellipse 80% 100% at 50% 0%, ${accentColor}40, transparent)`,
        }}
      />

      {/* ── Left SEO Sidebar ── */}
      <aside className="relative z-10 hidden w-60 shrink-0 lg:flex">
        <EditorLeftPanel activeTool={activeTool} accentColor={accentColor} />
      </aside>

      {/* ── Center Canvas ── */}
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden">
        {/* Floating version button */}
        <div className="pointer-events-auto absolute top-4 left-4 z-20 flex gap-2">
          <button
            onClick={() => setShowChangelog(true)}
            className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/50 shadow-2xl backdrop-blur-2xl transition-all hover:bg-white/10 hover:text-white"
            style={{
              boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06), 0 0 40px ${accentColor}10`,
              color: accentColor,
            }}
            title="View changelog"
          >
            v{APP_VERSION}
          </button>
          <PWAInstallButton accentColor={accentColor} />
        </div>

        <EditorCanvas
          imageData={queue.imageData}
          resultData={queue.resultData}
          showDust={showDust}
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
        />
        <EditorToolbar
          canDownload={canDownload}
          onProcess={process}
          onDownload={handleDownload}
          accentColor={accentColor}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          zoom={zoom}
        />
      </main>

      {/* ── Right Controls + Queue Sidebar ── */}
      <aside className="relative z-10 w-[24rem] shrink-0">
        <EditorRightPanel
          activeTool={activeTool}
          onToolChange={handleToolChange}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          modelStatus={onnx.modelStatus}
          downloadProgress={onnx.downloadProgress}
          localSettings={queue.localSettings}
          onSettingsChange={queue.updateLocalSettings}
          applyBgColor={applyBgColor}
          onToggleBgColor={() => setApplyBgColor((v) => !v)}
          bgColor={bgColor}
          onBgColorChange={setBgColor}
          hasImage={!!queue.imageData}
          onRemove={remove}
          hasResult={!!queue.resultData}
          hasUpscaled={!!upscaledData}
          onUpscale={upscale}
          hasColorized={!!colorizedData}
          onColorize={colorize}
          onDownload={handleDownload}
          onDownloadSingle={handleDownload}
          files={queue.files}
          settings={queue.settings}
          selectedImage={queue.selectedImage}
          resultsData={queue.resultsData}
          onFilesChange={queue.handleDataChange}
          onRemoveFile={queue.handleRemoveFile}
          onSelectImage={queue.handleChangeImage}
          onClearQueue={() => {
            queue.clearQueue()
            setUpscaledData(null)
            setColorizedData(null)
          }}
          onUpscalerSettingsChange={setUpscalerSettings}
          selectedUpscalerSettings={upscalerSettings}
          upscalerModel={upscalerModel}
          colorizerModel={colorizerModel}
          accentColor={accentColor}
        />
      </aside>

      {/* Blocking inference modal */}
      <EditorProcessingDialog dialog={dialog} />

      {/* Changelog dialog */}
      <ChangelogDialog
        open={showChangelog}
        onOpenChange={setShowChangelog}
        version={APP_VERSION}
        accentColor={accentColor}
      />

      {/* Mobile restriction overlay */}
      <MobileRestriction accentColor={accentColor} />
    </div>
  )
}
