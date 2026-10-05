import type { MaskOutputType, SegmentationConfig } from "../types"

type Ort = typeof import("onnxruntime-web")

// ── Pre-processing ────────────────────────────────────────────────────────────

export interface MaskRegion {
  x: number
  y: number
  width: number
  height: number
  inputWidth: number
  inputHeight: number
}

const roundToMultiple = (value: number, multiple: number) =>
  Math.max(multiple, Math.round(value / multiple) * multiple)

const getMaskRegion = (
  ow: number,
  oh: number,
  config: SegmentationConfig
): MaskRegion => {
  const { size, resize } = config
  const multiple = config.multipleOf ?? 1

  if (resize === "shortestEdge") {
    const scale = size / Math.min(ow, oh)
    const width = roundToMultiple(ow * scale, multiple)
    const height = roundToMultiple(oh * scale, multiple)
    return { x: 0, y: 0, width, height, inputWidth: width, inputHeight: height }
  }

  if (resize === "letterbox") {
    const ratio = Math.min(size / ow, size / oh)
    const width = Math.max(1, Math.round(ow * ratio))
    const height = Math.max(1, Math.round(oh * ratio))
    return {
      x: Math.floor((size - width) / 2),
      y: Math.floor((size - height) / 2),
      width,
      height,
      inputWidth: size,
      inputHeight: size,
    }
  }

  return { x: 0, y: 0, width: size, height: size, inputWidth: size, inputHeight: size }
}

/**
 * Converts an HTMLImageElement into a normalised Float32 tensor ready for the
 * ONNX background-removal model described by `config`.
 *
 * Steps:
 *  1. Resize the image according to the model's resize mode (stretch,
 *     letterbox or shortest edge) on an offscreen canvas.
 *  2. Read the raw RGBA pixel buffer.
 *  3. Rescale each channel to [0, 1] and apply the model's mean/std.
 *  4. Arrange the result in CHW order (channel-height-width) as required by
 *     PyTorch-exported ONNX models.
 *
 * @param imgEl  - The source image element (can be any natural size).
 * @param config - The model's segmentation configuration.
 * @returns      - The input tensor and the region of it covered by the image.
 */
export const preprocessImage = (
  imgEl: any,
  ort: Ort,
  config: SegmentationConfig
) => {
  const region = getMaskRegion(imgEl.naturalWidth, imgEl.naturalHeight, config)
  const W = region.inputWidth
  const H = region.inputHeight

  const canvas = (globalThis as any).document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!

  ctx.fillStyle = "black"
  ctx.fillRect(0, 0, W, H)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(imgEl, region.x, region.y, region.width, region.height)

  const { data } = ctx.getImageData(0, 0, W, H)
  const { mean, std } = config
  const plane = W * H
  const float32 = new Float32Array(3 * plane)

  for (let i = 0; i < plane; i++) {
    float32[i] = (data[i * 4] / 255 - mean[0]) / std[0]
    float32[plane + i] = (data[i * 4 + 1] / 255 - mean[1]) / std[1]
    float32[plane * 2 + i] = (data[i * 4 + 2] / 255 - mean[2]) / std[2]
  }

  return { tensor: new ort.Tensor("float32", float32, [1, 3, H, W]), region }
}

// ── Post-processing ───────────────────────────────────────────────────────────

const normalizeMask = (
  raw: ArrayLike<number>,
  output: MaskOutputType
): Float32Array => {
  const mask = new Float32Array(raw.length)

  if (output === "logits") {
    for (let i = 0; i < raw.length; i++) mask[i] = 1 / (1 + Math.exp(-raw[i]))
    return mask
  }

  if (output === "minmax") {
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] < min) min = raw[i]
      if (raw[i] > max) max = raw[i]
    }
    const range = max - min || 1
    for (let i = 0; i < raw.length; i++) mask[i] = (raw[i] - min) / range
    return mask
  }

  for (let i = 0; i < raw.length; i++) mask[i] = Math.min(1, Math.max(0, raw[i]))
  return mask
}

const bilinearAxis = (
  outSize: number,
  start: number,
  span: number,
  maskSize: number
) => {
  const i0 = new Int32Array(outSize)
  const i1 = new Int32Array(outSize)
  const frac = new Float32Array(outSize)
  const scale = span / outSize

  for (let i = 0; i < outSize; i++) {
    const pos = Math.min(
      maskSize - 1,
      Math.max(0, start + (i + 0.5) * scale - 0.5)
    )
    const lo = Math.floor(pos)
    i0[i] = lo
    i1[i] = Math.min(maskSize - 1, lo + 1)
    frac[i] = pos - lo
  }

  return { i0, i1, frac }
}

