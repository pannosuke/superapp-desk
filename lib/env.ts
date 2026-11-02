const GUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const AUTH_ENV_VARS = [
  "AUTH_SECRET",
  "AZURE_AD_CLIENT_ID",
  "AZURE_AD_CLIENT_SECRET",
  "AZURE_AD_TENANT_ID",
  "ALLOWED_EMAIL",
] as const;

function filled(name: string) {
  return Boolean(process.env[name]?.trim());
}

export function missingAuthEnv(): string[] {
  const missing = AUTH_ENV_VARS.filter((name) => !filled(name));
  const tenant = process.env.AZURE_AD_TENANT_ID?.trim();
  if (tenant && !GUID.test(tenant) && !missing.includes("AZURE_AD_TENANT_ID")) {
    missing.push("AZURE_AD_TENANT_ID");
  }
  const email = process.env.ALLOWED_EMAIL?.trim();
  if (email && !email.includes("@") && !missing.includes("ALLOWED_EMAIL")) {
    missing.push("ALLOWED_EMAIL");
  }
  return missing;
}

export function isAuthConfigured() {
  return missingAuthEnv().length === 0;
}

export function allowedEmail() {
  return process.env.ALLOWED_EMAIL?.trim().toLowerCase() ?? "";
}

export function graphScopes() {
  return [
    "openid",
    "profile",
    "email",
    "offline_access",
    "User.Read",
    "Mail.ReadWrite",
    "Mail.Send",
    "Calendars.Read",
  ].join(" ");
}

export function todoistMissing() {
  return filled("TODOIST_API_TOKEN") ? [] : ["TODOIST_API_TOKEN"];
}

export function ninjaMissing() {
  const required = [
    "NINJAONE_BASE_URL",
    "NINJAONE_CLIENT_ID",
    "NINJAONE_CLIENT_SECRET",
  ] as const;
  return required.filter((name) => !filled(name));
}

export function notionMissing() {
  return filled("NOTION_TOKEN") ? [] : ["NOTION_TOKEN"];
}

export function feedInboundMissing() {
  return filled("FEED_WEBHOOK_SECRET") ? [] : ["FEED_WEBHOOK_SECRET"];
}

export function grokbotMissing() {
  const missing: string[] = [];
  if (!filled("GROKBOT_WEBHOOK_URL")) missing.push("GROKBOT_WEBHOOK_URL");
  if (!filled("GROKBOT_WEBHOOK_SECRET")) missing.push("GROKBOT_WEBHOOK_SECRET");
  return missing;
}

export type AiProvider = "google" | "openai" | "anthropic";

export function aiProvider(): AiProvider {
  const value = process.env.AI_PROVIDER?.trim().toLowerCase() || "google";
  if (value === "openai" || value === "anthropic" || value === "google") {
    return value;
  }
  return "google";
}

export function aiMissing() {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase() || "google";
  if (provider === "openai") {
    return filled("OPENAI_API_KEY") ? [] : ["OPENAI_API_KEY"];
  }
  if (provider === "anthropic") {
    return filled("ANTHROPIC_API_KEY") ? [] : ["ANTHROPIC_API_KEY"];
  }
  if (provider !== "google") return ["AI_PROVIDER"];
  return filled("GOOGLE_GENERATIVE_AI_API_KEY")
    ? []
    : ["GOOGLE_GENERATIVE_AI_API_KEY"];
}

export function storageMode(): "upstash" | "neon" | "memory" {
  const redisUrl =
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim();
  const redisToken =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim();
  if (redisUrl && redisToken) return "upstash";
  if (
    process.env.NEON_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim()
  ) {
    return "neon";
  }
  return "memory";
}
