"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { NotConnected, Panel, PanelMessage } from "@/components/panel";
import { readJson, useApi } from "@/components/use-api";
import type { DecisionChoice, FeedItem } from "@/lib/types";

type FeedResponse = {
  connected?: boolean;
  missing?: string[];
  items?: FeedItem[];
  error?: string;
};

const CHOICES: { id: DecisionChoice; label: string }[] = [
  { id: "approve", label: "Approve" },
  { id: "decline", label: "Decline" },
  { id: "changes", label: "Request changes" },
];

export function DecisionsPanel() {
  const feed = useApi<FeedResponse>("/api/feed");
  const grok = useApi<FeedResponse>("/api/grokbot");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [choice, setChoice] = useState<{ item: FeedItem; choice: DecisionChoice } | null>(null);
  const [handled, setHandled] = useState<FeedItem | null>(null);

  const items = (feed.data?.items ?? []).filter((item) => item.needsDecision && !item.done);

  async function sendChoice() {
    if (!choice) return;
    setPending(true);
    setActionError(null);
    const response = await fetch("/api/grokbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "decision",
        itemId: choice.item.id,
        choice: choice.choice,
        note,
      }),
    });
    const body = await readJson(response);
    setPending(false);
    if (!response.ok || body.connected === false) {
      setActionError(
        typeof body.error === "string"
          ? body.error
          : body.connected === false
            ? `Not connected, set ${(body.missing as string[] | undefined)?.join(", ")}`
            : "Could not send that choice.",
      );
      return;
    }
    setChoice(null);
    setNote("");
    await feed.reload();
  }

  async function markHandled() {
    if (!handled) return;
    setPending(true);
    setActionError(null);
    const response = await fetch(`/api/feed/items/${handled.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true, handledNote: note }),
    });
    const body = await readJson(response);
    setPending(false);
    if (!response.ok) {
      setActionError(typeof body.error === "string" ? body.error : "Could not mark that handled.");
      return;
    }
    setHandled(null);
    setNote("");
    await feed.reload();
  }

  return (
    <Panel title="Decisions waiting on Eric">
      {feed.loading ? <PanelMessage>Loading decisions…</PanelMessage> : null}
      {feed.data?.connected === false ? <NotConnected missing={feed.data.missing ?? ["FEED_WEBHOOK_SECRET"]} /> : null}
      {feed.error ? <PanelMessage>{feed.error}</PanelMessage> : null}
      {feed.data?.connected && items.length === 0 ? (
        <PanelMessage>Nothing is waiting on you.</PanelMessage>
      ) : null}
      {actionError ? <p className="mb-3 text-sm text-destructive">{actionError}</p> : null}
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-border bg-background/40 p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">{item.priority}</span>
              <span>{item.type.replaceAll("_", " ")}</span>
              <span>{item.source}</span>
            </div>
            <p className="mt-2 text-sm font-medium">{item.title}</p>
            {item.body ? <p className="mt-1 text-sm text-muted-foreground">{item.body}</p> : null}
            {item.link ? (
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs underline">
                Open source
              </a>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {CHOICES.map((option) => (
                <Button
                  key={option.id}
                  size="sm"
                  variant={option.id === "decline" ? "outline" : "secondary"}
                  onClick={() => {
                    setActionError(null);
                    setNote("");
                    setChoice({ item, choice: option.id });
                  }}
                >
                  {option.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setActionError(null);
                  setNote("");
                  setHandled(item);
                }}
              >
                Mark handled
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Choices go only to Grok Bot, from your signed-in session. They do not approve anything in NinjaOne, Microsoft, or a client tenant.
      </p>
      {grok.data?.connected === false ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Not connected, set {(grok.data.missing ?? ["GROKBOT_WEBHOOK_URL", "GROKBOT_WEBHOOK_SECRET"]).join(", ")}
        </p>
      ) : null}
      <ConfirmDialog
        open={Boolean(choice)}
        onOpenChange={(open) => {
          if (!open) setChoice(null);
        }}
        title={`Send “${choice?.choice ?? ""}” to Grok Bot?`}
        description="This posts your choice to the Grok Bot webhook. Desk will not call NinjaOne, Graph, or any client tenant."
        confirmLabel="Send choice"
        pending={pending}
        onConfirm={() => void sendChoice()}
      >
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional note for the bot"
          aria-label="Note for Grok Bot"
        />
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(handled)}
        onOpenChange={(open) => {
          if (!open) setHandled(null);
        }}
        title="Mark handled?"
        description="This only updates Desk. It does not call an external system."
        confirmLabel="Mark handled"
        pending={pending}
        onConfirm={() => void markHandled()}
      >
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional note, stored only in Desk"
          aria-label="Handled note"
        />
      </ConfirmDialog>
    </Panel>
  );
}
