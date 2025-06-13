// App.jsx

import React, { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import "./App.scss";

function App() {
  const [token, setToken] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [itemId, setItemId] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [error, setError] = useState(null);

  // --- Callback Functions ---

  const onSuccess = useCallback(async (publicToken) => {
    setLoading(true);
    const response = await fetch("/api/exchange_public_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_token: publicToken }),
    });

    // --- NEW: EXPECT ALL DATA AT ONCE ---
    const data = await response.json();

    // Check for an error from the server first
    if (data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }

    // Set everything from the single response
    localStorage.setItem("item_id", data.item_id);
    setItemId(data.item_id);
    setBalance({ Balance: data.balance }); // Keep the structure consistent with your old getBalance
    setTransactions(data.transactions);

    setLoading(false); // We are done!
  }, []); // No dependencies needed here

  const createLinkToken = useCallback(async () => {
    const response = await fetch("/api/create_link_token", {});
    const data = await response.json();
    setToken(data.link_token);
  }, []);

  const getBalance = useCallback(async (id) => {
    console.log(`[FRONT-END] Requesting balance for item_id: '${id}'`);
    const response = await fetch("/api/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: id }),
    });
    const balance = await response.json();
    console.log("[FRONT-END] Received balance data:", balance);
    setBalance(balance);
  }, []);

  const formatCategory = (categoryString) => {
    if (!categoryString) {
      return "Uncategorized";
    }
    try {
      // Plaid returns categories as an array of strings.
      const categories = JSON.parse(categoryString);
      return categories.join(" > ");
    } catch (error) {
      // If parsing fails for any reason, fall back gracefully.
      console.error("Failed to parse category:", categoryString, error);
      return "Uncategorized";
    }
  };

  const getTransactions = useCallback(async (id) => {
    setError(null); // Clear previous errors
    try {
      const response = await fetch("/api/get_transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: id }),
      });

      if (!response.ok) {
        // Handle HTTP errors like 404 or 500
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setTransactions(data.transactions);
    } catch (e) {
      console.error("Failed to fetch transactions:", e);
      setError("Could not load your transactions. Please try again later.");
    }
  }, []);

  const { open, ready } = usePlaidLink({ token, onSuccess });

  // --- useEffect for Initialization ---

  useEffect(() => {
    async function initialize() {
      const storedItemId = localStorage.getItem("item_id");

      if (storedItemId) {
        setItemId(storedItemId);
        await getBalance(storedItemId);
        await getTransactions(storedItemId); // MODIFIED: Also fetch transactions on load
      } else {
        await createLinkToken();
      }
      setLoading(false); // We are done loading after all data is fetched
    }
    initialize();
  }, [getBalance, getTransactions, createLinkToken]); // MODIFIED: Add getTransactions to dependencies

  // --- Render Logic ---

  if (loading) {
    return <div className="spinner" />;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  // If we have an item_id, we are "logged in"
  if (itemId) {
    return (
      <div>
        <h2>Your Account</h2>

        {/* Display Balance Data */}
        {balance != null && (
          <pre>
            <code>{JSON.stringify(balance.Balance, null, 2)}</code>
          </pre>
        )}

        {/* NEW: Display Transaction Data */}
        <h3>Transactions</h3>
        <h3>Transactions</h3>
        {/* --- MODIFIED RENDER LOGIC --- */}
        {transactions ? (
          transactions.length > 0 ? (
            <ul>
              {transactions.map((t) => (
                <li key={t.id} /* Use transaction's primary key from DB */ style={{ borderBottom: "1px solid #ccc", padding: "10px 0" }}>
                  <strong>{t.name}</strong> <br />
                  Amount: ${t.amount.toFixed(2)} <br />
                  Date: {t.date} <br />
                  Category: {formatCategory(t.categories)}
                </li>
              ))}
            </ul>
          ) : (
            // This now handles the case where the API returns an empty array
            <p>No transactions found for this account yet.</p>
          )
        ) : (
          // This handles the initial state where transactions are still null (i.e., loading)
          <p>Loading transactions...</p>
        )}
      </div>
    );
  }

  // Default "logged out" view
  return (
    <div>
      <button onClick={() => open()} disabled={!ready}>
        <strong>Link your bank account</strong>
      </button>
    </div>
  );
}

export default App;
