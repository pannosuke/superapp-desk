import { grokbotMissing } from "@/lib/env";
import { outboundSchema } from "@/lib/feed";
import { postGrokbot } from "@/lib/grokbot";
import { UpstreamError } from "@/lib/http";
import { json, requireSession } from "@/lib/session";
import { findFeed, updateFeed } from "@/lib/storage";

export async function GET() {
  const missing = grokbotMissing();
  if (missing.length) return json({ connected: false, missing });
  const session = await requireSession();
  if (!session.ok) return session.response;
  return json({ connected: true, missing: [] });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;
  const missing = grokbotMissing();
  if (missing.length) return json({ connected: false, missing });

  const parsed = outboundSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "That message is not a decision, command, or item." }, 400);

  const payload = {
    ...parsed.data,
    sentAt: new Date().toISOString(),
    actor: session.email,
  };

  try {
    if (parsed.data.kind === "decision") {
      const item = await findFeed(parsed.data.itemId);
      if (!item) return json({ error: "That decision is no longer in the feed." }, 404);
      await postGrokbot({
        ...payload,
        feedItem: {
          id: item.id,
          type: item.type,
          title: item.title,
          source: item.source,
          priority: item.priority,
        },
      });
      const updated = await updateFeed(item.id, {
        choice: parsed.data.choice,
        choiceNote: parsed.data.note?.trim() || undefined,
        choiceSentAt: payload.sentAt,
        done: true,
        handledNote: parsed.data.note?.trim() || item.handledNote,
      });
      return json({ connected: true, item: updated });
    }
    await postGrokbot(payload);
    return json({ connected: true });
  } catch (error) {
    const message = error instanceof UpstreamError ? error.message : "Could not reach Grok Bot.";
    return json({ error: message }, 502);
  }
}
