"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { WeeklyComparison } from "@/lib/insights";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function SpendingInsightCard({ comparison }: { comparison: WeeklyComparison }) {
  const { points, diff } = comparison;
  const less = diff >= 0;

  return (
    <div className="flex flex-col justify-between gap-2">
      <p className="text-xl font-bold leading-snug text-zinc-900">
        You&apos;re spending{" "}
        <span className={less ? "text-green-700" : "text-red-600"}>
          {currency.format(Math.abs(diff))} {less ? "less" : "more"}
        </span>{" "}
        than usual
      </p>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 8, fill: "#71717a" }}
              angle={-45}
              height={28}
              tickMargin={8}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <Tooltip
              formatter={(value, name) => [
                currency.format(Number(value)),
                name === "current" ? "This week" : "Usual",
              ]}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey="usual"
              stroke="#a7d3a6"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="current"
              stroke="#1e3a5f"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
