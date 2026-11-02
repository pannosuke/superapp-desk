import { z } from "zod";
import { notionMissing } from "@/lib/env";
import { findPrepPage } from "@/lib/notion";
import { UpstreamError } from "@/lib/http";
import { json, requireSession } from "@/lib/session";
import { setMeetingLink } from "@/lib/storage";

const searchSchema = z.object({
  eventId: z.string().trim().min(1).max(400),
  title: z.string().trim().min(1).max(300),
});

const saveSchema = z.object({
  eventId: z.string().trim().min(1).max(400),
  url: z.string().trim().max(2000),
});

function httpsUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;
  const missing = notionMissing();
  if (missing.length) return json({ connected: false, missing });
  const parsed = searchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "A meeting title is required." }, 400);
  try {
    const match = await findPrepPage(parsed.data.title);
    if (match) await setMeetingLink(parsed.data.eventId, match.url);
    return json({ connected: true, match });
  } catch (error) {
    const message = error instanceof UpstreamError ? error.message : "Notion search failed.";
    return json({ error: message }, 502);
  }
}

export async function PUT(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "That prep link is not valid." }, 400);
  const url = httpsUrl(parsed.data.url);
  if (url === undefined) return json({ error: "Prep links must be https URLs." }, 400);
  await setMeetingLink(parsed.data.eventId, url);
  return json({ ok: true, url });
}
