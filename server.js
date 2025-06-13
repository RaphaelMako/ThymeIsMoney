/*
server.js – Configures the Plaid client and uses Express to defines routes that call Plaid endpoints in the Sandbox environment.
Utilizes the official Plaid node.js client library and a local SQLite database.
*/

// --- 1. Imports and Initial Setup ---
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");
const db = require("./database"); // <-- ⭐️ FIXED: Import the database connection

const app = express();

// --- 2. Middleware Configuration ---
app.use(session({ secret: "bosco", saveUninitialized: true, resave: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// --- 3. Plaid Client Configuration ---
const config = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
      "Plaid-Version": "2020-09-14",
    },
  },
});
const client = new PlaidApi(config);

// --- 4. API Routes ---

// Creates a Link token and returns it
app.get("/api/create_link_token", async (req, res, next) => {
  const tokenResponse = await client.linkTokenCreate({
    user: { client_user_id: req.sessionID },
    client_name: "Plaid Quickstart",
    language: "en",
    products: ["transactions"],
    country_codes: ["US"],
  });
  res.json(tokenResponse.data);
});

// Exchanges the public token, gets the initial transactions, and stores everything in SQLite.
app.post("/api/exchange_public_token", async (req, res, next) => {
  try {
    const exchangeResponse = await client.itemPublicTokenExchange({
      public_token: req.body.public_token,
    });

    const itemId = exchangeResponse.data.item_id;
    const accessToken = exchangeResponse.data.access_token;

    // Initial Transaction Sync
    let cursor = null;
    let added = [];
    while (true) {
      const request = { access_token: accessToken, cursor: cursor };
      const response = await client.transactionsSync(request);
      const data = response.data;
      added = added.concat(data.added);
      if (!data.has_more) {
        cursor = data.next_cursor;
        break;
      }
      cursor = data.next_cursor;
    }

    // Database Operations
    const dbTransaction = db.transaction(() => {
      const insertItem = db.prepare("INSERT INTO items (id, access_token, next_cursor) VALUES (?, ?, ?)");
      insertItem.run(itemId, accessToken, cursor);

      const insertTransaction = db.prepare("INSERT INTO transactions (id, item_id, account_id, name, amount, date, categories) VALUES (?, ?, ?, ?, ?, ?, ?)");
      for (const txn of added) {
        const categories = txn.category ? JSON.stringify(txn.category) : null;
        insertTransaction.run(txn.transaction_id, itemId, txn.account_id, txn.name, txn.amount, txn.date, categories);
      }
    });
    dbTransaction();

    console.log(`Initial sync complete! Stored ${added.length} transactions.`);
    res.json({ item_id: itemId });
  } catch (error) {
    console.error("Error exchanging public token:", error);
    res.status(500).json({ error: "Failed to exchange token and sync transactions." });
  }
});

// Fetches balance data by calling Plaid directly (since balance is not stored permanently yet)
app.post("/api/balance", async (req, res, next) => {
  const { item_id } = req.body;

  // ⭐️ FIXED: Query the database for the access_token
  const getItem = db.prepare("SELECT access_token FROM items WHERE id = ?");
  const item = getItem.get(item_id);

  if (!item || !item.access_token) {
    return res.status(400).json({ error: "No access token found for this item." });
  }

  try {
    const balanceResponse = await client.accountsBalanceGet({ access_token: item.access_token });
    res.json({ Balance: balanceResponse.data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not fetch balance." });
  }
});

// Fetches all transactions for a given item FROM OUR DATABASE
app.post("/api/get_transactions", (req, res, next) => {
  // This route was already correct, it just needed the db import to work.
  const { item_id } = req.body;
  try {
    const getTransactions = db.prepare("SELECT * FROM transactions WHERE item_id = ? ORDER BY date DESC");
    const transactions = getTransactions.all(item_id);
    res.json({ transactions });
  } catch (error) {
    console.error("Failed to get transactions from DB:", error);
    res.status(500).json({ error: "Failed to retrieve transactions." });
  }
});

// --- 5. Start The Server ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running and listening on port ${PORT}`);
});
