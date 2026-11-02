import { missingAuthEnv } from "@/lib/env";
import { sendDraft } from "@/lib/graph";
import { UpstreamError } from "@/lib/http";
import { json, requireGraph } from "@/lib/session";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const missing = missingAuthEnv();
  if (missing.length) return json({ connected: false, missing });
  const session = await requireGraph();
  if (!session.ok) return session.response;
  const { id } = await context.params;
  try {
    await sendDraft(session.accessToken, id);
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof UpstreamError ? error.message : "Could not send the draft.";
    return json({ error: message }, error instanceof UpstreamError ? error.status : 502);
  }
}
