import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateNetWorth } from "@/lib/networth";
import { categoryComparison, pickBubbles, weeklySpendComparison } from "@/lib/insights";
import BalanceHero from "@/components/BalanceHero";
import CategoryBubbles from "@/components/CategoryBubbles";
import CategoryComparisonChart from "@/components/CategoryComparisonChart";
import PlaidLinkButton from "@/components/PlaidLinkButton";
import SpendingInsightCard from "@/components/SpendingInsightCard";
import SyncButton from "@/components/SyncButton";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [bankAccounts, transactions] = await Promise.all([
    db.bankAccount.findMany({
      where: { plaidItem: { userId } },
      orderBy: { name: "asc" },
    }),
    db.transaction.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    }),
  ]);

  const netWorth = calculateNetWorth(bankAccounts);
  const hasLinkedBank = bankAccounts.length > 0;
  const chartTransactions = transactions.map((t) => ({
    date: t.date.toISOString().slice(0, 10),
    amount: Number(t.amount),
  }));
  const recent = transactions.slice(0, 10);

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
          <button className="rounded-lg border border-teal-400 px-3 py-1.5 text-xs text-teal-100 hover:bg-teal-800">
            Sign out
          </button>
        </form>
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 pb-10">
        <div className="flex gap-3">
          <PlaidLinkButton />
          {hasLinkedBank && <SyncButton />}
        </div>

        <section>
          <h2 className="mb-3 text-2xl font-bold text-teal-900">Recent Expenses</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {hasLinkedBank
                ? "No transactions yet — try syncing."
                : "Link a bank account to see transactions."}
            </p>
          ) : (
            <div className="grid items-start gap-4 md:grid-cols-[1fr_270px]">
            <div className="overflow-hidden rounded-xl bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id} className="border-b border-zinc-50 last:border-0">
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
            <CategoryComparisonChart rows={comparison.slice(0, 14)} />
          </section>
        )}

        <section>
          <h2 className="mb-3 text-2xl font-bold text-teal-900">Accounts</h2>
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
