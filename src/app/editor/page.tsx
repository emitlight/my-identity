import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Empty } from "@/components/ui";
import { SectionRule } from "@/components/editorial";
import { monthDay } from "@/lib/date";
import { AnswerForm, RequestForm, TopicRow, AddTopicForm } from "./forms";

export const dynamic = "force-dynamic";

/**
 * 편집실.
 *
 * 이 앱은 지금까지 내가 넣은 것을 되돌려주기만 했다. 매일 발행이 붙으면서
 * 처음으로 앱이 먼저 말을 건다. 그 대화가 일어나는 자리다.
 *
 * 메일을 쓰지 않는 이유: 발행기가 메일을 보낼 수는 있어도 답장을 받을
 * 곳이 없다. 묻는 곳과 답하는 곳이 같아야 고리가 닫힌다.
 */

interface Note {
  id: string;
  kind: "question" | "request" | "feedback";
  body: string;
  answer: string | null;
  status: "open" | "answered" | "closed";
  created_at: string;
  topic_id: string | null;
}

interface Topic {
  id: string;
  area: string;
  title: string;
  emoji: string | null;
  angle: string | null;
  weight: number;
  active: boolean;
  last_issued_on: string | null;
  issued_count: number;
}

interface Run {
  ran_on: string;
  ok: boolean;
  detail: string | null;
  post_id: string | null;
}

const AREA: Record<string, string> = {
  lifelog: "일상",
  finance: "자산",
  workout: "운동",
  future: "앞으로",
  language: "언어",
  career: "커리어",
};
const AREA_ORDER = ["future", "lifelog", "career", "finance", "language", "workout"];

