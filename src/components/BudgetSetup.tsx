"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BudgetSetup({ suggestedIncome }: { suggestedIncome: number | null }) {
  const router = useRouter();
  const [income, setIncome] = useState(suggestedIncome ? String(Math.round(suggestedIncome)) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyIncome: Number(income) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to create budget.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="mb-1 text-sm font-semibold text-zinc-900">Set up your budget</p>
      <p className="mb-4 text-sm text-zinc-500">
        Enter your monthly take-home income and Thyme will build a 50/30/20 budget — 50% needs,
        30% wants, 20% savings — split across your spending categories based on your history.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
          <input
            type="number"
            required
            min={1}
            step="0.01"
            placeholder="Monthly income"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            className="w-44 rounded-lg border border-zinc-300 py-2 pl-7 pr-3 text-sm text-black placeholder-zinc-400"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? "Building…" : "Create 50/30/20 budget"}
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
