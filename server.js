/*
server.js – Configures the Plaid client and uses Express to defines routes that call Plaid endpoints in the Sandbox environment.Utilizes the official Plaid node.js client library to make calls to the Plaid API.
*/

// --- 1. Imports and Initial Setup ---
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const { Configuration, PlaidApi, PlaidEnvironments } = require("plaid");
const fs = require("fs").promises;

const app = express();

// --- 2. Middleware Configuration ---
app.use(session({ secret: "bosco", saveUninitialized: true, resave: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// --- 3. Plaid Client and DB Configuration ---
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
const DB_PATH = "./database.json";

// --- 4. Database Helper Functions ---
async function readDB() {
  try {
    const data = await fs.readFile(DB_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function writeDB(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

// --- 5. API Routes ---

// Creates a Link token and returns it
app.get("/api/create_link_token", async (req, res, next) => {
  const tokenResponse = await client.linkTokenCreate({
    user: { client_user_id: req.sessionID },
    client_name: "Plaid Persistent Quickstart",
    language: "en",
    products: ["auth", "transactions"],
    country_codes: ["US"],
  });
  res.json(tokenResponse.data);
});

// Exchanges the public token from Plaid Link for an access token
app.post("/api/exchange_public_token", async (req, res, next) => {
  const exchangeResponse = await client.itemPublicTokenExchange({
    public_token: req.body.public_token,
  });

  const itemId = exchangeResponse.data.item_id;
  const accessToken = exchangeResponse.data.access_token;

  const db = await readDB();
  db[itemId] = accessToken;
  await writeDB(db);

  console.log(`Stored access_token for item_id: ${itemId} in ${DB_PATH}`);
  res.json({ item_id: itemId });
});

// Fetches balance data using the Node client library for Plaid
app.post("/api/balance", async (req, res, next) => {
  const { item_id } = req.body;
  const db = await readDB();
  const access_token = db[item_id];

  if (!access_token) {
    return res.status(400).json({ error: "No access token found for this item." });
  }

  try {
    const balanceResponse = await client.accountsBalanceGet({ access_token });
    res.json({
      Balance: balanceResponse.data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not fetch balance." });
  }
});

app.post("/api/transactions", async (req, res, next) => {
  const { item_id } = req.body;
  const db = await readDB();
  const access_token = db[item_id];

  if (!access_token) {
    return res.status(400).json({ error: "No access token found for this item." });
  }

  // Set cursor to empty to receive all pages of data
  let cursor = null;

  // New transaction data since the last sync
  let added = [];
  let modified = [];
  // Removed transaction ids
  let removed = [];
  let hasMore = true;

  try {
    // Iterate through each page of new transaction updates for item
    // Note: This is an advanced pattern for iterating through pages of data.
    // For a simpler start, you could just fetch the first page.
    // But this complete example is more robust.
    while (hasMore) {
      const request = {
        access_token: access_token,
        cursor: cursor,
      };
      const response = await client.transactionsSync(request);
      const data = response.data;

      // Add this page of results to our transaction list
      added = added.concat(data.added);
      modified = modified.concat(data.modified);
      removed = removed.concat(data.removed);
      hasMore = data.has_more;

      // Update the cursor to the next cursor
      cursor = data.next_cursor;
    }

    // For simplicity, we'll just return the added transactions.
    // A real app would need to handle modified and removed transactions.
    res.json({ transactions: added });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not fetch transactions." });
  }
});

// --- 6. Start The Server ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running and listening on port ${PORT}`);
});
