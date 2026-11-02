import { z } from "zod";
import { clientsForMatching, describeEvent, parseDayWindow } from "@/lib/agenda";
import { aiMissing, feedInboundMissing, isAuthConfigured, missingAuthEnv, ninjaMissing, notionMissing, todoistMissing } from "@/lib/env";
import { writeBrief } from "@/lib/ai";
import { listCalendar, listDrafts } from "@/lib/graph";
import { listAssignedTickets } from "@/lib/ninjaone";
import { listFeed } from "@/lib/storage";
import { listDueTasks } from "@/lib/todoist";
import { json, requireGraph, requireSession } from "@/lib/session";

const bodySchema = z.object({
  action: z.enum(["brief", "ask"]),
  prompt: z.string().trim().max(2000).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  clients: z.string().max(4000).optional(),
});

async function safe<T>(run: () => Promise<T>, fallback: T) {
  try {
    return await run();
  } catch {
    return fallback;
  }
}

export async function GET() {
  const missing = aiMissing();
  if (missing.length) return json({ connected: false, missing });
  if (!isAuthConfigured()) return json({ connected: false, missing: missingAuthEnv() });
  return json({ connected: true, missing: [] });
}

export async function POST(request: Request) {
  const missing = aiMissing();
  if (missing.length) return json({ connected: false, missing });
  if (!isAuthConfigured()) return json({ connected: false, missing: missingAuthEnv() });
  const session = await requireSession();
  if (!session.ok) return session.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Ask for a brief or a question." }, 400);
  if (parsed.data.action === "ask" && !parsed.data.prompt) {
    return json({ error: "Type a question first." }, 400);
  }

  const window = parseDayWindow(parsed.data.start ?? null, parsed.data.end ?? null);
  const graph = missingAuthEnv().length ? null : await requireGraph();
  const token = graph && graph.ok ? graph.accessToken : null;

  const [drafts, events, tasks, tickets, feed] = await Promise.all([
    token
      ? safe(() => listDrafts(token), [])
      : Promise.resolve([]),
    token && window
      ? safe(async () => {
          const rows = await listCalendar(token, window.start, window.end);
          const clients = clientsForMatching(parsed.data.clients ?? null);
          return rows.map((event) => describeEvent(event, clients));
        }, [])
      : Promise.resolve([]),
    todoistMissing().length ? Promise.resolve(null) : safe(() => listDueTasks(), []),
    ninjaMissing().length ? Promise.resolve(null) : safe(() => listAssignedTickets(), []),
    feedInboundMissing().length ? Promise.resolve(null) : safe(() => listFeed(), []),
  ]);

  const snapshot = {
    drafts: drafts.map((draft) => ({
      subject: draft.subject,
      toCount: draft.to.length,
      ccCount: draft.cc.length,
    })),
    agenda: events.map((event) => ({
      subject: event.subject,
      start: event.start,
      end: event.end,
      clientMeeting: event.clientMeeting,
      clientName: event.clientName,
      gccHigh: event.gccHigh,
    })),
    tasks:
      tasks === null
        ? "not connected"
        : tasks.map((task) => ({
            title: task.content,
            priority: task.priorityLabel,
            due: task.due,
            overdue: task.overdue,
            duration: task.duration,
          })),
    tickets:
      tickets === null
        ? "not connected"
        : tickets.map((ticket) => ({
            id: ticket.id,
            subject: ticket.subject,
            status: ticket.status,
            changeRequest: ticket.changeRequest,
            approval: ticket.approval,
            organization: ticket.organization,
          })),
    decisions:
      feed === null
        ? "not connected"
        : feed
            .filter((item) => item.needsDecision && !item.done)
            .map((item) => ({
              title: item.title,
              type: item.type,
              source: item.source,
              priority: item.priority,
            })),
    feed:
      feed === null
        ? "not connected"
        : feed.slice(0, 12).map((item) => ({
            title: item.title,
            type: item.type,
            priority: item.priority,
            done: item.done,
            needsDecision: item.needsDecision,
          })),
    notion: notionMissing().length ? "not connected" : "connected",
  };

  try {
    const result = await writeBrief(
      snapshot,
      parsed.data.action === "ask" ? parsed.data.prompt : undefined,
    );
    if (!result.connected) return json(result);
    return json({ connected: true, text: result.text });
  } catch {
    return json({ error: "The model did not answer. Check the provider key and AI_MODEL." }, 502);
  }
}
