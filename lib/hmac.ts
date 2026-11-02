import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_AGE_SECONDS = 5 * 60;
export const MAX_FUTURE_SECONDS = 60;

export function signPayload(secret: string, timestamp: string, rawBody: string) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

export type VerifyResult =
  | { ok: true; timestamp: string }
  | { ok: false; status: number; reason: string };

export function verifyWebhookSignature(input: {
  secret: string;
  timestampHeader: string | null;
  signatureHeader: string | null;
  rawBody: string;
  now?: number;
}): VerifyResult {
  const timestampHeader = input.timestampHeader?.trim() ?? "";
  const signatureHeader = input.signatureHeader?.trim() ?? "";
  if (!timestampHeader || !signatureHeader) {
    return { ok: false, status: 401, reason: "Missing x-timestamp or x-signature." };
  }

  const parsed = Number(timestampHeader);
  if (!Number.isFinite(parsed)) {
    return { ok: false, status: 401, reason: "x-timestamp is not a number." };
  }
  const seconds = parsed > 10_000_000_000 ? Math.floor(parsed / 1000) : Math.floor(parsed);
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (now - seconds > MAX_AGE_SECONDS) {
    return { ok: false, status: 401, reason: "Timestamp is older than 5 minutes." };
  }
  if (seconds - now > MAX_FUTURE_SECONDS) {
    return { ok: false, status: 401, reason: "Timestamp is too far in the future." };
  }

  const provided = signatureHeader.replace(/^sha256=/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) {
    return { ok: false, status: 401, reason: "x-signature must be a hex SHA-256 digest." };
  }

  const expected = signPayload(input.secret, String(seconds), input.rawBody);
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, reason: "Signature does not match." };
  }
  return { ok: true, timestamp: String(seconds) };
}

export function validIdempotencyKey(value: string | null) {
  const key = value?.trim() ?? "";
  return /^[A-Za-z0-9._:-]{8,200}$/.test(key) ? key : null;
}
