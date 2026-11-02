"use client";

import { useState } from "react";
import { useClients } from "@/components/client-store";
import { useLocalDayWindow } from "@/components/day-window";
import { NotConnected, Panel, PanelMessage } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readJson, useApi } from "@/components/use-api";
import { formatTime } from "@/lib/format";
import type { AgendaEvent } from "@/lib/types";

type AgendaResponse = {
  connected?: boolean;
  missing?: string[];
  error?: string;
  events?: AgendaEvent[];
  notionConnected?: boolean;
  notionMissing?: string[];
};

export function AgendaPanel() {
  const day = useLocalDayWindow();
  const hints = useClients().map((client) => ({ name: client.name, cloud: client.cloud }));
  const query = day
    ? new URLSearchParams({
        start: day.start,
        end: day.end,
        clients: JSON.stringify(hints),
      }).toString()
    : null;
  const agenda = useApi<AgendaResponse>(query ? `/api/calendar?${query}` : null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [manual, setManual] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  async function findPrep(event: AgendaEvent) {
    setBusyId(event.id);
    setMessage(null);
    const response = await fetch("/api/calendar/prep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: event.id, title: event.subject }),
    });
    const body = await readJson(response);
    setBusyId(null);
    if (body.connected === false) {
      setMessage(`Not connected, set ${(body.missing as string[] | undefined)?.join(", ")}`);
      return;
    }
    if (!response.ok) {
      setMessage(typeof body.error === "string" ? body.error : "Notion search failed.");
      return;
    }
    if (!body.match) setMessage(`No Notion page matched “${event.subject}”. Paste a link instead.`);
    await agenda.reload();
  }

  async function savePrep(eventId: string) {
    setBusyId(eventId);
    setMessage(null);
    const response = await fetch("/api/calendar/prep", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, url: manual[eventId] ?? "" }),
    });
    const body = await readJson(response);
    setBusyId(null);
    if (!response.ok) {
      setMessage(typeof body.error === "string" ? body.error : "Could not save that link.");
      return;
    }
    await agenda.reload();
  }

  const events = agenda.data?.events ?? [];

  return (
    <Panel title="Agenda" meta="Today">
      {agenda.loading ? <PanelMessage>Loading the calendar…</PanelMessage> : null}
      {agenda.data?.connected === false ? <NotConnected missing={agenda.data.missing ?? []} /> : null}
      {agenda.error ? <PanelMessage>{agenda.error}</PanelMessage> : null}
      {agenda.data?.error ? <PanelMessage>{agenda.data.error}</PanelMessage> : null}
      {agenda.data?.connected && events.length === 0 && !agenda.data.error ? (
        <PanelMessage>Nothing on the calendar today.</PanelMessage>
      ) : null}
      <ul className="space-y-4">
        {events.map((event) => (
          <li key={event.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{event.subject}</p>
              <p className="text-xs text-muted-foreground">
                {formatTime(event.start)}–{formatTime(event.end)}
              </p>
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {event.location ? <span>{event.location}</span> : null}
              {event.clientMeeting ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">
                  Client{event.clientName ? ` · ${event.clientName}` : ""}
                </span>
              ) : null}
              {event.gccHigh ? <span>GCC High — link out only</span> : null}
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              {event.prepUrl ? (
                <a href={event.prepUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                  Prep page
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">No prep page yet</span>
              )}
              <Button
                size="xs"
                variant="outline"
                disabled={busyId === event.id}
                onClick={() => void findPrep(event)}
              >
                Find in Notion
              </Button>
              <Input
                value={manual[event.id] ?? ""}
                onChange={(input) => setManual((current) => ({ ...current, [event.id]: input.target.value }))}
                placeholder="https://www.notion.so/…"
                aria-label={`Prep link for ${event.subject}`}
                className="sm:max-w-xs"
              />
              <Button size="xs" variant="ghost" disabled={busyId === event.id} onClick={() => void savePrep(event.id)}>
                Save link
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {agenda.data?.notionConnected === false ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Not connected, set {(agenda.data.notionMissing ?? ["NOTION_TOKEN"]).join(", ")}. Manual prep links still save.
        </p>
      ) : null}
      {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
    </Panel>
  );
}
