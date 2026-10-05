import { useCallback, useRef, useState } from "react"

import { MODELS, UPSCALER_MODELS } from "../constants"
import { checkAndDownloadModel } from "../lib/idb"
import {
  applyColorizerChromaToOriginal,
  applyMaskAsAlpha,
  preprocessImage,
  preprocessImageToImage,
  upscaleTiled,
} from "../lib/onnx-pipeline"
import type {
  ModelKey,
  ModelStatus,
  ProgressCallback,
  UpscalerModelKey,
} from "../types"

type Ort = typeof import("onnxruntime-web")
type InferenceSession = Awaited<ReturnType<Ort["InferenceSession"]["create"]>>
const SESSION_CREATE_TIMEOUT_MS = 90 * 1000
const INFERENCE_TIMEOUT_MS = 120 * 1000

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

/** Hook return contract */
export interface UseOnnxSessionReturn {
  modelStatus: ModelStatus
  downloadProgress: number
  runInference: (
    imgEl: HTMLImageElement,
    modelKey: ModelKey,
    onUpdate: ProgressCallback,
    quality?: number
  ) => Promise<Blob>
  runImageToImage: (
    imgEl: HTMLImageElement,
    modelKey: ModelKey,
    onUpdate: ProgressCallback,
    options?: { quality?: number; upscalerMode?: UpscalerModelKey }
  ) => Promise<Blob>
  setModelStatus: (status: ModelStatus) => void
}

/**
 * Manages ONNX Runtime sessions on the client.
 *
 * - Avoids SSR issues by using a lazy-loaded ortRef
 * - Caches sessions per model
 * - Handles download + inference pipeline
 */
export const useOnnxSession = (
  ortRef: React.RefObject<Ort | null>
): UseOnnxSessionReturn => {
  /** In-memory session cache per model */
  const sessionCache = useRef<Partial<Record<ModelKey, InferenceSession>>>({})

  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle")
  const [downloadProgress, setDownloadProgress] = useState(0)

  /**
   * Get cached session or create a new one.
   */
  const getOrCreateSession = useCallback(
    async (
      modelKey: ModelKey,
      onUpdate: ProgressCallback
    ): Promise<InferenceSession> => {
      const ort = ortRef.current
      if (!ort) throw new Error("ONNX Runtime not initialized")

      // Fast path: cached session
      if (sessionCache.current[modelKey]) {
        return sessionCache.current[modelKey]!
      }

      setModelStatus("downloading")
      onUpdate("Checking model cache…", 0)

      const buffer = await checkAndDownloadModel(modelKey, (pct) => {
        setDownloadProgress(pct)
        onUpdate(
          pct < 100
            ? `Downloading ${MODELS[modelKey].label}… ${pct}%`
            : "Finalizing download…",
          pct
        )
      })

      onUpdate("Loading session…", 100)

      const session = await withTimeout(
        ort.InferenceSession.create(buffer, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        }),
        SESSION_CREATE_TIMEOUT_MS,
        "Session initialization timed out."
      )

      sessionCache.current[modelKey] = session
      setModelStatus("ready")

      return session
    },
    [ortRef]
  )

  /**
   * Run full inference pipeline for an image.
   */
  const runInference = useCallback(
    async (
      imgEl: HTMLImageElement,
      modelKey: ModelKey,
      onUpdate: ProgressCallback,
      quality: number = 0.9
    ): Promise<Blob> => {
      // Check if the session is ready before running inference
      if (!ortRef.current) {
        throw new Error("ONNX Runtime not initialized")
      }

      const session = await getOrCreateSession(modelKey, onUpdate)

      const { inputType, segmentation } = MODELS[modelKey]
      if (!segmentation) {
        throw new Error(`${modelKey} is not a segmentation model`)
      }

      onUpdate("Pre-processing…", 0)
      const { tensor: inputTensor, region } = preprocessImage(
        imgEl,
        ortRef.current,
        segmentation
      )

      onUpdate("Running inference…", 0)
      const results = await withTimeout(
        session.run({ [inputType]: inputTensor }),
        INFERENCE_TIMEOUT_MS,
        "Inference timed out."
      )

      onUpdate("Post-processing…", 0)
      const maskTensor = results[session.outputNames[0]]
      const blob = await applyMaskAsAlpha(
        maskTensor,
        imgEl,
        segmentation,
        region,
        quality
      )

      return blob
    },
    [getOrCreateSession]
  )

  /**
   * Run Image-to-Image inference (Upscale, Colorize).
   */
  const runImageToImage = useCallback(
    async (
      imgEl: HTMLImageElement,
      modelKey: ModelKey,
      onUpdate: ProgressCallback,
      options: { quality?: number; upscalerMode?: UpscalerModelKey } = {}
    ): Promise<Blob> => {
      const ort = ortRef.current
      if (!ort) {
        throw new Error("ONNX Runtime not initialized")
      }

      const session = await getOrCreateSession(modelKey, onUpdate)

      const { tool, inputType } = MODELS[modelKey]
      const quality = options.quality ?? 0.9

      const runModel = async (tensor: any) => {
        const results = await withTimeout(
          session.run({ [inputType]: tensor }),
          INFERENCE_TIMEOUT_MS,
          "Inference timed out."
        )
        return results[session.outputNames[0]]
      }

      if (tool === "upscaler") {
        const { patchSize, padding } =
          UPSCALER_MODELS[options.upscalerMode ?? "balanced"]
        let lastPct = -1

        return upscaleTiled(
          imgEl,
          ort,
          runModel,
          { patchSize, padding },
          async (done, total) => {
            const pct = Math.floor((done / total) * 100)
            if (pct === lastPct) return
            lastPct = pct
            onUpdate(`Upscaling tile ${done}/${total}…`, pct)
            await new Promise((resolve) => setTimeout(resolve, 0))
          },
          quality
        )
      }

      onUpdate("Pre-processing…", 0)
      // Note: The current DeOldify ONNX models have a fixed input size of 256x256.
      const inputTensor = preprocessImageToImage(imgEl, ort, 256, {
        keepAspectRatio: true,
        grayscale: true,
        useByteRange: true,
      })

      onUpdate("Running inference…", 0)
      const outputTensor = await runModel(inputTensor)

      onUpdate("Post-processing…", 0)
      return applyColorizerChromaToOriginal(outputTensor, imgEl, quality)
    },
    [getOrCreateSession]
  )

  return {
    modelStatus,
    downloadProgress,
    runInference,
    runImageToImage,
    setModelStatus,
  }
}
