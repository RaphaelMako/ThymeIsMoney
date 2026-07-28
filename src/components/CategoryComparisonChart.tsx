"use client";

import { useMemo, useState } from "react";
import type { CategoryRow } from "@/lib/insights";

export type ComparisonRow = CategoryRow & { monthlyBudget?: number };

type SeriesKey = "thisMonth" | "monthlyAverage" | "monthlyBudget";
type SortKey = "budgetUsage" | SeriesKey;
type Ticker = "nominal" | "percent";

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: "thisMonth", label: "This Month", color: "#85C3CE" },
  { key: "monthlyAverage", label: "Monthly Average", color: "#396E77" },
  { key: "monthlyBudget", label: "Monthly Budget", color: "#1B4C54" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "budgetUsage", label: "Budget usage" },
  { key: "thisMonth", label: "This month" },
  { key: "monthlyAverage", label: "Monthly average" },
  { key: "monthlyBudget", label: "Monthly budget" },
];

/**
 * The largest budget renders at this share of the chart height, leaving
 * headroom above it for categories that overspend.
 */
const BUDGET_BAND = 0.72;

/**
 * Floor for bar heights, as a share of the plot. Values are remapped into
 * [MIN_BAR_PCT, 100] so a small category still reads clearly instead of
 * collapsing into an unlabelable sliver.
 */
const MIN_BAR_PCT = 50;

/** Pixel height of the plot area (h-72), used to decide if a label fits inside its bar. */
const CHART_HEIGHT_PX = 288;

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function CategoryComparisonChart({ rows }: { rows: ComparisonRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("budgetUsage");
  const [ticker, setTicker] = useState<Ticker>("nominal");
  const [hovered, setHovered] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const withUsage = rows.map((r) => ({
      ...r,
      usage: r.monthlyBudget && r.monthlyBudget > 0 ? r.thisMonth / r.monthlyBudget : null,
    }));

    if (sortKey === "budgetUsage") {
      // Furthest under budget on the left, at-or-over budget on the right.
      // Categories with no budget can't be ranked, so they trail at the end.
      return withUsage.sort((a, b) => {
        if (a.usage === null && b.usage === null) return b.thisMonth - a.thisMonth;
        if (a.usage === null) return 1;
        if (b.usage === null) return -1;
        return a.usage - b.usage;
      });
    }
    return withUsage.sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));
  }, [rows, sortKey]);

  // Budget sets the scale; overspending grows past it up to the chart ceiling.
  const heightPct = useMemo(() => {
    const maxBudget = Math.max(0, ...rows.map((r) => r.monthlyBudget ?? 0));
    const maxAny = Math.max(
      1,
      ...rows.flatMap((r) => [r.thisMonth, r.monthlyAverage, r.monthlyBudget ?? 0])
    );
    const fullHeightValue = maxBudget > 0 ? maxBudget / BUDGET_BAND : maxAny;
    return (value: number) =>
      MIN_BAR_PCT + Math.min(value / fullHeightValue, 1) * (100 - MIN_BAR_PCT);
  }, [rows]);

  if (rows.length === 0) return null;

  const format = (value: number | undefined, budget: number | undefined) => {
    if (value == null || value === 0) return "—";
    if (ticker === "nominal") return currency.format(value);
    if (!budget) return "—";
    return `${Math.round((value / budget) * 100)}%`;
  };

  const active = sorted.find((r) => r.category === hovered) ?? null;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <h3 className="text-xl font-bold text-zinc-900">Category Comparison</h3>

        <div className="flex flex-wrap items-center gap-4">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-zinc-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            Sort
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-black"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center rounded-full bg-zinc-100 p-0.5">
            {(["nominal", "percent"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTicker(t)}
                title={t === "nominal" ? "Show dollar amounts" : "Show percent of budget"}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                  ticker === t ? "bg-thyme-800 text-white" : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {t === "nominal" ? "$" : "%"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex h-72 items-end gap-3 overflow-x-auto pb-1">
        {sorted.map((row) => {
          // Paint tallest first so shorter bars sit in front and cast onto them
          const bars = SERIES.map((s) => ({ ...s, value: row[s.key] ?? 0 }))
            .filter((b) => b.value > 0)
            .sort((a, b) => b.value - a.value);
          const fill = heightPct(bars[0]?.value ?? 0);
          // Rotated labels need roughly 6px per character; when the tallest
          // bar is too short to hold the name, sit it just above instead.
          const fitsInside = (fill / 100) * CHART_HEIGHT_PX >= row.label.length * 6.2 + 14;

          return (
            <div
              key={row.category}
              onMouseEnter={() => setHovered(row.category)}
              onMouseLeave={() => setHovered((h) => (h === row.category ? null : h))}
              className="relative h-full w-14 shrink-0 cursor-default"
            >
              {bars.map((bar, i) => (
                <div
                  key={bar.key}
                  className="absolute bottom-0 w-full rounded-lg transition-[height]"
                  style={{
                    height: `${heightPct(bar.value)}%`,
                    backgroundColor: bar.color,
                    // Shorter bars sit in front — cast onto the taller bar behind
                    boxShadow: i > 0 ? "0 -3px 9px rgba(10, 35, 40, 0.5)" : undefined,
                  }}
                />
              ))}
              {fitsInside ? (
                <span
                  className="absolute bottom-0 left-0 right-0 flex items-center justify-center rotate-180 whitespace-nowrap text-[11px] font-bold text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.5)] [writing-mode:vertical-rl]"
                  style={{ height: `${fill}%` }}
                >
                  {row.label}
                </span>
              ) : (
                <span
                  className="absolute left-0 right-0 flex justify-center rotate-180 whitespace-nowrap text-[11px] font-bold text-zinc-500 [writing-mode:vertical-rl]"
                  style={{ bottom: `calc(${fill}% + 6px)` }}
                >
                  {row.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {active ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-zinc-100 pt-3 text-sm">
          <span className="font-bold text-zinc-900">{active.label}</span>
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-zinc-600">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
              <span className="font-bold text-zinc-900">
                {format(active[s.key], active.monthlyBudget)}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-4 border-t border-zinc-100 pt-3 text-sm text-zinc-400">
          Hover a category to see its {ticker === "nominal" ? "amounts" : "percent of budget"}.
        </p>
      )}
    </div>
  );
}
