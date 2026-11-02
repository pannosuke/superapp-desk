import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateText, type LanguageModel } from "ai";
import { aiMissing, aiProvider } from "@/lib/env";

const DEFAULT_MODELS = {
  google: "gemini-4-argon",
  openai: "gpt-6-astra",
  anthropic: "claude-sonnet-5-5",
} as const;

export function resolveLanguageModel() {
  const missing = aiMissing();
  if (missing.length) return { missing };
  const provider = aiProvider();
  const modelId = process.env.AI_MODEL?.trim() || DEFAULT_MODELS[provider];
  const model: LanguageModel =
    provider === "openai"
      ? openai(modelId)
      : provider === "anthropic"
        ? anthropic(modelId)
        : google(modelId);
  return { model, google: provider === "google" };
}

const SYSTEM = `You are Desk, writing for Eric Allerton at PCG. He is an MSP and CMMC consultant.
You only receive metadata: titles, subjects, times, statuses, priorities. You do not have email bodies, draft bodies, or ticket comments.
Never claim you sent mail, edited a draft, changed a NinjaOne ticket, approved a change, or touched a client tenant.
Decision items are waiting on Eric. You cannot approve them. Say what is waiting, in plain sentences.
If a source is not connected, say so in one clause. Keep the brief under 180 words. No preamble.`;

export async function writeBrief(snapshot: unknown, question?: string) {
  const resolved = resolveLanguageModel();
  if ("missing" in resolved && resolved.missing) {
    return { connected: false as const, missing: resolved.missing };
  }
  const prompt = question
    ? `Question: ${question}\n\nSnapshot:\n${JSON.stringify(snapshot)}`
    : `Write Eric's daily brief from this snapshot.\n\n${JSON.stringify(snapshot)}`;

  const run = (withThinking: boolean) =>
    generateText({
      model: resolved.model,
      system: SYSTEM,
      prompt,
      maxOutputTokens: 700,
      providerOptions:
        withThinking && "google" in resolved
          ? {
              google: {
                thinkingConfig: { thinkingLevel: "low", includeThoughts: false },
              },
            }
          : undefined,
    });

  try {
    const result = await run(true);
    return { connected: true as const, text: result.text.trim() };
  } catch {
    const result = await run(false);
    return { connected: true as const, text: result.text.trim() };
  }
}
