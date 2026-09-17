import type { CollectionKind, ItemStatus } from "@/lib/types";

/**
 * 컬렉션 성격마다 세는 말과 상태를 부르는 말이 다르다.
 *
 * 한 벌로 통일하면 "읽은 책 1곳 중 1곳은 아직 안 가봤습니다" 같은 문장이
 * 나온다. 화면 어디서든 같은 말을 쓰도록 여기 한 곳에서만 정한다.
 */
interface Words {
  /** 세는 말 — 3"곳", 3"개", 3"권" */
  unit: string;
  /** 아직 안 한 것을 부르는 말 */
  pending: string;
  /** 이미 한 것을 부르는 말 */
  done: string;
  /** "아직 안 가봤습니다" 처럼 문장 끝에 오는 서술 */
  pendingVerb: string;
}

const WORDS: Record<CollectionKind, Words> = {
  place:   { unit: "곳", pending: "안 가봄",   done: "가봄",   pendingVerb: "안 가봤습니다" },
  media:   { unit: "개", pending: "안 봄",     done: "봄",     pendingVerb: "안 봤습니다" },
  product: { unit: "개", pending: "안 삼",     done: "가지고 있음", pendingVerb: "안 샀습니다" },
  person:  { unit: "명", pending: "안 만남",   done: "만남",   pendingVerb: "안 만났습니다" },
  generic: { unit: "개", pending: "아직",      done: "됨",     pendingVerb: "그대로입니다" },
};

export function words(kind: string | null | undefined): Words {
  return WORDS[(kind ?? "generic") as CollectionKind] ?? WORDS.generic;
}

/** "3곳" */
export function count(n: number, kind: string | null | undefined): string {
  return `${n}${words(kind).unit}`;
}

/** "23곳 중 8곳은 아직 안 가봤습니다" — 다 했으면 다 했다고 말한다 */
export function progressLine(
  total: number,
  pending: number,
  kind: string | null | undefined,
): string {
  const w = words(kind);
  if (total === 0) return "아직 비어 있습니다";
  if (pending === 0) return `${total}${w.unit} 전부 챙겼습니다`;
  return `${total}${w.unit} 중 ${pending}${w.unit}은 아직 ${w.pendingVerb}`;
}

/** 항목 상태 이름. 장소가 아니면 "안 가봄" 이 아니라 "안 봄" 이다. */
export function statusLabel(
  status: ItemStatus,
  kind: string | null | undefined,
): string {
  const w = words(kind);
  if (status === "wishlist") return w.pending;
  if (status === "visited" || status === "owned") return w.done;
  return "접음";
}
