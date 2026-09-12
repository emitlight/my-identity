/**
 * DB 행 타입.
 *
 * supabase gen types 로 생성하는 편이 정확하지만, 그러려면 실제 프로젝트에
 * 연결되어 있어야 한다. 프로젝트가 생기면 생성본으로 교체한다.
 * 그때까지는 마이그레이션과 이 파일을 같이 고치는 것이 규약이다.
 */

export type TaskStatus = "inbox" | "todo" | "doing" | "done" | "dropped";
export type GoalHorizon = "life" | "year" | "quarter" | "month";
export type GoalStatus = "active" | "done" | "dropped" | "paused";
export type HabitCadence = "daily" | "weekly" | "custom";
export type AspirationDomain =
  | "space" | "routine" | "style" | "body" | "work" | "relationship" | "other";

export interface Role {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  active: boolean;
  sort_order: number;
}

export interface Task {
  id: string;
  project_id: string | null;
  role_id: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: number;
  due_at: string | null;
  scheduled_for: string | null;
  estimate_min: number | null;
  completed_at: string | null;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  role_id: string | null;
  project_id: string | null;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  region: string | null;
  recurrence: unknown | null;
  reminder_minutes: number[];
}

export interface Habit {
  id: string;
  role_id: string | null;
  aspiration_id: string | null;
  title: string;
  cadence: HabitCadence;
  target_per_period: number;
  color: string | null;
  active: boolean;
  sort_order: number;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  logged_on: string;
  value: number;
}

export interface Goal {
  id: string;
  role_id: string | null;
  parent_id: string | null;
  title: string;
  description: string | null;
  horizon: GoalHorizon;
  period_start: string | null;
  period_end: string | null;
  metric_key: string | null;
  metric_target: number | null;
  metric_unit: string | null;
  status: GoalStatus;
  last_activity_at: string;
  stale_after_days: number | null;
}

/** Today 화면이 한 번에 받아오는 묶음 */
export interface TodayData {
  now: string;
  roles: Role[];
  events: CalendarEvent[];
  tasks: Task[];
  habits: (Habit & { done_today: boolean; streak: number })[];
  alerts: TodayAlert[];
}

/**
 * Today 최상단에 뜨는 경고·맥락 카드.
 * 노션이 3개월간 하지 않은 말을 여기서 한다.
 */
export interface TodayAlert {
  kind: "overdue" | "due_soon" | "stale" | "surface";
  title: string;
  body: string;
  href: string;
}
