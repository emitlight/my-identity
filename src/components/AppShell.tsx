import Link from "next/link";

const NAV = [
  { href: "/", label: "오늘", key: "today" },
  { href: "/calendar", label: "캘린더", key: "calendar" },
  { href: "/tasks", label: "할 일", key: "tasks" },
  { href: "/goals", label: "목표", key: "goals" },
  { href: "/collections", label: "컬렉션", key: "collections" },
];

export function AppShell({
  children,
  active,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  active: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4">
      <header className="flex items-baseline justify-between gap-3 pt-7 pb-5">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 text-[13px] text-muted tnum">{subtitle}</p>
          ) : null}
        </div>
        <span className="flex shrink-0 items-center gap-3">
          <Link href="/identity" className="text-[12.5px] text-faint hover:text-muted">
            나
          </Link>
          <Link href="/settings" className="text-[12.5px] text-faint hover:text-muted">
            설정
          </Link>
        </span>
      </header>

      <main className="flex-1 pb-28">{children}</main>

      <nav
        aria-label="주요 메뉴"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex w-full max-w-[560px]">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              aria-current={active === n.key ? "page" : undefined}
              className={
                "flex-1 py-3.5 text-center text-[13px] font-medium transition-colors " +
                (active === n.key ? "text-accent" : "text-faint hover:text-muted")
              }
            >
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
