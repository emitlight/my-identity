import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { QuickCapture } from "@/components/QuickCapture";
import { TaskRow } from "@/components/TaskRow";
import { Empty } from "@/components/ui";
import { todayISO } from "@/lib/date";
import type { Task } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const { supabase } = await requireUser();
  const today = todayISO();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .in("status", ["inbox", "todo", "doing"])
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <AppShell active="tasks" title="할 일">
        <p className="krb py-10 text-[15px] text-danger">할 일을 불러오지 못했습니다.</p>
      </AppShell>
    );
  }

  const tasks = (data ?? []) as Task[];
  const inbox = tasks.filter((t) => t.status === "inbox");
  const todayList = tasks.filter(
    (t) => t.status !== "inbox" && t.scheduled_for && t.scheduled_for <= today,
  );
  const later = tasks.filter(
    (t) => t.status !== "inbox" && (!t.scheduled_for || t.scheduled_for > today),
  );

  return (
    <AppShell active="tasks" title="할 일" subtitle={`${tasks.length}개`}>
      <div className="flex flex-col gap-8 pt-4 lg:gap-12 lg:pt-6">
        <QuickCapture />

        <Group title="인박스" latin="Unsorted" hint="분류하지 않아도 됩니다" tasks={inbox} />
        <Group title="오늘" latin="Today" tasks={todayList} />
        <Group title="예정" latin="Later" tasks={later} />
      </div>
    </AppShell>
  );
}

function Group({
  title,
  latin,
  hint,
  tasks,
}: {
  title: string;
  latin: string;
  hint?: string;
  tasks: Task[];
}) {
  return (
    <section>
      <div className="flex items-end justify-between gap-4 border-b-[3px] border-ink pb-1.5">
        <span className="flex flex-col gap-1.5">
          <span className="kicker text-hot-deep">{latin}</span>
          <span className="krb text-[19px] leading-none lg:text-[24px]">{title}</span>
        </span>
        {tasks.length ? (
          <span className="num text-[26px] leading-none text-hot lg:text-[34px]">
            {tasks.length}
          </span>
        ) : null}
      </div>
      {tasks.length === 0 ? (
        <Empty>{hint ?? "비어 있습니다."}</Empty>
      ) : (
        <div>
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      )}
    </section>
  );
}
