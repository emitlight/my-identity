import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Empty } from "@/components/ui";
import { excerpt } from "@/lib/markdown";
import { monthDay } from "@/lib/date";

export const dynamic = "force-dynamic";

/**
 * 서가.
 *
 * 글이 하루 한 편씩 쌓이는 지면이므로 목록이 아니라 서가로 짠다.
 * 가장 최근 호가 크게 한 장, 나머지는 달별 색인이다. 전부 같은 크기로
 * 늘어놓으면 100편째부터는 아무것도 안 보인다.
 */

interface Post {
  id: string;
  kind: "auto" | "mine";
  title: string;
  subtitle: string | null;
  lede: string | null;
  body: string;
  cover_url: string | null;
  tags: string[];
  status: "draft" | "published";
  published_at: string | null;
  updated_at: string;
  reading_minutes: number | null;
}

export default async function PostsPage() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <AppShell active="posts" title="글">
        <p className="krb py-10 text-[15px] text-danger">글을 불러오지 못했습니다.</p>
      </AppShell>
    );
  }

  const posts = (data ?? []) as Post[];
  const live = posts.filter((p) => p.status === "published");
  const drafts = posts.filter((p) => p.status === "draft");
  const [lead, ...rest] = live;

  // 달별로 묶는다. 매일 한 편이면 한 달에 서른 편이고, 달 경계가 없으면
  // 스크롤 속에서 어디쯤인지 알 수가 없다.
  const months = new Map<string, Post[]>();
  for (const p of rest) {
    const key = (p.published_at ?? p.updated_at).slice(0, 7);
    const list = months.get(key);
    if (list) list.push(p);
    else months.set(key, [p]);
  }

  return (
    <AppShell active="posts" title="글" subtitle={`${live.length}편`}>
      <div className="flex items-end justify-between gap-4 border-b-[4px] border-ink pb-2 pt-4 lg:pt-6">
        <span className="flex flex-col gap-2">
          <span className="kicker text-key-ink">The archive</span>
          <span className="krd text-[34px] leading-none lg:text-[52px]">서가</span>
        </span>
        <span className="mb-1 flex items-center gap-2">
          <Link
            href="/editor"
            className="krb border-2 border-ink px-4 py-2 text-[12.5px] tracking-[.06em] hover:bg-key-soft"
          >
            편집실
          </Link>
          <Link
            href="/posts/new"
            className="krb bg-ink px-4 py-2 text-[12.5px] tracking-[.06em] text-key-on-dark"
          >
            직접 쓰기
          </Link>
        </span>
      </div>

      {live.length === 0 ? (
        <Empty>
          아직 발행된 글이 없습니다. 매일 아침 6시 18분에 한 편씩 올라옵니다.
        </Empty>
      ) : null}

      {/* ═══ 최신호 ═══ */}
      {lead ? (
        <section className="pt-7 lg:pt-9">
          <Link href={`/posts/${lead.id}`} className="tile group block">
            {lead.cover_url ? (
              <div className="relative -mx-5 h-[200px] overflow-hidden bg-key-soft lg:-mx-10 lg:h-[400px]">
                <span aria-hidden className="dots absolute inset-0 text-ink" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lead.cover_url}
                  alt=""
                  className="zoom absolute inset-0 size-full object-cover"
                />
              </div>
            ) : null}

            <div className={"flex items-center gap-3 " + (lead.cover_url ? "mt-5" : "")}>
              <span className="kicker text-key-ink">
                {lead.kind === "auto" ? "Today's issue" : "Latest"}
              </span>
              <span aria-hidden className="h-[2px] w-10 bg-ink" />
              <span className="kicker-kr text-faint">
                {monthDay(new Date(lead.published_at ?? lead.updated_at))}
              </span>
              {lead.reading_minutes ? (
                <span className="kicker text-faint">{lead.reading_minutes}분</span>
              ) : null}
            </div>

            <h2 className="krd mt-3 text-[clamp(30px,7.5vw,62px)] leading-[1.04]">{lead.title}</h2>
            {lead.lede ? (
              <p className="mt-4 max-w-[46ch] text-[clamp(16px,2.4vw,22px)] font-medium leading-snug text-key-ink">
                {lead.lede}
              </p>
            ) : null}
            <p className="mt-3 max-w-[60ch] text-[14.5px] leading-relaxed text-muted">
              {lead.subtitle ?? excerpt(lead.body, 140)}
            </p>
          </Link>
        </section>
      ) : null}

      {/* ═══ 지난 호 ═══ */}
      {months.size ? (
        <div className="flex flex-col gap-10 pt-12 lg:gap-14 lg:pt-16">
          {[...months.entries()].map(([month, list]) => (
            <section key={month}>
              <div className="flex items-end justify-between gap-4 border-b-[3px] border-ink pb-1.5">
                <span className="flex flex-col gap-1.5">
                  <span className="kicker text-key-ink">
                    {new Date(`${month}-01`).toLocaleDateString("en", { month: "long" })}
                  </span>
                  <span className="krb text-[19px] leading-none lg:text-[24px]">
                    {month.slice(0, 4)}년 {Number(month.slice(5))}월
                  </span>
                </span>
                <span className="num text-[26px] leading-none text-key-ink lg:text-[34px]">
                  {list.length}
                </span>
              </div>

              {list.map((p) => (
                <Link
                  key={p.id}
                  href={`/posts/${p.id}`}
                  className="group flex items-baseline gap-4 border-b border-line py-4 transition-colors hover:bg-key-soft lg:gap-7"
                >
                  <span className="num w-9 shrink-0 text-[15px] leading-none text-key-ink lg:w-12 lg:text-[20px]">
                    {(p.published_at ?? p.updated_at).slice(8, 10)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="krd block text-[19px] leading-[1.18] lg:text-[26px]">
                      {p.title}
                    </span>
                    {p.subtitle || p.body ? (
                      <span className="mt-1 block text-[13px] leading-relaxed text-muted lg:text-[14px]">
                        {p.subtitle ?? excerpt(p.body)}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    {p.kind === "mine" ? (
                      <span className="kicker text-faint">직접</span>
                    ) : null}
                    {p.reading_minutes ? (
                      <span className="kicker text-faint">{p.reading_minutes}분</span>
                    ) : null}
                  </span>
                </Link>
              ))}
            </section>
          ))}
        </div>
      ) : null}

      {/* ═══ 초안 ═══ */}
      {drafts.length ? (
        <section className="mt-12 lg:mt-16">
          <div className="flex items-end justify-between gap-4 border-b border-line pb-1.5">
            <span className="kicker text-faint">Drafts · 초안</span>
            <span className="kicker tnum text-faint">{drafts.length}</span>
          </div>
          {drafts.map((p) => (
            <Link
              key={p.id}
              href={`/posts/${p.id}`}
              className="flex items-baseline gap-4 border-b border-line-soft py-3 text-faint transition-colors hover:text-ink"
            >
              <span className="min-w-0 flex-1 truncate text-[14.5px]">{p.title}</span>
              <span className="kicker shrink-0">{monthDay(new Date(p.updated_at))} 수정</span>
            </Link>
          ))}
        </section>
      ) : null}
    </AppShell>
  );
}
