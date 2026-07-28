import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import SpendingTable from "@/components/SpendingTable";
import { buildSpendingRows, monthLabel } from "@/lib/spendingRows";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function MonthPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) notFound();

  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const transactions = await db.transaction.findMany({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: { date: "desc" },
    include: { _count: { select: { attachments: true } } },
  });

  const { rows, totalSpend } = buildSpendingRows(transactions, month);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="bg-thyme-900 px-6 py-10 text-white">
        <div className="mx-auto w-[85%]">
          <Link href="/" className="text-sm text-thyme-200 hover:text-white">
            ← Back to dashboard
          </Link>
          <h1 className="mt-3 text-3xl font-bold">{monthLabel(month)}</h1>
          <p className="mt-2 text-4xl font-bold tracking-tight">{currency.format(totalSpend)}</p>
          <p className="mt-1 text-xs text-thyme-200">Total spending this month.</p>
        </div>
      </header>

      <main className="mx-auto flex w-[85%] flex-1 flex-col gap-8 py-8">
        <section>
          <h2 className="mb-3 text-2xl font-bold text-thyme-900">Spending</h2>
          <SpendingTable rows={rows} collapsible={false} />
        </section>
      </main>
    </div>
  );
}
