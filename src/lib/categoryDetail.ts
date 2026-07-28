// Aggregations behind the category detail modal. Pure and client-safe:
// dates are ISO YYYY-MM-DD strings and "today" is always passed in.

export type CategoryTxn = {
  id: string;
  name: string;
  date: string;
  amount: number;
  category: string;
};

export type ListRange = "month" | "6m" | "ytd" | "1y" | "all";

export const LIST_RANGES: { key: ListRange; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "6m", label: "6 months" },
  { key: "ytd", label: "YTD" },
  { key: "1y", label: "1 year" },
  { key: "all", label: "All time" },
];

const round2 = (n: number) => Math.round(n * 100) / 100;
const monthOf = (iso: string) => iso.slice(0, 7);

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthLabelShort(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

/** Inclusive lower bound for a list range. */
export function rangeStart(range: ListRange, todayIso: string): string {
  const [y, m, d] = todayIso.split("-").map(Number);
  switch (range) {
    case "month":
      return `${monthOf(todayIso)}-01`;
    case "6m":
      return new Date(Date.UTC(y, m - 6, 1)).toISOString().slice(0, 10);
    case "ytd":
      return `${y}-01-01`;
    case "1y":
      return new Date(Date.UTC(y - 1, m - 1, d)).toISOString().slice(0, 10);
    case "all":
      return "0000-01-01";
  }
}

/** Every month key from `startIso` through `endIso`, inclusive. */
export function monthsInSpan(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const [sy, sm] = startIso.split("-").map(Number);
  const end = monthOf(endIso);
  const cursor = new Date(Date.UTC(sy, sm - 1, 1));
  for (let guard = 0; guard < 600; guard++) {
    const key = cursor.toISOString().slice(0, 7);
    out.push(key);
    if (key >= end) break;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

/** Every calendar date from `startIso` through `endIso`, inclusive. */
export function datesInSpan(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  for (let guard = 0; cursor <= end && guard < 4000; guard++) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function monthTotal(txns: CategoryTxn[], month: string): number {
  return round2(txns.reduce((sum, t) => (monthOf(t.date) === month ? sum + t.amount : sum), 0));
}

/** Months before `currentMonth` that actually have activity. */
export function priorMonths(txns: CategoryTxn[], currentMonth: string): string[] {
  return [...new Set(txns.map((t) => monthOf(t.date)).filter((m) => m < currentMonth))].sort();
}

/**
 * Average spend per month for a category. `monthCount` is the number of prior
 * months of history overall, not just the ones this category appears in — a
 * monthly budget applies whether or not you bought anything, and it keeps this
 * figure equal to the Monthly Average in the comparison chart.
 */
export function priorMonthlyAverage(
  txns: CategoryTxn[],
  currentMonth: string,
  monthCount: number
): number {
  if (monthCount <= 0) return 0;
  const total = txns.reduce((sum, t) => (monthOf(t.date) < currentMonth ? sum + t.amount : sum), 0);
  return round2(total / monthCount);
}

/** Totals for each given month, in the order supplied. */
export function monthlyHistory(
  txns: CategoryTxn[],
  months: string[]
): { month: string; total: number }[] {
  return months.map((month) => ({ month, total: monthTotal(txns, month) }));
}

/** Running total across an explicit date span. */
export function cumulativeOverSpan(
  txns: CategoryTxn[],
  dates: string[]
): { date: string; spent: number }[] {
  const byDate = new Map<string, number>();
  for (const t of txns) byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.amount);

  let running = 0;
  return dates.map((date) => {
    running += byDate.get(date) ?? 0;
    return { date, spent: round2(running) };
  });
}

/** Per-day totals across an explicit date span. */
export function dailyOverSpan(
  txns: CategoryTxn[],
  dates: string[]
): { date: string; total: number }[] {
  const byDate = new Map<string, number>();
  for (const t of txns) byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.amount);
  return dates.map((date) => ({ date, total: round2(byDate.get(date) ?? 0) }));
}

/** Per-month daily sums, indexed by day of month. */
function dailySumsByMonth(txns: CategoryTxn[]): Map<string, number[]> {
  const byMonth = new Map<string, number[]>();
  for (const t of txns) {
    const month = monthOf(t.date);
    const day = Number(t.date.slice(8, 10));
    const days = byMonth.get(month) ?? [];
    days[day] = (days[day] ?? 0) + t.amount;
    byMonth.set(month, days);
  }
  return byMonth;
}

/**
 * Running spend through the current month against the average month's
 * trajectory (the mean, day by day, of every prior month with activity).
 * This month stops at today so the line does not flatline into the future.
 */
export function cumulativeSeries(
  txns: CategoryTxn[],
  todayIso: string,
  priorMonthKeys: string[]
) {
  const currentMonth = monthOf(todayIso);
  const today = Number(todayIso.slice(8, 10));
  const total = daysInMonth(currentMonth);
  const prior = priorMonthKeys;
  const byMonth = dailySumsByMonth(txns);

  const priorRunning = prior.map(() => 0);
  let running = 0;
  const points: { day: number; thisMonth: number | null; average: number | null }[] = [];

  for (let day = 1; day <= total; day++) {
    running += byMonth.get(currentMonth)?.[day] ?? 0;
    prior.forEach((month, i) => {
      priorRunning[i] += byMonth.get(month)?.[day] ?? 0;
    });
    points.push({
      day,
      thisMonth: day <= today ? round2(running) : null,
      average: prior.length
        ? round2(priorRunning.reduce((a, b) => a + b, 0) / prior.length)
        : null,
    });
  }
  return points;
}

export function dailyTotals(
  txns: CategoryTxn[],
  currentMonth: string
): { day: number; total: number }[] {
  const days = Array.from({ length: daysInMonth(currentMonth) }, (_, i) => ({
    day: i + 1,
    total: 0,
  }));
  for (const t of txns) {
    if (monthOf(t.date) !== currentMonth) continue;
    const day = Number(t.date.slice(8, 10));
    days[day - 1].total = round2(days[day - 1].total + t.amount);
  }
  return days;
}

export function merchantTotals(
  txns: CategoryTxn[]
): { name: string; total: number; count: number }[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of txns) {
    const entry = map.get(t.name) ?? { total: 0, count: 0 };
    entry.total += t.amount;
    entry.count += 1;
    map.set(t.name, entry);
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, total: round2(v.total), count: v.count }))
    .sort((a, b) => b.total - a.total);
}

/** Straight-line projection of the month's total from the pace so far. */
export function projectMonthEnd(txns: CategoryTxn[], todayIso: string) {
  const currentMonth = monthOf(todayIso);
  const dayOfMonth = Number(todayIso.slice(8, 10));
  const total = daysInMonth(currentMonth);
  const spent = monthTotal(txns, currentMonth);
  return {
    spent,
    projected: dayOfMonth > 0 ? round2((spent / dayOfMonth) * total) : 0,
    dayOfMonth,
    daysInMonth: total,
  };
}
