import { Metadata } from "next"
import { WifiOff } from "lucide-react"

import { Icons } from "@/components/icons"

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
}

export default function OfflinePage() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#050505] px-6">
      <div className="flex max-w-sm flex-col items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl backdrop-blur-2xl">
        <Icons.logo className="size-10 text-[#A855F7]" />
        <div className="flex size-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
          <WifiOff className="size-5 text-white/60" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-lg font-semibold text-white">You are offline</h1>
          <p className="text-sm text-white/50">
            This page is not available without a connection. Pages and models
            you have already opened keep working offline.
          </p>
        </div>
        <a
          href="/removerized"
          className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
        >
          Try again
        </a>
      </div>
    </div>
  )
}
