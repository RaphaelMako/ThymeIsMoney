"use client";

import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  cumulativeOverSpan,
  cumulativeSeries,
  dailyOverSpan,
  merchantTotals,
  monthLabelShort,
  monthlyHistory,
  projectMonthEnd,
  type CategoryTxn,
} from "@/lib/categoryDetail";

export const SPEND_COLOR = "#85C3CE";
export const AVERAGE_COLOR = "#396E77";
export const BUDGET_COLOR = "#1B4C54";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const currency0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const tooltipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" };

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="flex h-full items-center justify-center text-sm text-zinc-400">{children}</p>;
}

/* --------------------------------------------------------------- Icons */

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-5 w-5",
};

export const ICONS = {
  bars: (
    <svg {...iconProps}>
      <path d="M6 20V11M12 20V5M18 20v-6" />
    </svg>
  ),
  cumulative: (
    <svg {...iconProps}>
      <path d="M4 19h16" />
      <path d="M4 15.5l4.5-4 3.5 2.5 6-7" />
      <path d="M15 7h3v3" />
    </svg>
  ),
  history: (
    <svg {...iconProps}>
      <path d="M3.5 9A9 9 0 1 1 3 12.5" />
      <path d="M3 5v4h4" />
      <path d="M12 8v4.5l3 1.5" />
    </svg>
  ),
  merchants: (
    <svg {...iconProps}>
      <path d="M4 6h13M4 12h9M4 18h5" />
    </svg>
  ),
  daily: (
    <svg {...iconProps}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M8 14h.01M12 14h.01M16 14h.01" />
    </svg>
  ),
  projection: (
    <svg {...iconProps}>
      <path d="M4 20a8 8 0 1 1 16 0" />
      <path d="M12 20l4.5-6" />
    </svg>
  ),
};

/* ---------------------------------------------------------------- Bars */

