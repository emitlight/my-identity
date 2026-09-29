"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

const Body = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "제목이 필요합니다").max(200),
  subtitle: z.string().trim().max(300).optional().or(z.literal("")),
  body: z.string().max(60000).default(""),
  cover_url: z.string().trim().max(2000).optional().or(z.literal("")),
  publish: z.enum(["draft", "published"]).default("draft"),
});

function read(form: FormData) {
  return Body.safeParse({
    id: (form.get("id") as string) || undefined,
    title: form.get("title"),
    subtitle: form.get("subtitle") ?? "",
    body: form.get("body") ?? "",
    cover_url: form.get("cover_url") ?? "",
    publish: form.get("publish") ?? "draft",
  });
}

/**
 * 쓰기·고치기 한 곳에서 처리한다.
 *
 * 저장 실패를 조용히 삼키지 않는다. 글은 다시 쓸 수 없으므로, 안 되면
 * 안 됐다고 말하고 쓰던 내용을 화면에 그대로 둬야 한다.
 */
export async function savePost(_prev: unknown, form: FormData) {
  const parsed = read(form);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "입력을 확인해 주세요" };
  }
  const { id, title, subtitle, body, cover_url, publish } = parsed.data;

  const { user, supabase } = await requireUser();
  const row = {
    user_id: user.id,
    title,
    subtitle: subtitle || null,
    body,
    cover_url: cover_url || null,
    status: publish,
  };

  let postId = id;
  if (id) {
    const { error } = await supabase.from("posts").update(row).eq("id", id);
    if (error) return { ok: false as const, error: "저장하지 못했습니다" };
  } else {
    const { data, error } = await supabase.from("posts").insert(row).select("id").single();
    if (error || !data) return { ok: false as const, error: "저장하지 못했습니다" };
    postId = (data as { id: string }).id;
  }

  revalidatePath("/posts");
  revalidatePath("/");
  redirect(`/posts/${postId}`);
}

const Id = z.object({ id: z.string().uuid() });

/** 목록에서 바로 발행·내림 */
export async function setPostStatus(raw: unknown) {
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(["draft", "published"]) }).safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "잘못된 요청입니다" };

  const { supabase } = await requireUser();
  // published_at 은 DB 트리거가 찍는다. 여러 경로에서 상태를 바꾸므로
  // 한 곳에서 보장해야 한쪽만 빠뜨리는 일이 없다.
  const { error } = await supabase
    .from("posts")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);

  if (error) return { ok: false as const, error: "바꾸지 못했습니다" };
  revalidatePath("/posts");
  revalidatePath("/");
  return { ok: true as const };
}

export async function deletePost(form: FormData) {
  const parsed = Id.safeParse({ id: form.get("id") });
  if (!parsed.success) return;

  const { supabase } = await requireUser();
  await supabase.from("posts").delete().eq("id", parsed.data.id);
  revalidatePath("/posts");
  revalidatePath("/");
  redirect("/posts");
}