/**
 * Composites the model's foreground mask onto the original image as an alpha
 * channel, producing a transparent WebP Blob.
 *
 * Steps:
 *  1. Convert the raw output tensor (shape [1,1,H,W]) to a [0, 1] mask using
 *     the model's output type (probabilities, logits or min-max).
 *  2. Draw the original image on a canvas at its natural dimensions.
 *  3. For every pixel, bilinearly sample the mask inside the region that the
 *     image occupied in the model input and write it as the alpha byte.
 *  4. Export via `canvas.toBlob`.
 *
 * @param maskTensor - The raw output tensor from session.run().
 * @param imgEl      - The original source image used to recover natural dimensions
 *                     and pixel data.
 * @param config     - The model's segmentation configuration.
 * @param region     - The region returned by `preprocessImage`.
 * @returns          - A Promise resolving to a transparent Blob.
 */
export const applyMaskAsAlpha = (
  maskTensor: any,
  imgEl: any,
  config: SegmentationConfig,
  region: MaskRegion,
  quality: number = 0.9
): Promise<Blob> =>
  new Promise((resolve) => {
    const ow = imgEl.naturalWidth
    const oh = imgEl.naturalHeight

    const dims = maskTensor.dims as number[]
    const mH = Number(dims[dims.length - 2])
    const mW = Number(dims[dims.length - 1])
    const mask = normalizeMask(maskTensor.data, config.output)

    const sx = mW / region.inputWidth
    const sy = mH / region.inputHeight
    const cols = bilinearAxis(ow, region.x * sx, region.width * sx, mW)
    const rows = bilinearAxis(oh, region.y * sy, region.height * sy, mH)

    const origCanvas = (globalThis as any).document.createElement("canvas")
    origCanvas.width = ow
    origCanvas.height = oh
    const origCtx = origCanvas.getContext("2d")!
    origCtx.drawImage(imgEl, 0, 0)
    const origPx = origCtx.getImageData(0, 0, ow, oh)

    for (let y = 0; y < oh; y++) {
      const top = rows.i0[y] * mW
      const bottom = rows.i1[y] * mW
      const fy = rows.frac[y]

      for (let x = 0; x < ow; x++) {
        const x0 = cols.i0[x]
        const x1 = cols.i1[x]
        const fx = cols.frac[x]

        const upper = mask[top + x0] + (mask[top + x1] - mask[top + x0]) * fx
        const lower =
          mask[bottom + x0] + (mask[bottom + x1] - mask[bottom + x0]) * fx
        const value = upper + (lower - upper) * fy

        const i = (y * ow + x) * 4 + 3
        origPx.data[i] = Math.round(value * origPx.data[i])
      }
    }

    const outCanvas = (globalThis as any).document.createElement("canvas")
    outCanvas.width = ow
    outCanvas.height = oh
    outCanvas.getContext("2d")!.putImageData(origPx, 0, 0)
    // Use WebP for better compression with transparency
    outCanvas.toBlob((blob: any) => resolve(blob!), "image/webp", quality)
  })

/**
 * Prepares a tensor for Image-to-Image models (Upscaler, Colorizer).
 */
export const preprocessImageToImage = (
  imgEl: any,
  ort: Ort,
  size: number = 512,
  options: {
    keepAspectRatio?: boolean
    grayscale?: boolean
    useByteRange?: boolean
  } = {}
) => {
  const { keepAspectRatio = false, grayscale = false, useByteRange = false } =
    options

  let width = size
  let height = size
  let drawWidth = width
  let drawHeight = height
  let offsetX = 0
  let offsetY = 0

  if (keepAspectRatio) {
    const originalWidth = imgEl.naturalWidth
    const originalHeight = imgEl.naturalHeight
    const ratio = Math.min(size / originalWidth, size / originalHeight)

    drawWidth = Math.max(1, Math.round(originalWidth * ratio))
    drawHeight = Math.max(1, Math.round(originalHeight * ratio))
    offsetX = Math.round((width - drawWidth) / 2)
    offsetY = Math.round((height - drawHeight) / 2)
  }

  const canvas = (globalThis as any).document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!

  ctx.fillStyle = "black"
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(imgEl, offsetX, offsetY, drawWidth, drawHeight)

  const { data } = ctx.getImageData(0, 0, width, height)
  const float32 = new Float32Array(3 * width * height)

  for (let i = 0; i < width * height; i++) {
    let r = data[i * 4]
    let g = data[i * 4 + 1]
    let b = data[i * 4 + 2]

    if (grayscale) {
      // Standard luminance weights: 0.299R + 0.587G + 0.114B
      const gray = 0.299 * r + 0.587 * g + 0.114 * b
      r = g = b = gray
    }

    if (useByteRange) {
      float32[i] = r
      float32[width * height + i] = g
      float32[width * height * 2 + i] = b
      continue
    }

    float32[i] = r / 255
    float32[width * height + i] = g / 255
    float32[width * height * 2 + i] = b / 255
  }

  return new ort.Tensor("float32", float32, [1, 3, height, width])
}

