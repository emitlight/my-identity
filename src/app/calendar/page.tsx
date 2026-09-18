import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { QuickCapture } from "@/components/QuickCapture";
import { Empty, RoleDot } from "@/components/ui";
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
        <p className="krb py-10 text-[15px] text-danger">일정을 불러오지 못했습니다.</p>
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
      <div className="flex flex-col gap-8 pt-4 lg:pt-6">
        <QuickCapture />

        {byDay.size === 0 ? (
          <Empty>앞으로 60일간 등록된 일정이 없습니다.</Empty>
        ) : (
          <div>
            {[...byDay.entries()].map(([day, list]) => {
              const d = new Date(`${day}T00:00:00Z`);
              const isToday = day === today;
              return (
                <section
                  key={day}
                  className="grid grid-cols-[58px_minmax(0,1fr)] gap-4 border-b-2 border-ink/80 py-5 lg:grid-cols-[132px_minmax(0,1fr)] lg:gap-8 lg:py-7"
                >
                  {/* 날짜를 숫자로 세운다. 이 지면에서 숫자는 사진 대신이다. */}
                  <div className="pt-0.5">
                    <div
                      className={
                        "num text-[36px] leading-[.85] lg:text-[62px] " +
                        (isToday ? "text-key-ink" : "text-ink")
                      }
                    >
                      {d.getUTCDate()}
                    </div>
                    <div className="kicker-kr mt-1 text-muted">
                      {monthDay(d).split(".")[0]}월 {weekday(d)}
                    </div>
                    {isToday ? (
                      <div className="krb mt-1.5 inline-block bg-ink px-2 py-0.5 text-[10.5px] tracking-[.16em] text-key-on-dark">
                        오늘
                      </div>
                    ) : null}
                  </div>

                  <ul className="min-w-0">
                    {list.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-baseline gap-3 border-b border-line py-2.5 last:border-b-0 lg:gap-5"
                      >
                        <span className="num w-[44px] shrink-0 text-[13px] text-muted lg:w-[58px] lg:text-[16px]">
                          {e.all_day ? "종일" : hhmm(e.starts_at)}
                        </span>
                        <span className="krb min-w-0 flex-1 text-[15px] leading-snug lg:text-[19px]">
                          {e.title}
                        </span>
                        {e.region ? (
                          <span className="kicker-kr shrink-0 text-faint">{e.region}</span>
                        ) : null}
                        <RoleDot color={roleColor.get(e.role_id ?? "")} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
