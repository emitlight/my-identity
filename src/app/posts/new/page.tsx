import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PostEditor } from "@/components/PostEditor";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  await requireUser();
  return (
    <AppShell active="posts" title="글" subtitle="새 글">
      <PostEditor />
    </AppShell>
  );
}
