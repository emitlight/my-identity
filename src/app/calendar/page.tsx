import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { QuickCapture } from "@/components/QuickCapture";
import { Card, SectionLabel, Empty, RoleDot } from "@/components/ui";
import { todayISO, hhmm, monthDay, weekday, TZ } from "@/lib/date";
import type { CalendarEvent, Role } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 모바일 기본은 어젠다다. 월간 격자는 폰에서 글자가 읽히지 않는다. */
export default async function CalendarPage() {
  const { supabase } = await requireUser();
  const today = todayISO();
  const from = new Date(`${today}T00:00:00Z`);
  const to = new Date(from.getTime() + 60 * 86400_000);

  const [{ data: events, error }, { data: roles }] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at"),
    supabase.from("roles").select("*").eq("active", true),
  ]);

  if (error) {
    return (
      <AppShell active="calendar" title="캘린더">
        <Card className="p-5">
          <p className="text-[14.5px] text-danger">일정을 불러오지 못했습니다.</p>
        </Card>
      </AppShell>
    );
  }

  const roleColor = new Map((roles ?? []).map((r: Role) => [r.id, r.color]));
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of (events ?? []) as CalendarEvent[]) {
    const key = todayISO(new Date(e.starts_at), TZ);
    const list = byDay.get(key);
    if (list) list.push(e);
    else byDay.set(key, [e]);
  }

  return (
    <AppShell active="calendar" title="캘린더" subtitle="앞으로 60일">
      <div className="flex flex-col gap-6">
        <QuickCapture />

        {byDay.size === 0 ? (
          <Card>
            <Empty>앞으로 60일간 등록된 일정이 없습니다.</Empty>
          </Card>
        ) : (
          [...byDay.entries()].map(([day, list]) => {
            const d = new Date(`${day}T00:00:00Z`);
            return (
              <section key={day} className="flex flex-col gap-2">
                <SectionLabel right={day === today ? "오늘" : undefined}>
                  {monthDay(d)} {weekday(d)}
                </SectionLabel>
                <Card className="divide-y divide-line-soft">
                  {list.map((e) => (
                    <div key={e.id} className="flex items-baseline gap-3 px-3 py-2.5">
                      <span className="w-[42px] shrink-0 text-[12.5px] tnum text-muted">
                        {e.all_day ? "종일" : hhmm(e.starts_at)}
                      </span>
                      <span className="min-w-0 flex-1 text-[14.5px] leading-snug">
                        {e.title}
                      </span>
                      {e.region ? (
                        <span className="shrink-0 text-[11.5px] text-faint">{e.region}</span>
                      ) : null}
                      <RoleDot color={roleColor.get(e.role_id ?? "")} />
                    </div>
                  ))}
                </Card>
              </section>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
