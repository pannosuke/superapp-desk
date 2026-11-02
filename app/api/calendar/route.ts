import { connection } from "next/server";
import { clientsForMatching, describeEvent, parseDayWindow } from "@/lib/agenda";
import { missingAuthEnv, notionMissing } from "@/lib/env";
import { listCalendar } from "@/lib/graph";
import { UpstreamError } from "@/lib/http";
import { json, requireGraph } from "@/lib/session";
import { getMeetingLink } from "@/lib/storage";

export async function GET(request: Request) {
  await connection();
  const missing = missingAuthEnv();
  if (missing.length) return json({ connected: false, missing, notion: notionMissing() });
  const session = await requireGraph();
  if (!session.ok) return session.response;

  const url = new URL(request.url);
  const window = parseDayWindow(url.searchParams.get("start"), url.searchParams.get("end"));
  if (!window) return json({ error: "Send a start and end within a two-day window." }, 400);

  try {
    const events = await listCalendar(session.accessToken, window.start, window.end);
    const clients = clientsForMatching(url.searchParams.get("clients"));
    const described = await Promise.all(
      events.map(async (event) => {
        const base = describeEvent(event, clients);
        const prepUrl = await getMeetingLink(event.id);
        return { ...base, prepUrl };
      }),
    );
    return json({
      connected: true,
      events: described,
      notionConnected: notionMissing().length === 0,
      notionMissing: notionMissing(),
    });
  } catch (error) {
    const message = error instanceof UpstreamError ? error.message : "Could not load the calendar.";
    return json(
      { connected: true, error: message, events: [], notionMissing: notionMissing() },
      error instanceof UpstreamError ? error.status : 502,
    );
  }
}
