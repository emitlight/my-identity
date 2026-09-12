import { fromZonedTime, toZonedTime } from "date-fns-tz";

/**
 * 한국어 일정 한 줄 파서.
 *
 * 목표는 완벽한 파서가 아니다. 실제로 자주 쓰는 패턴만 확실히 잡고,
 * 나머지는 제목으로 흘려보낸 뒤 사용자가 칩을 눌러 고치게 한다.
 * 정확도 90%짜리 파서를 만들려다 Phase 1 을 못 끝내는 것이 최악이고,
 * 어차피 "고치는 비용"이 "폼을 채우는 비용"보다 싸면 목적은 달성된다.
 *
 *   "내일 오후 3시 강남 미팅 2시간"  → 09.13 15:00~17:00 · 강남 · 미팅
 *   "매주 목요일 저녁 7시 골프 레슨"  → 매주 목 19:00 반복
 *   "11월 20일 대전 출장"            → 종일 · region=대전  ← 서피싱 트리거
 */

export type TokenType =
  | "date"
  | "time"
  | "duration"
  | "recurrence"
  | "region"
  | "allDay";

export interface ParseToken {
  type: TokenType;
  /** 원문에서 잘라낸 조각 */
  text: string;
  /** 칩에 표시할 문구 */
  label: string;
}

export interface Recurrence {
  freq: "daily" | "weekly" | "monthly";
  /** 0=일 … 6=토 */
  byDay?: number[];
  byMonthDay?: number;
}

export interface ParsedEvent {
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  allDay: boolean;
  region: string | null;
  recurrence: Recurrence | null;
  tokens: ParseToken[];
  /** 날짜/시간을 하나도 못 찾았으면 true — UI 가 폼으로 폴백한다 */
  needsForm: boolean;
}

const WEEKDAYS: Record<string, number> = {
  일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6,
};
const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

/** 한글 수사 — "세시", "열두시" */
const NUM_WORDS: Record<string, number> = {
  한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6,
  일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 열한: 11, 열두: 12,
};

/**
 * 서피싱 매칭에 쓸 지역명.
 *
 * 광역시/도와 자주 가는 지명만 둔다. 전국 행정구역을 다 넣으면 "성남"이
 * 사람 이름에 걸리는 식의 오탐이 늘어난다. 실제로 컬렉션을 만들 지역만
 * 추가해 나가는 편이 정확하다.
 */
const REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "수원", "성남", "분당", "판교", "용인", "고양", "일산", "안양",
  "강남", "서초", "송파", "잠실", "여의도", "종로", "홍대", "성수", "판교역",
  "춘천", "강릉", "속초", "원주", "청주", "천안", "아산", "전주", "여수",
  "순천", "포항", "경주", "창원", "김해", "제주", "서귀포", "평택", "화성",
];

const PERIOD_SHIFT: Record<string, "am" | "pm"> = {
  새벽: "am", 아침: "am", 오전: "am",
  점심: "pm", 낮: "pm", 오후: "pm", 저녁: "pm", 밤: "pm",
};

interface Cut {
  start: number;
  end: number;
}

/** 원문에서 매칭 구간을 제거해 제목만 남기기 위한 도구 */
class Text {
  private cuts: Cut[] = [];
  readonly raw: string;

  constructor(raw: string) {
    this.raw = raw;
  }

  cut(match: RegExpMatchArray) {
    const start = match.index ?? 0;
    this.cuts.push({ start, end: start + match[0].length });
  }

  cutRange(start: number, end: number) {
    this.cuts.push({ start, end });
  }

