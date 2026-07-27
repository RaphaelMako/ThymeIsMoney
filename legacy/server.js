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

app.post("/api/create_link_token", async (req, res) => {
  try {
    const tokenResponse = await client.linkTokenCreate({
      user: { client_user_id: req.sessionID },
      client_name: "Plaid Quickstart",
      language: "en",
      products: ["transactions"],
      country_codes: ["US"],
    });
    res.json(tokenResponse.data);
  } catch (error) {
    console.error("Error creating link token:", error);
    res.status(500).json({ error: "Failed to create link token." });
  }
});

app.post("/api/exchange_public_token", async (req, res) => {
  try {
    const { public_token } = req.body;
    const exchangeResponse = await client.itemPublicTokenExchange({ public_token });

    const itemId = exchangeResponse.data.item_id;
    const accessToken = exchangeResponse.data.access_token;

    const upsertItem = db.prepare("REPLACE INTO items (id, access_token) VALUES (?, ?)");
    upsertItem.run(itemId, accessToken);

    res.json({ item_id: itemId });
  } catch (error) {
    console.error("Error exchanging public token:", error);
    res.status(500).json({ error: "A server error occurred." });
  }
});

app.post("/api/transactions", async (req, res) => {
  try {
    const { item_id } = req.body;
    const itemQuery = db.prepare("SELECT access_token FROM items WHERE id = ?");
    const item = itemQuery.get(item_id);

    if (!item) {
      return res.status(404).json({ error: "Item not found." });
    }

    let cursor = null;
    let added = [];
    let hasMore = true;

    while (hasMore) {
      const request = {
        access_token: item.access_token,
        cursor: cursor,
      };
      const response = await client.transactionsSync(request);
      const data = response.data;

      added = added.concat(data.added);
      hasMore = data.has_more;
      cursor = data.next_cursor;
    }

    const insertTransaction = db.prepare("INSERT OR IGNORE INTO transactions (id, item_id, account_id, name, amount, date) VALUES (?, ?, ?, ?, ?, ?)");
    const dbTransaction = db.transaction(() => {
      for (const txn of added) {
        insertTransaction.run(txn.transaction_id, item_id, txn.account_id, txn.name, txn.amount, txn.date);
      }
    });
    dbTransaction();

    const getTransactions = db.prepare("SELECT * FROM transactions WHERE item_id = ? ORDER BY date DESC");
    const transactions = getTransactions.all(item_id);

    res.json({ transactions });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions." });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
