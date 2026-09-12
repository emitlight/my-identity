"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/date";

const Toggle = z.object({
  habitId: z.string().uuid(),
  done: z.boolean(),
});

export async function toggleHabit(raw: unknown) {
  const parsed = Toggle.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "잘못된 요청입니다" };

  const { user, supabase } = await requireUser();
  const on = todayISO();

  if (parsed.data.done) {
    // (habit_id, logged_on) 유니크. 두 번 눌러도 한 줄이다.
    const { error } = await supabase
      .from("habit_logs")
      .upsert(
        { user_id: user.id, habit_id: parsed.data.habitId, logged_on: on },
        { onConflict: "habit_id,logged_on" },
      );
    if (error) return { ok: false as const, error: "체크하지 못했습니다" };
  } else {
    const { error } = await supabase
      .from("habit_logs")
      .delete()
      .eq("habit_id", parsed.data.habitId)
      .eq("logged_on", on);
    if (error) return { ok: false as const, error: "해제하지 못했습니다" };
  }

  revalidatePath("/");
  return { ok: true as const };
}
