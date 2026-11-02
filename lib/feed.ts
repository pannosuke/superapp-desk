import { z } from "zod";
import { FEED_TYPES, type FeedItem } from "@/lib/types";

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((value) => {
    if (!value) return undefined;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
      return url.toString();
    } catch {
      return undefined;
    }
  });

export const inboundFeedSchema = z.object({
  type: z.enum(FEED_TYPES),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(8000).optional().default(""),
  source: z.string().trim().min(1).max(120),
  link: optionalUrl,
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
  needsDecision: z.boolean().optional(),
});

export function toFeedItem(
  input: z.infer<typeof inboundFeedSchema>,
  idempotencyKey: string,
): FeedItem {
  const needsDecision =
    input.needsDecision ?? (input.type === "decision" ? true : false);
  return {
    id: crypto.randomUUID(),
    idempotencyKey,
    type: input.type,
    title: input.title,
    body: input.body.trim(),
    source: input.source,
    link: input.link,
    priority: input.priority,
    needsDecision,
    createdAt: new Date().toISOString(),
    done: false,
  };
}

export const feedPatchSchema = z.object({
  done: z.boolean().optional(),
  handledNote: z.string().max(2000).optional(),
});

export const decisionSchema = z.object({
  kind: z.literal("decision"),
  itemId: z.string().min(1).max(80),
  choice: z.enum(["approve", "decline", "changes"]),
  note: z.string().max(2000).optional(),
});

export const outboundSchema = z.discriminatedUnion("kind", [
  decisionSchema,
  z.object({
    kind: z.literal("command"),
    body: z.string().trim().min(1).max(4000),
  }),
  z.object({
    kind: z.literal("item"),
    title: z.string().trim().min(1).max(200),
    body: z.string().max(8000).optional().default(""),
  }),
]);
