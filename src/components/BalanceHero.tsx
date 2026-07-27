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
      <p className="font-semibold text-teal-900">{currency.format(point.balance)}</p>
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

  return (
    <section>
      <div className="bg-teal-900 pt-10 text-white">
        <div className="mx-auto w-full max-w-3xl px-6">
          <h1 className="text-2xl font-bold">
            {greeting()} {name}
          </h1>
          <p className="mt-3 text-5xl font-bold tracking-tight">{currency.format(netWorth)}</p>
          <p className="mt-2 text-xs text-teal-200">Across all accounts.</p>
        </div>
        <div className="mt-6 h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity={0.25} />
                  <stop offset="55%" stopColor="#f4f8f8" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#fafafa" stopOpacity={0.97} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#ffffff55" }} />
              <Area
                type="monotone"
                dataKey="balance"
                baseValue="dataMin"
                stroke="#ffffff"
                strokeWidth={2}
                fill="url(#balanceGradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-wrap justify-center gap-3 px-6 py-5">
        {RANGES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setRange(key)}
            className={`rounded-full px-5 py-1.5 text-sm font-medium text-white transition-colors ${
              range === key
                ? "bg-teal-950 ring-2 ring-teal-950/30"
                : "bg-teal-800 hover:bg-teal-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
