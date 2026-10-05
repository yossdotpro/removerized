import { useCallback, useRef, useState } from "react"

import { MODELS } from "../constants"
import { checkAndDownloadModel } from "../lib/idb"
import {
  applyColorizerChromaToOriginal,
  applyMaskAsAlpha,
  preprocessImage,
  preprocessImageToImage,
  tensorToImageData,
} from "../lib/onnx-pipeline"
import type { ModelKey, ModelStatus, ProgressCallback } from "../types"

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
    options?: { size?: number; quality?: number }
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
      options: { size?: number; quality?: number } = {}
    ): Promise<Blob> => {
      if (!ortRef.current) {
        throw new Error("ONNX Runtime not initialized")
      }

      const session = await getOrCreateSession(modelKey, onUpdate)

      const isColorizer = modelKey.includes("deoldify")
      const isUpscaler = modelKey.includes("swin2sr") || modelKey.includes("realesrgan")
      const quality = options.quality ?? 0.9

      onUpdate("Pre-processing…", 0)
      // Note: The current DeOldify ONNX models have a fixed input size of 256x256.
      const size = isColorizer ? 256 : (options.size || 512)
      const inputTensor = preprocessImageToImage(
        imgEl,
        ortRef.current,
        size,
        {
          keepAspectRatio: isColorizer,
          grayscale: isColorizer,
          useByteRange: isColorizer,
        }
      )

      onUpdate("Running inference…", 0)
      const inputType = MODELS[modelKey].inputType
      const results = await withTimeout(
        session.run({ [inputType]: inputTensor }),
        INFERENCE_TIMEOUT_MS,
        "Inference timed out."
      )

      onUpdate("Post-processing…", 0)
      const outputTensor = results[session.outputNames[0]]

      if (isColorizer) {
        return applyColorizerChromaToOriginal(outputTensor, imgEl, quality)
      }

      // For upscaler, output size is usually input * 4
      const outW = (outputTensor.dims[3] as number) || (options.size || 512) * (isUpscaler ? 4 : 1)
      const outH = (outputTensor.dims[2] as number) || (options.size || 512) * (isUpscaler ? 4 : 1)

      const blob = await tensorToImageData(outputTensor, outW, outH, { quality })

      return blob
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
