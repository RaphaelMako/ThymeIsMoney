import type { Transaction } from "@prisma/client";
import type { SpendingRow } from "@/components/SpendingTable";
import { isSpend, prettyCategory } from "./insights";

type TxnWithAttachments = Transaction & { _count: { attachments: number } };

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Rows for one month's spending table, with each row's share of that month's spend. */
export function buildSpendingRows(
  transactions: TxnWithAttachments[],
  monthKey: string
): { rows: SpendingRow[]; totalSpend: number } {
  const monthTxns = transactions.filter(
    (t) => t.date.toISOString().slice(0, 7) === monthKey && Number(t.amount) > 0
  );

  const asSpendTxn = (t: TxnWithAttachments) => ({
    date: t.date.toISOString().slice(0, 10),
    amount: Number(t.amount),
    category: t.plaidCategoryPrimary,
  });

  const totalSpend = monthTxns.reduce(
    (sum, t) => (isSpend(asSpendTxn(t)) ? sum + Number(t.amount) : sum),
    0
  );

  const rows = monthTxns.map((t) => {
    const amount = Number(t.amount);
    const spend = isSpend(asSpendTxn(t));
    return {
      id: t.id,
      name: t.merchantName ?? t.name,
      date: t.date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }),
      category: t.plaidCategoryPrimary ? prettyCategory(t.plaidCategoryPrimary) : "—",
      categoryKey: t.plaidCategoryPrimary,
      cost: currency.format(amount),
      description: t.description,
      receipts: t._count.attachments,
      percentOfMonthly:
        spend && totalSpend > 0 ? Math.round((amount / totalSpend) * 1000) / 10 : null,
    };
  });

  return { rows, totalSpend };
}

export function monthLabel(monthKey: string): string {
  return new Date(`${monthKey}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
