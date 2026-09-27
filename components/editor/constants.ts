import type { ActiveTool, ModelKey, UpscalerModelKey } from "./types"

export const MODELS: Record<
  ModelKey,
  {
    tool: ActiveTool
    url: string
    hfUrl: string
    cacheKey: string
    label: string
    title: string
    description: string
    size: string
    author: string
    license: string
    inputType: string
  }
> = {
  ormbg_quantized: {
    tool: "remover",
    url: "https://huggingface.co/onnx-community/ormbg-ONNX/resolve/main/onnx/model_quantized.onnx",
    hfUrl: "https://huggingface.co/onnx-community/ormbg-ONNX",
    cacheKey: "ormbg_quantized_v1",
    label: "ORMBG (Quantized)",
    title: "ORMBG — Object Removal from Background",
    description: "Balanced for web performance and speed",
    size: "~44 MB",
    author: "ONNX Community",
    license: "Apache-2.0",
    inputType: "pixel_values",
  },
  ormbg_fp16: {
    tool: "remover",
    url: "https://huggingface.co/onnx-community/ormbg-ONNX/resolve/main/onnx/model_fp16.onnx",
    hfUrl: "https://huggingface.co/onnx-community/ormbg-ONNX",
    cacheKey: "ormbg_fp16_v1",
    label: "ORMBG (FP16)",
    title: "ORMBG — Object Removal from Background",
    description: "Higher precision for complex edges",
    size: "~88 MB",
    author: "ONNX Community",
    license: "Apache-2.0",
    inputType: "pixel_values",
  },
  isnet_quantized: {
    tool: "remover",
    url: "https://huggingface.co/onnx-community/ISNet-ONNX/resolve/main/onnx/model_quantized.onnx",
    hfUrl: "https://huggingface.co/onnx-community/ISNet-ONNX",
    cacheKey: "isnet_quantized_v1",
    label: "ISNet (Quantized)",
    title: "ISNet — Highly Accurate Dichotomous Image Segmentation",
    description: "Excellent silhouette definition, low weight",
    size: "~44 MB",
    author: "ONNX Community",
    license: "AGPL-3.0",
    inputType: "input",
  },
  isnet_fp16: {
    tool: "remover",
    url: "https://huggingface.co/onnx-community/ISNet-ONNX/resolve/main/onnx/model_fp16.onnx",
    hfUrl: "https://huggingface.co/onnx-community/ISNet-ONNX",
    cacheKey: "isnet_fp16_v1",
    label: "ISNet (FP16)",
    title: "ISNet — Highly Accurate Dichotomous Image Segmentation",
    description: "High quality silhouette without edge artifacts",
    size: "~88 MB",
    author: "ONNX Community",
    license: "AGPL-3.0",
    inputType: "input",
  },
  birefnet_lite: {
    tool: "remover",
    url: "https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model.onnx",
    hfUrl: "https://huggingface.co/onnx-community/BiRefNet_lite-ONNX",
    cacheKey: "birefnet_lite_v1",
    label: "BiRefNet v2 Lite (FP32)",
    title: "BiRefNet v2 Lite — Bilateral Reference Image Segmentation",
    description: "Standard precision without fidelity loss. Best when precision is more important than speed.",
    size: "224 MB",
    author: "ONNX Community",
    license: "MIT",
    inputType: "input_image",
  },
  birefnet_lite_fp16: {
    tool: "remover",
    url: "https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model_fp16.onnx",
    hfUrl: "https://huggingface.co/onnx-community/BiRefNet_lite-ONNX",
    cacheKey: "birefnet_lite_fp16_v2",
    label: "BiRefNet Lite (FP16)",
    title: "BiRefNet Lite — Bilateral Reference Image Segmentation",
    description: "Half precision with 50% less memory usage. Faster inference on modern GPUs and mobile processors.",
    size: "~115 MB",
    author: "ONNX Community",
    license: "MIT",
    inputType: "input_image",
  },
  rmbg_1_4_quantized: {
    tool: "remover",
    url: "https://huggingface.co/Xenova/bria-rmbg-1.4/resolve/main/onnx/model_quantized.onnx",
    hfUrl: "https://huggingface.co/Xenova/bria-rmbg-1.4",
    cacheKey: "rmbg_1_4_quantized_v1",
    label: "RMBG 1.4 (Quantized)",
    title: "BRIA RMBG 1.4 — Background Removal by BRIA AI",
    description: "Solid general purpose background removal",
    size: "~44 MB",
    author: "Xenova / BRIA AI",
    license: "Non-Commercial",
    inputType: "pixel_values",
  },
  rmbg_1_4_fp16: {
    tool: "remover",
    url: "https://huggingface.co/Xenova/bria-rmbg-1.4/resolve/main/onnx/model_fp16.onnx",
    hfUrl: "https://huggingface.co/Xenova/bria-rmbg-1.4",
    cacheKey: "rmbg_1_4_fp16_v1",
    label: "RMBG 1.4 (FP16)",
    title: "BRIA RMBG 1.4 — Background Removal by BRIA AI",
    description: "Better handling of transparent objects",
    size: "~88 MB",
    author: "Xenova / BRIA AI",
    license: "Non-Commercial",
    inputType: "pixel_values",
  },
  modnet_quantized: {
    tool: "remover",
    url: "https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_quantized.onnx",
    hfUrl: "https://huggingface.co/Xenova/modnet",
    cacheKey: "modnet_quantized_v1",
    label: "MODNet (Quantized)",
    title: "MODNet — Trimap-Free Portrait Matting",
    description: "Ultra-fast and lightweight, good for mobile",
    size: "~25 MB",
    author: "Xenova / ZHKKKe",
    license: "Apache-2.0",
    inputType: "pixel_values",
  },
  swin2sr_quantized: {
    tool: "upscaler",
    url: "https://huggingface.co/onnx-community/swin2SR-realworld-sr-x4-64-bsrgan-psnr-ONNX/resolve/main/onnx/model_quantized.onnx",
    hfUrl: "https://huggingface.co/onnx-community/swin2SR-realworld-sr-x4-64-bsrgan-psnr-ONNX",
    cacheKey: "swin2sr_quantized_v1",
    label: "Swin2SR x4 (Quantized)",
    title: "Swin2SR — Image Super-Resolution",
    description: "High-quality 4x upscaling",
    size: "~18 MB",
    author: "ONNX Community",
    license: "Apache-2.0",
    inputType: "pixel_values",
  },
  swin2sr_fp16: {
    tool: "upscaler",
    url: "https://huggingface.co/onnx-community/swin2SR-realworld-sr-x4-64-bsrgan-psnr-ONNX/resolve/main/onnx/model_fp16.onnx",
    hfUrl: "https://huggingface.co/onnx-community/swin2SR-realworld-sr-x4-64-bsrgan-psnr-ONNX",
    cacheKey: "swin2sr_fp16_v1",
    label: "Swin2SR x4 (FP16)",
    title: "Swin2SR — Image Super-Resolution",
    description: "Maximum precision 4x upscaling",
    size: "~36 MB",
    author: "ONNX Community",
    license: "Apache-2.0",
    inputType: "pixel_values",
  },
  deoldify_artistic_quantized: {
    tool: "colorizer",
    url: "https://huggingface.co/thookham/DeOldify-on-Browser/resolve/main/deoldify-quant.onnx",
    hfUrl: "https://huggingface.co/thookham/DeOldify-on-Browser",
    cacheKey: "deoldify_artistic_quantized_v2",
    label: "DeOldify Artistic (Quantized)",
    title: "DeOldify — AI Image Colorization",
    description: "Vibrant colors for old photos",
    size: "~61 MB",
    author: "Jason Antic / Travis Hookham",
    license: "MIT",
    inputType: "input",
  },
  deoldify_artistic_fp16: {
    tool: "colorizer",
    url: "https://huggingface.co/thookham/DeOldify-on-Browser/resolve/main/deoldify-art.onnx",
    hfUrl: "https://huggingface.co/thookham/DeOldify-on-Browser",
    cacheKey: "deoldify_artistic_fp16_v2",
    label: "DeOldify Artistic (FP16)",
    title: "DeOldify — AI Image Colorization",
    description: "Highest quality artistic colorization",
    size: "~243 MB",
    author: "Jason Antic / Travis Hookham",
    license: "MIT",
    inputType: "input",
  },
}

