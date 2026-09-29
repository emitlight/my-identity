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
  title: string;
  subtitle: string | null;
  body: string;
  cover_url: string | null;
  status: "draft" | "published";
  published_at: string | null;
  updated_at: string;
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
          <div className="flex items-center gap-3">
            <span className="kicker text-key-ink">
              {p.status === "published" ? "Published" : "Draft"}
            </span>
            <span aria-hidden className="h-[2px] w-8 bg-ink" />
            <span className="kicker-kr text-faint">{monthDay(new Date(when))}</span>
          </div>
          <h1 className="krd mt-3 text-[32px] leading-[1.08] lg:text-[54px]">{p.title}</h1>
          {p.subtitle ? (
            <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-muted lg:text-[17px]">
              {p.subtitle}
            </p>
          ) : null}
        </header>

        <div className="mt-8 max-w-[68ch] lg:mt-10">
          {p.body.trim() ? (
            <Markdown text={p.body} />
          ) : (
            <p className="text-[15px] text-faint">본문이 아직 비어 있습니다.</p>
          )}
        </div>

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
