"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await createClient().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
      className="mt-3 text-[12.5px] text-faint underline underline-offset-2 hover:text-muted disabled:opacity-50"
    >
      {busy ? "로그아웃 중…" : "로그아웃"}
    </button>
  );
}
