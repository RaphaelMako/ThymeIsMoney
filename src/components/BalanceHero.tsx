"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type TxnPoint = { date: string; amount: number };
type Range = "weekly" | "monthly" | "ytd" | "all";

const RANGES: { key: Range; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "All Time" },
];

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function startOfRange(range: Range, transactions: TxnPoint[]): Date {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  switch (range) {
    case "weekly":
      start.setDate(start.getDate() - 6);
      return start;
    case "monthly":
      start.setDate(start.getDate() - 29);
      return start;
    case "ytd":
      return new Date(now.getFullYear(), 0, 1);
    case "all": {
      if (transactions.length === 0) {
        start.setDate(start.getDate() - 29);
        return start;
      }
      const earliest = transactions.reduce(
        (min, t) => (t.date < min ? t.date : min),
        transactions[0].date
      );
      return new Date(earliest);
    }
  }
}

/**
 * Reconstruct the daily net-worth series backwards from today.
 * Plaid convention: positive amount = money out, so walking back in
 * time means adding amounts back on.
 */
function buildSeries(netWorth: number, transactions: TxnPoint[], range: Range) {
  const start = startOfRange(range, transactions);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: Date[] = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  // Keep the chart light: cap at ~120 points by striding longer ranges
  const stride = Math.max(1, Math.ceil(days.length / 120));
  const sampled = days.filter((_, i) => i % stride === 0 || i === days.length - 1);

  return sampled.map((day) => {
    const dayIso = day.toISOString().slice(0, 10);
    const laterOutflow = transactions.reduce(
      (sum, t) => (t.date > dayIso ? sum + t.amount : sum),
      0
    );
    return {
      date: dayIso,
      balance: Math.round((netWorth + laterOutflow) * 100) / 100,
    };
  });
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { date: string; balance: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const label = new Date(`${point.date}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="rounded-lg bg-white/95 px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-thyme-900">{currency.format(point.balance)}</p>
      <p className="text-zinc-500">{label}</p>
    </div>
  );
}

export default function BalanceHero({
  name,
  netWorth,
  transactions,
}: {
  name: string;
  netWorth: number;
  transactions: TxnPoint[];
}) {
  const [range, setRange] = useState<Range>("monthly");
  const series = useMemo(() => buildSeries(netWorth, transactions, range), [netWorth, transactions, range]);

  // Pad the y-domain: room below so the line never touches the chart floor
  // (the gradient needs space to finish fading to white), and slight
  // headroom above so the stroke never clips the chart's top edge.
  const [domainLo, domainHi] = useMemo(() => {
    const values = series.map((p) => p.balance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || Math.abs(min) || 1;
    return [min - span * 0.15, max + span * 0.05];
  }, [series]);

  return (
    <section className="flex h-[90vh] min-h-[560px] flex-col">
      {/* True inner shadow for the hero text: invert the glyph alpha, blur
          and push it down, tint it, keep only the part inside the glyphs,
          and draw it over the original text. Applied via .text-inset. */}
      <svg aria-hidden="true" className="absolute h-0 w-0">
        <defs>
          <filter id="textInnerShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feComponentTransfer in="SourceAlpha" result="invAlpha">
              <feFuncA type="table" tableValues="1 0" />
            </feComponentTransfer>
            <feGaussianBlur in="invAlpha" stdDeviation="4" result="blur" />
            <feOffset in="blur" dy="4" result="offsetBlur" />
            <feFlood floodColor="#03211f" floodOpacity="0.55" result="color" />
            <feComposite in="color" in2="offsetBlur" operator="in" result="shadowShape" />
            <feComposite in="shadowShape" in2="SourceAlpha" operator="in" result="innerShadow" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="innerShadow" />
            </feMerge>
          </filter>
        </defs>
      </svg>
      <div className="flex min-h-0 flex-1 flex-col bg-thyme-900">
        <div className="mx-auto w-[85%] pt-14">
          <h1 className="text-inset text-4xl font-extrabold md:text-5xl">
            {greeting()} {name}
          </h1>
          <p className="text-inset mt-4 text-7xl font-extrabold tracking-tight md:text-8xl">
            {currency.format(netWorth)}
          </p>
          <p className="mt-2 text-base text-thyme-200">Across all accounts.</p>
        </div>
        {/*
          The gradient is painted on the chart's background, anchored to the
          container: pure white at the bottom, heading toward #166767 at the
          top. The Area then fills the region ABOVE the line with the solid
          hero color, so the background gradient only shows through below
          the line — reaching exactly as far toward #166767 as the line is
          high at any given point.
        */}
        <div
          className="hero-chart mt-6 min-h-0 w-full flex-1"
          style={{ background: "linear-gradient(to top, #ffffff 0%, #166767 100%)" }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                {/* Emits only the outer shadow of the below-line shape: blur its
                    silhouette, push it upward, tint it, then cut away the part
                    overlapping the shape itself. */}
                <filter id="heroLineShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur" />
                  <feOffset in="blur" dy="-3" result="offsetBlur" />
                  <feFlood floodColor="#082222" floodOpacity="0.6" result="color" />
                  <feComposite in="color" in2="offsetBlur" operator="in" result="shadow" />
                  <feComposite in="shadow" in2="SourceAlpha" operator="out" />
                </filter>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={[domainLo, domainHi]} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#ffffff55" }} />
              {/* Solid header color above the line */}
              <Area
                type="monotone"
                dataKey="balance"
                baseValue={domainHi}
                stroke="none"
                fill="#396e77"
                fillOpacity={1}
                isAnimationActive={false}
              />
              {/* Below-line mass, rendered as shadow only */}
              <Area
                type="monotone"
                dataKey="balance"
                baseValue={domainLo}
                stroke="none"
                fill="#000000"
                fillOpacity={1}
                className="hero-shadow-area"
                isAnimationActive={false}
              />
              {/* Crisp line on top of the shadow */}
              <Area
                type="monotone"
                dataKey="balance"
                baseValue={domainLo}
                stroke="#ffffff"
                strokeWidth={2.5}
                fillOpacity={0}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="h-10 shrink-0 bg-gradient-to-b from-white to-[#fafafa]" />

      <div className="flex flex-wrap items-center justify-center gap-4 pb-6">
        {RANGES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setRange(key)}
            className={`rounded-full px-6 py-2 text-base font-bold text-white transition-colors ${
              range === key
                ? "bg-thyme-950 ring-2 ring-thyme-950/30"
                : "bg-thyme-800 hover:bg-thyme-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
