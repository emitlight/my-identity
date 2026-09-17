import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Empty } from "@/components/ui";
import { daysUntil } from "@/lib/date";
import type { Goal, Role } from "@/lib/types";

export const dynamic = "force-dynamic";

const HORIZON_LABEL: Record<Goal["horizon"], string> = {
  life: "인생",
  year: "올해",
  quarter: "이번 분기",
  month: "이번 달",
};
const HORIZON_ORDER: Goal["horizon"][] = ["quarter", "month", "year", "life"];

/**
 * 노션 비전보드가 오는 자리.
 *
 * 원본에서는 분기·월이 multi-select 태그라 마감까지 며칠인지 계산할 수
 * 없었고, 그래서 12개가 전부 'Not started' 로 굳었다. 실제 날짜로 옮긴
 * 덕에 여기서는 남은 일수가 숫자로 나온다.
 */
export default async function GoalsPage() {
  const { supabase } = await requireUser();

  const [{ data: goals }, { data: roles }, { data: metrics }] = await Promise.all([
    supabase.from("goals").select("*").neq("status", "dropped"),
    supabase.from("roles").select("*"),
    supabase.from("metric_logs").select("metric_key, value, recorded_at"),
  ]);

  const all = (goals ?? []) as Goal[];
  const roleColor = new Map(((roles ?? []) as Role[]).map((r) => [r.id, r.color]));

  // 목표 진척은 기록에서 집계한다. 손으로 갱신하는 숫자는 반드시 방치된다.
  const latest = new Map<string, number>();
  for (const m of metrics ?? []) {
    const key = m.metric_key as string;
    if (!latest.has(key)) latest.set(key, Number(m.value));
  }

  const children = new Map<string, Goal[]>();
  for (const g of all) {
    if (!g.parent_id) continue;
    const list = children.get(g.parent_id);
    if (list) list.push(g);
    else children.set(g.parent_id, [g]);
  }

  const roots = all.filter((g) => !g.parent_id);
  const groups = HORIZON_ORDER.map((h) => ({
    horizon: h,
    items: roots
      .filter((g) => g.horizon === h)
      .sort((a, b) => (a.period_end ?? "9999").localeCompare(b.period_end ?? "9999")),
  })).filter((g) => g.items.length);

  return (
    <AppShell active="goals" title="목표" subtitle={`${all.length}개 · 진행 중`}>
      <div className="flex items-end justify-between gap-4 border-b-[4px] border-ink pb-2 pt-4 lg:pt-6">
        <span className="flex flex-col gap-2">
          <span className="kicker text-hot-deep">Deadlines</span>
          <span className="krd text-[34px] leading-none lg:text-[52px]">목표</span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="num text-[38px] leading-none text-hot lg:text-[56px]">{all.length}</span>
          <span className="kicker-kr pb-1 text-muted">진행 중</span>
        </span>
      </div>

      {groups.length === 0 ? (
        <Empty>아직 목표가 없습니다.</Empty>
      ) : (
        <div className="flex flex-col">
          {groups.map((g) => (
            <section key={g.horizon}>
              <h2 className="mt-8 flex items-baseline gap-4 border-b-2 border-ink pb-1.5 lg:mt-12">
                <span className="krb text-[17px] lg:text-[21px]">{HORIZON_LABEL[g.horizon]}</span>
                <span aria-hidden className="h-px flex-1 bg-line" />
                <span className="kicker text-faint">{g.items.length} open</span>
              </h2>

              {g.items.map((goal) => (
                <div key={goal.id}>
                  <GoalRow goal={goal} color={roleColor.get(goal.role_id ?? "")} current={latest} />
                  {(children.get(goal.id) ?? []).map((c) => (
                    <GoalRow
                      key={c.id}
                      goal={c}
                      color={roleColor.get(c.role_id ?? "")}
                      current={latest}
                      child
                    />
                  ))}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}

/**
 * 목표 한 줄.
 *
 * 남은 일수를 큰 숫자로 왼쪽에 세운다. 노션에서 12개가 전부
 * 'Not started' 로 굳은 이유는 마감이 계산되지 않아서였고, 계산된
 * 마감은 눈에 띄는 자리에 있어야 의미가 있다.
 */
function GoalRow({
  goal,
  color,
  current,
  child,
}: {
  goal: Goal;
  color?: string | null;
  current: Map<string, number>;
  child?: boolean;
}) {
  const left = goal.period_end ? daysUntil(goal.period_end) : null;
  const have = goal.metric_key ? current.get(goal.metric_key) ?? 0 : null;
  const pct =
    have != null && goal.metric_target
      ? Math.min(100, Math.round((have / Number(goal.metric_target)) * 100))
      : null;
  const urgent = left != null && left <= 30;

  return (
    <div
      className={
        "flex items-start gap-4 border-b border-line py-4 lg:gap-7 " +
        (child ? "pl-6 lg:pl-14" : "")
      }
    >
      {/* D— */}
      <span className="flex w-[74px] shrink-0 items-baseline gap-1 lg:w-[108px]">
        {left == null ? (
          <span className="kicker pt-2 text-faint">No date</span>
        ) : (
          <>
            <span className="num text-[15px] leading-none text-muted lg:text-[19px]">
              {left < 0 ? "D+" : "D－"}
            </span>
            <span
              className={
                "num text-[30px] leading-[.85] lg:text-[44px] " +
                (urgent || left < 0 ? "text-hot" : "text-ink")
              }
            >
              {Math.abs(left)}
            </span>
          </>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2.5">
          {color ? (
            <span aria-hidden className="h-[3px] w-4 shrink-0" style={{ background: color }} />
          ) : null}
          <span className="krb min-w-0 text-[16px] leading-snug lg:text-[21px]">{goal.title}</span>
        </span>

        {goal.description ? (
          <span className="mt-1 block text-[12.5px] leading-relaxed text-muted lg:text-[13.5px]">
            {goal.description}
          </span>
        ) : null}

        {pct != null ? (
          <span className="mt-2.5 block max-w-[440px]">
            <span className="flex items-baseline justify-between text-[11.5px] tnum text-muted">
              <span className="num text-[13px] text-ink">
                {have!.toLocaleString("ko-KR")}
                {goal.metric_unit ? ` ${goal.metric_unit}` : ""}
              </span>
              <span className="num text-[13px]">
                {Number(goal.metric_target).toLocaleString("ko-KR")}
                {goal.metric_unit ? ` ${goal.metric_unit}` : ""}
              </span>
            </span>
            <span className="mt-1 block h-[6px] bg-line-soft">
              <span className="block h-full bg-hot" style={{ width: `${pct}%` }} />
            </span>
          </span>
        ) : goal.metric_key ? (
          <span className="kicker mt-1.5 block text-faint">No record</span>
        ) : null}
      </span>
    </div>
  );
}
