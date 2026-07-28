"use client";

import { useState } from "react";
import Link from "next/link";

export type SpendingRow = {
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

const INITIAL_ROWS = 5;

export default function SpendingTable({
  rows,
  collapsible = true,
  monthHref,
}: {
  rows: SpendingRow[];
  /** When false, every transaction is shown with no expand/collapse toggle. */
  collapsible?: boolean;
  /** When set, a link to that month's summary page sits in the footer. */
  monthHref?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded || !collapsible ? rows : rows.slice(0, INITIAL_ROWS);
  const hiddenCount = collapsible ? rows.length - INITIAL_ROWS : 0;

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">No transactions this month.</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-sm text-zinc-500">
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
              <tr key={row.id} className="border-b border-zinc-100 last:border-0">
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
      {(hiddenCount > 0 || monthHref) && (
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-3">
          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-base font-bold text-thyme-800 hover:text-thyme-600"
            >
              {expanded ? "Show less" : `Show ${hiddenCount} more`}
            </button>
          )}
          {monthHref && (
            <Link
              href={monthHref}
              className="text-base font-bold text-thyme-800 hover:text-thyme-600"
            >
              Open Month Summary →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
