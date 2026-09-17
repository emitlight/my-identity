import Link from "next/link";

const NAV = [
  { href: "/", label: "오늘", key: "today" },
  { href: "/calendar", label: "캘린더", key: "calendar" },
  { href: "/tasks", label: "할 일", key: "tasks" },
  { href: "/goals", label: "목표", key: "goals" },
  { href: "/collections", label: "컬렉션", key: "collections" },
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
export function AppShell({
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

  // 켜진 메뉴는 ink 바탕에 paper 글자다. hot 을 쓰면 다크 모드에서
  // ink 가 크림색이 되면서 분홍 글자가 3:1 로 떨어져 안 읽힌다.

  return (
    <div className="min-h-dvh bg-paper">
      {/* ─────────── 리본 ─────────── */}
      <div className="bg-hot text-[color:var(--on-accent)]">
        <div className="mx-auto flex h-10 w-full max-w-[1440px] items-center justify-between gap-4 px-5 lg:h-[46px] lg:px-10">
          <nav aria-label="주요 메뉴" className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <Link
                key={n.key}
                href={n.href}
                aria-current={active === n.key ? "page" : undefined}
                className={
                  "krb border-[1.5px] px-3 py-1 text-[12px] tracking-[.06em] transition-colors " +
                  (active === n.key
                    ? "border-transparent bg-ink text-paper"
                    : "border-transparent hover:border-ink")
                }
              >
                {n.label}
              </Link>
            ))}
          </nav>

          {/* 폰에서는 보조 메뉴가 리본 왼쪽에 온다 */}
          <div className="flex items-center gap-3 lg:hidden">
            {SECONDARY.map((s) => (
              <Link key={s.key} href={s.href} className="krb text-[12px] tracking-[.06em]">
                {s.label}
              </Link>
            ))}
          </div>

          <span className="krb shrink-0 text-[11px] tracking-[.14em] lg:text-[12.5px]">
            {dateline ?? subtitle ?? label}
          </span>

          <div className="hidden items-center gap-3 lg:flex">
            {SECONDARY.map((s) => (
              <Link
                key={s.key}
                href={s.href}
                aria-current={active === s.key ? "page" : undefined}
                className={
                  "krb border-[1.5px] px-3 py-1 text-[12px] tracking-[.06em] transition-colors " +
                  (active === s.key
                    ? "border-transparent bg-ink text-paper"
                    : "border-transparent hover:border-ink")
                }
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────── 제호 ─────────── */}
      <div className="mx-auto w-full max-w-[1440px] px-5 pt-2 lg:px-10 lg:pt-2.5">
        <Link href="/" className="masthead-wrap block">
          <h1 className="masthead text-center">MY IDENTITY</h1>
        </Link>
      </div>

      {/* ─────────── 지면 ─────────── */}
      <main className="mx-auto w-full max-w-[1440px] px-5 pb-28 lg:px-10 lg:pb-16">
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
                className={"h-[3px] w-5 " + (active === n.key ? "bg-hot" : "bg-transparent")}
              />
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
