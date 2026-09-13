import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, SectionLabel, Empty } from "@/components/ui";
import { daysUntil, todayISO, monthDay } from "@/lib/date";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Profile {
  display_name: string | null;
  email: string | null;
  birth_date: string | null;
  birth_place: string | null;
  career_started_at: string | null;
  company: string | null;
  job_title: string | null;
  bio: string | null;
}

interface InterestRow {
  id: string;
  title: string;
  area: "lifelog" | "workout" | "finance" | "language" | "other";
  emoji: string | null;
  note: string | null;
  status: "active" | "someday" | "paused" | "dropped";
  linked: boolean;
  last_active: string | null;
}

interface Aspiration {
  id: string;
  title: string;
  statement: string | null;
  domain: string;
}

const AREA_LABEL: Record<InterestRow["area"], string> = {
  lifelog: "일상 취미",
  workout: "운동",
  finance: "자산 · 소비",
  language: "언어",
  other: "그 외",
};
const AREA_ORDER: InterestRow["area"][] = ["lifelog", "workout", "finance", "language", "other"];

/** 마지막 활동을 사람 말로. null 은 "아직 아무것도 없음" 이고 그 자체가 정보다. */
function activityLabel(last: string | null, linked: boolean): { text: string; quiet: boolean } {
  if (!last) {
    return linked
      ? { text: "기록 없음", quiet: true }
      : { text: "아직 연결 안 됨", quiet: true };
  }
  const days = -daysUntil(last.slice(0, 10));
  if (days <= 0) return { text: "오늘", quiet: false };
  if (days === 1) return { text: "어제", quiet: false };
  if (days < 30) return { text: `${days}일 전`, quiet: false };
  if (days < 365) return { text: `${Math.floor(days / 30)}개월 전`, quiet: true };
  return { text: "1년 넘음", quiet: true };
}

