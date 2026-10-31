"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AcceptInvite({ token, slug }: { token: string; slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-4">
      <button onClick={async () => { setBusy(true); setError(null); const res = await fetch(`/api/invite/${token}`, { method: "POST" }); const d = await res.json().catch(() => ({})); setBusy(false); if (!res.ok) setError(d.error ?? "Could not accept"); else router.push(`/org/${slug}`); }} disabled={busy} className="btn btn-primary w-full justify-center">{busy ? "Joining…" : "Accept and join"}</button>
      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </div>
  );
}