/**
 * Converts a [1, 3, H, W] tensor back into a PNG Blob.
 */
export const tensorToImageData = (
  tensor: any,
  width: number,
  height: number,
  options: { valueMode?: "unit" | "byte"; quality?: number } = {}
): Promise<Blob> =>
  new Promise((resolve) => {
    const { valueMode = "unit", quality = 0.9 } = options
    const canvas = (globalThis as any).document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")!
    const imageData = ctx.createImageData(width, height)

    const data = tensor.data as Float32Array
    const size = width * height
    const scale = valueMode === "byte" ? 1 : 255

    for (let i = 0; i < size; i++) {
      imageData.data[i * 4] = Math.max(0, Math.min(255, data[i] * scale))
      imageData.data[i * 4 + 1] = Math.max(
        0,
        Math.min(255, data[size + i] * scale)
      )
      imageData.data[i * 4 + 2] = Math.max(
        0,
        Math.min(255, data[size * 2 + i] * scale)
      )
      imageData.data[i * 4 + 3] = 255
    }

    ctx.putImageData(imageData, 0, 0)
    // Use WebP for better compression
    canvas.toBlob((blob: any) => resolve(blob!), "image/webp", quality)
  })

/**
 * Reuses the model output as low-resolution chroma and keeps the original
 * image luminance/detail. This mirrors how other DeOldify integrations avoid
 * mushy results on non-square images.
 */
export const applyColorizerChromaToOriginal = (
  tensor: any,
  imgEl: any,
  quality: number = 0.9
): Promise<Blob> =>
  new Promise((resolve) => {
    const ow = imgEl.naturalWidth
    const oh = imgEl.naturalHeight

    const tH = Number(tensor.dims[2]) || oh
    const tW = Number(tensor.dims[3]) || ow

    const colorCanvas = (globalThis as any).document.createElement("canvas")
    colorCanvas.width = tW
    colorCanvas.height = tH
    const colorCtx = colorCanvas.getContext("2d")!
    const colorImageData = colorCtx.createImageData(tW, tH)
    const data = tensor.data as Float32Array
    const size = tW * tH

    for (let i = 0; i < size; i++) {
      colorImageData.data[i * 4] = Math.max(0, Math.min(255, data[i]))
      colorImageData.data[i * 4 + 1] = Math.max(
        0,
        Math.min(255, data[size + i])
      )
      colorImageData.data[i * 4 + 2] = Math.max(
        0,
        Math.min(255, data[size * 2 + i])
      )
      colorImageData.data[i * 4 + 3] = 255
    }
    colorCtx.putImageData(colorImageData, 0, 0)

    const outCanvas = (globalThis as any).document.createElement("canvas")
    outCanvas.width = ow
    outCanvas.height = oh
    const outCtx = outCanvas.getContext("2d")!
    const ratio = Math.min(tW / ow, tH / oh)
    const contentWidth = Math.max(1, Math.round(ow * ratio))
    const contentHeight = Math.max(1, Math.round(oh * ratio))
    const cropX = Math.max(0, Math.round((tW - contentWidth) / 2))
    const cropY = Math.max(0, Math.round((tH - contentHeight) / 2))

    const resizedColorCanvas = (globalThis as any).document.createElement(
      "canvas"
    )
    resizedColorCanvas.width = ow
    resizedColorCanvas.height = oh
    const resizedColorCtx = resizedColorCanvas.getContext("2d")!
    resizedColorCtx.imageSmoothingEnabled = true
      ; (resizedColorCtx as any).imageSmoothingQuality = "high"
    resizedColorCtx.drawImage(
      colorCanvas,
      cropX,
      cropY,
      contentWidth,
      contentHeight,
      0,
      0,
      ow,
      oh
    )

    // Slightly blur only the chroma source to reduce blockiness from 256x256 inference.
    const blurredColorCanvas = (globalThis as any).document.createElement(
      "canvas"
    )
    blurredColorCanvas.width = ow
    blurredColorCanvas.height = oh
    const blurredColorCtx = blurredColorCanvas.getContext("2d")!
    blurredColorCtx.filter = "blur(1.25px)"
    blurredColorCtx.drawImage(resizedColorCanvas, 0, 0)

    // Start from the original image so all fine luminance detail remains intact.
    outCtx.drawImage(imgEl, 0, 0, ow, oh)
    outCtx.globalCompositeOperation = "color"
    outCtx.drawImage(blurredColorCanvas, 0, 0, ow, oh)
    outCtx.globalCompositeOperation = "source-over"

    // Use WebP for better compression
    outCanvas.toBlob((blob: any) => resolve(blob!), "image/webp", quality)
  })
