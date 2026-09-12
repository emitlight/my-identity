"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";

const Sub = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(400).optional(),
});

export async function saveSubscription(raw: unknown) {
  const parsed = Sub.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "구독 정보가 올바르지 않습니다" };

  const { user, supabase } = await requireUser();
  const { endpoint, p256dh, auth, userAgent } = parsed.data;

  // endpoint 가 유니크. 같은 기기에서 다시 등록해도 한 줄이다.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) return { ok: false as const, error: "구독을 저장하지 못했습니다" };
  return { ok: true as const };
}

export async function removeSubscription(endpoint: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) return { ok: false as const, error: "해제하지 못했습니다" };
  return { ok: true as const };
}
