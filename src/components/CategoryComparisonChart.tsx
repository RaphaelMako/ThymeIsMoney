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
 * In dollars, the largest budget renders at this share of the plot; in
 * percent, this is where 100% of budget lands. Either way it leaves headroom
 * above for categories that overspend.
 */
const BUDGET_BAND = 0.72;

/**
 * Floor for a column's overall height in dollar mode, so a small category
 * never collapses into an unreadable sliver.
 */
const MIN_COLUMN_PCT = 50;

/** Hard floor for an individual bar, guarding against near-zero values vanishing. */
const MIN_BAR_PCT = 6;

/** Column geometry, in px — columns are placed by transform so they can slide. */
const COLUMN_W = 56;
const COLUMN_GAP = 12;

/** Pixel height of the plot area (h-72), used to decide if a label fits inside its bar. */
const CHART_HEIGHT_PX = 288;

const SLIDE = "transform 420ms cubic-bezier(0.22, 0.61, 0.36, 1), height 420ms cubic-bezier(0.22, 0.61, 0.36, 1)";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function CategoryComparisonChart({ rows }: { rows: ComparisonRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("budgetUsage");
  const [ticker, setTicker] = useState<Ticker>("nominal");
  const [hovered, setHovered] = useState<string | null>(null);

  const hasAnyBudget = rows.some((r) => (r.monthlyBudget ?? 0) > 0);
  const mode: Ticker = hasAnyBudget ? ticker : "nominal";

  const sorted = useMemo(() => {
    const withUsage = rows.map((r) => ({
      ...r,
      usage: r.monthlyBudget && r.monthlyBudget > 0 ? r.thisMonth / r.monthlyBudget : null,
    }));

    // Percent of budget is meaningless without one, so those drop out in % mode
    const visible =
      mode === "percent" ? withUsage.filter((r) => (r.monthlyBudget ?? 0) > 0) : withUsage;

    if (sortKey === "budgetUsage") {
      // Furthest under budget on the left, at-or-over budget on the right.
      // Categories with no budget can't be ranked, so they trail at the end.
      return visible.sort((a, b) => {
        if (a.usage === null && b.usage === null) return b.thisMonth - a.thisMonth;
        if (a.usage === null) return 1;
        if (b.usage === null) return -1;
        return a.usage - b.usage;
      });
    }

    // Value sorts follow the ticker: dollars in $ mode, share of budget in %
    const metric = (r: (typeof visible)[number]) => {
      const value = r[sortKey] ?? 0;
      if (mode === "nominal") return value;
      return r.monthlyBudget && r.monthlyBudget > 0 ? value / r.monthlyBudget : -1;
    };
    return visible.sort((a, b) => metric(b) - metric(a));
  }, [rows, sortKey, mode]);

  const barsFor = useMemo(() => {
    const maxBudget = Math.max(0, ...rows.map((r) => r.monthlyBudget ?? 0));
    const maxAny = Math.max(
      1,
      ...rows.flatMap((r) => [r.thisMonth, r.monthlyAverage, r.monthlyBudget ?? 0])
    );
    const fullHeightValue = maxBudget > 0 ? maxBudget / BUDGET_BAND : maxAny;

    return (row: ComparisonRow) => {
      // Paint tallest first so shorter bars sit in front and cast onto them
      const bars = SERIES.map((s) => ({ ...s, value: row[s.key] ?? 0 }))
        .filter((b) => b.value > 0)
        .sort((a, b) => b.value - a.value);

      if (mode === "percent") {
        // Every budget bar lands on the band, so a category spending 120% of a
        // small budget stands taller than one at 110% of a large budget.
        const budget = row.monthlyBudget ?? 0;
        return bars.map((b) => ({
          ...b,
          pct:
            budget > 0
              ? Math.max(Math.min((b.value / budget) * BUDGET_BAND, 1) * 100, MIN_BAR_PCT)
              : MIN_BAR_PCT,
        }));
      }

      // Dollars: the column sits on the global budget-relative scale with a
      // floor, then bars divide that height by their true ratio to the tallest
      // so the layered sections stay legible.
      const columnMax = bars[0]?.value ?? 0;
      const columnPct =
        MIN_COLUMN_PCT + Math.min(columnMax / fullHeightValue, 1) * (100 - MIN_COLUMN_PCT);
      return bars.map((b) => ({
        ...b,
        pct: columnMax > 0 ? Math.max((b.value / columnMax) * columnPct, MIN_BAR_PCT) : MIN_BAR_PCT,
      }));
    };
  }, [rows, mode]);

  // Columns keep a stable DOM order and are placed by transform, so a change
  // of sort or mode slides them instead of snapping to a new order.
  const positions = useMemo(
    () => new Map(sorted.map((r, i) => [r.category, i])),
    [sorted]
  );
  const stable = useMemo(
    () => [...sorted].sort((a, b) => a.category.localeCompare(b.category)),
    [sorted]
  );

  if (rows.length === 0) return null;

  const format = (value: number | undefined, budget: number | undefined) => {
    if (value == null || value === 0) return "—";
    if (mode === "nominal") return currency.format(value);
    if (!budget) return "—";
    return `${Math.round((value / budget) * 100)}%`;
  };

  const active = sorted.find((r) => r.category === hovered) ?? null;
  const hiddenCount = rows.length - sorted.length;

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
                disabled={t === "percent" && !hasAnyBudget}
                title={
                  t === "nominal"
                    ? "Size bars by dollar amount"
                    : hasAnyBudget
                      ? "Size bars by percent of budget"
                      : "Set up a budget to compare by percent"
                }
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors disabled:opacity-40 ${
                  mode === t ? "bg-thyme-800 text-white" : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {t === "nominal" ? "$" : "%"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div
          className="relative h-72"
          style={{ width: Math.max(sorted.length * (COLUMN_W + COLUMN_GAP) - COLUMN_GAP, 0) }}
        >
          {stable.map((row) => {
            const bars = barsFor(row);
            const fill = bars[0]?.pct ?? 0;
            // Rotated labels need roughly 6px per character; when the tallest
            // bar is too short to hold the name, sit it just above instead.
            const fitsInside = (fill / 100) * CHART_HEIGHT_PX >= row.label.length * 6.2 + 14;
            const index = positions.get(row.category) ?? 0;

            return (
              <div
                key={row.category}
                onMouseEnter={() => setHovered(row.category)}
                onMouseLeave={() => setHovered((h) => (h === row.category ? null : h))}
                className="absolute bottom-0 top-0 left-0 cursor-default"
                style={{
                  width: COLUMN_W,
                  transform: `translateX(${index * (COLUMN_W + COLUMN_GAP)}px)`,
                  transition: SLIDE,
                }}
              >
                {bars.map((bar, i) => (
                  <div
                    key={bar.key}
                    className="absolute bottom-0 w-full rounded-lg"
                    style={{
                      height: `${bar.pct}%`,
                      backgroundColor: bar.color,
                      transition: SLIDE,
                      // Shorter bars sit in front — cast onto the taller bar behind
                      boxShadow: i > 0 ? "0 -3px 9px rgba(10, 35, 40, 0.5)" : undefined,
                    }}
                  />
                ))}
                {fitsInside ? (
                  <span
                    className="absolute bottom-0 left-0 right-0 flex items-center justify-center rotate-180 whitespace-nowrap text-[11px] font-bold text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.5)] [writing-mode:vertical-rl]"
                    style={{ height: `${fill}%`, transition: SLIDE }}
                  >
                    {row.label}
                  </span>
                ) : (
                  <span
                    className="absolute left-0 right-0 flex justify-center rotate-180 whitespace-nowrap text-[11px] font-bold text-zinc-500 [writing-mode:vertical-rl]"
                    style={{ bottom: `calc(${fill}% + 6px)`, transition: SLIDE }}
                  >
                    {row.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
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
          Hover a category to see its {mode === "nominal" ? "amounts" : "percent of budget"}.
          {hiddenCount > 0 &&
            ` ${hiddenCount} ${hiddenCount === 1 ? "category has" : "categories have"} no budget and can't be shown as a percent.`}
        </p>
      )}
    </div>
  );
}