export const UPSCALER_MODELS: Record<
  UpscalerModelKey,
  {
    label: string
    description: string
    patchSize: number
    padding: number
    detail: string
  }
> = {
  performance: {
    label: "Performance",
    description: "Fastest processing, lower memory usage",
    patchSize: 32,
    padding: 1,
    detail: "patch 32 · pad 1",
  },
  balanced: {
    label: "Balanced",
    description: "Best speed/quality tradeoff",
    patchSize: 64,
    padding: 2,
    detail: "patch 64 · pad 2",
  },
  quality: {
    label: "Quality",
    description: "Maximum detail, slower processing",
    patchSize: 128,
    padding: 4,
    detail: "patch 128 · pad 4",
  },
}

export const TOOL_ACCENTS: Record<ActiveTool, string> = {
  remover: "#A855F7",
  upscaler: "#3B82F6",
  colorizer: "#F59E0B",
}

export const SEO_CONTENT: Record<
  ActiveTool,
  { heading: string; subheading: string; body: string; features: string[] }
> = {
  remover: {
    heading: "AI Background Removal",
    subheading: "Instant & Private",
    body: "Remove backgrounds from any image with on-device AI. No uploads, no server, fully offline-capable.",
    features: [
      "100% Client-Side",
      "WebAssembly Accelerated",
      "Transparent PNG Output",
      "Batch Processing",
    ],
  },
  upscaler: {
    heading: "AI Image Upscaler",
    subheading: "Enhance Resolution",
    body: "Super-resolution AI upscales images up to 4× with on-device AI — zero cloud dependency.",
    features: [
      "4× Super Resolution",
      "WASM Accelerated",
      "Edge-Preserving Detail",
      "Works Offline",
    ],
  },
  colorizer: {
    heading: "AI Image Colorizer",
    subheading: "Restore Old Photos",
    body: "Colorize black and white or sepia photographs instantly with AI. Professional results, locally processed.",
    features: [
      "Deep Learning Colorization",
      "One-Click Restoration",
      "Private & Secure",
      "High Resolution Output",
    ],
  },
}

export const IDB_NAME = "RemoverizerModelDB"

export const IDB_STORE = "models"

export const IDB_VERSION = 1

export const INFERENCE_SIZE = 1024

export const getWasmCdnBase = (version: string) =>
  `https://cdn.jsdelivr.net/npm/onnxruntime-web@${version}/dist/`
