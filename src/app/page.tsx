import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateNetWorth } from "@/lib/networth";
import { categoryComparison, pickBubbles, weeklySpendComparison } from "@/lib/insights";
import { GROUP_SHARE, groupForPlaidCategory } from "@/lib/budget";
import BalanceHero from "@/components/BalanceHero";
import BudgetCard, { type BudgetGroupSummary } from "@/components/BudgetCard";
import BudgetSetup from "@/components/BudgetSetup";
import CategoryBubbles from "@/components/CategoryBubbles";
import CategoryComparisonChart from "@/components/CategoryComparisonChart";
import PlaidLinkButton from "@/components/PlaidLinkButton";
import SpendingInsightCard from "@/components/SpendingInsightCard";
import SyncButton from "@/components/SyncButton";
import Link from "next/link";
import SpendingTable from "@/components/SpendingTable";
import { buildSpendingRows, monthLabel } from "@/lib/spendingRows";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [bankAccounts, transactions, budgetProfile] = await Promise.all([
    db.bankAccount.findMany({
      where: { plaidItem: { userId } },
      orderBy: { name: "asc" },
    }),
    db.transaction.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      include: { _count: { select: { attachments: true } } },
    }),
    db.budgetProfile.findFirst({
      where: { userId, isActive: true },
      include: { budgetCategories: { include: { category: true } } },
    }),
  ]);

  const netWorth = calculateNetWorth(bankAccounts);
  const hasLinkedBank = bankAccounts.length > 0;
  const chartTransactions = transactions.map((t) => ({
    date: t.date.toISOString().slice(0, 10),
    amount: Number(t.amount),
  }));
  const recent = transactions.slice(0, 5);

  const spendTxns = transactions.map((t) => ({
    date: t.date.toISOString().slice(0, 10),
    amount: Number(t.amount),
    category: t.plaidCategoryPrimary,
  }));
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const weekly = weeklySpendComparison(spendTxns, todayIso);
  const comparison = categoryComparison(spendTxns, todayIso);
  const daysInMonth = new Date(today.getUTCFullYear(), today.getUTCMonth() + 1, 0).getDate();
  const bubbles = pickBubbles(comparison, today.getUTCDate() / daysInMonth);
  const overspending = bubbles.filter((b) => b.direction === "over");
  const saving = bubbles.filter((b) => b.direction === "under");

  // Budget: per-category limits feed the comparison chart; group totals feed the card
  const budgetByPrimary = new Map<string, number>();
  if (budgetProfile) {
    for (const bc of budgetProfile.budgetCategories) {
      if (bc.category.plaidPrimary) {
        budgetByPrimary.set(
          bc.category.plaidPrimary,
          (budgetByPrimary.get(bc.category.plaidPrimary) ?? 0) + Number(bc.monthlyLimit)
        );
      }
    }
  }
  const comparisonRows = comparison
    .slice(0, 14)
    .map((r) => ({ ...r, monthlyBudget: budgetByPrimary.get(r.category) }));

  let budgetGroups: BudgetGroupSummary[] | null = null;
  if (budgetProfile?.monthlyIncome) {
    const income = Number(budgetProfile.monthlyIncome);
    const thisMonth = todayIso.slice(0, 7);
    const spent: Record<"NEEDS" | "WANTS" | "SAVINGS", number> = {
      NEEDS: 0,
      WANTS: 0,
      SAVINGS: 0,
    };
    for (const t of spendTxns) {
      if (t.amount <= 0 || t.date.slice(0, 7) !== thisMonth) continue;
      const group = groupForPlaidCategory(t.category);
      if (group) spent[group] += t.amount;
    }
    budgetGroups = (["NEEDS", "WANTS", "SAVINGS"] as const).map((group) => ({
      group,
      label: group.charAt(0) + group.slice(1).toLowerCase(),
      spent: Math.round(spent[group] * 100) / 100,
      allocated: Math.round(income * GROUP_SHARE[group] * 100) / 100,
    }));
  }

  // This Month's Spending table
  const thisMonthKey = todayIso.slice(0, 7);
  const { rows: monthRows } = buildSpendingRows(transactions, thisMonthKey);

  // Past months with any activity, newest first
  const pastMonths = [
    ...new Set(
      transactions
        .map((t) => t.date.toISOString().slice(0, 7))
        .filter((m) => m < thisMonthKey)
    ),
  ].sort((a, b) => (a < b ? 1 : -1));

  // Suggest income from deposits categorized as income by Plaid
  const incomeMonths = new Map<string, number>();
  for (const t of spendTxns) {
    if (t.amount < 0 && t.category === "INCOME") {
      const month = t.date.slice(0, 7);
      incomeMonths.set(month, (incomeMonths.get(month) ?? 0) + Math.abs(t.amount));
    }
  }
  const suggestedIncome =
    incomeMonths.size > 0
      ? [...incomeMonths.values()].reduce((a, b) => a + b, 0) / incomeMonths.size
      : null;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <div className="relative">
        <BalanceHero
          name={session.user.name ?? session.user.email ?? ""}
          netWorth={netWorth}
          transactions={chartTransactions}
        />
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
          className="absolute right-6 top-6"
        >
          <button className="rounded-lg border border-thyme-400 px-3 py-1.5 text-xs text-thyme-100 hover:bg-thyme-800">
            Sign out
          </button>
        </form>
      </div>

      <main className="mx-auto flex w-[85%] flex-1 flex-col gap-12 pb-16 pt-4">
        <div className="flex gap-3">
          <PlaidLinkButton />
          {hasLinkedBank && <SyncButton />}
        </div>

        <section>
          <h2 className="mb-3 text-2xl font-bold text-thyme-900">Recent Expenses</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {hasLinkedBank
                ? "No transactions yet — try syncing."
                : "Link a bank account to see transactions."}
            </p>
          ) : (
            <div className="grid items-start gap-10 md:grid-cols-[2fr_1fr]">
            <div>
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-sm text-zinc-500">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {t.merchantName ?? t.name}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {t.date.toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </td>
                      <td className="px-4 py-3 capitalize text-zinc-500">
                        {t.plaidCategoryPrimary?.replaceAll("_", " ").toLowerCase() ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-900">
                        {currency.format(Number(t.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SpendingInsightCard comparison={weekly} />
            </div>
          )}
        </section>

        {bubbles.length > 0 && (
          <section className="flex flex-col gap-6">
            <p className="mx-auto max-w-xl text-center text-lg font-bold leading-relaxed text-zinc-900">
              {overspending.length > 0 && (
                <>
                  You&apos;re way overspending on{" "}
                  {overspending.map((b, i) => (
                    <span key={b.category}>
                      <span className="text-red-600">{b.label.toLowerCase()}</span>
                      {i < overspending.length - 2 ? ", " : i === overspending.length - 2 ? ", and " : ""}
                    </span>
                  ))}
                  .{" "}
                </>
              )}
              {saving.length > 0 && (
                <>
                  {overspending.length > 0 ? "But, you're" : "You're"} saving well on{" "}
                  {saving.map((b, i) => (
                    <span key={b.category}>
                      <span className="text-green-700">{b.label.toLowerCase()}</span>
                      {i < saving.length - 2 ? ", " : i === saving.length - 2 ? ", and " : ""}
                    </span>
                  ))}
                  !
                </>
              )}
            </p>
            <CategoryBubbles bubbles={bubbles} />
          </section>
        )}

        {comparison.length > 0 && (
          <section>
            <CategoryComparisonChart rows={comparisonRows} />
          </section>
        )}

        {hasLinkedBank && (
          <section>
            <h2 className="mb-3 text-2xl font-bold text-thyme-900">Budget</h2>
            {budgetGroups ? (
              <BudgetCard groups={budgetGroups} />
            ) : (
              <BudgetSetup suggestedIncome={suggestedIncome} />
            )}
          </section>
        )}

        {hasLinkedBank && (
          <section>
            <h2 className="mb-3 text-2xl font-bold text-thyme-900">
              This Month&apos;s Spending
            </h2>
            <SpendingTable rows={monthRows} />
          </section>
        )}

        {pastMonths.length > 0 && (
          <section>
            <h2 className="mb-3 text-2xl font-bold text-thyme-900">
              Past Months&apos; Spending Summaries
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {pastMonths.map((month) => (
                <Link
                  key={month}
                  href={`/month/${month}`}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-4 text-center text-sm font-semibold text-thyme-900 shadow-sm transition-colors hover:border-thyme-700 hover:bg-thyme-50"
                >
                  {monthLabel(month)}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-2xl font-bold text-thyme-900">Accounts</h2>
          {bankAccounts.length === 0 ? (
            <p className="text-sm text-zinc-500">No accounts linked yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {bankAccounts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{a.name}</p>
                    <p className="text-xs text-zinc-500">
                      {a.subtype ?? a.type}
                      {a.mask ? ` ••${a.mask}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {a.currentBalance != null ? currency.format(Number(a.currentBalance)) : "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
