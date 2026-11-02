import { assertCommercialUrl, readJson, UpstreamError } from "@/lib/http";
import { sanitizeMailHtml } from "@/lib/mail-html";
import type { DraftDetail, DraftSummary, ThreadMessage } from "@/lib/types";

const GRAPH = "https://graph.microsoft.com/v1.0";

type Recipient = { emailAddress?: { address?: string; name?: string } };

type GraphMessage = {
  id: string;
  subject?: string;
  toRecipients?: Recipient[];
  ccRecipients?: Recipient[];
  lastModifiedDateTime?: string;
  conversationId?: string;
  hasAttachments?: boolean;
  body?: { contentType?: string; content?: string };
  uniqueBody?: { contentType?: string; content?: string };
  from?: Recipient;
  receivedDateTime?: string;
  isDraft?: boolean;
};

function addresses(list: Recipient[] | undefined) {
  return (list ?? [])
    .map((item) => item.emailAddress?.address?.trim())
    .filter((value): value is string => Boolean(value));
}

function toSummary(message: GraphMessage): DraftSummary {
  return {
    id: message.id,
    subject: message.subject?.trim() || "(no subject)",
    to: addresses(message.toRecipients),
    cc: addresses(message.ccRecipients),
    lastModifiedDateTime: message.lastModifiedDateTime ?? "",
    conversationId: message.conversationId ?? null,
    hasAttachments: Boolean(message.hasAttachments),
  };
}

async function graph(path: string, token: string, init?: RequestInit) {
  const url = assertCommercialUrl(`${GRAPH}${path}`, "graph");
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 204) return null;
  const body = await readJson(response);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error?: { message?: string } }).error?.message ?? response.status)
        : `Microsoft Graph returned ${response.status}`;
    throw new UpstreamError(message, response.status);
  }
  return body;
}

export function assertDraftId(id: string) {
  if (!/^[A-Za-z0-9_\-=]{8,400}$/.test(id)) {
    throw new UpstreamError("That draft id is not valid.", 400);
  }
  return id;
}

export async function listDrafts(token: string): Promise<DraftSummary[]> {
  const params = new URLSearchParams({
    $top: "40",
    $orderby: "lastModifiedDateTime desc",
    $select:
      "id,subject,toRecipients,ccRecipients,lastModifiedDateTime,conversationId,hasAttachments,isDraft",
  });
  const body = (await graph(
    `/me/mailFolders/drafts/messages?${params.toString()}`,
    token,
  )) as { value?: GraphMessage[] } | null;
  return (body?.value ?? []).map(toSummary);
}

export async function getDraft(token: string, id: string): Promise<DraftDetail> {
  assertDraftId(id);
  const params = new URLSearchParams({
    $select:
      "id,subject,body,toRecipients,ccRecipients,lastModifiedDateTime,conversationId,hasAttachments,isDraft",
  });
  const message = (await graph(
    `/me/messages/${encodeURIComponent(id)}?${params.toString()}`,
    token,
  )) as GraphMessage;
  return {
    ...toSummary(message),
    bodyHtml: sanitizeMailHtml(message.body?.content ?? ""),
  };
}

export async function getThread(token: string, conversationId: string, draftId: string) {
  if (!conversationId) return [] as ThreadMessage[];
  const safe = conversationId.replaceAll("'", "''");
  const params = new URLSearchParams({
    $filter: `conversationId eq '${safe}'`,
    $select: "id,subject,from,receivedDateTime,isDraft,uniqueBody,body",
    $top: "20",
  });
  try {
    const body = (await graph(`/me/messages?${params.toString()}`, token)) as {
      value?: GraphMessage[];
    } | null;
    return (body?.value ?? [])
      .filter((message) => message.id !== draftId)
      .map((message) => ({
        id: message.id,
        from: message.from?.emailAddress?.address || message.from?.emailAddress?.name || "Unknown",
        receivedDateTime: message.receivedDateTime ?? "",
        subject: message.subject?.trim() || "(no subject)",
        bodyHtml: sanitizeMailHtml(
          message.uniqueBody?.content || message.body?.content || "",
        ),
        isDraft: Boolean(message.isDraft),
      }))
      .sort((a, b) => a.receivedDateTime.localeCompare(b.receivedDateTime));
  } catch {
    return [] as ThreadMessage[];
  }
}

function recipients(addresses: string[]) {
  return addresses.map((address) => ({ emailAddress: { address } }));
}

export async function updateDraft(
  token: string,
  id: string,
  input: { subject: string; bodyHtml: string; to: string[]; cc: string[] },
) {
  assertDraftId(id);
  await graph(`/me/messages/${encodeURIComponent(id)}`, token, {
    method: "PATCH",
    body: JSON.stringify({
      subject: input.subject,
      body: { contentType: "HTML", content: sanitizeMailHtml(input.bodyHtml) },
      toRecipients: recipients(input.to),
      ccRecipients: recipients(input.cc),
    }),
  });
}

export async function sendDraft(token: string, id: string) {
  assertDraftId(id);
  await graph(`/me/messages/${encodeURIComponent(id)}/send`, token, {
    method: "POST",
  });
}

export async function discardDraft(token: string, id: string) {
  assertDraftId(id);
  await graph(`/me/messages/${encodeURIComponent(id)}`, token, {
    method: "DELETE",
  });
}

export type GraphEvent = {
  id: string;
  subject?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  location?: { displayName?: string };
  attendees?: { emailAddress?: { address?: string; name?: string } }[];
  isOnlineMeeting?: boolean;
  onlineMeetingUrl?: string | null;
  webLink?: string;
};

export async function listCalendar(token: string, start: string, end: string) {
  const params = new URLSearchParams({
    startDateTime: start,
    endDateTime: end,
    $orderby: "start/dateTime",
    $select:
      "id,subject,start,end,location,attendees,isOnlineMeeting,onlineMeetingUrl,webLink",
    $top: "50",
  });
  const body = (await graph(`/me/calendarView?${params.toString()}`, token, {
    headers: { Prefer: 'outlook.timezone="UTC"' },
  })) as { value?: GraphEvent[] } | null;
  return body?.value ?? [];
}
