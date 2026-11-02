import { isAuthConfigured, todoistMissing } from "@/lib/env";
import { UpstreamError } from "@/lib/http";
import { json, requireSession } from "@/lib/session";
import { closeTask } from "@/lib/todoist";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const missing = todoistMissing();
  if (missing.length) return json({ connected: false, missing });
  if (!isAuthConfigured()) {
    return json({ connected: false, missing: ["AUTH_SECRET"] });
  }
  const session = await requireSession();
  if (!session.ok) return session.response;
  const { id } = await context.params;
  try {
    await closeTask(id);
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof UpstreamError ? error.message : "Could not complete the task.";
    return json({ error: message }, 502);
  }
}
