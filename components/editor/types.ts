export type ActiveTool = "remover" | "upscaler" | "colorizer"

export type ModelKey =
  | "ormbg_quantized"
  | "ormbg_fp16"
  | "isnet_quantized"
  | "isnet_fp16"
  | "birefnet_lite"
  | "birefnet_lite_fp16"
  | "rmbg_1_4_quantized"
  | "rmbg_1_4_fp16"
  | "modnet_quantized"
  | "swin2sr_quantized"
  | "swin2sr_fp16"
  | "deoldify_artistic_quantized"
  | "deoldify_artistic_fp16"

export type UpscalerModelKey = "performance" | "balanced" | "quality"

export type ModelStatus = "idle" | "downloading" | "ready" | "error"

export interface QueueResult {
  name: string
  data: Blob
}

export type ProgressCallback = (text: string, pct: number) => void

export interface DialogState {
  open: boolean
  text: string
  progress: number
}

export type ResizeMode = "letterbox" | "stretch" | "shortestEdge"

export type MaskOutputType = "probabilities" | "logits" | "minmax"

export interface SegmentationConfig {
  size: number
  multipleOf?: number
  mean: [number, number, number]
  std: [number, number, number]
  resize: ResizeMode
  output: MaskOutputType
}
