import assert from "node:assert/strict";
import test from "node:test";
import {
  signPayload,
  validIdempotencyKey,
  verifyWebhookSignature,
} from "../lib/hmac.ts";
import { assertNinjaReadOnly } from "../lib/guards.ts";
import { assertCommercialUrl, assertPublicWebhookUrl } from "../lib/http.ts";

const secret = "test-secret";
const body = JSON.stringify({ type: "status", title: "Ping", source: "bot" });

test("accepts a fresh HMAC over timestamp and body", () => {
  const timestamp = "1700000000";
  const signature = signPayload(secret, timestamp, body);
  const result = verifyWebhookSignature({
    secret,
    timestampHeader: timestamp,
    signatureHeader: `sha256=${signature}`,
    rawBody: body,
    now: 1700000000,
  });
  assert.equal(result.ok, true);
});

test("rejects a bad signature and a body that was changed", () => {
  const timestamp = "1700000000";
  const signature = signPayload(secret, timestamp, body);
  const bad = verifyWebhookSignature({
    secret: "other",
    timestampHeader: timestamp,
    signatureHeader: signature,
    rawBody: body,
    now: 1700000000,
  });
  assert.equal(bad.ok, false);
  const tampered = verifyWebhookSignature({
    secret,
    timestampHeader: timestamp,
    signatureHeader: signature,
    rawBody: `${body} `,
    now: 1700000000,
  });
  assert.equal(tampered.ok, false);
});

test("rejects timestamps older than five minutes", () => {
  const timestamp = "1700000000";
  const signature = signPayload(secret, timestamp, body);
  const result = verifyWebhookSignature({
    secret,
    timestampHeader: timestamp,
    signatureHeader: signature,
    rawBody: body,
    now: 1700000000 + 5 * 60 + 1,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /5 minutes/);
});

test("rejects timestamps too far in the future", () => {
  const timestamp = "1700000100";
  const signature = signPayload(secret, timestamp, body);
  const result = verifyWebhookSignature({
    secret,
    timestampHeader: timestamp,
    signatureHeader: signature,
    rawBody: body,
    now: 1700000000,
  });
  assert.equal(result.ok, false);
});

test("checks idempotency key shape", () => {
  assert.equal(validIdempotencyKey("abc"), null);
  assert.equal(validIdempotencyKey("agent-run:1234"), "agent-run:1234");
});

test("blocks GCC High and unknown hosts", () => {
  assert.throws(() => assertCommercialUrl("https://graph.microsoft.us/v1.0/me", "graph"));
  assert.throws(() => assertCommercialUrl("https://admin.microsoft.us", "graph"));
  assert.throws(() => assertPublicWebhookUrl("https://portal.office365.us/hook"));
  assert.equal(
    assertCommercialUrl("https://graph.microsoft.com/v1.0/me", "graph").hostname,
    "graph.microsoft.com",
  );
});

test("NinjaOne client allows reads and the board query only", () => {
  assert.doesNotThrow(() => assertNinjaReadOnly("GET", "/v2/ticketing/trigger/boards"));
  assert.doesNotThrow(() => assertNinjaReadOnly("POST", "/v2/ticketing/trigger/board/12/run"));
  assert.throws(() => assertNinjaReadOnly("POST", "/v2/ticketing/ticket/9/comment"));
  assert.throws(() => assertNinjaReadOnly("PUT", "/v2/ticketing/ticket/9"));
  assert.throws(() => assertNinjaReadOnly("DELETE", "/v2/organizations/3"));
});
