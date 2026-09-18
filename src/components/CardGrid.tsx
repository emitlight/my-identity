"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { saveLayout } from "@/lib/actions/layout";

export interface Slot {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const COLS = 12;
const GAP = 20;
const ROW = 92;

/** 카드가 가질 수 있는 크기. 버튼을 누를 때마다 다음 크기로 넘어간다. */
const SIZES: [number, number][] = [
  [4, 2], // 기본 — 한 줄에 셋
  [8, 2], // 가로로 넓게
  [4, 4], // 세로로 길게
  [8, 4], // 특집
];

/* ── 격자 계산 ────────────────────────────────────────────────
   겹침을 허용하지 않는다. 잡지 지면에서 카드가 서로 포개지면 그건
   자유로운 배치가 아니라 고장 난 화면으로 보인다. */

const hit = (a: Slot, b: Slot) =>
  a.id !== b.id &&
  a.x < b.x + b.w && a.x + a.w > b.x &&
  a.y < b.y + b.h && a.y + a.h > b.y;

/** 위쪽 빈 자리로 끌어올린다 — 맥의 "정리"와 같은 동작 */
function compact(list: Slot[]): Slot[] {
  const out = [...list].sort((a, b) => a.y - b.y || a.x - b.x);
  for (let i = 0; i < out.length; i++) {
    let y = out[i].y;
    while (y > 0) {
      const up = { ...out[i], y: y - 1 };
      if (out.some((o) => hit(up, o))) break;
      y -= 1;
    }
    out[i] = { ...out[i], y };
  }
  return out;
}

/** moved 를 그 자리에 놓고, 밀려난 카드를 아래로 내린 뒤 다시 끌어올린다 */
function settle(list: Slot[], moved: Slot): Slot[] {
  const next = list.map((s) => (s.id === moved.id ? moved : s));
  const done = new Set([moved.id]);
  let guard = 0;

  // 밀려난 카드를 아래로. 무한히 돌지 않게 횟수를 막아둔다.
  while (guard++ < 200) {
    const clash = next.find((s) => !done.has(s.id) && next.some((o) => hit(s, o) && done.has(o.id)));
    if (!clash) break;
    const over = next.filter((o) => done.has(o.id) && hit(clash, o));
    const bottom = Math.max(...over.map((o) => o.y + o.h));
    next[next.indexOf(clash)] = { ...clash, y: bottom };
    done.add(clash.id);
  }
  return compact(next);
}

/** 격자에서 s 가 들어갈 첫 빈 자리를 위에서부터 찾는다 */
function firstFree(placed: Slot[], s: Slot): Slot {
  for (let y = 0; ; y++) {
    for (let x = 0; x + s.w <= COLS; x++) {
      const c = { ...s, x, y };
      if (!placed.some((p) => hit(c, p))) return c;
    }
  }
}

/** 읽는 순서대로 다시 채운다 (왼쪽 위부터) — 맥의 "자동 정렬" */
function reflow(list: Slot[]): Slot[] {
  const order = [...list].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: Slot[] = [];
  for (const s of order) placed.push(firstFree(placed, s));
  return placed;
}

/**
 * 저장된 배치에 새 카드를 붙이고, 사라진 카드는 버린다.
 *
 * 저장된 자리는 그대로 둔다. 다시 채우면(reflow) 화면을 열 때마다 본인이
 * 맞춰둔 배치가 왼쪽 위로 쓸려 올라가고, 그러면 배치 기능이 있으나 마나다.
 * 새로 생긴 카드만 빈 자리에 넣는다.
 */
function reconcile(ids: string[], saved: Slot[]): Slot[] {
  const known = new Map(saved.map((s) => [s.id, s]));
  const placed = ids.filter((id) => known.has(id)).map((id) => known.get(id)!);
  for (const id of ids) {
    if (known.has(id)) continue;
    placed.push(firstFree(placed, { id, x: 0, y: 0, w: 4, h: 2 }));
  }
  return placed;
}

/**
 * 끌어서 옮기는 격자.
 *
 * 데스크탑에서만 끌 수 있다. 폰에서는 드래그가 스크롤과 싸우고, 12칸
 * 기준으로 맞춰둔 자리는 390px 에서 의미가 없다. 대신 여기서 정한
 * 순서(왼쪽 위 → 오른쪽 아래)가 폰에서의 위아래 순서가 된다. 배치가
 * 한 화면에서만 쓰이고 버려지지 않게 하는 것이 핵심이다.
 */
export function CardGrid({
  surface,
  initial,
  cards,
}: {
  surface: "today";
  initial: Slot[];
  cards: { id: string; node: React.ReactNode }[];
}) {
  const ids = useMemo(() => cards.map((c) => c.id), [cards]);
  const [slots, setSlots] = useState<Slot[]>(() => reconcile(ids, initial));
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [width, setWidth] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const label = useId();

  // 카드 목록이 바뀌면(컬렉션 추가·삭제) 배치를 맞춘다
  useEffect(() => { setSlots((s) => reconcile(ids, s)); }, [ids]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const persist = useCallback((next: Slot[]) => {
    if (timer.current) clearTimeout(timer.current);
    // 끌 때마다 저장하면 한 번 옮기는 동안 요청이 수십 개 나간다.
    timer.current = setTimeout(() => { void saveLayout({ surface, items: next }); }, 600);
  }, [surface]);

  const apply = useCallback((next: Slot[]) => { setSlots(next); persist(next); }, [persist]);

  const cellW = width ? (width - GAP * (COLS - 1)) / COLS : 0;
  const rows = slots.length ? Math.max(...slots.map((s) => s.y + s.h)) : 0;
  const pos = (s: Slot) => ({
    left: s.x * (cellW + GAP),
    top: s.y * (ROW + GAP),
    width: s.w * cellW + (s.w - 1) * GAP,
    height: s.h * ROW + (s.h - 1) * GAP,
  });

  function startDrag(e: React.PointerEvent, s: Slot) {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = pos(s);
    setDrag({ id: s.id, dx: e.clientX - p.left, dy: e.clientY - p.top });
  }

  function onMove(e: React.PointerEvent) {
    if (!drag || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const s = slots.find((v) => v.id === drag.id)!;
    const x = Math.round((e.clientX - r.left - drag.dx) / (cellW + GAP));
    const y = Math.round((e.clientY - r.top - drag.dy) / (ROW + GAP));
    const at = {
      ...s,
      x: Math.max(0, Math.min(COLS - s.w, x)),
      y: Math.max(0, y),
    };
    if (at.x !== s.x || at.y !== s.y) setSlots(settle(slots, at));
  }

  function endDrag() {
    if (!drag) return;
    setDrag(null);
    persist(slots);
  }

  function resize(s: Slot) {
    const i = SIZES.findIndex(([w, h]) => w === s.w && h === s.h);
    const [w, h] = SIZES[(i + 1) % SIZES.length];
    apply(settle(slots, { ...s, w, x: Math.min(s.x, COLS - w), h }));
  }

  function nudge(s: Slot, dx: number, dy: number) {
    apply(settle(slots, {
      ...s,
      x: Math.max(0, Math.min(COLS - s.w, s.x + dx)),
      y: Math.max(0, s.y + dy),
    }));
  }

  const byId = new Map(cards.map((c) => [c.id, c.node]));
  const order = [...slots].sort((a, b) => a.y - b.y || a.x - b.x);

  return (
    <div>
      <div className="mt-4 flex items-center justify-end gap-2 lg:mt-5">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={
            "krb hidden px-3 py-1.5 text-[11px] tracking-[.14em] transition-colors lg:block " +
            (editing ? "bg-ink text-paper" : "border-2 border-ink hover:bg-blush")
          }
          aria-pressed={editing}
        >
          {editing ? "배치 끝내기" : "배치 바꾸기"}
        </button>
        {editing ? (
          <button
            type="button"
            onClick={() => apply(reflow(slots))}
            className="krb hidden border-2 border-ink px-3 py-1.5 text-[11px] tracking-[.14em] hover:bg-blush lg:block"
          >
            자동 정렬
          </button>
        ) : null}
      </div>

      {editing ? (
        <p id={label} className="kicker mt-2 hidden text-faint lg:block">
          드래그로 옮기고 · 크기 버튼으로 칸 수를 바꿉니다 · 방향키로도 옮겨집니다
        </p>
      ) : null}

      {/* 폰·태블릿 — 배치한 순서대로 한 줄씩 */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:hidden">
        {order.map((s) => (
          <div key={s.id}>{byId.get(s.id)}</div>
        ))}
      </div>

      {/* 데스크탑 — 격자 */}
      <div
        ref={box}
        className="relative mt-5 hidden lg:mt-7 lg:block"
        style={{ height: rows * ROW + Math.max(0, rows - 1) * GAP }}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {editing ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[.13]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, var(--ink) 0 1px, transparent 1px " +
                (cellW + GAP) + "px)",
            }}
          />
        ) : null}

        {slots.map((s) => {
          const p = pos(s);
          const held = drag?.id === s.id;
          return (
            <div
              key={s.id}
              className={"absolute " + (held ? "z-10" : "transition-[left,top,width,height] duration-200")}
              style={p}
            >
              <div className={"relative h-full " + (held ? "opacity-90" : "")}>
                {byId.get(s.id)}

                {editing ? (
                  <>
                    {/* 잡는 면 — 편집 중에만 덮는다. 평소에는 카드가 그냥 링크다. */}
                    <button
                      type="button"
                      aria-label={`카드 옮기기`}
                      aria-describedby={label}
                      onPointerDown={(e) => startDrag(e, s)}
                      onKeyDown={(e) => {
                        const d: Record<string, [number, number]> = {
                          ArrowLeft: [-1, 0], ArrowRight: [1, 0],
                          ArrowUp: [0, -1], ArrowDown: [0, 1],
                        };
                        const m = d[e.key];
                        if (!m) return;
                        e.preventDefault();
                        nudge(s, m[0], m[1]);
                      }}
                      // 카드 안에 z-index 를 쓰는 조각(번호판·색면)이 있어서
                      // 잡는 면이 그 위로 와야 한다. 크기 버튼만 이보다 위.
                      className="absolute inset-0 z-[5] cursor-grab bg-ink/[.04] active:cursor-grabbing"
                    />
                    <button
                      type="button"
                      onClick={() => resize(s)}
                      aria-label={`카드 크기 ${s.w}×${s.h} · 눌러서 바꾸기`}
                      // 아래가 아니라 색면 오른쪽 위. 아래에 두면 캡션 글자를
                      // 덮는다. 번호판은 왼쪽 위라 겹치지 않는다.
                      className="krb absolute right-2 top-2 z-[6] bg-ink px-2 py-1 text-[10px] tracking-[.12em] text-hot"
                    >
                      {s.w}×{s.h}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
