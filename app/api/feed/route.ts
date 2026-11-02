import { feedInboundMissing, isAuthConfigured } from "@/lib/env";
import { toFeedItem, inboundFeedSchema } from "@/lib/feed";
import { validIdempotencyKey, verifyWebhookSignature } from "@/lib/hmac";
import { json, requireSession } from "@/lib/session";
import { findFeedByIdempotency, insertFeed, listFeed } from "@/lib/storage";

export async function GET() {
  const missing = feedInboundMissing();
  if (missing.length) return json({ connected: false, missing });
  if (isAuthConfigured()) {
    const session = await requireSession();
    if (!session.ok) return session.response;
  }
  const items = await listFeed();
  return json({ connected: true, items });
}

export async function POST(request: Request) {
  const missing = feedInboundMissing();
  if (missing.length) return json({ connected: false, missing }, 503);

  const rawBody = await request.text();
  if (rawBody.length > 100_000) {
    return json({ error: "Payload is too large." }, 413);
  }
  const verified = verifyWebhookSignature({
    secret: process.env.FEED_WEBHOOK_SECRET!.trim(),
    timestampHeader: request.headers.get("x-timestamp"),
    signatureHeader: request.headers.get("x-signature"),
    rawBody,
  });
  if (!verified.ok) return json({ error: verified.reason }, verified.status);

  const idempotencyKey = validIdempotencyKey(request.headers.get("x-idempotency-key"));
  if (!idempotencyKey) {
    return json(
      { error: "x-idempotency-key must be 8–200 characters of letters, numbers, . _ : -" },
      400,
    );
  }

  const existing = await findFeedByIdempotency(idempotencyKey);
  if (existing) return json({ deduped: true, item: existing });

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }
  const parsed = inboundFeedSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return json({ error: "Feed item is missing a title, source, or known type." }, 400);
  }

  const item = await insertFeed(toFeedItem(parsed.data, idempotencyKey));
  return json({ deduped: false, item }, 201);
}
