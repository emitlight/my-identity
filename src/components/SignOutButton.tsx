"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** 어느 화면에서나 한 번에 빠져나올 수 있어야 한다 */
export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await createClient().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
      className={
        "kicker shrink-0 text-faint underline underline-offset-2 hover:text-key-ink disabled:opacity-50 " +
        className
      }
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
