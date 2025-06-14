import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

function BalanceOverTimeChart({ data }) {
  if (!data || data.length === 0) {
    return <p>Not enough data to display chart.</p>;
  }

  return (
    // ResponsiveContainer makes the chart fill its parent container.
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip formatter={(value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)} />
        <Legend />
        <Line type="monotone" dataKey="balance" stroke="#8884d8" activeDot={{ r: 8 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default BalanceOverTimeChart;
