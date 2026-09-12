import { toZonedTime, fromZonedTime, format } from "date-fns-tz";

export const TZ = "Asia/Seoul";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** UTC 타임스탬프를 사용자 시간대의 벽시계 Date 로 */
export function local(d: Date | string, tz = TZ): Date {
  return toZonedTime(typeof d === "string" ? new Date(d) : d, tz);
}

/** 사용자 시간대의 "오늘" 을 YYYY-MM-DD 로. 서버가 UTC 여도 옳다. */
export function todayISO(now: Date = new Date(), tz = TZ): string {
  return format(toZonedTime(now, tz), "yyyy-MM-dd", { timeZone: tz });
}

/** 사용자 시간대 기준 하루의 시작/끝을 UTC 범위로 */
export function dayRange(dateISO: string, tz = TZ): { from: string; to: string } {
  const from = fromZonedTime(`${dateISO}T00:00:00`, tz);
  const to = fromZonedTime(`${dateISO}T23:59:59.999`, tz);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function hhmm(d: Date | string, tz = TZ): string {
  return format(local(d, tz), "HH:mm", { timeZone: tz });
}

export function monthDay(d: Date | string, tz = TZ): string {
  const z = local(d, tz);
  return `${z.getMonth() + 1}.${z.getDate()}`;
}

export function weekday(d: Date | string, tz = TZ): string {
  return WEEKDAYS[local(d, tz).getDay()];
}

/** "2시간 뒤", "12분 뒤", "지금" — 다음 일정까지 남은 시간 */
export function untilLabel(target: Date | string, now: Date = new Date()): string {
  const t = typeof target === "string" ? new Date(target) : target;
  const min = Math.round((t.getTime() - now.getTime()) / 60000);
  if (min < -60) return `${Math.abs(Math.round(min / 60))}시간 지남`;
  if (min < 0) return `${Math.abs(min)}분 지남`;
  if (min < 1) return "지금";
  if (min < 60) return `${min}분 뒤`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 뒤`;
  return `${Math.floor(h / 24)}일 뒤`;
}

/** 마감까지 남은 일수. 음수면 지남. */
export function daysUntil(dateISO: string, now: Date = new Date(), tz = TZ): number {
  const today = new Date(`${todayISO(now, tz)}T00:00:00Z`);
  const target = new Date(`${dateISO}T00:00:00Z`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
