import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import PlaidLinkButton from "@/components/PlaidLinkButton";
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
      take: 25,
    }),
  ]);

  const totalBalance = bankAccounts.reduce((sum, a) => sum + Number(a.currentBalance ?? 0), 0);
  const hasLinkedBank = bankAccounts.length > 0;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="bg-teal-900 px-6 py-8 text-white">
        <div className="mx-auto flex w-full max-w-3xl items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Good Morning {session.user.name ?? session.user.email}
            </h1>
            <p className="mt-2 text-4xl font-bold">{currency.format(totalBalance)}</p>
            <p className="mt-1 text-xs text-teal-200">Across all accounts.</p>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="rounded-lg border border-teal-400 px-3 py-1.5 text-xs text-teal-100 hover:bg-teal-800">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-8">
        <div className="flex gap-3">
          <PlaidLinkButton />
          {hasLinkedBank && <SyncButton />}
        </div>

        {hasLinkedBank && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-teal-900">Accounts</h2>
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
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold text-teal-900">Recent Expenses</h2>
          {transactions.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {hasLinkedBank
                ? "No transactions yet — try syncing."
                : "Link a bank account to see transactions."}
            </p>
          ) : (
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
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-b border-zinc-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {t.merchantName ?? t.name}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {t.date.toISOString().slice(0, 10)}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
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
          )}
        </section>
      </main>
    </div>
  );
}
