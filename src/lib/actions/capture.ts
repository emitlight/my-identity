"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { parseEventInput } from "@/lib/parse-event";
import { todayISO, TZ } from "@/lib/date";

const Input = z.object({
  text: z.string().trim().min(1, "내용을 입력해 주세요").max(500),
  // 자동 판별을 사용자가 덮어쓸 수 있다. 파서가 틀렸을 때
  // 고치는 비용이 폼을 채우는 비용보다 싸야 한다.
  force: z.enum(["auto", "event", "task"]).default("auto"),
});

export type CaptureResult =
  | { ok: true; kind: "event" | "task"; title: string }
  | { ok: false; error: string };

/**
 * 빠른 캡처 — 한 줄을 받아 일정이나 할 일로 만든다.
 *
 * 클라이언트에서도 같은 파서로 미리보기를 만들지만, 쓰기는 여기서 다시
 * 파싱한 결과로 한다. 클라이언트가 보낸 구조를 그대로 믿지 않는다.
 */
export async function capture(raw: unknown): Promise<CaptureResult> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "입력이 올바르지 않습니다" };
  }
  const { text, force } = parsed.data;

  const { user, supabase } = await requireUser();
  const p = parseEventInput(text, new Date(), TZ);

  const asEvent = force === "event" || (force === "auto" && !p.needsForm);

  if (asEvent && p.startsAt) {
    const { error } = await supabase.from("events").insert({
      user_id: user.id,
      title: p.title,
      starts_at: p.startsAt.toISOString(),
      ends_at: p.endsAt?.toISOString() ?? null,
      all_day: p.allDay,
      region: p.region,
      recurrence: p.recurrence,
    });
    if (error) return { ok: false, error: `일정을 저장하지 못했습니다: ${error.message}` };

    revalidatePath("/");
    revalidatePath("/calendar");
    return { ok: true, kind: "event", title: p.title };
  }

  // 날짜가 없으면 인박스 할 일이 된다. 분류를 요구하지 않는다.
  // 날짜만 못 읽었을 뿐이므로 읽어낸 날짜가 있으면 예정일로 넣어준다.
  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    title: p.title || text,
    status: force === "task" && p.startsAt ? "todo" : "inbox",
    scheduled_for: p.startsAt ? todayISOFrom(p.startsAt) : null,
  });
  if (error) return { ok: false, error: `할 일을 저장하지 못했습니다: ${error.message}` };

  revalidatePath("/");
  revalidatePath("/tasks");
  return { ok: true, kind: "task", title: p.title || text };
}

function todayISOFrom(d: Date): string {
  return todayISO(d, TZ);
}
