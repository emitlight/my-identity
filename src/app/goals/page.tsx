import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, SectionLabel, Empty } from "@/components/ui";
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
      {groups.length === 0 ? (
        <Card>
          <Empty>아직 목표가 없습니다.</Empty>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.horizon} className="flex flex-col gap-2">
              <SectionLabel right={`${g.items.length}개`}>
                {HORIZON_LABEL[g.horizon]}
              </SectionLabel>
              <Card className="divide-y divide-line-soft">
                {g.items.map((goal) => (
                  <div key={goal.id}>
                    <GoalRow goal={goal} color={roleColor.get(goal.role_id ?? "")} current={latest} />
                    {(children.get(goal.id) ?? []).map((c) => (
                      <div key={c.id} className="border-t border-line-soft bg-surface-2/60 pl-6">
                        <GoalRow goal={c} color={roleColor.get(c.role_id ?? "")} current={latest} child />
                      </div>
                    ))}
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}

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

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      {color ? (
        <span
          aria-hidden
          className="mt-[7px] size-[7px] shrink-0 rounded-full"
          style={{ background: color }}
        />
      ) : (
        <span aria-hidden className="mt-[7px] size-[7px] shrink-0" />
      )}

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          {child ? <span aria-hidden className="text-[11px] text-faint">└</span> : null}
          <span className="min-w-0 text-[14.5px] font-medium leading-snug">{goal.title}</span>
        </span>

        {goal.description ? (
          <span className="mt-0.5 block text-[12.5px] text-faint">{goal.description}</span>
        ) : null}

        {pct != null ? (
          <span className="mt-2 block">
            <span className="flex items-baseline justify-between text-[11.5px] tnum text-muted">
              <span>
                {have!.toLocaleString("ko-KR")}
                {goal.metric_unit ? ` ${goal.metric_unit}` : ""}
              </span>
              <span>
                {Number(goal.metric_target).toLocaleString("ko-KR")}
                {goal.metric_unit ? ` ${goal.metric_unit}` : ""}
              </span>
            </span>
            <span className="mt-1 block h-[3px] overflow-hidden rounded-full bg-line">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${pct}%` }}
              />
            </span>
          </span>
        ) : goal.metric_key ? (
          <span className="mt-1 block text-[11.5px] text-faint">
            {goal.metric_key} 기록이 아직 없습니다
          </span>
        ) : null}
      </span>

      <span className="shrink-0 text-right">
        {left == null ? (
          <span className="text-[11.5px] text-faint">기한 없음</span>
        ) : left < 0 ? (
          <span className="text-[11.5px] font-medium tnum text-signal">
            {Math.abs(left)}일 지남
          </span>
        ) : (
          <span
            className={
              "text-[11.5px] tnum " + (left <= 30 ? "font-medium text-signal" : "text-muted")
            }
          >
            {left}일 남음
          </span>
        )}
      </span>
    </div>
  );
}
