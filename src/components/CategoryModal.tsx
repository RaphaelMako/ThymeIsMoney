"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LIST_RANGES,
  datesInSpan,
  monthTotal,
  monthsInSpan,
  priorMonths,
  priorMonthlyAverage,
  rangeStart,
  type CategoryTxn,
  type ListRange,
} from "@/lib/categoryDetail";
import {
  AVERAGE_COLOR,
  BUDGET_COLOR,
  BarsView,
  CumulativeMonthView,
  CumulativeSpanView,
  DailyView,
  HistoryView,
  ICONS,
  MerchantsView,
  ProjectionView,
  SPEND_COLOR,
} from "./CategoryViews";

type Target = { category: string; label: string };
type Ctx = { open: (category: string, label: string) => void };

const CategoryModalContext = createContext<Ctx | null>(null);

/** Null when no provider is mounted, so callers can skip the affordance. */
export function useCategoryModal() {
  return useContext(CategoryModalContext);
}

const VIEWS = [
  { key: "bars", label: "Budget, average and spend" },
  { key: "cumulative", label: "Spending over time" },
  { key: "history", label: "Month by month" },
  { key: "merchants", label: "Where it went" },
  { key: "daily", label: "Day by day" },
  { key: "projection", label: "Month-end projection" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export default function CategoryModalProvider({
  transactions,
  budgets,
  todayIso,
  children,
}: {
  transactions: CategoryTxn[];
  budgets: Record<string, number>;
  todayIso: string;
  children: React.ReactNode;
}) {
  const [target, setTarget] = useState<Target | null>(null);
  const open = useCallback((category: string, label: string) => {
    setTarget({ category, label });
  }, []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <CategoryModalContext.Provider value={value}>
      {children}
      {target && (
        <CategoryModal
          target={target}
          transactions={transactions}
          budget={budgets[target.category]}
          todayIso={todayIso}
          onClose={() => setTarget(null)}
        />
      )}
    </CategoryModalContext.Provider>
  );
}

function CategoryModal({
  target,
  transactions,
  budget,
  todayIso,
  onClose,
}: {
  target: Target;
  transactions: CategoryTxn[];
  budget?: number;
  todayIso: string;
  onClose: () => void;
}) {
  const [view, setView] = useState<ViewKey>("bars");
  const [range, setRange] = useState<ListRange>("month");
  const panelRef = useRef<HTMLDivElement>(null);
  const currentMonth = todayIso.slice(0, 7);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const categoryTxns = useMemo(
    () =>
      transactions
        .filter((t) => t.category === target.category)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [transactions, target.category]
  );

  // The range drives every view as well as the list.
  const spanStart = useMemo(() => {
    if (range !== "all") return rangeStart(range, todayIso);
    const earliest = transactions.reduce(
      (min, t) => (t.date < min ? t.date : min),
      `${currentMonth}-01`
    );
    return earliest;
  }, [range, todayIso, transactions, currentMonth]);

  const spanMonths = useMemo(() => monthsInSpan(spanStart, todayIso), [spanStart, todayIso]);
  const spanDates = useMemo(() => datesInSpan(spanStart, todayIso), [spanStart, todayIso]);
  const rangeTxns = useMemo(
    () => categoryTxns.filter((t) => t.date >= spanStart),
    [categoryTxns, spanStart]
  );

  // Averages divide by the whole observation window, not just the months this
  // category appears in, so they agree with the Category Comparison chart.
  const priorMonthKeys = useMemo(
    () => priorMonths(transactions, currentMonth),
    [transactions, currentMonth]
  );

  const monthlyAverage = priorMonthlyAverage(categoryTxns, currentMonth, priorMonthKeys.length);
  const months = spanMonths.length;
  const rangeSpend =
    range === "month"
      ? monthTotal(categoryTxns, currentMonth)
      : Math.round(rangeTxns.reduce((sum, t) => sum + t.amount, 0) * 100) / 100;
  const expected = Math.round(monthlyAverage * months * 100) / 100;
  const budgetForSpan = budget != null ? Math.round(budget * months * 100) / 100 : undefined;

  const hasBudget = budget != null && budget > 0;
  const colorKey: { label: string; color: string }[] = {
    bars: [
      { label: months > 1 ? "Actual spend" : "Monthly spend", color: SPEND_COLOR },
      { label: months > 1 ? "Expected" : "Monthly average", color: AVERAGE_COLOR },
      ...(hasBudget ? [{ label: "Budget", color: BUDGET_COLOR }] : []),
    ],
    cumulative: [
      { label: "Spent", color: SPEND_COLOR },
      { label: months > 1 ? "Expected pace" : "Average month", color: AVERAGE_COLOR },
      ...(hasBudget ? [{ label: "Budget", color: BUDGET_COLOR }] : []),
    ],
    history: [
      { label: "This month", color: SPEND_COLOR },
      { label: "Earlier months", color: AVERAGE_COLOR },
      ...(hasBudget ? [{ label: "Monthly budget", color: BUDGET_COLOR }] : []),
    ],
    merchants: [{ label: "Total spent", color: SPEND_COLOR }],
    daily: [{ label: "Spent that day", color: SPEND_COLOR }],
    projection: [
      { label: "Spent so far", color: SPEND_COLOR },
      { label: "Projected", color: AVERAGE_COLOR },
      ...(hasBudget ? [{ label: "Budget", color: BUDGET_COLOR }] : []),
    ],
  }[view];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${target.label} spending detail`}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[95vh] w-full max-w-[96rem] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl outline-none"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full text-2xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          ×
        </button>

        <div className="grid gap-10 overflow-y-auto p-10 md:grid-cols-[1fr_24rem]">
          <div className="flex min-w-0 flex-col">
            <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1">
              {colorKey.map((k) => (
                <span key={k.label} className="flex items-center gap-1.5 text-xs text-zinc-600">
                  <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: k.color }} />
                  {k.label}
                </span>
              ))}
            </div>

            <div className="h-[30rem]">
              {view === "bars" && (
                <BarsView
                  spend={rangeSpend}
                  average={expected}
                  budget={budgetForSpan}
                  months={months}
                />
              )}
              {view === "cumulative" &&
                (range === "month" ? (
                  <CumulativeMonthView
                    txns={categoryTxns}
                    todayIso={todayIso}
                    budget={budget}
                    priorMonthKeys={priorMonthKeys}
                  />
                ) : (
                  <CumulativeSpanView
                    txns={rangeTxns}
                    dates={spanDates}
                    expectedTotal={expected}
                    budgetTotal={budgetForSpan}
                  />
                ))}
              {view === "history" && (
                <HistoryView
                  txns={categoryTxns}
                  months={spanMonths}
                  currentMonth={currentMonth}
                  budget={budget}
                />
              )}
              {view === "merchants" && <MerchantsView txns={rangeTxns} />}
              {view === "daily" && <DailyView txns={rangeTxns} dates={spanDates} />}
              {view === "projection" && (
                <ProjectionView txns={categoryTxns} todayIso={todayIso} budget={budget} />
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  title={v.label}
                  aria-label={v.label}
                  aria-pressed={view === v.key}
                  className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                    view === v.key
                      ? "bg-thyme-800 text-white"
                      : "bg-thyme-50 text-thyme-800 hover:bg-thyme-100"
                  }`}
                >
                  {ICONS[v.key]}
                </button>
              ))}
            </div>
            {view === "projection" && range !== "month" && (
              <p className="mt-3 text-xs text-zinc-400">
                This view always projects the current month, whatever range is selected.
              </p>
            )}
          </div>

          <div className="flex min-w-0 flex-col">
            <h2 className="pr-10 text-right text-5xl font-bold leading-tight text-thyme-900">
              {target.label}
            </h2>

            <div className="mt-5 flex flex-wrap justify-end gap-1.5">
              {LIST_RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                    range === r.key
                      ? "bg-thyme-800 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <p className="mt-3 text-right text-xs text-zinc-500">
              {rangeTxns.length} {rangeTxns.length === 1 ? "transaction" : "transactions"} ·{" "}
              {currency.format(rangeSpend)}
            </p>

            <div className="mt-2 max-h-[34rem] overflow-y-auto">
              {rangeTxns.length === 0 ? (
                <p className="py-6 text-sm text-zinc-400">No transactions in this range.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                      <th className="py-2 pr-2 font-medium">Name</th>
                      <th className="py-2 pr-2 font-medium">Date</th>
                      <th className="py-2 text-right font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rangeTxns.map((t) => (
                      <tr key={t.id} className="border-b border-zinc-100 last:border-0">
                        <td className="max-w-40 truncate py-2 pr-2 font-bold text-zinc-800">
                          {t.name}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-2 text-zinc-500">
                          {shortDate(t.date)}
                        </td>
                        <td className="whitespace-nowrap py-2 text-right text-zinc-700">
                          {currency.format(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
