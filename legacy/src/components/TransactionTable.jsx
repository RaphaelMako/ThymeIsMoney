import React from "react";

// A simple, functional component for displaying transactions in a table.
export default function TransactionTable({ transactions }) {
  if (!transactions || transactions.length === 0) {
    return <p>No transactions to display.</p>;
  }

  return (
    <table
      style={{
        width: "90%",
        margin: "20px auto",
        borderCollapse: "collapse",
      }}
    >
      <thead>
        <tr>
          <th style={styles.th}>Date</th>
          <th style={styles.th}>Name</th>
          <th style={styles.th}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((t) => (
          <tr key={t.id} style={styles.tr}>
            <td style={styles.td}>{t.date}</td>
            <td style={styles.td}>{t.name}</td>
            <td style={{ ...styles.td, textAlign: "right", color: t.amount > 0 ? "#C21807" : "#228B22" }}>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(t.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Basic styles for the table to make it readable
const styles = {
  th: {
    borderBottom: "2px solid #333",
    padding: "12px",
    textAlign: "left",
    backgroundColor: "#f2f2f2",
  },
  td: {
    borderBottom: "1px solid #ddd",
    padding: "10px 12px",
  },
  tr: {
    // Basic hover effect
  },
};
