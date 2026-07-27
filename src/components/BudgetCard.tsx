"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type BudgetGroupSummary = {
  group: "NEEDS" | "WANTS" | "SAVINGS";
  label: string;
  spent: number;
  allocated: number;
};

const COLORS: Record<BudgetGroupSummary["group"], string> = {
  NEEDS: "#366b7d",
  WANTS: "#5c7f46",
  SAVINGS: "#7c3f4e",
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function BudgetCard({ groups }: { groups: BudgetGroupSummary[] }) {
  const data = groups.filter((g) => g.spent > 0);

  return (
    <div className="grid items-center gap-10 md:grid-cols-2">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        {groups.map((g, i) => (
          <div
            key={g.group}
            className={`flex items-baseline justify-between py-4 ${
              i > 0 ? "border-t border-zinc-100" : ""
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: COLORS[g.group] }}
              />
              <span className="text-lg font-bold text-zinc-900">{g.label}</span>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-zinc-900">{currency.format(g.spent)}</p>
              <p className="text-xs text-zinc-500">of {currency.format(g.allocated)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="h-72">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-zinc-500">
            No spending yet this month.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                formatter={(value, name) => [currency.format(Number(value)), name]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Pie
                data={data}
                dataKey="spent"
                nameKey="label"
                innerRadius="55%"
                outerRadius="90%"
                paddingAngle={1}
                isAnimationActive={false}
              >
                {data.map((g) => (
                  <Cell key={g.group} fill={COLORS[g.group]} stroke="none" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