export default async function IdentityPage() {
  const { user, supabase } = await requireUser();

  const [{ data: profile }, { data: roles }, { data: values }, { data: asps }, { data: interests }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, email, birth_date, birth_place, career_started_at, company, job_title, bio")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("roles").select("*").eq("active", true).order("sort_order"),
      supabase.from("core_values").select("id, title, description").order("sort_order"),
      supabase.from("aspirations").select("id, title, statement, domain").eq("status", "active"),
      supabase.rpc("interests_view"),
    ]);

  const p = (profile ?? {}) as Profile;
  const today = todayISO();

  // 생일 · 근속. 날짜로 저장해둔 덕에 계산되고, 계산되니 알림도 걸린다.
  let age: number | null = null;
  let untilBirthday: number | null = null;
  if (p.birth_date) {
    const [y, m, d] = p.birth_date.split("-").map(Number);
    const [ty, tm, td] = today.split("-").map(Number);
    age = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
    const thisYear = `${ty}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const nextYear = `${ty + 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const n = daysUntil(thisYear);
    untilBirthday = n >= 0 ? n : daysUntil(nextYear);
  }
  const tenureDays = p.career_started_at ? -daysUntil(p.career_started_at) : null;

  const rows = (interests ?? []) as InterestRow[];
  const byArea = AREA_ORDER.map((a) => ({
    area: a,
    items: rows.filter((r) => r.area === a),
  })).filter((g) => g.items.length);

  return (
    <AppShell
      active="identity"
      title="나"
      subtitle={p.display_name ?? p.email ?? undefined}
    >
      <div className="flex flex-col gap-6">
        {/* ---------- 소개 ---------- */}
        <section className="flex flex-col gap-2">
          <SectionLabel>소개</SectionLabel>
          <Card className="p-5">
            <div className="flex flex-wrap gap-x-7 gap-y-3">
              {age != null ? (
                <Fact label="나이" value={`만 ${age}세`} sub={
                  untilBirthday === 0 ? "오늘 생일" :
                  untilBirthday != null ? `생일까지 ${untilBirthday}일` : undefined
                } />
              ) : null}
              {p.birth_place ? <Fact label="출생" value={p.birth_place} /> : null}
              {tenureDays != null ? (
                <Fact
                  label="근속"
                  value={`${Math.floor(tenureDays / 365)}년 ${Math.floor((tenureDays % 365) / 30)}개월`}
                  sub={`${tenureDays.toLocaleString("ko-KR")}일째`}
                />
              ) : null}
            </div>

            {p.company ? (
              <p className="mt-4 border-t border-line-soft pt-4 text-[14.5px]">
                <span className="font-medium">{p.company}</span>
                {p.job_title ? (
                  <span className="block text-[13px] text-muted">{p.job_title}</span>
                ) : null}
              </p>
            ) : null}

            {p.bio ? (
              <div className="mt-4 flex flex-col gap-3.5 border-t border-line-soft pt-4">
                {p.bio.split(/\n{2,}/).map((para, i) => (
                  <p key={i} className="whitespace-pre-wrap text-[14px] leading-[1.75] text-muted">
                    {bold(para)}
                  </p>
                ))}
              </div>
            ) : null}
          </Card>
        </section>

        {/* ---------- 가치 ---------- */}
        {values?.length ? (
          <section className="flex flex-col gap-2">
            <SectionLabel>기준</SectionLabel>
            <Card className="divide-y divide-line-soft">
              {values.map((v) => (
                <div key={v.id} className="px-4 py-3.5">
                  <p className="text-[15px] font-medium leading-snug">{v.title}</p>
                  {v.description ? (
                    <p className="mt-1 text-[12.5px] text-faint">{v.description}</p>
                  ) : null}
                </div>
              ))}
            </Card>
          </section>
        ) : null}

        {/* ---------- 역할 ---------- */}
        {roles?.length ? (
          <section className="flex flex-col gap-2">
            <SectionLabel right={`${roles.length}개`}>역할</SectionLabel>
            <Card className="divide-y divide-line-soft">
              {(roles as Role[]).map((r) => (
                <div key={r.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    aria-hidden
                    className="mt-[7px] size-[9px] shrink-0 rounded-full"
                    style={{ background: r.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-medium">
                      {r.icon ? `${r.icon} ` : ""}{r.name}
                    </span>
                    {r.description ? (
                      <span className="mt-0.5 block text-[12.5px] text-faint">{r.description}</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </Card>
          </section>
        ) : null}

        {/* ---------- 추구미 ---------- */}
        {asps?.length ? (
          <section className="flex flex-col gap-2">
            <SectionLabel right={`${asps.length}개`}>추구미</SectionLabel>
            <Card className="divide-y divide-line-soft">
              {(asps as Aspiration[]).map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <p className="text-[14.5px] font-medium">{a.title}</p>
                  {a.statement ? (
                    <p className="mt-0.5 text-[12.5px] text-muted">{a.statement}</p>
                  ) : null}
                </div>
              ))}
            </Card>
          </section>
        ) : null}

        {/* ---------- 관심사 ---------- */}
        {byArea.length ? (
          <section className="flex flex-col gap-5">
            {byArea.map((g) => (
              <div key={g.area} className="flex flex-col gap-2">
                <SectionLabel right={`${g.items.length}개`}>{AREA_LABEL[g.area]}</SectionLabel>
                <Card className="divide-y divide-line-soft">
                  {g.items.map((it) => {
                    const act = activityLabel(it.last_active, it.linked);
                    return (
                      <div key={it.id} className="flex items-center gap-3 px-4 py-2.5">
                        {it.emoji ? (
                          <span aria-hidden className="w-[20px] shrink-0 text-[15px]">{it.emoji}</span>
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14.5px]">{it.title}</span>
                          {it.note ? (
                            <span className="block text-[11.5px] text-faint">{it.note}</span>
                          ) : null}
                        </span>
                        {it.status === "someday" ? (
                          <span className="shrink-0 text-[11.5px] text-faint">언젠가</span>
                        ) : (
                          <span
                            className={
                              "shrink-0 text-[11.5px] tnum " +
                              (act.quiet ? "text-faint" : "text-accent")
                            }
                          >
                            {act.text}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </Card>
              </div>
            ))}
            <p className="px-1 text-[12.5px] leading-relaxed text-faint">
              오른쪽은 마지막으로 무언가 기록된 시점입니다. 목록을 보여주려는 게 아니라,
              무엇을 하고 있고 무엇이 조용한지 보이게 하려는 것입니다.
            </p>
          </section>
        ) : (
          <Card>
            <Empty>관심사가 아직 없습니다.</Empty>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

/**
 * bio 의 **강조**만 살린다. 마크다운 라이브러리를 넣을 만한 분량이 아니고,
 * 강조를 그냥 지우면 "학력" 같은 라벨이 본문과 구분되지 않는다.
 */
function bold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((chunk, i) =>
    i % 2 === 1 ? (
      <b key={i} className="font-semibold text-ink">
        {chunk}
      </b>
    ) : (
      chunk
    ),
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <span>
      <span className="block text-[11px] uppercase tracking-[0.12em] text-faint">{label}</span>
      <span className="mt-0.5 block text-[17px] font-semibold tnum">{value}</span>
      {sub ? <span className="block text-[11.5px] text-muted tnum">{sub}</span> : null}
    </span>
  );
}
