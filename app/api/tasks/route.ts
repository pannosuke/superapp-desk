import { z } from "zod";
import { isAuthConfigured, missingAuthEnv, todoistMissing } from "@/lib/env";
import { UpstreamError } from "@/lib/http";
import { json, requireSession } from "@/lib/session";
import { addTask, listDueTasks } from "@/lib/todoist";

const createSchema = z.object({
  content: z.string().trim().min(1).max(500),
  minutes: z.number().int().positive().max(24 * 60).optional(),
});

async function gate() {
  const missing = todoistMissing();
  if (missing.length) return { ok: false as const, response: json({ connected: false, missing }) };
  if (!isAuthConfigured()) {
    return { ok: false as const, response: json({ connected: false, missing: missingAuthEnv() }) };
  }
  const session = await requireSession();
  if (!session.ok) return { ok: false as const, response: session.response };
  return { ok: true as const };
}

export async function GET() {
  const session = await gate();
  if (!session.ok) return session.response;
  try {
    const tasks = await listDueTasks();
    return json({ connected: true, tasks });
  } catch (error) {
    const message = error instanceof UpstreamError ? error.message : "Could not load Todoist.";
    return json({ connected: true, error: message, tasks: [] }, 502);
  }
}

export async function POST(request: Request) {
  const session = await gate();
  if (!session.ok) return session.response;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Give the task a title." }, 400);
  try {
    const task = await addTask(parsed.data);
    return json({ connected: true, task });
  } catch (error) {
    const message = error instanceof UpstreamError ? error.message : "Could not add the task.";
    return json({ error: message }, 502);
  }
}
