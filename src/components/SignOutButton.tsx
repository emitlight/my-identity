"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 어느 화면에서나 한 번에 빠져나올 수 있어야 한다.
 *
 * 호버 표시를 불투명도로 하지 않는다. opacity 가 1 미만이면 그 요소는
 * 자기만의 쌓임 맥락을 만드는데, 1 로 올라가는 순간 그게 사라지면서
 * 이웃과의 그리기 순서가 뒤집힌다. 제호처럼 자기 상자 밖으로 삐져나온
 * 큰 활자가 옆에 있으면 호버 → 순서 뒤집힘 → 호버 풀림 → 되돌아옴 이
 * 매 프레임 반복되면서 미친듯이 껌뻑인다. 색만 바꾸면 그 일이 없다.
 */
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
        "kicker shrink-0 cursor-pointer underline decoration-[1px] underline-offset-2 " +
        "transition-[color,text-decoration-color] hover:decoration-[2px] disabled:cursor-wait " +
        className
      }
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
