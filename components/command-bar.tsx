"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clientHints } from "@/components/client-store";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { readJson } from "@/components/use-api";
import { localDayWindow } from "@/lib/format";

const PAGES = [
  { href: "/", label: "Today" },
  { href: "/drafts", label: "Drafts" },
  { href: "/tasks", label: "Tasks" },
  { href: "/tickets", label: "Tickets" },
  { href: "/clients", label: "Clients" },
  { href: "/feed", label: "Feed" },
];

export function CommandBar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [result, setResult] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  async function read(path: string, label: string, pick: (body: Record<string, unknown>) => string) {
    setBusy(true);
    setResult("");
    const response = await fetch(path, { cache: "no-store" });
    const body = await readJson(response);
    setBusy(false);
    if (body.connected === false) {
      setResult(`Not connected, set ${((body.missing as string[] | undefined) ?? []).join(", ")}`);
      return;
    }
    if (!response.ok) {
      setResult(typeof body.error === "string" ? body.error : `Could not read ${label}.`);
      return;
    }
    setResult(pick(body));
  }

  async function summarize(prompt?: string) {
    const day = localDayWindow();
    setBusy(true);
    setResult("");
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: prompt ? "ask" : "brief",
        prompt,
        start: day.start,
        end: day.end,
        clients: JSON.stringify(clientHints()),
      }),
    });
    const body = await readJson(response);
    setBusy(false);
    if (body.connected === false) {
      setResult(`Not connected, set ${((body.missing as string[] | undefined) ?? []).join(", ")}`);
      return;
    }
    setResult(typeof body.text === "string" ? body.text : typeof body.error === "string" ? body.error : "No answer.");
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Desk commands"
      description="Jump, summarize, or run a read."
      className="sm:max-w-xl"
    >
      <Command>
        <CommandInput placeholder="Jump, summarize, or ask" />
        <CommandList>
          <CommandEmpty>No matching command. Press enter on Ask to send the question.</CommandEmpty>
          <CommandGroup heading="Go">
            {PAGES.map((page) => (
              <CommandItem key={page.href} onSelect={() => go(page.href)}>
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Read">
            <CommandItem onSelect={() => void summarize()}>Summarize today</CommandItem>
            <CommandItem
              onSelect={() =>
                void read("/api/feed", "decisions", (body) => {
                  const items = (body.items as { title: string; needsDecision?: boolean; done?: boolean }[] | undefined) ?? [];
                  const waiting = items.filter((item) => item.needsDecision && !item.done);
                  return waiting.length ? waiting.map((item) => item.title).join("\n") : "Nothing is waiting on you.";
                })
              }
            >
              Read decisions
            </CommandItem>
            <CommandItem
              onSelect={() =>
                void read("/api/drafts", "drafts", (body) => {
                  const drafts = (body.drafts as { subject: string }[] | undefined) ?? [];
                  return drafts.length ? drafts.map((draft) => draft.subject).join("\n") : "No drafts.";
                })
              }
            >
              Read draft subjects
            </CommandItem>
            <CommandItem
              onSelect={() => {
                const day = localDayWindow();
                void read(
                  `/api/calendar?start=${encodeURIComponent(day.start)}&end=${encodeURIComponent(day.end)}`,
                  "agenda",
                  (body) => {
                    const events = (body.events as { subject: string }[] | undefined) ?? [];
                    return events.length ? events.map((event) => event.subject).join("\n") : "Nothing on the calendar.";
                  },
                );
              }}
            >
              Read agenda
            </CommandItem>
            <CommandItem
              onSelect={() =>
                void read("/api/tasks", "tasks", (body) => {
                  const tasks = (body.tasks as { content: string; priorityLabel: string }[] | undefined) ?? [];
                  return tasks.length
                    ? tasks.map((task) => `${task.priorityLabel} ${task.content}`).join("\n")
                    : "No tasks due.";
                })
              }
            >
              Read tasks
            </CommandItem>
            <CommandItem
              onSelect={() =>
                void read("/api/tickets", "tickets", (body) => {
                  const tickets = (body.tickets as { id: string; subject: string; approval: string | null; changeRequest: boolean }[] | undefined) ?? [];
                  return tickets.length
                    ? tickets
                        .map((ticket) => `#${ticket.id} ${ticket.subject}${ticket.changeRequest ? ` · ${ticket.approval ?? "approval unknown"}` : ""}`)
                        .join("\n")
                    : "No open tickets.";
                })
              }
            >
              Read tickets
            </CommandItem>
          </CommandGroup>
        </CommandList>
        {(busy || result) && (
          <div className="max-h-48 overflow-y-auto border-t border-border px-3 py-3 text-sm whitespace-pre-wrap">
            {busy ? "Reading…" : result}
          </div>
        )}
      </Command>
    </CommandDialog>
  );
}
