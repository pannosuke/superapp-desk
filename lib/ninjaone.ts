import { organizationName } from "@/lib/clients";
import { assertNinjaReadOnly } from "@/lib/guards";
import { assertCommercialUrl, readJson, UpstreamError } from "@/lib/http";
import type { TicketItem } from "@/lib/types";

let cachedToken: { value: string; expiresAt: number } | null = null;

function instanceBase() {
  const raw = process.env.NINJAONE_BASE_URL?.trim().replace(/\/$/, "");
  if (!raw) throw new UpstreamError("NINJAONE_BASE_URL is not set.", 503);
  return assertCommercialUrl(raw, "ninja").origin;
}

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const base = instanceBase();
  const clientId = process.env.NINJAONE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.NINJAONE_CLIENT_SECRET?.trim() ?? "";
  const scope = process.env.NINJAONE_SCOPE?.trim() || "monitoring management";
  const url = assertCommercialUrl(`${base}/ws/oauth/token`, "ninja");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await readJson(response)) as { access_token?: string; expires_in?: number } | null;
  if (!response.ok || !body?.access_token) {
    throw new UpstreamError(`NinjaOne token request failed (${response.status}).`, response.status);
  }
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
}

async function ninja(method: string, path: string, body?: unknown) {
  assertNinjaReadOnly(method, path);
  const token = await accessToken();
  const url = assertCommercialUrl(`${instanceBase()}/api${path}`, "ninja");
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new UpstreamError(`NinjaOne returned ${response.status} for ${path}.`, response.status);
  }
  return payload;
}

function cell(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const found = Object.entries(row).find(([name]) => name.toLowerCase() === key.toLowerCase());
    if (!found) continue;
    const value = found[1];
    if (value && typeof value === "object" && "value" in value) {
      return (value as { value: unknown }).value;
    }
    return value;
  }
  return undefined;
}

function text(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.displayName ?? record.name ?? record.statusName ?? "");
  }
  return "";
}

function closed(status: string) {
  return /closed|resolved|complete|cancelled|canceled/i.test(status);
}

function changeRequest(row: Record<string, unknown>, status: string, type: string, subject: string) {
  const tags = text(cell(row, ["tags"]));
  const form = text(cell(row, ["ticketForm", "form", "formName", "ticketFormName"]));
  const blob = `${type} ${tags} ${form} ${subject}`;
  return /change[\s_-]*request|\bchange request\b/i.test(blob) || /change[\s_-]*request/i.test(status);
}

function approvalValue(row: Record<string, unknown>) {
  for (const [key, value] of Object.entries(row)) {
    if (!/approv/i.test(key)) continue;
    const label = text(value);
    if (label) return label;
  }
  const attributes = cell(row, ["attributeValues", "attributes"]);
  if (Array.isArray(attributes)) {
    for (const attribute of attributes) {
      if (!attribute || typeof attribute !== "object") continue;
      const record = attribute as Record<string, unknown>;
      const name = text(record.name ?? record.attributeName);
      if (!/approv/i.test(name)) continue;
      const label = text(record.value ?? record.textValue ?? record.displayValue);
      if (label) return label;
    }
  }
  return null;
}

type Technician = { id?: number; email?: string; displayName?: string };

async function resolveAssigneeId() {
  const explicit = process.env.NINJAONE_ASSIGNEE_ID?.trim();
  if (explicit && /^\d+$/.test(explicit)) return Number(explicit);
  const email = (
    process.env.NINJAONE_ASSIGNEE_EMAIL ||
    process.env.ALLOWED_EMAIL ||
    ""
  )
    .trim()
    .toLowerCase();
  if (!email) return null;
  const params = new URLSearchParams({
    userType: "TECHNICIAN",
    pageSize: "50",
    searchCriteria: email,
  });
  const body = (await ninja(
    "GET",
    `/v2/ticketing/app-user-contact?${params.toString()}`,
  )) as Technician[] | { results?: Technician[] } | null;
  const list = Array.isArray(body) ? body : body?.results ?? [];
  const match = list.find((person) => person.email?.toLowerCase() === email);
  return match?.id ?? null;
}

async function boardId() {
  const explicit = process.env.NINJAONE_BOARD_ID?.trim();
  if (explicit && /^\d+$/.test(explicit)) return Number(explicit);
  const boards = (await ninja("GET", "/v2/ticketing/trigger/boards")) as
    | { id?: number; name?: string }[]
    | null;
  const list = boards ?? [];
  const preferred =
    list.find((board) => /my tickets|assigned to me/i.test(board.name ?? "")) ??
    list.find((board) => /^open/i.test(board.name ?? "")) ??
    list[0];
  if (!preferred?.id) {
    throw new UpstreamError(
      "NinjaOne returned no ticketing boards. Set NINJAONE_BOARD_ID.",
      502,
    );
  }
  return preferred.id;
}

export async function listAssignedTickets(): Promise<TicketItem[]> {
  const [assigneeId, id] = await Promise.all([resolveAssigneeId(), boardId()]);
  if (!assigneeId) {
    throw new UpstreamError(
      "Could not resolve Eric in NinjaOne. Set NINJAONE_ASSIGNEE_ID or NINJAONE_ASSIGNEE_EMAIL.",
      503,
    );
  }
  const body = (await ninja("POST", `/v2/ticketing/trigger/board/${id}/run`, {
    pageSize: 100,
    sortBy: [{ field: "id", direction: "DESC" }],
    filters: assigneeId
      ? [{ field: "assignedAppUserId", operator: "equals", value: String(assigneeId) }]
      : [],
  })) as { data?: Record<string, unknown>[] } | null;

  const base = instanceBase();
  return (body?.data ?? [])
    .map((row) => {
      const ticketId = text(cell(row, ["id", "ticketId"]));
      const status = text(cell(row, ["status", "statusName"]));
      const type = text(cell(row, ["type", "ticketType"]));
      const subject = text(cell(row, ["summary", "subject", "title"])) || "(no subject)";
      const orgRaw = cell(row, ["clientId", "organizationId", "client"]);
      const orgId = typeof orgRaw === "number" ? orgRaw : Number(text(orgRaw));
      const orgName = organizationName(Number.isFinite(orgId) ? orgId : null);
      const assigned = text(cell(row, ["assignedAppUserId", "assignee", "assignedUser"]));
      return {
        id: ticketId,
        subject,
        status: status || "Open",
        priority: text(cell(row, ["priority"])) || "NONE",
        type: type || "TASK",
        organization: orgName || (Number.isFinite(orgId) ? `Org ${orgId}` : "Unscoped"),
        changeRequest: changeRequest(row, status, type, subject),
        approval: approvalValue(row),
        link: ticketId ? `${base}/#/ticketing/ticket/${ticketId}` : null,
        assigned,
        deleted: text(cell(row, ["deleted"])).toLowerCase() === "true",
      };
    })
    .filter((ticket) => ticket.id && !ticket.deleted && !closed(ticket.status))
    .filter((ticket) => {
      if (!ticket.assigned) return true;
      const email = (
        process.env.NINJAONE_ASSIGNEE_EMAIL ||
        process.env.ALLOWED_EMAIL ||
        ""
      )
        .trim()
        .toLowerCase();
      return (
        ticket.assigned === String(assigneeId) ||
        (email.length > 0 && ticket.assigned.toLowerCase().includes(email))
      );
    })
    .map((ticket) => ({
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      type: ticket.type,
      organization: ticket.organization,
      changeRequest: ticket.changeRequest,
      approval: ticket.approval,
      link: ticket.link,
    }))
    .sort((a, b) => Number(b.changeRequest) - Number(a.changeRequest));
}
