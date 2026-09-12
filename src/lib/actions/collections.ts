"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

const AddItem = z.object({
  collectionId: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().trim().min(1, "이름을 입력해 주세요").max(200),
  region: z.string().trim().max(50).optional(),
});

export async function addItem(raw: unknown) {
  const parsed = AddItem.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다" };
  }
  const { user, supabase } = await requireUser();

  const { error } = await supabase.from("collection_items").insert({
    user_id: user.id,
    collection_id: parsed.data.collectionId,
    title: parsed.data.title,
    region: parsed.data.region || null,
  });
  if (error) return { ok: false as const, error: "저장하지 못했습니다" };

  revalidatePath(`/collections/${parsed.data.slug}`);
  return { ok: true as const };
}

const SetStatus = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  visited: z.boolean(),
});

/**
 * 방문 체크. 다녀온 뒤 한 탭으로 끝나야 기록이 쌓이고,
 * 기록이 쌓여야 다음 추천이 좋아진다.
 */
export async function setVisited(raw: unknown) {
  const parsed = SetStatus.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "잘못된 요청입니다" };

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("collection_items")
    .update({
      status: parsed.data.visited ? "visited" : "wishlist",
      visited_at: parsed.data.visited ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id);

  if (error) return { ok: false as const, error: "상태를 바꾸지 못했습니다" };
  revalidatePath(`/collections/${parsed.data.slug}`);
  revalidatePath("/");
  return { ok: true as const };
}

const Note = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  rating: z.number().min(0).max(5).nullable(),
  note: z.string().trim().max(500),
});

/** 한 줄 평 + 별점. 방문 직후 알림에서도 이걸 호출한다. */
export async function logVisit(raw: unknown) {
  const parsed = Note.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "잘못된 요청입니다" };

  const { user, supabase } = await requireUser();
  const { id, slug, rating, note } = parsed.data;

  const { error: logError } = await supabase.from("collection_item_logs").insert({
    user_id: user.id,
    item_id: id,
    rating,
    note: note || null,
  });
  if (logError) return { ok: false as const, error: "기록하지 못했습니다" };

  // 항목의 대표 평점은 기록들의 평균으로 둔다. 손으로 고치는 값은 방치된다.
  const { data: logs } = await supabase
    .from("collection_item_logs")
    .select("rating")
    .eq("item_id", id)
    .not("rating", "is", null);

  const values = (logs ?? []).map((l) => Number(l.rating)).filter((n) => !Number.isNaN(n));
  const avg = values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
    : null;

  await supabase
    .from("collection_items")
    .update({ rating: avg, status: "visited", visited_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath(`/collections/${slug}`);
  return { ok: true as const };
}
