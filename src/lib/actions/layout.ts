"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";

/** 격자 한 칸의 자리. 12칸 기준. */
const Item = z.object({
  id: z.string().min(1).max(64),
  x: z.number().int().min(0).max(11),
  y: z.number().int().min(0).max(200),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(12),
});

const Payload = z.object({
  surface: z.enum(["today"]),
  items: z.array(Item).max(60),
});

/**
 * 배치를 저장한다.
 *
 * revalidatePath 를 부르지 않는다. 카드를 놓을 때마다 서버 렌더가 다시
 * 돌면 방금 끌어놓은 화면이 깜빡이면서 되돌아온 것처럼 보인다. 배치는
 * 이미 브라우저에 반영돼 있으므로 여기서는 기록만 남기면 된다.
 */
export async function saveLayout(raw: unknown) {
  const parsed = Payload.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "잘못된 배치입니다" };

  const { user, supabase } = await requireUser();
  const { error } = await supabase.from("layouts").upsert(
    {
      user_id: user.id,
      surface: parsed.data.surface,
      items: parsed.data.items,
    },
    { onConflict: "user_id,surface" },
  );

  if (error) return { ok: false as const, error: "배치를 저장하지 못했습니다" };
  return { ok: true as const };
}
