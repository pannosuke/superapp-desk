"use client";

import { useState, type FormEvent } from "react";
import { NotConnected, PageHeader, PanelMessage } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readJson, useApi } from "@/components/use-api";
import { formatStamp } from "@/lib/format";
import type { FeedItem } from "@/lib/types";

type FeedResponse = {
  connected?: boolean;
  missing?: string[];
  items?: FeedItem[];
  error?: string;
};

export function FeedBoard() {
  const feed = useApi<FeedResponse>("/api/feed");
  const grok = useApi<FeedResponse>("/api/grokbot");
  const [kind, setKind] = useState<"command" | "item">("command");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function toggle(item: FeedItem) {
    setMessage(null);
    const response = await fetch(`/api/feed/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !item.done }),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      setMessage(typeof payload.error === "string" ? payload.error : "Could not update that item.");
      return;
    }
    await feed.reload();
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/grokbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kind === "command" ? { kind, body } : { kind, title, body }),
    });
    const payload = await readJson(response);
    setPending(false);
    if (payload.connected === false) {
      setMessage(`Not connected, set ${(payload.missing as string[] | undefined)?.join(", ")}`);
      return;
    }
    if (!response.ok) {
      setMessage(typeof payload.error === "string" ? payload.error : "Grok Bot did not accept that.");
      return;
    }
    setTitle("");
    setBody("");
    setMessage("Sent to Grok Bot.");
  }

  const items = feed.data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Feed"
        lede="Items your Grok Bot agents push in. The inbound webhook is signed. Sending something back uses the outbound webhook and your signed-in session."
      />
      {feed.loading ? <PanelMessage>Loading the feed…</PanelMessage> : null}
      {feed.data?.connected === false ? <NotConnected missing={feed.data.missing ?? []} /> : null}
      {feed.error ? <PanelMessage>{feed.error}</PanelMessage> : null}
      {feed.data?.connected && items.length === 0 ? (
        <PanelMessage>No feed items yet. Agents POST to /api/feed.</PanelMessage>
      ) : null}
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={item.done}
                aria-label={`Mark “${item.title}” done`}
                onChange={() => void toggle(item)}
                className="mt-1"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{item.type.replaceAll("_", " ")}</span>
                  <span>{item.priority}</span>
                  <span>{item.source}</span>
                  <span>{formatStamp(item.createdAt)}</span>
                  {item.needsDecision ? <span>needs a decision</span> : null}
                  {item.choice ? <span>choice: {item.choice}</span> : null}
                </div>
                <p className={`mt-1 text-sm font-medium ${item.done ? "text-muted-foreground line-through" : ""}`}>
                  {item.title}
                </p>
                {item.body ? <p className="mt-1 text-sm text-muted-foreground">{item.body}</p> : null}
                {item.handledNote ? <p className="mt-1 text-xs text-muted-foreground">Note: {item.handledNote}</p> : null}
                {item.link ? (
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs underline">
                    Open
                  </a>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={(event) => void send(event)} className="mt-8 grid gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Send to Grok Bot</h2>
        {grok.data?.connected === false ? (
          <NotConnected missing={grok.data.missing ?? ["GROKBOT_WEBHOOK_URL", "GROKBOT_WEBHOOK_SECRET"]} />
        ) : null}
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={kind === "command" ? "default" : "outline"} onClick={() => setKind("command")}>
            Command
          </Button>
          <Button type="button" size="sm" variant={kind === "item" ? "default" : "outline"} onClick={() => setKind("item")}>
            Item
          </Button>
        </div>
        {kind === "item" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="grok-title">Title</Label>
            <Input id="grok-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor="grok-body">{kind === "command" ? "Command" : "Body"}</Label>
          <Textarea id="grok-body" value={body} onChange={(event) => setBody(event.target.value)} />
        </div>
        <Button type="submit" disabled={pending || (kind === "command" ? !body.trim() : !title.trim())}>
          Send from this session
        </Button>
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </form>
    </div>
  );
}
