import { KarbonizedBanner } from "@/components/ads/karbonized-banner"
import { Icons } from "@/components/icons"

import { SEO_CONTENT, TOOL_ACCENTS } from "../../constants"
import type { ActiveTool } from "../../types"

interface EditorLeftPanelProps {
  activeTool: ActiveTool
  accentColor: string
}

export const EditorLeftPanel = ({
  activeTool,
  accentColor,
}: EditorLeftPanelProps) => {
  const content = SEO_CONTENT[activeTool]

  return (
    <div className="glass-panel flex h-full flex-col border-r border-white/[0.06] px-6 py-7">
      <div className="-mr-2 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-2">
        {/* Brand */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <Icons.logo
            className="size-6 shrink-0"
            style={{ color: accentColor }}
          />
          <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-white/35">
            Removerized
          </span>
        </div>

        {/* Accent divider */}
        <div
          className="h-px w-full flex-shrink-0 rounded-full"
          style={{
            background: `linear-gradient(to right, ${accentColor}70, ${accentColor}10, transparent)`,
          }}
        />

        {/* Dynamic SEO content */}
        <section className="flex flex-col gap-3 flex-shrink-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors duration-500"
            style={{ color: accentColor }}
          >
            {content.subheading}
          </p>

          <h1 className="text-[1.35rem] font-bold leading-snug tracking-tight text-white">
            {content.heading}
          </h1>

          <p className="text-[0.8rem] leading-relaxed text-white/40">
            {content.body}
          </p>
        </section>

        {/* Feature list */}
        <ul className="flex flex-col gap-2.5">
          {content.features.map((feature) => (
            <li key={feature} className="flex items-center gap-2.5">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: accentColor,
                  boxShadow: `0 0 6px ${accentColor}`,
                }}
              />
              <span className="text-[0.75rem] text-white/50">{feature}</span>
            </li>
          ))}
        </ul>

        {/* Karbonized promo */}
        <div className="mt-auto flex-shrink-0">
          <KarbonizedBanner />
        </div>

        {/* Glow card */}
        <div
          className="rounded-xl border p-4 flex-shrink-0"
          style={{
            borderColor: `${accentColor}25`,
            background: `linear-gradient(135deg, ${accentColor}08, transparent)`,
          }}
        >
          <p
            className="text-[0.7rem] font-semibold uppercase tracking-widest mb-1"
            style={{ color: accentColor }}
          >
            Privacy First
          </p>
          <p className="text-[0.7rem] leading-relaxed text-white/35">
            All processing happens locally in your browser. No image ever leaves
            your device.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-5 flex-shrink-0 border-t border-white/[0.06] pt-4">
        <p className="text-[0.65rem] leading-relaxed text-white/20">
          100% client-side &middot; No data collected &middot; Works offline
        </p>
      </div>
    </div>
  )
}
