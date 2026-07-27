"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSync() {
    setBusy(true);
    try {
      await fetch("/api/plaid/sync", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={busy}
      className="rounded-lg border border-teal-800 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50"
    >
      {busy ? "Syncing…" : "Sync transactions"}
    </button>
  );
}
