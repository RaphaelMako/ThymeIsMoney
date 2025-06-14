import React, { useState, useEffect } from "react";
import { calculateTotalBalance, calculateDailyBalance } from "../utils/dataProcessor";
import BalanceOverTimeChart from "./BalanceOverTimeChart";

function Dashboard({ balance, transactions }) {
  const [totalBalance, setTotalBalance] = useState(0);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    if (balance && transactions) {
      // 1. Calculate the simple total balance
      const total = calculateTotalBalance(balance);
      setTotalBalance(total);

      // 2. Process the data for the chart
      const dailyData = calculateDailyBalance(transactions, total);
      setChartData(dailyData);
    }
  }, [balance, transactions]); // Re-run when data changes

  return (
    <div>
      <h1>Hello Mako</h1>
      <h2>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalBalance)}</h2>

      <div className="summary-card">
        <h3>Total Balance</h3>
        <p style={{ fontSize: "2em", color: "#4CAF50" }}>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalBalance)}</p>
      </div>

      <div className="chart-card">
        <h3>Balance Over Last 30 Days</h3>
        <BalanceOverTimeChart data={chartData} />
      </div>

      {/* You could add more cards/charts here */}

      <div className="transactions-list">
        <h3>Recent Transactions</h3>
        <ul>
          {transactions.slice(0, 10).map(
            (
              t // Show first 10
            ) => (
              <li key={t.id} style={{ borderBottom: "1px solid #ccc", padding: "10px 0" }}>
                <strong>{t.name}</strong> <br />
                Amount: ${t.amount.toFixed(2)} | Date: {t.date}
              </li>
            )
          )}
        </ul>
      </div>
    </div>
  );
}

export default Dashboard;
