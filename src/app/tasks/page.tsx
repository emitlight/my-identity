import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { QuickCapture } from "@/components/QuickCapture";
import { TaskRow } from "@/components/TaskRow";
import { Card, SectionLabel, Empty } from "@/components/ui";
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
        <Card className="p-5">
          <p className="text-[14.5px] text-danger">할 일을 불러오지 못했습니다.</p>
        </Card>
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
      <div className="flex flex-col gap-6">
        <QuickCapture />

        <Group title="인박스" hint="분류하지 않아도 됩니다" tasks={inbox} />
        <Group title="오늘" tasks={todayList} />
        <Group title="예정" tasks={later} />
      </div>
    </AppShell>
  );
}

function Group({
  title,
  hint,
  tasks,
}: {
  title: string;
  hint?: string;
  tasks: Task[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel right={tasks.length ? `${tasks.length}` : undefined}>
        {title}
      </SectionLabel>
      {tasks.length === 0 ? (
        <Card>
          <Empty>{hint ?? "비어 있습니다."}</Empty>
        </Card>
      ) : (
        <Card className="divide-y divide-line-soft">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </Card>
      )}
    </section>
  );
}
