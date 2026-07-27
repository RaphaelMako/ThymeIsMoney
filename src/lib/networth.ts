import type { BankAccount } from "@prisma/client";

const LIABILITY_TYPES = new Set(["credit", "loan"]);

export function isLiability(account: Pick<BankAccount, "type">): boolean {
  return LIABILITY_TYPES.has(account.type);
}

/** Net worth: assets minus liabilities (credit cards, loans, mortgages). */
export function calculateNetWorth(accounts: Pick<BankAccount, "type" | "currentBalance">[]): number {
  return accounts.reduce((sum, account) => {
    const balance = Number(account.currentBalance ?? 0);
    return sum + (isLiability(account) ? -balance : balance);
  }, 0);
}
