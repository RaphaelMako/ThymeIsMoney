import React, { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import "./App.scss";

function App() {
  const [token, setToken] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemId, setItemId] = useState(null);

  const onSuccess = useCallback(async (publicToken) => {
    setLoading(true);
    await fetch("/api/exchange_public_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_token: publicToken }),
    });
    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: localStorage.getItem("item_id") }),
    });
    const data = await response.json();
    setTransactions(data.transactions);
    setLoading(false);
  }, []);

  const createLinkToken = useCallback(async () => {
    const response = await fetch("/api/create_link_token", { method: "POST" });
    const data = await response.json();
    setToken(data.link_token);
  }, []);

  useEffect(() => {
    const storedItemId = localStorage.getItem("item_id");
    if (storedItemId) {
      setItemId(storedItemId);
      const getTransactions = async () => {
        const response = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: storedItemId }),
        });
        const data = await response.json();
        setTransactions(data.transactions);
        setLoading(false);
      };
      getTransactions();
    } else {
      createLinkToken();
      setLoading(false);
    }
  }, [createLinkToken]);

  const { open, ready } = usePlaidLink({ token, onSuccess });

  const handleLogout = () => {
    localStorage.removeItem("item_id");
    window.location.reload();
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (itemId) {
    return (
      <div>
        <button onClick={handleLogout}>Logout</button>
        <h1>Transactions</h1>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Amount</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.amount}</td>
                <td>{t.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => open()} disabled={!ready}>
        Link your bank account
      </button>
    </div>
  );
}

export default App;