export default async function EditorPage() {
  const { supabase } = await requireUser();

  const [{ data: notes }, { data: topics }, { data: runs }] = await Promise.all([
    supabase
      .from("editor_notes")
      .select("id, kind, body, answer, status, created_at, topic_id")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("topics")
      .select("id, area, title, emoji, angle, weight, active, last_issued_on, issued_count")
      .order("title"),
    supabase
      .from("issue_runs")
      .select("ran_on, ok, detail, post_id")
      .order("ran_on", { ascending: false })
      .limit(10),
  ]);

  const all = (notes ?? []) as Note[];
  const pool = (topics ?? []) as Topic[];
  const history = (runs ?? []) as Run[];

  const asked = all.filter((n) => n.kind === "question" && n.status === "open");
  const queued = all.filter((n) => n.kind === "request" && n.status === "open");
  const answered = all.filter((n) => n.status === "answered").slice(0, 6);

  const live = pool.filter((t) => t.active).length;
  const byArea = AREA_ORDER.map((a) => ({
    area: a,
    items: pool.filter((t) => t.area === a),
  })).filter((g) => g.items.length);

  return (
    <AppShell active="editor" title="편집실" subtitle={`주제 ${live}개 가동`}>
      <div className="flex flex-col gap-11 pt-4 lg:gap-16 lg:pt-6">
        {/* ═══ 머리 ═══ */}
        <section className="border-b-[4px] border-ink pb-3">
          <span className="kicker text-key-ink">Editorial desk</span>
          <h2 className="krd mt-2 text-[34px] leading-none lg:text-[52px]">편집실</h2>
          <p className="mt-3 max-w-[58ch] text-[14px] leading-relaxed text-muted">
            매일 아침 6시 18분에 한 편이 올라옵니다. 주제는 아래 풀에서 고릅니다. 요청을
            남겨두면 그것부터 씁니다.
          </p>
        </section>

        {/* ═══ 묻는 것 ═══ */}
        <section className="flex flex-col gap-4">
          <SectionRule lat="Asked of you" right={asked.length ? `${asked.length}건` : undefined}>
            편집자가 묻습니다
          </SectionRule>
          {asked.length ? (
            <div className="flex flex-col gap-5">
              {asked.map((n) => (
                <AnswerForm key={n.id} id={n.id} body={n.body} at={monthDay(n.created_at)} />
              ))}
            </div>
          ) : (
            <Empty>지금은 물어볼 것이 없습니다. 글이 쌓이면 다시 묻습니다.</Empty>
          )}
        </section>

        {/* ═══ 내가 시키는 것 ═══ */}
        <section className="flex flex-col gap-4">
          <SectionRule lat="Commission" right={queued.length ? `대기 ${queued.length}건` : undefined}>
            다음 호에 시킬 것
          </SectionRule>
          <RequestForm topics={pool.filter((t) => t.active)} />
          {queued.length ? (
            <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
              {queued.map((n) => (
                <li key={n.id} className="flex items-baseline gap-3 py-3">
                  <span className="kicker shrink-0 text-key-ink">대기</span>
                  <span className="min-w-0 flex-1 text-[14px] leading-snug">{n.body}</span>
                  <span className="kicker shrink-0 text-faint">{monthDay(n.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {/* ═══ 주고받은 것 ═══ */}
        {answered.length ? (
          <section className="flex flex-col gap-4">
            <SectionRule lat="On record">주고받은 것</SectionRule>
            <p className="-mt-1 text-[12.5px] text-faint">
              여기 적힌 답은 다음 호를 쓸 때 그대로 참고합니다.
            </p>
            <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
              {answered.map((n) => (
                <li key={n.id} className="py-4">
                  <p className="text-[13px] leading-snug text-muted">{n.body}</p>
                  <p className="mt-1.5 border-l-[3px] border-key pl-3 text-[14px] leading-relaxed">
                    {n.answer}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ═══ 주제 풀 ═══ */}
        <section className="flex flex-col gap-5">
          <SectionRule lat="The desk list" right={`${live} / ${pool.length}`}>
            주제 풀
          </SectionRule>
          <p className="-mt-2 text-[12.5px] leading-relaxed text-faint">
            무게가 클수록 자주 걸립니다. 최근에 나온 주제는 한동안 빠집니다. 당분간 안 보고
            싶은 것은 끄세요 — 끌 수 없으면 안 읽는 글이 쌓이고, 그러면 잡지를 안 열게 됩니다.
          </p>
          {byArea.map((g) => (
            <div key={g.area} className="flex flex-col gap-1">
              <span className="kicker-kr text-[10.5px] tracking-[.18em] text-key-ink">
                {AREA[g.area] ?? g.area}
              </span>
              <ul className="divide-y divide-line-soft border-t border-line">
                {g.items.map((t) => (
                  <TopicRow
                    key={t.id}
                    id={t.id}
                    emoji={t.emoji}
                    title={t.title}
                    angle={t.angle}
                    weight={t.weight}
                    active={t.active}
                    count={t.issued_count}
                    last={t.last_issued_on}
                  />
                ))}
              </ul>
            </div>
          ))}
          <AddTopicForm />
        </section>

        {/* ═══ 발행 기록 ═══ */}
        <section className="flex flex-col gap-4">
          <SectionRule lat="Press run">발행 기록</SectionRule>
          {history.length ? (
            <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
              {history.map((r) => (
                <li key={r.ran_on} className="flex items-baseline gap-3 py-2.5">
                  <span className="kicker shrink-0 tnum text-faint">{r.ran_on}</span>
                  {r.ok ? (
                    <>
                      <span className="kicker shrink-0 text-ok">발행</span>
                      {r.post_id ? (
                        <Link
                          href={`/posts/${r.post_id}`}
                          className="min-w-0 flex-1 truncate text-[13.5px] hover:text-key-ink"
                        >
                          읽기 →
                        </Link>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className="kicker shrink-0 text-danger">실패</span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
                        {r.detail ?? "사유 없음"}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>아직 자동 발행이 돌지 않았습니다.</Empty>
          )}
        </section>
      </div>
    </AppShell>
  );
}