  /** 잘라낸 구간을 뺀 나머지 */
  rest(): string {
    if (!this.cuts.length) return this.raw.trim();
    const sorted = [...this.cuts].sort((a, b) => a.start - b.start);
    let out = "";
    let at = 0;
    for (const c of sorted) {
      if (c.start > at) out += this.raw.slice(at, c.start);
      at = Math.max(at, c.end);
    }
    out += this.raw.slice(at);
    return out.replace(/\s+/g, " ").trim();
  }
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/** 기준일 이후(오늘 포함 여부 선택)로 가장 가까운 해당 요일 */
function nextWeekday(from: Date, target: number, includeToday: boolean): Date {
  const cur = from.getDay();
  let delta = (target - cur + 7) % 7;
  if (delta === 0 && !includeToday) delta = 7;
  return addDays(from, delta);
}

function parseHourWord(raw: string): number | null {
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  return NUM_WORDS[raw] ?? null;
}

export function parseEventInput(
  input: string,
  now: Date = new Date(),
  timeZone = "Asia/Seoul",
): ParsedEvent {
  const t = new Text(input);
  const tokens: ParseToken[] = [];

  let recurrence: Recurrence | null = null;
  let day: Date | null = null;
  let hour: number | null = null;
  let minute = 0;
  let durationMin: number | null = null;
  let endHour: number | null = null;
  let endMinute = 0;
  let region: string | null = null;

  const localNow = toZonedTime(now, timeZone);
  const today = startOfDay(localNow);

  // ---------- 1. 반복 ----------
  // 날짜보다 먼저 잡아야 한다. "매주 목요일"의 '목요일'이 단독 요일로
  // 먼저 소비되면 반복이 사라진다.
  let m: RegExpMatchArray | null;

  if ((m = input.match(/매주\s*([일월화수목금토])(?:요일)?/))) {
    recurrence = { freq: "weekly", byDay: [WEEKDAYS[m[1]]] };
    tokens.push({ type: "recurrence", text: m[0], label: `매주 ${m[1]}` });
    day = nextWeekday(today, WEEKDAYS[m[1]], true);
    t.cut(m);
  } else if ((m = input.match(/매월\s*(\d{1,2})\s*일/))) {
    const d = parseInt(m[1], 10);
    recurrence = { freq: "monthly", byMonthDay: d };
    tokens.push({ type: "recurrence", text: m[0], label: `매월 ${d}일` });
    const candidate = new Date(today.getFullYear(), today.getMonth(), d);
    day = candidate < today
      ? new Date(today.getFullYear(), today.getMonth() + 1, d)
      : candidate;
    t.cut(m);
  } else if ((m = input.match(/(매일|평일|주말)/))) {
    const kind = m[1];
    recurrence =
      kind === "매일"
        ? { freq: "daily" }
        : kind === "평일"
          ? { freq: "weekly", byDay: [1, 2, 3, 4, 5] }
          : { freq: "weekly", byDay: [0, 6] };
    tokens.push({ type: "recurrence", text: m[0], label: kind });
    day = today;
    t.cut(m);
  }

  // ---------- 2. 날짜 ----------
  if (!day) {
    if ((m = input.match(/(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/))) {
      day = new Date(+m[1], +m[2] - 1, +m[3]);
      t.cut(m);
    } else if ((m = input.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/))) {
      const month = +m[1] - 1;
      const date = +m[2];
      // 연도를 안 적었는데 이미 지난 날짜면 내년으로 본다.
      // 12월에 "1월 5일"이라 쓰면 보통 다음 달을 뜻한다.
      let year = today.getFullYear();
      if (new Date(year, month, date) < today) year += 1;
      day = new Date(year, month, date);
      t.cut(m);
    } else if ((m = input.match(/(오늘|내일|모레|글피)/))) {
      const offset = { 오늘: 0, 내일: 1, 모레: 2, 글피: 3 }[m[1]]!;
      day = addDays(today, offset);
      t.cut(m);
    } else if ((m = input.match(/(\d{1,2})\s*일\s*(뒤|후)/))) {
      day = addDays(today, +m[1]);
      t.cut(m);
    } else if (
      (m = input.match(/(다음\s*주|담주|이번\s*주|차주)\s*([일월화수목금토])(?:요일)?/))
    ) {
      const wd = WEEKDAYS[m[2]];
      const thisWeek = nextWeekday(today, wd, true);
      day = /이번/.test(m[1]) ? thisWeek : addDays(nextWeekday(today, wd, false), 7 - 7);
      if (!/이번/.test(m[1])) {
        // "다음주 화요일" = 다음 주에 속한 화요일
        const monday = addDays(today, (8 - today.getDay()) % 7 || 7);
        day = nextWeekday(monday, wd, true);
      }
      t.cut(m);
    } else if ((m = input.match(/([일월화수목금토])요일/))) {
      day = nextWeekday(today, WEEKDAYS[m[1]], true);
      t.cut(m);
    }
  }

  // ---------- 3. 시간 ----------
  // 기간 표기("3시부터 5시까지")를 먼저 본다.
  const rangeRe =
    /(오전|오후|아침|점심|저녁|밤|새벽|낮)?\s*(\d{1,2}|[가-힣]{1,2})\s*시\s*(?:(\d{1,2})\s*분)?\s*(?:부터|~|-|에서)\s*(오전|오후|아침|점심|저녁|밤|새벽|낮)?\s*(\d{1,2}|[가-힣]{1,2})\s*시\s*(?:(\d{1,2})\s*분)?\s*(?:까지)?/;

  const singleRe =
    /(오전|오후|아침|점심|저녁|밤|새벽|낮)?\s*(\d{1,2}|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열두|열한|열)\s*시\s*(반|\d{1,2}\s*분)?/;

  const clockRe = /(\d{1,2}):(\d{2})/;

  const applyPeriod = (h: number, period?: string): number => {
    if (!period) return h;
    const shift = PERIOD_SHIFT[period];
    if (shift === "pm" && h < 12) return h + 12;
    if (shift === "am" && h === 12) return 0;
    return h;
  };

  if ((m = input.match(rangeRe))) {
    const h1 = parseHourWord(m[2]);
    const h2 = parseHourWord(m[5]);
    if (h1 !== null && h2 !== null) {
      // 단독 시각과 같은 규칙을 쓴다. "3시부터 5시까지 워크샵"은
      // 새벽 3시가 아니다.
      hour = m[1] ? applyPeriod(h1, m[1]) : h1 >= 1 && h1 <= 7 ? h1 + 12 : h1;
      minute = m[3] ? +m[3] : 0;

      const endPeriod = m[4] ?? m[1];
      endHour = endPeriod ? applyPeriod(h2, endPeriod) : h2;
      endMinute = m[6] ? +m[6] : 0;

      // 종료가 시작보다 앞서면 오후로 올린다. "9시부터 6시까지"는
      // 9시간 뒤를 뜻하지 15시간 전을 뜻하지 않는다.
      if (!endPeriod && endHour < 12 && endHour + 12 >= hour) endHour += 12;
      if (endHour <= hour && endHour + 12 <= 23) endHour += 12;
      t.cut(m);
    }
  } else if ((m = input.match(clockRe))) {
    hour = +m[1];
    minute = +m[2];
    t.cut(m);
  } else if ((m = input.match(singleRe))) {
    const h = parseHourWord(m[2]);
    if (h !== null) {
      hour = applyPeriod(h, m[1]);
      if (m[3]) minute = m[3] === "반" ? 30 : parseInt(m[3], 10);
      // 기간 표기가 없고 오전/오후도 없는데 이른 숫자면 오후로 본다.
      // "3시 미팅"은 새벽 3시가 아니다.
      if (!m[1] && hour >= 1 && hour <= 7) hour += 12;
      t.cut(m);
    }
  }

  // ---------- 4. 소요 시간 ----------
  if ((m = input.match(/(\d+(?:\.\d+)?)\s*시간\s*(?:(\d{1,2})\s*분)?/))) {
    durationMin = Math.round(parseFloat(m[1]) * 60) + (m[2] ? +m[2] : 0);
    tokens.push({ type: "duration", text: m[0], label: `${durationMin}분` });
    t.cut(m);
  } else if ((m = input.match(/(\d+)\s*분\s*(?:짜리|동안)?/))) {
    // "30분" 이 시각의 일부("3시 30분")로 이미 소비되지 않은 경우만
    durationMin = +m[1];
    tokens.push({ type: "duration", text: m[0], label: `${durationMin}분` });
    t.cut(m);
  }

  // ---------- 5. 지역 ----------
  // 긴 이름부터 봐야 "판교역"이 "판교"로 잘리지 않는다.
  for (const r of [...REGIONS].sort((a, b) => b.length - a.length)) {
    const idx = input.indexOf(r);
    if (idx >= 0) {
      region = r;
      tokens.push({ type: "region", text: r, label: `지역 · ${r}` });
      // 지역명은 제목에 남긴다. "대전 출장"에서 '대전'을 지우면
      // 제목이 '출장'만 남아 목록에서 무슨 일인지 알 수 없다.
      break;
    }
  }

  // ---------- 6. 조립 ----------
  if (day === null && hour !== null) {
    day = today;
    const passed =
      hour < localNow.getHours() ||
      (hour === localNow.getHours() && minute <= localNow.getMinutes());
    if (passed) day = addDays(today, 1);
  }

  const allDay = hour === null;
  let startsAt: Date | null = null;
  let endsAt: Date | null = null;

  if (day) {
    const wall = new Date(day);
    if (hour !== null) wall.setHours(hour, minute, 0, 0);
    else wall.setHours(0, 0, 0, 0);
    startsAt = fromZonedTime(wall, timeZone);

    if (endHour !== null) {
      const e = new Date(day);
      e.setHours(endHour, endMinute, 0, 0);
      endsAt = fromZonedTime(e, timeZone);
    } else if (durationMin !== null && hour !== null) {
      endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
    }
  }

  // 날짜 칩
  if (day) {
    const label = allDay
      ? `${day.getMonth() + 1}.${day.getDate()} (${WEEKDAY_NAMES[day.getDay()]}) 종일`
      : `${day.getMonth() + 1}.${day.getDate()} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    tokens.unshift({ type: allDay ? "allDay" : "date", text: "", label });
  }

  const title = t.rest() || input.trim();

  return {
    title,
    startsAt,
    endsAt,
    allDay,
    region,
    recurrence,
    tokens,
    needsForm: day === null,
  };
}
