"use client"

import { useEffect, useId, useState } from "react"
import { ArrowUpRight, X } from "lucide-react"

const KARBONIZED_URL =
  "https://karbonized.yoss.pro/?utm_source=removerized&utm_medium=banner"
const DISMISS_KEY = "karbonized-banner-dismissed"

const storage = () => (globalThis as any).localStorage

const KarbonizedLogo = ({ className }: { className?: string }) => {
  const maskId = useId()

  return (
    <svg viewBox="0 0 480.629 480.629" className={className} aria-hidden="true">
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x="-20"
          y="-20"
          width="521"
          height="521"
        >
          <rect
            fill="#fff"
            x="37.88"
            y="37.88"
            width="404.88"
            height="404.88"
            rx="111"
            transform="rotate(45 240.3145 240.3145)"
          />
          <path
            fill="#000"
            transform="translate(240.3145 246) scale(0.95) translate(-240.3145 -246)"
            d="M95.956 314.452C92.0398 305.032 85.0647 279.618 107.815 251.82C136.587 216.661 164.15 192.428 173.317 173.816C179.552 161.159 177.306 137.734 175.231 124.042C174.329 118.091 177.38 116.019 182.26 119.543C199.436 131.951 236.438 160.955 248.82 188.693C265.151 225.28 265.094 239.108 225.82 302.319C206.534 333.36 231.024 368.204 250.41 395.785C259.861 409.232 268.099 420.953 269.46 429.665L265.771 433.355C251.71 447.416 228.92 447.416 214.859 433.355Z"
          />
        </mask>
      </defs>
      <rect
        x="-20"
        y="-20"
        width="521"
        height="521"
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  )
}

export const KarbonizedBanner = () => {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      setShow(storage().getItem(DISMISS_KEY) !== "1")
    } catch {
      setShow(true)
    }
  }, [])

  const dismiss = () => {
    setShow(false)
    try {
      storage().setItem(DISMISS_KEY, "1")
    } catch {}
  }

  if (!show) return null

  return (
    <div className="group relative shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#141213]">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide Karbonized banner"
        className="absolute right-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-black/40 text-white/60 backdrop-blur transition-colors hover:bg-black/60 hover:text-white"
      >
        <X className="size-3.5" />
      </button>

      <a
        href={KARBONIZED_URL}
        target="_blank"
        rel="noopener"
        className="flex flex-col focus-visible:outline-none"
      >
        {/* Mini canvas preview */}
        <div className="relative h-[88px] overflow-hidden bg-gradient-to-br from-[#fda4af] via-[#f43f5e] to-[#c026d3] p-3">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(253,230,138,0.45),transparent_55%)]" />
          <div className="relative flex h-full rotate-[-4deg] flex-col justify-center gap-1 rounded-lg bg-[#1c1b1b] px-3 py-2 shadow-[0_10px_24px_rgba(28,27,27,0.45)] transition-transform duration-500 group-hover:-rotate-2 group-hover:scale-[1.03]">
            <span className="font-mono text-[7px] tracking-[0.18em] text-[#fb7185]">
              KARBONIZED 2.0
            </span>
            <span className="text-[11px] font-bold leading-tight text-white">
              Design posts that ship.
            </span>
            <span className="truncate rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[7px] text-white/55">
              await post.export({"{"} scale: 2 {"}"})
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 p-3.5">
          <div className="flex items-center gap-1.5 text-white">
            <KarbonizedLogo className="size-4 shrink-0" />
            <span className="text-[0.8rem] font-bold tracking-tight">
              Karbonized
            </span>
          </div>

          <p className="text-[0.95rem] font-bold leading-tight tracking-tight text-white">
            The <span className="text-[#fb7185]">programmable</span> image
            editor.
          </p>

          <p className="text-[0.68rem] leading-relaxed text-white/45">
            Social posts, code shots and mockups with blocks, code or your AI
            agent.
          </p>

          <span className="mt-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#f43f5e] px-3 py-2 text-[0.72rem] font-bold text-white transition-colors group-hover:bg-[#e11d48]">
            Try it free
            <ArrowUpRight className="size-3.5" />
          </span>

          <p className="text-center text-[0.6rem] text-white/30">
            Free &amp; open source &middot; karbonized.yoss.pro
          </p>
        </div>
      </a>
    </div>
  )
}
