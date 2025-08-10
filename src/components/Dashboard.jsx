import React, { useState, useEffect } from "react";
import { calculateTotalBalance, calculateDailyBalance } from "../utils/dataProcessor"; // Correctly import from the new file
import BalanceOverTimeChart from "./BalanceOverTimeChart";

const FILTER_MAP = {
  weekly: "Balance Over Last 7 Days",
  monthly: "Balance Since First of the Month",
  ytd: "Balance Since Start of the Year",
  all: "Balance Since First Record",
};

export default function Dashboard({ balance, transactions }) {
  const [totalBalance, setTotalBalance] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [activeFilter, setActiveFilter] = useState("monthly");
  const [chartTitle, setChartTitle] = useState(FILTER_MAP[activeFilter]);

  useEffect(() => {
    if (balance && transactions) {
      // 1. Calculate the current total balance
      const total = calculateTotalBalance(balance);
      setTotalBalance(total);

      let filteredTransactions = transactions;
      const today = new Date();

      // 2. Filter transactions based on the selected time range
      switch (activeFilter) {
        case "weekly": {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(today.getDate() - 7);
          filteredTransactions = transactions.filter((t) => new Date(t.date) >= sevenDaysAgo);
          break;
        }
        case "monthly": {
          const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          filteredTransactions = transactions.filter((t) => new Date(t.date) >= firstDayOfMonth);
          break;
        }
        case "ytd": {
          const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
          filteredTransactions = transactions.filter((t) => new Date(t.date) >= firstDayOfYear);
          break;
        }
        case "all":
        default:
          // Use all transactions
          filteredTransactions = transactions;
          break;
      }

      // 3. Calculate the historical daily balances using the new utility
      const dailyData = calculateDailyBalance(filteredTransactions, total);

      // 4. Format the data for the recharts component (which expects a 'pv' key)
      const formattedChartData = dailyData.map((d) => ({
        ...d,
        pv: d.balance,
      }));
      setChartData(formattedChartData);
    }
  }, [balance, transactions, activeFilter]); // Dependencies are correct

  const handleFilterClick = (filter) => {
    setActiveFilter(filter);
    setChartTitle(FILTER_MAP[filter]);
  };

  // ... (The rest of your JSX render logic is fine and does not need to change)
  return (
    <div>
      <div className="chart-card">
        <h1>Hello Mako</h1>
        <div className="summary-card">
          <h3>Total Balance</h3>
          <h2 style={{ fontSize: "2em", color: "#4CAF50" }}>
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(totalBalance)}
          </h2>
        </div>

        <h3>{chartTitle}</h3>
        <BalanceOverTimeChart data={chartData} />
        <div className="filter-buttons">
          <button onClick={() => handleFilterClick("weekly")} className={`filter-button ${activeFilter === "weekly" ? "active" : ""}`}>
            <span className="button-text">Weekly</span>
          </button>
          <button onClick={() => handleFilterClick("monthly")} className={`filter-button ${activeFilter === "monthly" ? "active" : ""}`}>
            <span className="button-text">Monthly</span>
          </button>
          <button onClick={() => handleFilterClick("ytd")} className={`filter-button ${activeFilter === "ytd" ? "active" : ""}`}>
            <span className="button-text">YTD</span>
          </button>
          <button onClick={() => handleFilterClick("all")} className={`filter-button ${activeFilter === "all" ? "active" : ""}`}>
            <span className="button-text">All Time</span>
          </button>
        </div>
      </div>

      <div className="transactions-list">
        <h3>Recent Transactions</h3>
        <ul>
          {transactions.slice(0, 10).map((t) => (
            <li key={t.id} style={{ borderBottom: "1px solid #ccc", padding: "10px 0" }}>
              <strong>{t.name}</strong> <br />
              Amount: ${t.amount.toFixed(2)} | Date: {t.date}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
