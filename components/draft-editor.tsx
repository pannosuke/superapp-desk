"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { NotConnected, PanelMessage } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readJson } from "@/components/use-api";
import { formatStamp } from "@/lib/format";
import type { DraftDetail, ThreadMessage } from "@/lib/types";

type DraftResponse = {
  connected?: boolean;
  missing?: string[];
  error?: string;
  draft?: DraftDetail;
  thread?: ThreadMessage[];
};

function join(addresses: string[]) {
  return addresses.join(", ");
}

function split(value: string) {
  return value
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function DraftEditor({ id }: { id: string }) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);
  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [subject, setSubject] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [missing, setMissing] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const response = await fetch(`/api/drafts/${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = (await readJson(response)) as DraftResponse;
      if (cancelled) return;
      setLoading(false);
      if (body.connected === false) {
        setMissing(body.missing ?? []);
        return;
      }
      if (!response.ok || !body.draft) {
        setError(body.error ?? "Could not open that draft.");
        return;
      }
      setDraft(body.draft);
      setThread(body.thread ?? []);
      setSubject(body.draft.subject === "(no subject)" ? "" : body.draft.subject);
      setTo(join(body.draft.to));
      setCc(join(body.draft.cc));
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!draft || !editorRef.current || loaded.current) return;
    editorRef.current.innerHTML = draft.bodyHtml;
    loaded.current = true;
  }, [draft]);

  function payload() {
    return {
      subject: subject.trim(),
      bodyHtml: editorRef.current?.innerHTML ?? "",
      to: split(to),
      cc: split(cc),
    };
  }

  async function save() {
    setPending(true);
    setStatus(null);
    setError(null);
    const response = await fetch(`/api/drafts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    });
    const body = await readJson(response);
    setPending(false);
    if (!response.ok) {
      setError(typeof body.error === "string" ? body.error : "Could not save.");
      return false;
    }
    setStatus("Saved to Outlook. The body is not stored in Desk.");
    return true;
  }

  async function send() {
    setPending(true);
    setError(null);
    const saved = await save();
    if (!saved) {
      setPending(false);
      return;
    }
    const response = await fetch(`/api/drafts/${encodeURIComponent(id)}/send`, { method: "POST" });
    const body = await readJson(response);
    setPending(false);
    if (!response.ok) {
      setError(typeof body.error === "string" ? body.error : "Could not send.");
      return;
    }
    router.push("/drafts");
    router.refresh();
  }

  async function discard() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/drafts/${encodeURIComponent(id)}`, { method: "DELETE" });
    const body = await readJson(response);
    setPending(false);
    if (!response.ok) {
      setError(typeof body.error === "string" ? body.error : "Could not discard.");
      return;
    }
    router.push("/drafts");
    router.refresh();
  }

  function format(command: string) {
    editorRef.current?.focus();
    document.execCommand(command);
  }

  if (loading) return <PanelMessage>Opening the draft…</PanelMessage>;
  if (missing) return <NotConnected missing={missing} />;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/drafts" className="text-xs text-muted-foreground hover:text-foreground">
          Back to drafts
        </Link>
        <h1 className="mt-2 text-2xl font-medium tracking-tight">Edit draft</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {draft?.lastModifiedDateTime ? `Last change ${formatStamp(draft.lastModifiedDateTime)}. ` : ""}
          Saving patches Outlook. Sending posts the message. Neither body is kept on the server.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4">
        <div className="grid gap-1.5">
          <Label htmlFor="draft-to">To</Label>
          <Input id="draft-to" value={to} onChange={(event) => setTo(event.target.value)} placeholder="name@client.com" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="draft-cc">Cc</Label>
          <Input id="draft-cc" value={cc} onChange={(event) => setCc(event.target.value)} placeholder="Optional" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="draft-subject">Subject</Label>
          <Input id="draft-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Body</Label>
          <div className="flex gap-1">
            <Button type="button" size="xs" variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")}>
              Bold
            </Button>
            <Button type="button" size="xs" variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={() => format("italic")}>
              Italic
            </Button>
            <Button type="button" size="xs" variant="outline" onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertUnorderedList")}>
              List
            </Button>
          </div>
          <div
            ref={editorRef}
            role="textbox"
            aria-multiline="true"
            aria-label="Message body"
            contentEditable
            className="min-h-48 rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            suppressContentEditableWarning
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void save()} disabled={pending}>
            Save
          </Button>
          <Button type="button" variant="default" onClick={() => setConfirmSend(true)} disabled={pending}>
            Send
          </Button>
          <Button type="button" variant="destructive" onClick={() => setConfirmDiscard(true)} disabled={pending}>
            Discard
          </Button>
        </div>
      </div>
      <section>
        <h2 className="text-sm font-medium">Thread</h2>
        <p className="mt-1 text-xs text-muted-foreground">Earlier messages are read-only and are not saved in Desk.</p>
        {thread.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No earlier messages in this conversation.</p> : null}
        <ul className="mt-3 space-y-3">
          {thread.map((message) => (
            <li key={message.id} className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">
                {message.from} · {formatStamp(message.receivedDateTime)}
                {message.isDraft ? " · draft" : ""}
              </p>
              <p className="mt-1 text-sm font-medium">{message.subject}</p>
              <div
                className="prose-invert mt-2 text-sm leading-6 text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
              />
            </li>
          ))}
        </ul>
      </section>
      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title="Send this draft?"
        description="Desk will save your edits, then POST the message to Microsoft Graph from your mailbox. This does not store the body."
        confirmLabel="Send message"
        pending={pending}
        onConfirm={() => {
          setConfirmSend(false);
          void send();
        }}
      />
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this draft?"
        description="Outlook will delete it. Desk does not keep a copy."
        confirmLabel="Discard draft"
        destructive
        pending={pending}
        onConfirm={() => {
          setConfirmDiscard(false);
          void discard();
        }}
      />
    </div>
  );
}
