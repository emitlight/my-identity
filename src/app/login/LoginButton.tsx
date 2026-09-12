"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

export function LoginButton({ next }: { next?: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    setBusy(true);
    setFailed(false);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback${
      next ? `?next=${encodeURIComponent(next)}` : ""
    }`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    // 성공하면 브라우저가 구글로 떠나므로 여기로 돌아오지 않는다.
    if (error) {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div>
      <Button onClick={signIn} disabled={busy} className="w-full">
        {busy ? "이동 중…" : "Google로 계속하기"}
      </Button>
      {failed ? (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          구글 로그인을 시작하지 못했습니다. 네트워크를 확인하고 다시 눌러 주세요.
        </p>
      ) : null}
    </div>
  );
}
