// database.js
const Database = require("better-sqlite3");

// The database file will be created in your project directory.
const db = new Database("dev.db", { verbose: console.log });

// A function to run when the server starts to set up our tables.
function initializeDatabase() {
  // Use .exec() to run multiple SQL statements.
  // This is a great way to create your schema.
  const createTables = `
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      next_cursor TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      categories TEXT,
      FOREIGN KEY (item_id) REFERENCES items (id)
    );
  `;

  db.exec(createTables);
  console.log("Database tables are set up!");
}

// Run the initialization
initializeDatabase();

// Export the database connection
module.exports = db;
