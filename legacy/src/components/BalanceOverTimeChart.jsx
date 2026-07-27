import React from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

function BalanceOverTimeChart({ data }) {
  if (!data || data.length === 0) {
    return <p>Not enough data to display chart.</p>;
  }

  const data2 = [
    {
      name: "Page A",
      uv: 4000,
      pv: 2400,
      amt: 2400,
    },
    {
      name: "Page B",
      uv: 3000,
      pv: 1398,
      amt: 2210,
    },
    {
      name: "Page C",
      uv: 2000,
      pv: 9800,
      amt: 2290,
    },
    {
      name: "Page D",
      uv: 2780,
      pv: 3908,
      amt: 2000,
    },
    {
      name: "Page E",
      uv: 1890,
      pv: 4800,
      amt: 2181,
    },
    {
      name: "Page F",
      uv: 2390,
      pv: 3800,
      amt: 2500,
    },
    {
      name: "Page G",
      uv: 3490,
      pv: 4300,
      amt: 2100,
    },
  ];

  const data3 = [
    {
      name: "Page A",
      uv: 4000,
      pv: 2400,
      amt: 2400,
    },
    {
      name: "Page B",
      uv: 3000,
      pv: 1398,
      amt: 2210,
    },
    {
      name: "Page C",
      uv: 2000,
      pv: 9800,
      amt: 2290,
    },
    {
      name: "Page D",
      uv: 2780,
      pv: 3908,
      amt: 2000,
    },
    {
      name: "Page E",
      uv: 1890,
      pv: 4800,
      amt: 2181,
    },
    {
      name: "Page F",
      uv: 2390,
      pv: 3800,
      amt: 2500,
    },
    {
      name: "Page G",
      uv: 3490,
      pv: 4300,
      amt: 2100,
    },
    {
      name: "Page H",
      uv: 4200,
      pv: 2480,
      amt: 2480,
    },
    {
      name: "Page I",
      uv: 3400,
      pv: 1238,
      amt: 2516,
    },
    {
      name: "Page J",
      uv: 2100,
      pv: 10200,
      amt: 3200,
    },
    {
      name: "Page K",
      uv: 3080,
      pv: 3888,
      amt: 1900,
    },
    {
      name: "Page L",
      uv: 1000,
      pv: 6600,
      amt: 1081,
    },
    {
      name: "Page M",
      uv: 2990,
      pv: 3200,
      amt: 2490,
    },
    {
      name: "Page N",
      uv: 5000,
      pv: 4300,
      amt: 2100,
    },
  ];

  return (
    // ResponsiveContainer makes the chart fill its parent container.
    <ResponsiveContainer width="100%" height={400} className="BalanceChart">
      <AreaChart data={data3} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
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

export default BalanceOverTimeChart;
