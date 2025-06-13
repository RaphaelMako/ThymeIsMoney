// server.js (DEBUG VERSION)

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");
const db = require("./database");

const app = express();
app.use(session({ secret: "bosco", saveUninitialized: true, resave: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

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

app.get("/api/create_link_token", async (req, res, next) => {
  try {
    console.log("\n[SERVER] /api/create_link_token: Received request.");
    const tokenResponse = await client.linkTokenCreate({
      user: { client_user_id: req.sessionID },
      client_name: "Plaid Quickstart",
      language: "en",
      products: ["transactions"],
      country_codes: ["US"],
    });
    console.log("[SERVER] /api/create_link_token: Successfully created link token.");
    res.json(tokenResponse.data);
  } catch (error) {
    console.error("[SERVER] /api/create_link_token: FAILED.", error.response ? error.response.data : error);
    res.status(500).json({ error: "Failed to create link token." });
  }
});

app.post("/api/exchange_public_token", async (req, res, next) => {
  try {
    const public_token = req.body.public_token;
    const exchangeResponse = await client.itemPublicTokenExchange({ public_token });

    const itemId = exchangeResponse.data.item_id;
    const accessToken = exchangeResponse.data.access_token;

    // --- SYNC TRANSACTIONS ---
    let cursor = null;
    let added = [];
    let hasMore = true;
    while (hasMore) {
      const request = { access_token: accessToken, cursor: cursor };
      const response = await client.transactionsSync(request);
      const data = response.data;
      added = added.concat(data.added);
      hasMore = data.has_more;
      cursor = data.next_cursor;
    }

    // --- DATABASE WRITE ---
    const dbTransaction = db.transaction(() => {
      // ... (your existing database write logic is fine)
      const upsertItem = db.prepare("REPLACE INTO items (id, access_token, next_cursor) VALUES (?, ?, ?)");
      upsertItem.run(itemId, accessToken, cursor);
      if (added.length > 0) {
        const insertTransaction = db.prepare("INSERT OR IGNORE INTO transactions (id, item_id, account_id, name, amount, date, categories) VALUES (?, ?, ?, ?, ?, ?, ?)");
        for (const txn of added) {
          const categories = txn.category ? JSON.stringify(txn.category) : null;
          insertTransaction.run(txn.transaction_id, itemId, txn.account_id, txn.name, txn.amount, txn.date, categories);
        }
      }
    });
    dbTransaction();

    // --- NEW: FETCH INITIAL DATA ON THE SERVER ---
    // Fetch the balance
    const balanceResponse = await client.accountsBalanceGet({ access_token: accessToken });
    const balance = balanceResponse.data;

    // Read the transactions we just saved
    const getTransactions = db.prepare("SELECT * FROM transactions WHERE item_id = ? ORDER BY date DESC");
    const transactions = getTransactions.all(itemId);

    console.log(`[SERVER] /exchange: Returning item_id, ${transactions.length} transactions, and balance.`);

    // --- NEW: SEND EVERYTHING BACK IN ONE RESPONSE ---
    res.json({
      item_id: itemId,
      balance: balance,
      transactions: transactions,
    });
  } catch (error) {
    console.error("[SERVER] /exchange_public_token: FAILED.", error.response ? error.response.data : error);
    res.status(500).json({ error: "A server error occurred during token exchange." });
  }
});

app.post("/api/balance", async (req, res, next) => {
  console.log("\n[SERVER] /api/balance: Received request.");
  const { item_id } = req.body;
  console.log("[SERVER] /api/balance: Requesting balance for item_id:", item_id);

  if (!item_id) {
    console.error("[SERVER] /api/balance: FAILED - No item_id was provided in the request body.");
    return res.status(400).json({ error: "item_id is missing from request." });
  }

  const getItem = db.prepare("SELECT access_token FROM items WHERE id = ?");
  const item = getItem.get(item_id);

  console.log("[SERVER] /api/balance: Result from database query for item:", item);

  if (!item || !item.access_token) {
    console.error("[SERVER] /api/balance: FAILED - item_id not found in 'items' table.");
    return res.status(400).json({ error: "No access token found for this item." });
  }

  try {
    const balanceResponse = await client.accountsBalanceGet({ access_token: item.access_token });
    console.log("[SERVER] /api/balance: Successfully fetched balance from Plaid.");
    res.json({ Balance: balanceResponse.data });
  } catch (error) {
    console.error("[SERVER] /api/balance: FAILED.", error.response ? error.response.data : error);
    res.status(500).json({ error: "Could not fetch balance." });
  }
});

app.post("/api/get_transactions", (req, res, next) => {
  console.log("\n[SERVER] /api/get_transactions: Received request.");
  const { item_id } = req.body;
  console.log("[SERVER] /api/get_transactions: Requesting transactions for item_id:", item_id);

  try {
    const getTransactions = db.prepare("SELECT * FROM transactions WHERE item_id = ? ORDER BY date DESC");
    const transactions = getTransactions.all(item_id);
    console.log(`[SERVER] /api/get_transactions: Found ${transactions.length} transactions in database.`);
    res.json({ transactions });
  } catch (error) {
    console.error("[SERVER] /api/get_transactions: FAILED.", error);
    res.status(500).json({ error: "Failed to retrieve transactions." });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running and listening on port ${PORT}`);
});
