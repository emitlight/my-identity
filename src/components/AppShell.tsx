import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";

const NAV = [
  { href: "/", label: "오늘", key: "today" },
  { href: "/calendar", label: "캘린더", key: "calendar" },
  { href: "/tasks", label: "할 일", key: "tasks" },
  { href: "/goals", label: "목표", key: "goals" },
  { href: "/collections", label: "컬렉션", key: "collections" },
  { href: "/posts", label: "글", key: "posts" },
];

const SECONDARY = [
  { href: "/identity", label: "나", key: "identity" },
  { href: "/settings", label: "설정", key: "settings" },
];

/**
 * 가판대 판형의 앱 셸.
 *
 *   리본(핑크 띠 · 메뉴 · 발행 정보) → 제호 → 지면
 *
 * 왼쪽 사이드바를 없앴다. 사진이 없는 지면에서 화면의 일은 활자가 하는데,
 * 300px 를 메뉴에 떼어주면 표제를 키울 자리가 남지 않는다. 메뉴는 위의
 * 띠로 올리고, 폰에서는 아래 탭이 대신한다.
 */
export async function AppShell({
  children,
  active,
  title,
  subtitle,
  /** 제호 아래 오른쪽에 붙는 한 줄 (발행 정보) */
  dateline,
}: {
  children: React.ReactNode;
  active: string;
  title: string;
  subtitle?: string;
  dateline?: string;
}) {
  const label = NAV.concat(SECONDARY).find((n) => n.key === active)?.label ?? title;

  // 지금 누구로 들어와 있는지 모든 화면에서 보여준다. 1인용이라도 계정이
  // 둘 이상 있을 수 있고, 로그인된 채로 "이게 누구지" 가 되는 순간
  // 아무것도 믿을 수 없게 된다. 잡지의 판권면(콜로폰) 자리에 둔다.
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const who = user?.email ?? null;

  // 켜진 메뉴는 ink 바탕에 paper 글자다. key 을 쓰면 다크 모드에서
  // ink 가 크림색이 되면서 분홍 글자가 3:1 로 떨어져 안 읽힌다.

  return (
    <div className="min-h-dvh bg-paper">
      {/* ─────────── 리본 ───────────
           누구로 들어와 있는지는 늘 보여야 한다. 1인용이라도 계정이 둘
           이상일 수 있고, 로그인된 채로 "이게 누구지"가 되는 순간
           아무것도 믿을 수 없게 된다. 지면 위가 아니라 리본에 둔다 —
           오늘 화면의 띠가 음수 마진으로 제호 아래를 덮기 때문이다.

           z-30 이 필요하다. 아래 제호는 line-height 가 .82 라 글자
           조각이 자기 상자 밖으로 위아래 56px 씩 삐져나오고, 그 부분이
           리본 전체를 덮어서 클릭과 호버를 가로챈다. 눈에는 안 보이니
           원인을 찾기 어렵다. 쌓임 순서를 손으로 못박아 둔다. */}
      <div className="relative z-30 bg-key text-[color:var(--on-accent)]">
        <div className="mx-auto flex h-10 w-full max-w-[1440px] items-center justify-between gap-4 px-5 lg:h-[46px] lg:px-10">
          <nav aria-label="주요 메뉴" className="flex shrink-0 items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.key}
                href={n.href}
                aria-current={active === n.key ? "page" : undefined}
                className={
                  "krb hidden border-[1.5px] px-3 py-1 text-[12px] tracking-[.06em] transition-colors lg:block " +
                  (active === n.key
                    ? "border-transparent bg-ink text-paper"
                    : "border-transparent hover:border-ink")
                }
              >
                {n.label}
              </Link>
            ))}
            {SECONDARY.map((s2) => (
              <Link
                key={s2.key}
                href={s2.href}
                aria-current={active === s2.key ? "page" : undefined}
                className={
                  "krb border-[1.5px] px-2.5 py-1 text-[12px] tracking-[.06em] transition-colors lg:px-3 " +
                  (active === s2.key
                    ? "border-transparent bg-ink text-paper"
                    : "border-transparent hover:border-ink")
                }
              >
                {s2.label}
              </Link>
            ))}
          </nav>

          <span className="krb hidden shrink-0 text-[12.5px] tracking-[.14em] lg:block">
            {dateline ?? subtitle ?? label}
          </span>

          <span className="flex min-w-0 items-center gap-2.5 lg:gap-4">
            {who ? (
              <>
                <span className="kicker hidden shrink-0 opacity-70 lg:inline">Signed in</span>
                <span
                  title={who}
                  className="krb min-w-0 truncate text-[11px] tracking-[.02em] lg:text-[12px]"
                >
                  {who}
                </span>
                <SignOutButton className="text-[color:var(--on-accent)] decoration-[color:var(--on-accent)]/45 hover:decoration-[color:var(--on-accent)]" />
              </>
            ) : null}
          </span>
        </div>
      </div>

      {/* ─────────── 제호 ─────────── */}
      <div className="relative z-0 mx-auto w-full max-w-[1440px] px-5 pt-2 lg:px-10 lg:pt-2.5">
        <Link href="/" className="masthead-wrap block">
          <h1 className="masthead text-center">MY IDENTITY</h1>
        </Link>
      </div>

      {/* ─────────── 지면 ─────────── */}
      <main className="relative z-10 mx-auto w-full max-w-[1440px] px-5 pb-28 lg:px-10 lg:pb-16">
        {children}
      </main>

      {/* ─────────── 모바일 탭 ─────────── */}
      <nav
        aria-label="주요 메뉴"
        className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-ink bg-paper lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex w-full max-w-[560px]">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              aria-current={active === n.key ? "page" : undefined}
              className={
                "krb flex min-h-[54px] flex-1 flex-col items-center justify-center gap-1.5 text-[11.5px] " +
                (active === n.key ? "text-ink" : "text-faint")
              }
            >
              <span
                aria-hidden
                className={"h-[3px] w-5 " + (active === n.key ? "bg-key" : "bg-transparent")}
              />
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
