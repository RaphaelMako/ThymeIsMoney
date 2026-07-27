import { NextResponse } from "next/server";
import type { Transaction as PlaidTransaction, RemovedTransaction } from "plaid";
import { plaidClient } from "@/lib/plaid";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const items = await db.plaidItem.findMany({
      where: { userId },
      include: { bankAccounts: true },
    });
    if (items.length === 0) {
      return NextResponse.json({ error: "No linked bank account." }, { status: 404 });
    }

    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;

    for (const item of items) {
      const accountIdMap = new Map(item.bankAccounts.map((a) => [a.plaidAccountId, a.id]));

      let cursor = item.nextCursor ?? undefined;
      const added: PlaidTransaction[] = [];
      const modified: PlaidTransaction[] = [];
      const removed: RemovedTransaction[] = [];
      let hasMore = true;

      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: item.accessToken,
          cursor,
        });
        added.push(...response.data.added);
        modified.push(...response.data.modified);
        removed.push(...response.data.removed);
        hasMore = response.data.has_more;
        cursor = response.data.next_cursor;
      }

      const upsertData = (txn: PlaidTransaction) => ({
        name: txn.name,
        merchantName: txn.merchant_name ?? null,
        amount: txn.amount,
        isoCurrencyCode: txn.iso_currency_code,
        date: new Date(txn.date),
        pending: txn.pending,
        plaidCategoryPrimary: txn.personal_finance_category?.primary ?? null,
        plaidCategoryDetail: txn.personal_finance_category?.detailed ?? null,
      });

      for (const txn of [...added, ...modified]) {
        const bankAccountId = accountIdMap.get(txn.account_id);
        if (!bankAccountId) continue;

        await db.transaction.upsert({
          where: { plaidTransactionId: txn.transaction_id },
          update: upsertData(txn),
          create: {
            plaidTransactionId: txn.transaction_id,
            bankAccountId,
            userId,
            ...upsertData(txn),
          },
        });
      }

      if (removed.length > 0) {
        await db.transaction.deleteMany({
          where: { plaidTransactionId: { in: removed.map((r) => r.transaction_id) } },
        });
      }

      // Refresh account balances
      const accountsResponse = await plaidClient.accountsGet({ access_token: item.accessToken });
      for (const acct of accountsResponse.data.accounts) {
        const bankAccountId = accountIdMap.get(acct.account_id);
        if (!bankAccountId) continue;
        await db.bankAccount.update({
          where: { id: bankAccountId },
          data: {
            currentBalance: acct.balances.current,
            availableBalance: acct.balances.available,
          },
        });
      }

      await db.plaidItem.update({
        where: { id: item.id },
        data: { nextCursor: cursor },
      });

      totalAdded += added.length;
      totalModified += modified.length;
      totalRemoved += removed.length;
    }

    return NextResponse.json({ added: totalAdded, modified: totalModified, removed: totalRemoved });
  } catch (error) {
    console.error("Error syncing transactions:", error);
    return NextResponse.json({ error: "Failed to sync transactions." }, { status: 500 });
  }
}
