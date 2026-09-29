"use client";

import { useActionState, useState } from "react";
import { savePost } from "@/lib/actions/posts";

interface Draft {
  id?: string;
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  cover_url?: string | null;
  status?: "draft" | "published";
}

/**
 * 글 쓰는 화면.
 *
 * 미리보기를 옆에 붙이지 않는다. 폰에서는 둘 다 좁아져서 양쪽 다 못 쓰고,
 * 데스크탑에서도 쓰는 동안 눈이 두 군데로 나뉜다. 다 쓰고 저장하면 바로
 * 조판된 글로 넘어가므로 그게 곧 미리보기다.
 */
export function PostEditor({ post }: { post?: Draft }) {
  const [state, action, pending] = useActionState(savePost, null);
  const [body, setBody] = useState(post?.body ?? "");

  return (
    <form action={action} className="flex flex-col gap-6 pt-4 lg:pt-6">
      {post?.id ? <input type="hidden" name="id" value={post.id} /> : null}

      <div className="flex flex-col gap-3 border-b-[3px] border-ink pb-5">
        <input
          name="title"
          defaultValue={post?.title ?? ""}
          placeholder="제목"
          required
          maxLength={200}
          autoFocus={!post?.id}
          className="krd w-full bg-transparent text-[30px] leading-tight outline-none placeholder:text-faint lg:text-[46px]"
        />
        <input
          name="subtitle"
          defaultValue={post?.subtitle ?? ""}
          placeholder="부제 (없어도 됩니다)"
          maxLength={300}
          className="w-full bg-transparent text-[14.5px] text-muted outline-none placeholder:text-faint lg:text-[16px]"
        />
      </div>

      <label className="flex flex-col gap-2">
        <span className="kicker text-key-ink">Cover</span>
        <input
          name="cover_url"
          defaultValue={post?.cover_url ?? ""}
          placeholder="표지 사진 주소 (비워두면 색면으로 나갑니다)"
          maxLength={2000}
          className="w-full border-b border-line bg-transparent pb-1.5 text-[13.5px] outline-none placeholder:text-faint focus:border-key-ink"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="flex items-baseline justify-between">
          <span className="kicker text-key-ink">Body</span>
          <span className="num text-[11.5px] text-faint">{body.length}자</span>
        </span>
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={18}
          maxLength={60000}
          placeholder={"본문.\n\n# 큰 제목\n## 중간 제목\n- 목록\n> 인용\n**굵게** *기울임* [링크](주소)"}
          className="w-full resize-y border border-line bg-surface p-4 text-[15px] leading-[1.8] outline-none placeholder:text-faint focus:border-key-ink"
        />
      </label>

      {state && !state.ok ? (
        <p role="alert" className="border-2 border-signal bg-signal-soft px-4 py-3 text-[13.5px] text-signal">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          name="publish"
          value="published"
          disabled={pending}
          className="krb bg-ink px-5 py-2.5 text-[13px] tracking-[.06em] text-key-on-dark disabled:opacity-45"
        >
          {pending ? "저장 중…" : post?.status === "published" ? "발행 상태로 저장" : "발행하기"}
        </button>
        <button
          type="submit"
          name="publish"
          value="draft"
          disabled={pending}
          className="krb border-2 border-ink px-5 py-2.5 text-[13px] tracking-[.06em] hover:bg-key-soft disabled:opacity-45"
        >
          초안으로 저장
        </button>
        <span className="kicker text-faint">Markdown 이 그대로 조판됩니다</span>
      </div>
    </form>
  );
}
