import { clsx } from "clsx";

/** 섹션 머리표 — 작고 조용하게, 내용이 주인공이 되도록 */
export function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
        {children}
      </span>
      {right ? (
        <span className="text-[11px] tracking-wide text-faint tnum">{right}</span>
      ) : null}
    </div>
  );
}

export function Card({
  children,
  className,
  tone = "plain",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "plain" | "signal";
}) {
  return (
    <div
      className={clsx(
        "rounded-lg border",
        tone === "signal"
          ? "border-signal/35 bg-signal-soft"
          : "border-line bg-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** 역할 색 점. 역할이 없으면 자리만 차지하지 않고 사라진다. */
export function RoleDot({ color }: { color?: string | null }) {
  if (!color) return null;
  return (
    <span
      aria-hidden
      className="inline-block size-[7px] shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 py-6 text-center text-[13.5px] text-faint">{children}</p>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet";
}) {
  return (
    <button
      {...props}
      className={clsx(
        "rounded-md px-4 py-2.5 text-[14px] font-medium transition-opacity",
        "disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary"
          ? "bg-accent text-on-accent hover:opacity-90"
          : "border border-line bg-surface text-ink hover:bg-surface-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** 파싱 결과 칩 — 저장 전에 무엇으로 해석됐는지 보여주고 고치게 한다 */
export function Chip({
  children,
  tone = "accent",
}: {
  children: React.ReactNode;
  tone?: "accent" | "signal" | "quiet";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded px-2 py-[3px] text-[11.5px] whitespace-nowrap tnum",
        tone === "accent" && "bg-accent-soft text-accent",
        tone === "signal" && "bg-signal-soft text-signal",
        tone === "quiet" && "bg-line-soft text-muted",
      )}
    >
      {children}
    </span>
  );
}
