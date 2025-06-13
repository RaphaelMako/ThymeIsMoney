import { format, subDays, eachDayOfInterval } from "date-fns";

/**
 * Calculates the total current balance across all accounts.
 * @param {object} balanceObject - The raw balance object from Plaid.
 * @returns {number} The total balance.
 */
export function calculateTotalBalance(balanceObject) {
  if (!balanceObject || !balanceObject.Balance || !balanceObject.Balance.accounts) {
    return 0;
  }
  return balanceObject.Balance.accounts.reduce((total, account) => {
    return total + account.balances.current;
  }, 0);
}

/**
 * Reconstructs the daily balance for the last 30 days.
 * @param {Array} transactions - The array of transactions from your database.
 * @param {number} currentTotalBalance - The current total balance.
 * @returns {Array} An array of objects like [{ date: 'YYYY-MM-DD', balance: 1234.56 }]
 */
export function calculateDailyBalance(transactions, currentTotalBalance) {
  if (!transactions || transactions.length === 0) {
    return [];
  }

  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);

  // Create a map of daily spending
  const dailyDeltas = new Map();
  for (const t of transactions) {
    // IMPORTANT: Plaid debits (spending) are POSITIVE, credits (income) are NEGATIVE.
    // To calculate the change in balance, we subtract the amount.
    const delta = -t.amount;
    const date = format(new Date(t.date), "yyyy-MM-dd");
    dailyDeltas.set(date, (dailyDeltas.get(date) || 0) + delta);
  }

  // Generate an array of all dates in the last 30 days
  const dateInterval = eachDayOfInterval({ start: thirtyDaysAgo, end: today });
  const dailyBalances = [];
  let runningBalance = currentTotalBalance;

  // Iterate backwards from today
  for (let i = dateInterval.length - 1; i >= 0; i--) {
    const date = dateInterval[i];
    const formattedDate = format(date, "yyyy-MM-dd");

    // Add the current day's balance to our results
    dailyBalances.push({
      date: formattedDate,
      balance: runningBalance,
    });

    // To find the balance of the *previous* day, we reverse today's transactions.
    // If there was a change of +$50 today, yesterday's balance was $50 lower.
    const todaysDelta = dailyDeltas.get(formattedDate) || 0;
    runningBalance -= todaysDelta;
  }

  // The array is backwards, so we reverse it to be chronological
  return dailyBalances.reverse();
}
