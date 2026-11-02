"use client";

import { NotConnected, Panel, PanelMessage } from "@/components/panel";
import { useApi } from "@/components/use-api";
import type { TicketItem } from "@/lib/types";

type TicketResponse = {
  connected?: boolean;
  missing?: string[];
  error?: string;
  tickets?: TicketItem[];
};

export function TicketsPanel({ compact = false }: { compact?: boolean }) {
  const tickets = useApi<TicketResponse>("/api/tickets");
  const rows = compact ? (tickets.data?.tickets ?? []).slice(0, 6) : (tickets.data?.tickets ?? []);

  return (
    <Panel title="Tickets" href={compact ? "/tickets" : undefined} meta="Read only">
      {tickets.loading ? <PanelMessage>Loading NinjaOne…</PanelMessage> : null}
      {tickets.data?.connected === false ? <NotConnected missing={tickets.data.missing ?? []} /> : null}
      {tickets.error ? <PanelMessage>{tickets.error}</PanelMessage> : null}
      {tickets.data?.error ? <PanelMessage>{tickets.data.error}</PanelMessage> : null}
      {tickets.data?.connected && rows.length === 0 && !tickets.data.error ? (
        <PanelMessage>No open tickets assigned to you.</PanelMessage>
      ) : null}
      <ul className="space-y-3">
        {rows.map((ticket) => (
          <li
            key={ticket.id}
            className={ticket.changeRequest ? "rounded-lg border border-primary/40 bg-primary/5 p-3" : "py-1"}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>#{ticket.id}</span>
              <span>{ticket.organization}</span>
              <span>{ticket.status}</span>
              <span>{ticket.priority}</span>
              {ticket.changeRequest ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">Change request</span>
              ) : null}
            </div>
            <p className="mt-1 text-sm">{ticket.subject}</p>
            {ticket.changeRequest ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Approval: {ticket.approval ?? "not in the ticket payload"}
              </p>
            ) : null}
            {ticket.link ? (
              <a href={ticket.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs underline">
                Open in NinjaOne
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Read only. Desk never writes NinjaOne comments, status changes, or client tenants.
      </p>
    </Panel>
  );
}
