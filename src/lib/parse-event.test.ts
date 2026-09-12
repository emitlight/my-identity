/**
 * 자연어 일정 파서 검증.
 *   node --experimental-strip-types src/lib/parse-event.test.ts
 *
 * 파서는 규칙이 서로 간섭하기 쉬워서(반복이 요일을 먹고, 소요시간이
 * 분을 먹는 식) 손으로 눈으로 확인하면 반드시 놓친다.
 */
import { parseEventInput } from "./parse-event.ts";
import { toZonedTime } from "date-fns-tz";

const TZ = "Asia/Seoul";
// 기준: 2026-09-12(토) 13:00 KST
const NOW = new Date("2026-09-12T04:00:00Z");

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? `  — ${detail}` : ""}`);
  }
}

/** UTC Date 를 KST 벽시계로 되돌려 확인한다 */
function kst(d: Date | null) {
  if (!d) return null;
  const z = toZonedTime(d, TZ);
  return {
    month: z.getMonth() + 1,
    date: z.getDate(),
    hour: z.getHours(),
    minute: z.getMinutes(),
    day: z.getDay(),
  };
}

function p(input: string) {
  return parseEventInput(input, NOW, TZ);
}

console.log("\n=== 날짜 · 시간 ===");
{
  const r = p("내일 오후 3시 강남 미팅 2시간");
  const s = kst(r.startsAt)!;
  const e = kst(r.endsAt)!;
  check("내일 오후 3시 → 09.13 15:00", s.month === 9 && s.date === 13 && s.hour === 15, JSON.stringify(s));
  check("2시간 → 종료 17:00", e.hour === 17 && e.minute === 0, JSON.stringify(e));
  check("지역 강남 추출", r.region === "강남", String(r.region));
  check("제목에 미팅 남음", r.title.includes("미팅"), r.title);
  check("종일 아님", r.allDay === false);
}
{
  const r = p("11월 20일 대전 출장");
  const s = kst(r.startsAt)!;
  check("11월 20일 → 11.20", s.month === 11 && s.date === 20, JSON.stringify(s));
  check("시간 없으면 종일", r.allDay === true);
  check("지역 대전 → 서피싱 키", r.region === "대전", String(r.region));
  check("지역명은 제목에 남긴다", r.title.includes("대전"), r.title);
}
{
  const r = p("내일 14:30 치과");
  const s = kst(r.startsAt)!;
  check("24시간 표기 14:30", s.hour === 14 && s.minute === 30, JSON.stringify(s));
}
{
  // 기준 13:00 KST. 오전 9시는 이미 지났으므로 내일로 잡혀야 한다.
  const r = p("오전 9시 회의");
  const s = kst(r.startsAt)!;
  check("날짜 없이 시간만 → 날짜 채움", r.startsAt !== null);
  check("오전 9시 → 09:00", s.hour === 9, JSON.stringify(s));
  check("이미 지난 시각 → 내일", s.date === 13, JSON.stringify(s));
}
{
  // 기준 13:00 KST. 오후 6시는 아직 안 지났으므로 오늘.
  const r = p("저녁 6시 저녁약속");
  const s = kst(r.startsAt)!;
  check("아직 안 지난 시각 → 오늘", s.date === 12 && s.hour === 18, JSON.stringify(s));
}
{
  const r = p("3시 미팅");
  check("오전/오후 없는 3시 → 오후로 해석", kst(r.startsAt)!.hour === 15);
}
{
  const r = p("두시 반 상담");
  const s = kst(r.startsAt)!;
  check("한글 수사 + 반 → 14:30", s.hour === 14 && s.minute === 30, JSON.stringify(s));
}
{
  const r = p("모레 3시부터 5시까지 워크샵");
  const s = kst(r.startsAt)!;
  const e = kst(r.endsAt)!;
  check("기간 표기 시작 15:00", s.hour === 15, JSON.stringify(s));
  check("기간 표기 종료 17:00", e.hour === 17, JSON.stringify(e));
  check("모레 → 09.14", s.date === 14, JSON.stringify(s));
}

console.log("\n=== 반복 ===");
{
  const r = p("매주 목요일 저녁 7시 골프 레슨");
  check("매주 목 반복", r.recurrence?.freq === "weekly" && r.recurrence.byDay?.[0] === 4, JSON.stringify(r.recurrence));
  check("저녁 7시 → 19:00", kst(r.startsAt)!.hour === 19);
  check("첫 발생일이 목요일", kst(r.startsAt)!.day === 4);
  check("제목에 골프 레슨", r.title.includes("골프"), r.title);
}
{
  const r = p("매일 아침 7시 운동");
  check("매일 반복", r.recurrence?.freq === "daily");
  check("아침 7시 → 07:00", kst(r.startsAt)!.hour === 7);
}
{
  const r = p("평일 8시 30분 출근");
  check("평일 → 월~금", JSON.stringify(r.recurrence?.byDay) === "[1,2,3,4,5]", JSON.stringify(r.recurrence));
}
{
  const r = p("매월 15일 정산");
  check("매월 15일", r.recurrence?.freq === "monthly" && r.recurrence.byMonthDay === 15);
}

console.log("\n=== 요일 지정 ===");
{
  // 기준일 2026-09-12 는 토요일
  const r = p("다음주 화요일 점심 약속");
  const s = kst(r.startsAt)!;
  check("다음주 화요일 → 화요일로 해석", s.day === 2, `day=${s.day} (${s.month}.${s.date})`);
  check("다음주는 기준일보다 미래", r.startsAt!.getTime() > NOW.getTime());
}
{
  const r = p("수요일 저녁 7시 모임");
  const s = kst(r.startsAt)!;
  check("단독 요일 → 다가오는 수요일", s.day === 3, `day=${s.day}`);
}

console.log("\n=== 폴백 ===");
{
  const r = p("그냥 적어둔 메모");
  check("날짜 없으면 needsForm", r.needsForm === true);
  check("제목은 원문 그대로", r.title === "그냥 적어둔 메모", r.title);
}
{
  const r = p("내일 뭐하지");
  check("날짜만 있으면 폼 불필요", r.needsForm === false);
  check("종일로 처리", r.allDay === true);
}

console.log("\n=== 간섭 회귀 ===");
{
  // "매주 목요일"의 목요일이 단독 요일 규칙에 먼저 먹히면 반복이 사라진다
  const r = p("매주 목요일 회의");
  check("반복이 요일에 먹히지 않음", r.recurrence !== null);
}
{
  // "3시 30분"의 30분이 소요시간으로 먹히면 시각이 깨진다
  const r = p("내일 3시 30분 통화");
  const s = kst(r.startsAt)!;
  check("시각의 분이 소요시간에 먹히지 않음", s.hour === 15 && s.minute === 30, JSON.stringify(s));
}
{
  // 긴 지역명이 짧은 것에 잘리지 않는지
  const r = p("판교역 3번 출구");
  check("판교역이 판교로 잘리지 않음", r.region === "판교역", String(r.region));
}

console.log(`\n${fail === 0 ? "✓" : "✗"} ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail === 0 ? 0 : 1);
