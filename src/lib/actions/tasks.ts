"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/date";

const Toggle = z.object({
  id: z.string().uuid(),
  done: z.boolean(),
});

export async function toggleTask(raw: unknown) {
  const parsed = Toggle.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "잘못된 요청입니다" };

  const { supabase } = await requireUser();
  // completed_at 은 DB 트리거가 채운다. 웹·알림 액션·크론에서 모두
  // 상태를 바꾸므로 한 곳에서 보장해야 한다.
  const { error } = await supabase
    .from("tasks")
    .update({ status: parsed.data.done ? "done" : "todo" })
    .eq("id", parsed.data.id);

  if (error) return { ok: false as const, error: "상태를 바꾸지 못했습니다" };
  revalidatePath("/");
  return { ok: true as const };
}

const Schedule = z.object({ id: z.string().uuid() });

/** 인박스 항목을 오늘로 끌어온다 */
export async function scheduleToday(raw: unknown) {
  const parsed = Schedule.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "잘못된 요청입니다" };

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("tasks")
    .update({ status: "todo", scheduled_for: todayISO() })
    .eq("id", parsed.data.id);

  if (error) return { ok: false as const, error: "일정을 잡지 못했습니다" };
  revalidatePath("/");
  return { ok: true as const };
}
