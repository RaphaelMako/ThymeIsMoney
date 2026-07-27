import type { Bubble } from "@/lib/insights";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function CategoryBubbles({ bubbles }: { bubbles: Bubble[] }) {
  if (bubbles.length === 0) return null;

  return (
    <div className="flex flex-wrap items-end justify-center gap-5">
      {bubbles.map((b) => {
        const over = b.direction === "over";
        // Outer bubble grows with how far spending deviates from typical
        const deviation = over ? b.ratio : 1 / Math.max(b.ratio, 0.05);
        const outer = Math.round(clamp(72 + deviation * 18, 80, 132));
        // Inner disc: share of typical spending used (small = far off usual)
        const innerScale = clamp(over ? 1 / b.ratio : b.ratio, 0.18, 0.78);
        const inner = Math.round(outer * innerScale);
        const pct = Math.round(Math.abs(b.ratio - 1) * 100);

        return (
          <figure key={b.category} className="flex flex-col items-center gap-2">
            <div
              title={`${b.label}: ${pct}% ${over ? "over" : "under"} usual`}
              className="flex items-center justify-center rounded-full"
              style={{
                width: outer,
                height: outer,
                backgroundColor: over ? "#a85d63" : "#6f8f6d",
              }}
            >
              <div
                className="rounded-full"
                style={{
                  width: inner,
                  height: inner,
                  backgroundColor: over ? "#7e363c" : "#84c17b",
                  boxShadow: over
                    ? "inset 0 5px 10px rgba(30, 5, 8, 0.55)"
                    : "0 5px 10px rgba(20, 40, 18, 0.35)",
                }}
              />
            </div>
            <figcaption className="text-xs font-medium text-zinc-600">{b.label}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}
