import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Markdown } from "@/lib/markdown";
import { monthDay } from "@/lib/date";
import { deletePost } from "@/lib/actions/posts";

export const dynamic = "force-dynamic";

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
  model: string | null;
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const p = data as Post;

  const when = p.published_at ?? p.updated_at;

  return (
    <AppShell active="posts" title="글" subtitle={p.status === "draft" ? "초안" : undefined}>
      <article className="pt-4 lg:pt-6">
        {/* 표지 — 사진이 없으면 색면으로 남는다. 다른 지면과 같은 규칙. */}
        {p.cover_url ? (
          <div className="relative -mx-5 mb-8 h-[200px] overflow-hidden bg-key-soft lg:-mx-10 lg:mb-10 lg:h-[380px]">
            <span aria-hidden className="dots absolute inset-0 text-ink" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.cover_url} alt="" className="absolute inset-0 size-full object-cover" />
          </div>
        ) : null}

        <header className="border-b-[4px] border-ink pb-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="kicker text-key-ink">
              {p.status === "draft" ? "Draft" : p.kind === "auto" ? "Today's issue" : "Written"}
            </span>
            <span aria-hidden className="h-[2px] w-8 bg-ink" />
            <span className="kicker-kr text-faint">{monthDay(new Date(when))}</span>
            {p.reading_minutes ? (
              <span className="kicker text-faint">읽는 데 {p.reading_minutes}분</span>
            ) : null}
          </div>
          <h1 className="krd mt-3 text-[32px] leading-[1.08] lg:text-[54px]">{p.title}</h1>
          {p.lede ? (
            <p className="mt-4 max-w-[42ch] text-[clamp(17px,2.6vw,24px)] font-medium leading-snug text-key-ink">
              {p.lede}
            </p>
          ) : null}
          {p.subtitle ? (
            <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-muted lg:text-[17px]">
              {p.subtitle}
            </p>
          ) : null}
          {p.tags?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {p.tags.map((t) => (
                <span
                  key={t}
                  className="kicker-kr border border-line px-2 py-1 text-[10.5px] tracking-[.12em] text-muted"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </header>

        <div className="mt-8 max-w-[68ch] lg:mt-10">
          {p.body.trim() ? (
            <Markdown text={p.body} />
          ) : (
            <p className="text-[15px] text-faint">본문이 아직 비어 있습니다.</p>
          )}
        </div>

        {p.kind === "auto" ? (
          <p className="mt-10 max-w-[68ch] border-l-[3px] border-key bg-key-soft px-4 py-3 text-[12.5px] leading-relaxed text-muted">
            이 글은 편집실의 주제 풀에서 자동으로 발행된 한 편입니다. 사실관계는 확인하고
            읽어주세요. 주제를 바꾸거나 다음 호를 주문하려면{" "}
            <Link href="/editor" className="underline underline-offset-2 hover:text-key-ink">
              편집실
            </Link>
            로 가세요.
          </p>
        ) : null}

        <footer className="mt-12 flex flex-wrap items-center gap-3 border-t-[3px] border-ink pt-5 lg:mt-16">
          <Link
            href={`/posts/${p.id}/edit`}
            className="krb bg-ink px-5 py-2.5 text-[13px] tracking-[.06em] text-key-on-dark"
          >
            고치기
          </Link>
          <Link
            href="/posts"
            className="krb border-2 border-ink px-5 py-2.5 text-[13px] tracking-[.06em] hover:bg-key-soft"
          >
            목록
          </Link>
          <form action={deletePost} className="ml-auto">
            <input type="hidden" name="id" value={p.id} />
            <button
              type="submit"
              className="krb px-3 py-2.5 text-[12px] tracking-[.06em] text-faint hover:text-signal"
            >
              지우기
            </button>
          </form>
        </footer>
      </article>
    </AppShell>
  );
}
