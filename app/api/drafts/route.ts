import { connection } from "next/server";
import { missingAuthEnv } from "@/lib/env";
import { listDrafts } from "@/lib/graph";
import { UpstreamError } from "@/lib/http";
import { json, requireGraph } from "@/lib/session";

export async function GET() {
  await connection();
  const missing = missingAuthEnv();
  if (missing.length) return json({ connected: false, missing });
  const session = await requireGraph();
  if (!session.ok) return session.response;
  try {
    const drafts = await listDrafts(session.accessToken);
    return json({ connected: true, drafts });
  } catch (error) {
    const message = error instanceof UpstreamError ? error.message : "Could not load drafts.";
    return json({ connected: true, error: message, drafts: [] }, error instanceof UpstreamError ? error.status : 502);
  }
}
