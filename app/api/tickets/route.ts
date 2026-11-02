import { connection } from "next/server";
import { isAuthConfigured, ninjaMissing } from "@/lib/env";
import { UpstreamError } from "@/lib/http";
import { listAssignedTickets } from "@/lib/ninjaone";
import { json, requireSession } from "@/lib/session";

export async function GET() {
  await connection();
  const missing = ninjaMissing();
  if (missing.length) return json({ connected: false, missing });
  if (!isAuthConfigured()) {
    return json({
      connected: false,
      missing: ["AUTH_SECRET", "ALLOWED_EMAIL"],
    });
  }
  const session = await requireSession();
  if (!session.ok) return session.response;
  try {
    const tickets = await listAssignedTickets();
    return json({ connected: true, tickets, readOnly: true });
  } catch (error) {
    const message = error instanceof UpstreamError ? error.message : "Could not load NinjaOne.";
    return json({ connected: true, error: message, tickets: [], readOnly: true }, 502);
  }
}
