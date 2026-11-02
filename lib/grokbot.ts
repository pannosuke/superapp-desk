import { grokbotMissing } from "@/lib/env";
import { signPayload } from "@/lib/hmac";
import { assertPublicWebhookUrl, UpstreamError } from "@/lib/http";

export async function postGrokbot(payload: unknown) {
  const missing = grokbotMissing();
  if (missing.length) return { connected: false as const, missing };
  const url = assertPublicWebhookUrl(process.env.GROKBOT_WEBHOOK_URL!.trim());
  const secret = process.env.GROKBOT_WEBHOOK_SECRET!.trim();
  const raw = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-timestamp": timestamp,
      "x-signature": signPayload(secret, timestamp, raw),
    },
    body: raw,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new UpstreamError(`Grok Bot returned ${response.status}.`, response.status);
  }
  return { connected: true as const };
}
