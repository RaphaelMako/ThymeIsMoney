import type { CategoryRow } from "@/lib/insights";

const SERIES = [
  { key: "thisMonth", label: "This Month", color: "#bfdbdb" },
  { key: "monthlyAverage", label: "Monthly Average", color: "#4a7c7a" },
] as const;

export default function CategoryComparisonChart({ rows }: { rows: CategoryRow[] }) {
  if (rows.length === 0) return null;

  const max = Math.max(...rows.flatMap((r) => [r.thisMonth, r.monthlyAverage]));
  if (max <= 0) return null;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <h3 className="text-base font-bold text-zinc-900">Category Comparison</h3>
        <div className="flex flex-wrap items-center gap-4">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-zinc-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-2.5 overflow-x-auto pb-1">
        {rows.map((row) => {
          // Paint taller bars first so shorter ones sit in front
          const bars = SERIES.map((s) => ({ ...s, value: row[s.key] })).sort(
            (a, b) => b.value - a.value
          );
          return (
            <div
              key={row.category}
              className="relative h-44 w-7 shrink-0"
              title={`${row.label} — this month $${row.thisMonth.toFixed(2)}, average $${row.monthlyAverage.toFixed(2)}`}
            >
              {bars.map((bar) => (
                <div
                  key={bar.key}
                  className="absolute bottom-0 w-full rounded-full"
                  style={{
                    height: `${Math.max((bar.value / max) * 100, bar.value > 0 ? 8 : 0)}%`,
                    backgroundColor: bar.color,
                  }}
                />
              ))}
              <span
                className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium text-white [text-shadow:0_0_3px_rgba(0,0,0,0.35)] [writing-mode:vertical-rl] rotate-180"
              >
                {row.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
