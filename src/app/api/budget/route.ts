import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildCategoryLimits } from "@/lib/budget";
import { prettyCategory } from "@/lib/insights";

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const { monthlyIncome } = await req.json();
    const income = Number(monthlyIncome);
    if (!Number.isFinite(income) || income <= 0) {
      return NextResponse.json({ error: "A positive monthly income is required." }, { status: 400 });
    }

    // Historical monthly averages per Plaid category (prior months only)
    const transactions = await db.transaction.findMany({
      where: { userId, amount: { gt: 0 } },
      select: { date: true, amount: true, plaidCategoryPrimary: true },
    });
    const thisMonth = new Date().toISOString().slice(0, 7);
    const priorMonths = new Set<string>();
    const totals = new Map<string, number>();
    for (const t of transactions) {
      const month = t.date.toISOString().slice(0, 7);
      if (month >= thisMonth || !t.plaidCategoryPrimary) continue;
      priorMonths.add(month);
      totals.set(
        t.plaidCategoryPrimary,
        (totals.get(t.plaidCategoryPrimary) ?? 0) + Number(t.amount)
      );
    }
    const averages = new Map<string, number>();
    if (priorMonths.size > 0) {
      for (const [category, total] of totals) averages.set(category, total / priorMonths.size);
    }

    const limits = buildCategoryLimits(income, averages);

    const profile = await db.$transaction(async (tx) => {
      await tx.budgetProfile.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });

      const created = await tx.budgetProfile.create({
        data: {
          userId,
          name: "50/30/20",
          type: "FIFTY_THIRTY_TWENTY",
          monthlyIncome: income,
          isActive: true,
        },
      });

      for (const limit of limits) {
        const name = limit.plaidPrimary === "TRANSFER_OUT" ? "Savings" : prettyCategory(limit.plaidPrimary);
        const category = await tx.category.upsert({
          where: { userId_name: { userId, name } },
          update: { plaidPrimary: limit.plaidPrimary },
          create: { userId, name, plaidPrimary: limit.plaidPrimary },
        });
        await tx.budgetCategory.create({
          data: {
            budgetProfileId: created.id,
            categoryId: category.id,
            group: limit.group,
            monthlyLimit: limit.monthlyLimit,
          },
        });
      }

      return created;
    });

    return NextResponse.json({ id: profile.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating budget:", error);
    return NextResponse.json({ error: "A server error occurred." }, { status: 500 });
  }
}
