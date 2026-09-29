import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Empty } from "@/components/ui";
import { excerpt } from "@/lib/markdown";
import { monthDay } from "@/lib/date";

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

export default async function PostsPage() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
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

  return (
    <AppShell active="posts" title="글" subtitle={`${posts.length}편`}>
      <div className="flex items-end justify-between gap-4 border-b-[4px] border-ink pb-2 pt-4 lg:pt-6">
        <span className="flex flex-col gap-2">
          <span className="kicker text-key-ink">Writing</span>
          <span className="krd text-[34px] leading-none lg:text-[52px]">글</span>
        </span>
        <Link
          href="/posts/new"
          className="krb mb-1 bg-ink px-4 py-2 text-[12.5px] tracking-[.06em] text-key-on-dark"
        >
          새로 쓰기
        </Link>
      </div>

      {posts.length === 0 ? (
        <Empty>아직 쓴 글이 없습니다. 오른쪽 위에서 시작하세요.</Empty>
      ) : (
        <div className="flex flex-col gap-12 pt-6 lg:gap-16 lg:pt-8">
          <Group title="발행됨" latin="Published" posts={live} />
          <Group title="초안" latin="Drafts" posts={drafts} />
        </div>
      )}
    </AppShell>
  );
}

function Group({ title, latin, posts }: { title: string; latin: string; posts: Post[] }) {
  if (!posts.length) return null;
  return (
    <section>
      <div className="flex items-end justify-between gap-4 border-b-[3px] border-ink pb-1.5">
        <span className="flex flex-col gap-1.5">
          <span className="kicker text-key-ink">{latin}</span>
          <span className="krb text-[19px] leading-none lg:text-[24px]">{title}</span>
        </span>
        <span className="num text-[26px] leading-none text-key-ink lg:text-[34px]">
          {posts.length}
        </span>
      </div>

      {posts.map((p, i) => (
        <Link
          key={p.id}
          href={`/posts/${p.id}`}
          className="group flex items-baseline gap-4 border-b border-line py-5 transition-colors hover:bg-key-soft lg:gap-8"
        >
          <span className="num w-9 shrink-0 text-[17px] leading-none text-key-ink lg:w-14 lg:text-[24px]">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="krd block text-[21px] leading-[1.15] lg:text-[30px]">{p.title}</span>
            {p.subtitle || p.body ? (
              <span className="mt-1.5 block text-[13px] leading-relaxed text-muted lg:text-[14.5px]">
                {p.subtitle ?? excerpt(p.body)}
              </span>
            ) : null}
          </span>
          <span className="kicker-kr shrink-0 text-faint">
            {p.published_at
              ? monthDay(new Date(p.published_at))
              : monthDay(new Date(p.updated_at)) + " 수정"}
          </span>
        </Link>
      ))}
    </section>
  );
}
