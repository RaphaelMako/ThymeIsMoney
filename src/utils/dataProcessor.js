// src/utils/dataProcessor.js

/**
 * Calculates the total current balance from all accounts.
 * Plaid's balance object contains a list of accounts.
 * @param {object} balance - The balance object from Plaid.
 * @returns {number} - The total balance.
 */
export const calculateTotalBalance = (balance) => {
  if (!balance || !balance.Balance || !balance.Balance.accounts) {
    return 0;
  }
  return balance.Balance.accounts.reduce((total, account) => total + account.balances.current, 0);
};

/**
 * Calculates the historical daily balance based on a list of transactions
 * and the current total balance. It works backwards from today.
 *
 * @param {Array} transactions - A list of transaction objects.
 * @param {number} currentBalance - The current total balance.
 * @returns {Array} - An array of objects { date, balance } for the chart.
 */
export const calculateDailyBalance = (transactions, currentBalance) => {
  if (!transactions || transactions.length === 0) {
    return [];
  }

  // Group transaction amounts by date
  const dailyNet = transactions.reduce((acc, t) => {
    // Plaid treats debits (spending) as positive, credits (income) as negative
    acc[t.date] = (acc[t.date] || 0) + t.amount;
    return acc;
  }, {});

  // Find the earliest date in the filtered transactions
  const earliestDate = new Date(Math.min(...transactions.map((t) => new Date(t.date))));

  let runningBalance = currentBalance;
  const chartData = [];
  const today = new Date();

  // Loop backwards from today to the earliest transaction date
  for (let d = new Date(today); d >= earliestDate; d.setDate(d.getDate() - 1)) {
    const dateString = d.toISOString().split("T")[0];

    // Add the data point for the current day
    chartData.push({
      date: dateString,
      balance: runningBalance,
    });

    // To find the balance of the *previous* day, we reverse today's transactions.
    // If there was a net debit (spending) today, the balance was higher yesterday.
    // So, we ADD the net amount to the running balance as we go back in time.
    if (dailyNet[dateString]) {
      runningBalance += dailyNet[dateString];
    }
  }

  // The data was generated backwards, so reverse it for the chart
  return chartData.reverse();
};
