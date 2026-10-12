"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

/**
 * 편집실 — 발행기와 나 사이의 유일한 통로.
 *
 * 처음에는 메일로 물어보려 했다. 그런데 메일은 한 방향이다. 발행기가
 * 질문을 보낼 수는 있어도 답장을 받을 곳이 없다. 그래서 묻는 곳과
 * 답하는 곳을 같은 자리에 둔다. 여기 적힌 답은 다음 호의 프롬프트에
 * 그대로 들어간다.
 */

const Answer = z.object({
  id: z.string().uuid(),
  answer: z.string().trim().min(1, "답을 적어주세요").max(4000),
});

export async function answerNote(form: FormData) {
  const parsed = Answer.safeParse({
    id: form.get("id"),
    answer: form.get("answer"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("editor_notes")
    .update({
      answer: parsed.data.answer,
      status: "answered",
      answered_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (error) return { error: "저장하지 못했습니다" };
  revalidatePath("/editor");
  return { ok: true };
}

const Request = z.object({
  body: z.string().trim().min(1, "무엇을 쓸지 적어주세요").max(2000),
  topic_id: z.string().uuid().optional(),
});

/** 내일 치를 지정한다. 발행기는 요청이 있으면 그것부터 쓴다. */
export async function requestTopic(form: FormData) {
  const raw = (form.get("topic_id") as string) || "";
  const parsed = Request.safeParse({
    body: form.get("body"),
    topic_id: raw || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("editor_notes").insert({
    kind: "request",
    body: parsed.data.body,
    topic_id: parsed.data.topic_id ?? null,
    status: "open",
  });

  if (error) return { error: "저장하지 못했습니다" };
  revalidatePath("/editor");
  return { ok: true };
}

const Tune = z.object({
  id: z.string().uuid(),
  weight: z.coerce.number().int().min(1).max(5).optional(),
  active: z.enum(["on", "off"]).optional(),
});

/**
 * 주제의 손잡이. 요즘 꽂힌 것은 올리고, 당분간 안 보고 싶은 것은 끈다.
 * 끄는 쪽이 중요하다 — 끌 수 없으면 안 읽히는 글이 계속 쌓이고,
 * 그러면 잡지 자체를 안 열게 된다.
 */
export async function tuneTopic(form: FormData) {
  const parsed = Tune.safeParse({
    id: form.get("id"),
    weight: form.get("weight") ?? undefined,
    active: form.get("active") ?? undefined,
  });
  if (!parsed.success) return { error: "값이 올바르지 않습니다" };

  const patch: Record<string, unknown> = {};
  if (parsed.data.weight !== undefined) patch.weight = parsed.data.weight;
  if (parsed.data.active !== undefined) patch.active = parsed.data.active === "on";
  if (!Object.keys(patch).length) return { ok: true };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("topics").update(patch).eq("id", parsed.data.id);

  if (error) return { error: "저장하지 못했습니다" };
  revalidatePath("/editor");
  return { ok: true };
}

const NewTopic = z.object({
  title: z.string().trim().min(1, "주제 이름이 필요합니다").max(80),
  angle: z.string().trim().max(500).optional().or(z.literal("")),
  area: z.enum(["lifelog", "finance", "workout", "future", "language", "career"]),
});

/** 노션에 없던 관심사가 생기면 여기서 추가한다. */
export async function addTopic(form: FormData) {
  const parsed = NewTopic.safeParse({
    title: form.get("title"),
    angle: form.get("angle") ?? "",
    area: form.get("area") ?? "lifelog",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("topics").insert({
    title: parsed.data.title,
    angle: parsed.data.angle || null,
    area: parsed.data.area,
    weight: 4, // 새로 넣은 것은 보고 싶어서 넣은 것이다. 조금 높게 시작한다.
  });

  if (error) {
    return { error: error.code === "23505" ? "이미 있는 주제입니다" : "저장하지 못했습니다" };
  }
  revalidatePath("/editor");
  return { ok: true };
}
