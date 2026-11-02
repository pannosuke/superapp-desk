const BLOCKED_HOST =
  /(^|\.)microsoft\.us$|(^|\.)office365\.us$|(^|\.)azure\.us$|(^|\.)apps\.mil$|gcc|gov/i;

const ALLOWED_HOSTS: Record<string, RegExp> = {
  graph: /^graph\.microsoft\.com$/,
  login: /^login\.microsoftonline\.com$/,
  todoist: /^api\.todoist\.com$/,
  notion: /^api\.notion\.com$/,
  ninja: /(^|\.)ninjarmm\.com$|(^|\.)ninjaone\.com$/i,
};

export class UpstreamError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function assertCommercialUrl(
  raw: string,
  kind: keyof typeof ALLOWED_HOSTS,
) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Refused a non-URL upstream.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Refused a non-HTTPS upstream.");
  }
  if (BLOCKED_HOST.test(url.hostname) || !ALLOWED_HOSTS[kind].test(url.hostname)) {
    throw new Error(
      `Refused ${url.hostname}. Desk only calls commercial endpoints and never GCC High.`,
    );
  }
  return url;
}

export function assertPublicWebhookUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("GROKBOT_WEBHOOK_URL is not a URL.");
  }
  const local =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("GROKBOT_WEBHOOK_URL must be https.");
  }
  if (BLOCKED_HOST.test(url.hostname)) {
    throw new Error(
      "GROKBOT_WEBHOOK_URL points at a government cloud host. Desk will not call it.",
    );
  }
  return url;
}

export async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 300) };
  }
}