export function BarsView({
  spend,
  average,
  budget,
  months,
}: {
  spend: number;
  average: number;
  budget?: number;
  months: number;
}) {
  const series = [
    { key: "budget", label: months > 1 ? "Budget" : "Monthly Budget", value: budget ?? 0, color: BUDGET_COLOR },
    { key: "average", label: months > 1 ? "Expected" : "Monthly Average", value: average, color: AVERAGE_COLOR },
    { key: "spend", label: months > 1 ? "Actual Spend" : "Monthly Spend", value: spend, color: SPEND_COLOR },
  ]
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  const max = series[0]?.value ?? 0;
  if (max <= 0) return <Empty>No spending recorded in this range.</Empty>;

  const remaining = budget != null ? budget - spend : null;
  const averageGap = budget != null ? budget - average : null;
  const period = months > 1 ? `these ${months} months` : "this month";

  return (
    <div className="flex h-full flex-col gap-8 sm:flex-row">
      <div className="relative h-72 w-64 shrink-0 sm:h-full">
        {series.map((s, i) => {
          const pct = (s.value / max) * 100;
          return (
            <div key={s.key}>
              <div
                className="absolute bottom-0 w-full rounded-xl"
                style={{
                  height: `${pct}%`,
                  backgroundColor: s.color,
                  boxShadow: i > 0 ? "0 -3px 9px rgba(10, 35, 40, 0.5)" : undefined,
                }}
              />
              <span
                className="absolute left-0 right-0 px-4 text-base font-bold text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.45)]"
                style={{ bottom: `calc(${pct}% - 30px)` }}
              >
                {s.label} — {currency.format(s.value)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="max-w-md text-lg font-bold leading-relaxed text-zinc-800">
        {budget == null ? (
          <p>
            This category has no budget yet. You&apos;ve spent {currency.format(spend)} over{" "}
            {period}, against an expected {currency.format(average)}.
          </p>
        ) : (
          <p>
            On average you&apos;re spending{" "}
            <span className={averageGap! >= 0 ? "text-green-700" : "text-red-600"}>
              {currency.format(Math.abs(averageGap!))} {averageGap! >= 0 ? "below" : "above"}
            </span>{" "}
            your budget for {period}
            {averageGap! >= 0
              ? " — you're looking in good shape if you want to save a little more."
              : " — worth trimming if you can."}{" "}
            {remaining! >= 0 ? (
              <>
                Currently you still have {currency.format(remaining!)} available before you reach
                that budget.
              </>
            ) : (
              <>You&apos;re already {currency.format(Math.abs(remaining!))} over it.</>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- Cumulative */

/** Single month: actual so far against the average month's own trajectory. */
export function CumulativeMonthView({
  txns,
  todayIso,
  budget,
  priorMonthKeys,
}: {
  txns: CategoryTxn[];
  todayIso: string;
  budget?: number;
  priorMonthKeys: string[];
}) {
  const data = cumulativeSeries(txns, todayIso, priorMonthKeys);
  if (data.length === 0) return <Empty>Nothing to plot yet.</Empty>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 16, bottom: 4, left: 4 }}>
        <XAxis
          dataKey="day"
          tick={{ fontSize: 10, fill: "#71717a" }}
          axisLine={{ stroke: "#d4d4d8" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#71717a" }}
          axisLine={{ stroke: "#d4d4d8" }}
          tickLine={false}
          tickFormatter={(v) => currency0.format(Number(v))}
          width={58}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(d) => `Day ${d}`}
          formatter={(value, name) => [
            currency.format(Number(value)),
            name === "thisMonth" ? "This month" : "Average month",
          ]}
        />
        {budget != null && budget > 0 && (
          <ReferenceLine y={budget} stroke={BUDGET_COLOR} strokeWidth={2} />
        )}
        <Line
          type="monotone"
          dataKey="average"
          stroke={AVERAGE_COLOR}
          strokeWidth={2.5}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="thisMonth"
          stroke={SPEND_COLOR}
          strokeWidth={3}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Multi-month: actual running total against a straight expected pace. */
export function CumulativeSpanView({
  txns,
  dates,
  expectedTotal,
  budgetTotal,
}: {
  txns: CategoryTxn[];
  dates: string[];
  expectedTotal: number;
  budgetTotal?: number;
}) {
  if (dates.length === 0) return <Empty>Nothing to plot yet.</Empty>;
  const actual = cumulativeOverSpan(txns, dates);
  const data = actual.map((p, i) => ({
    ...p,
    expected: Math.round(((expectedTotal * (i + 1)) / dates.length) * 100) / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 16, bottom: 4, left: 4 }}>
        <XAxis
          dataKey="date"
          tickFormatter={dayLabel}
          tick={{ fontSize: 10, fill: "#71717a" }}
          axisLine={{ stroke: "#d4d4d8" }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#71717a" }}
          axisLine={{ stroke: "#d4d4d8" }}
          tickLine={false}
          tickFormatter={(v) => currency0.format(Number(v))}
          width={58}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(v) => dayLabel(String(v))}
          formatter={(value, name) => [
            currency.format(Number(value)),
            name === "spent" ? "Spent" : "Expected pace",
          ]}
        />
        {budgetTotal != null && budgetTotal > 0 && (
          <ReferenceLine y={budgetTotal} stroke={BUDGET_COLOR} strokeWidth={2} />
        )}
        <Line
          type="monotone"
          dataKey="expected"
          stroke={AVERAGE_COLOR}
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="spent"
          stroke={SPEND_COLOR}
          strokeWidth={3}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------- History */

export function HistoryView({
  txns,
  months,
  currentMonth,
  budget,
}: {
  txns: CategoryTxn[];
  months: string[];
  currentMonth: string;
  budget?: number;
}) {
  const data = monthlyHistory(txns, months).map((m) => ({
    ...m,
    label: monthLabelShort(m.month),
  }));
  if (data.every((d) => d.total === 0)) return <Empty>No history in this range.</Empty>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 16, bottom: 4, left: 4 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#71717a" }}
          axisLine={{ stroke: "#d4d4d8" }}
          tickLine={false}
          minTickGap={8}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#71717a" }}
          axisLine={{ stroke: "#d4d4d8" }}
          tickLine={false}
          tickFormatter={(v) => currency0.format(Number(v))}
          width={58}
        />
        <Tooltip
          cursor={{ fill: "rgba(133,195,206,0.15)" }}
          contentStyle={tooltipStyle}
          formatter={(value) => [currency.format(Number(value)), "Spent"]}
        />
        {budget != null && budget > 0 && (
          <ReferenceLine y={budget} stroke={BUDGET_COLOR} strokeDasharray="5 4" strokeWidth={2} />
        )}
        <Bar dataKey="total" radius={[6, 6, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.month} fill={d.month === currentMonth ? SPEND_COLOR : AVERAGE_COLOR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ----------------------------------------------------------- Merchants */

export function MerchantsView({ txns }: { txns: CategoryTxn[] }) {
  const merchants = merchantTotals(txns).slice(0, 12);
  if (merchants.length === 0) return <Empty>No transactions in this range.</Empty>;
  const max = merchants[0].total;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
      {merchants.map((m) => (
        <div key={m.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-bold text-zinc-800">{m.name}</span>
            <span className="shrink-0 text-zinc-500">
              {currency.format(m.total)}
              <span className="ml-2 text-xs text-zinc-400">
                {m.count} {m.count === 1 ? "visit" : "visits"}
              </span>
            </span>
          </div>
          <div className="h-3.5 w-full rounded-full bg-zinc-100">
            <div
              className="h-3.5 rounded-full"
              style={{ width: `${(m.total / max) * 100}%`, backgroundColor: SPEND_COLOR }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- Daily */

export function DailyView({ txns, dates }: { txns: CategoryTxn[]; dates: string[] }) {
  const data = dailyOverSpan(txns, dates);
  if (data.every((d) => d.total === 0)) return <Empty>No spending in this range.</Empty>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 16, bottom: 4, left: 4 }}>
        <XAxis
          dataKey="date"
          tickFormatter={dayLabel}
          tick={{ fontSize: 10, fill: "#71717a" }}
          axisLine={{ stroke: "#d4d4d8" }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#71717a" }}
          axisLine={{ stroke: "#d4d4d8" }}
          tickLine={false}
          tickFormatter={(v) => currency0.format(Number(v))}
          width={58}
        />
        <Tooltip
          cursor={{ fill: "rgba(133,195,206,0.15)" }}
          contentStyle={tooltipStyle}
          labelFormatter={(v) => dayLabel(String(v))}
          formatter={(value) => [currency.format(Number(value)), "Spent"]}
        />
        <Bar dataKey="total" fill={SPEND_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------------------------------------------------------- Projection */

export function ProjectionView({
  txns,
  todayIso,
  budget,
}: {
  txns: CategoryTxn[];
  todayIso: string;
  budget?: number;
}) {
  const { spent, projected, dayOfMonth, daysInMonth } = projectMonthEnd(txns, todayIso);
  const scale = Math.max(projected, budget ?? 0, spent) * 1.05 || 1;
  const over = budget != null && projected > budget;

  return (
    <div className="flex h-full flex-col justify-center gap-8">
      <div className="flex flex-wrap gap-x-14 gap-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Spent so far</p>
          <p className="text-4xl font-bold text-zinc-900">{currency.format(spent)}</p>
          <p className="text-xs text-zinc-500">
            day {dayOfMonth} of {daysInMonth}
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
            Projected month end
          </p>
          <p className={`text-4xl font-bold ${over ? "text-red-600" : "text-green-700"}`}>
            {currency.format(projected)}
          </p>
          <p className="text-xs text-zinc-500">at your current pace</p>
        </div>
        {budget != null && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Budget</p>
            <p className="text-4xl font-bold text-zinc-900">{currency.format(budget)}</p>
            <p className="text-xs text-zinc-500">
              {over
                ? `${currency.format(projected - budget)} over`
                : `${currency.format(budget - projected)} to spare`}
            </p>
          </div>
        )}
      </div>

      <div className="relative h-12 w-full overflow-hidden rounded-xl bg-zinc-100">
        <div
          className="absolute inset-y-0 left-0 rounded-xl"
          style={{ width: `${(projected / scale) * 100}%`, backgroundColor: AVERAGE_COLOR }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-xl"
          style={{ width: `${(spent / scale) * 100}%`, backgroundColor: SPEND_COLOR }}
        />
        {budget != null && budget > 0 && (
          <div
            className="absolute inset-y-0 w-0.5"
            style={{ left: `${(budget / scale) * 100}%`, backgroundColor: BUDGET_COLOR }}
          />
        )}
      </div>

      <p className="text-lg font-bold leading-relaxed text-zinc-800">
        {budget == null ? (
          <>
            At this pace you&apos;ll finish the month around {currency.format(projected)}. Set a
            budget for this category to track it against a target.
          </>
        ) : over ? (
          <>
            At this rate you&apos;ll finish at{" "}
            <span className="text-red-600">{currency.format(projected)}</span> against a{" "}
            {currency.format(budget)} budget — about {currency.format(projected - budget)} over.
          </>
        ) : (
          <>
            At this rate you&apos;ll finish at{" "}
            <span className="text-green-700">{currency.format(projected)}</span> against a{" "}
            {currency.format(budget)} budget — about {currency.format(budget - projected)} under.
          </>
        )}
      </p>
    </div>
  );
}
