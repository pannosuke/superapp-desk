import { z } from "zod";
import { missingAuthEnv } from "@/lib/env";
import { discardDraft, getDraft, getThread, updateDraft } from "@/lib/graph";
import { UpstreamError } from "@/lib/http";
import { json, requireGraph } from "@/lib/session";

const address = z.string().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

const patchSchema = z.object({
  subject: z.string().trim().min(1).max(255),
  bodyHtml: z.string().max(200_000),
  to: z.array(address).min(1).max(25),
  cc: z.array(address).max(25),
});

async function gate() {
  const missing = missingAuthEnv();
  if (missing.length) return { ok: false as const, response: json({ connected: false, missing }) };
  const session = await requireGraph();
  if (!session.ok) return { ok: false as const, response: session.response };
  return { ok: true as const, accessToken: session.accessToken };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await gate();
  if (!session.ok) return session.response;
  const { id } = await context.params;
  try {
    const draft = await getDraft(session.accessToken, id);
    const thread = draft.conversationId
      ? await getThread(session.accessToken, draft.conversationId, draft.id)
      : [];
    return json({ connected: true, draft, thread });
  } catch (error) {
    const message = error instanceof UpstreamError ? error.message : "Could not open that draft.";
    const status = error instanceof UpstreamError ? error.status : 502;
    return json({ connected: true, error: message }, status);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await gate();
  if (!session.ok) return session.response;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: "Subject, at least one To address, and a body are required." }, 400);
  }
  const { id } = await context.params;
  try {
    await updateDraft(session.accessToken, id, parsed.data);
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof UpstreamError ? error.message : "Could not save the draft.";
    return json({ error: message }, error instanceof UpstreamError ? error.status : 502);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await gate();
  if (!session.ok) return session.response;
  const { id } = await context.params;
  try {
    await discardDraft(session.accessToken, id);
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof UpstreamError ? error.message : "Could not discard the draft.";
    return json({ error: message }, error instanceof UpstreamError ? error.status : 502);
  }
}
