"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink, type PlaidLinkOnSuccess } from "react-plaid-link";

export default function PlaidLinkButton() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then((res) => res.json())
      .then((data) => setToken(data.link_token ?? null))
      .catch(() => setToken(null));
  }, []);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken) => {
      setBusy(true);
      try {
        await fetch("/api/plaid/exchange-public-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken }),
        });
        await fetch("/api/plaid/sync", { method: "POST" });
        router.refresh();
      } finally {
        setBusy(false);
      }
    },
    [router]
  );

  const { open, ready } = usePlaidLink({ token, onSuccess });

  return (
    <button
      onClick={() => open()}
      disabled={!ready || busy}
      className="rounded-lg bg-thyme-800 px-4 py-2 text-sm font-medium text-white hover:bg-thyme-700 disabled:opacity-50"
    >
      {busy ? "Linking…" : "Link a bank account"}
    </button>
  );
}
