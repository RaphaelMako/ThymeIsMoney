import { db } from "./db";
import type { CategoryTxn } from "./categoryDetail";

/** Everything the category detail modal needs, for any page that mounts it. */
export async function loadCategoryPayload(userId: string): Promise<{
  transactions: CategoryTxn[];
  budgets: Record<string, number>;
}> {
  const [txns, profile] = await Promise.all([
    db.transaction.findMany({
      where: { userId, amount: { gt: 0 }, plaidCategoryPrimary: { not: null } },
      select: {
        id: true,
        name: true,
        merchantName: true,
        date: true,
        amount: true,
        plaidCategoryPrimary: true,
      },
      orderBy: { date: "desc" },
    }),
    db.budgetProfile.findFirst({
      where: { userId, isActive: true },
      include: { budgetCategories: { include: { category: true } } },
    }),
  ]);

  const budgets: Record<string, number> = {};
  for (const bc of profile?.budgetCategories ?? []) {
    const key = bc.category.plaidPrimary;
    if (key) budgets[key] = (budgets[key] ?? 0) + Number(bc.monthlyLimit);
  }

  return {
    transactions: txns.map((t) => ({
      id: t.id,
      name: t.merchantName ?? t.name,
      date: t.date.toISOString().slice(0, 10),
      amount: Number(t.amount),
      category: t.plaidCategoryPrimary as string,
    })),
    budgets,
  };
}
