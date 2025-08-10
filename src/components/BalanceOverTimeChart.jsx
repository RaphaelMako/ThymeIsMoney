import React from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

export default function BalanceOverTimeChart({ data }) {
  if (!data || data.length === 0) {
    return <p>Not enough data to display chart.</p>;
  }

  return (
    // ResponsiveContainer makes the chart fill its parent container.
    <ResponsiveContainer width="100%" height={400} className="BalanceChart">
      <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="10%" stopColor="#166767" stopOpacity={1} />
            <stop offset="95%" stopColor="#ffffff" stopOpacity={1} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="pv" fill="url(#colorPv)" strokeWidth={5} stroke="white" activeDot={{ r: 8 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
