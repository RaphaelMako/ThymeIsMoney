// Spending aggregation helpers. All dates are ISO YYYY-MM-DD strings and
// "today" is passed in explicitly so these stay pure and testable.

export type SpendTxn = {
  date: string;
  amount: number; // Plaid convention: positive = money out
  category: string | null;
};

// Money movement that isn't really "spending"
const NON_SPEND_CATEGORIES = new Set(["TRANSFER_IN", "TRANSFER_OUT", "LOAN_PAYMENTS"]);

export function isSpend(txn: SpendTxn): boolean {
  return txn.amount > 0 && !NON_SPEND_CATEGORIES.has(txn.category ?? "");
}

export function prettyCategory(raw: string): string {
  return raw
    .split("_")
    .map((w) => (w === "AND" ? "and" : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function shortLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export type WeeklyComparison = {
  points: { label: string; current: number; usual: number }[];
  /** usual total minus current total: positive = spending less than usual */
  diff: number;
};

/**
 * Cumulative spend over the last 7 days vs the average of the four
 * preceding aligned 7-day windows (only windows the data actually covers).
 */
export function weeklySpendComparison(txns: SpendTxn[], today: string): WeeklyComparison {
  const spend = txns.filter(isSpend);
  const byDate = new Map<string, number>();
  let earliest = today;
  for (const t of spend) {
    byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.amount);
    if (t.date < earliest) earliest = t.date;
  }

  const windows: number[][] = [];
  for (let w = 4; w >= 1; w--) {
    const end = addDays(today, -7 * w);
    if (addDays(end, -6) < earliest) continue;
    const daily: number[] = [];
    for (let i = 0; i < 7; i++) daily.push(byDate.get(addDays(end, i - 6)) ?? 0);
    windows.push(daily);
  }

  const points = [];
  let current = 0;
  let usual = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i - 6);
    current += byDate.get(date) ?? 0;
    if (windows.length > 0) {
      usual += windows.reduce((s, w) => s + w[i], 0) / windows.length;
    }
    points.push({
      label: shortLabel(date),
      current: Math.round(current * 100) / 100,
      usual: Math.round(usual * 100) / 100,
    });
  }

  return { points, diff: Math.round((usual - current) * 100) / 100 };
}

export type CategoryRow = {
  category: string;
  label: string;
  thisMonth: number;
  monthlyAverage: number;
};

/** Per-category spend this calendar month vs the average of prior months. */
export function categoryComparison(txns: SpendTxn[], today: string): CategoryRow[] {
  const spend = txns.filter((t) => isSpend(t) && t.category);
  const thisMonth = today.slice(0, 7);

  const priorMonths = new Set<string>();
  for (const t of spend) {
    const month = t.date.slice(0, 7);
    if (month < thisMonth) priorMonths.add(month);
  }

  const totals = new Map<string, { thisMonth: number; prior: number }>();
  for (const t of spend) {
    const entry = totals.get(t.category!) ?? { thisMonth: 0, prior: 0 };
    if (t.date.slice(0, 7) === thisMonth) entry.thisMonth += t.amount;
    else entry.prior += t.amount;
    totals.set(t.category!, entry);
  }

  return [...totals.entries()]
    .map(([category, v]) => ({
      category,
      label: prettyCategory(category),
      thisMonth: Math.round(v.thisMonth * 100) / 100,
      monthlyAverage:
        priorMonths.size > 0 ? Math.round((v.prior / priorMonths.size) * 100) / 100 : 0,
    }))
    .filter((r) => r.thisMonth > 0 || r.monthlyAverage > 0)
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage);
}

export type Bubble = {
  category: string;
  label: string;
  /** spend so far this month relative to what's typical by this point */
  ratio: number;
  direction: "over" | "under";
};

/**
 * Pick the strongest over- and under-spending categories, comparing this
 * month's spend against the prior-month average prorated by how far into
 * the month we are.
 */
export function pickBubbles(rows: CategoryRow[], fractionOfMonthElapsed: number): Bubble[] {
  const rated = rows
    .map((r) => {
      const expected = r.monthlyAverage * fractionOfMonthElapsed;
      return expected >= 10 ? { ...r, ratio: r.thisMonth / expected } : null;
    })
    .filter((r) => r !== null);

  const over = rated
    .filter((r) => r.ratio >= 1.15)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3)
    .map((r) => ({ category: r.category, label: r.label, ratio: r.ratio, direction: "over" as const }));

  const under = rated
    .filter((r) => r.ratio <= 0.85)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 3)
    .map((r) => ({ category: r.category, label: r.label, ratio: r.ratio, direction: "under" as const }));

  return [...over, ...under];
}
