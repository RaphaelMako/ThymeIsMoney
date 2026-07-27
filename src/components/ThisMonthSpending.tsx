"use client";

import { useState } from "react";

export type MonthSpendingRow = {
  id: string;
  name: string;
  date: string; // pre-formatted
  category: string;
  cost: string; // pre-formatted
  description: string | null;
  receipts: number;
  /** share of this month's spending, null for transfers/loan payments */
  percentOfMonthly: number | null;
};

const INITIAL_ROWS = 15;

export default function ThisMonthSpending({ rows }: { rows: MonthSpendingRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, INITIAL_ROWS);
  const hiddenCount = rows.length - INITIAL_ROWS;

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">No transactions yet this month.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 text-right font-medium">Cost</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 text-center font-medium">Receipts</th>
              <th className="px-4 py-3 text-right font-medium">Percent of Monthly</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-b border-zinc-50 last:border-0">
                <td className="max-w-48 truncate px-4 py-3 font-medium text-zinc-900">
                  {row.name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{row.date}</td>
                <td className="whitespace-nowrap px-4 py-3 capitalize text-zinc-500">
                  {row.category}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-zinc-900">
                  {row.cost}
                </td>
                <td className="max-w-56 truncate px-4 py-3 text-zinc-500">
                  {row.description ?? "—"}
                </td>
                <td className="px-4 py-3 text-center text-zinc-500">
                  {row.receipts > 0 ? row.receipts : "—"}
                </td>
                <td className="px-4 py-3 text-right text-zinc-500">
                  {row.percentOfMonthly != null ? `${row.percentOfMonthly.toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full border-t border-zinc-100 py-3 text-sm font-medium text-teal-800 hover:bg-teal-50"
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}
