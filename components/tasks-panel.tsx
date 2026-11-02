"use client";

import { useState, type FormEvent } from "react";
import { NotConnected, Panel, PanelMessage } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readJson, useApi } from "@/components/use-api";
import type { TaskItem } from "@/lib/types";

type TaskResponse = {
  connected?: boolean;
  missing?: string[];
  error?: string;
  tasks?: TaskItem[];
};

export function TasksPanel({ compact = false }: { compact?: boolean }) {
  const tasks = useApi<TaskResponse>("/api/tasks");
  const [content, setContent] = useState("");
  const [minutes, setMinutes] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const visible = compact ? (tasks.data?.tasks ?? []).slice(0, 8) : (tasks.data?.tasks ?? []);

  async function addTask(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        minutes: minutes ? Number(minutes) : undefined,
      }),
    });
    const body = await readJson(response);
    setPending(false);
    if (!response.ok || body.connected === false) {
      setMessage(
        typeof body.error === "string"
          ? body.error
          : `Not connected, set ${(body.missing as string[] | undefined)?.join(", ")}`,
      );
      return;
    }
    setContent("");
    setMinutes("");
    await tasks.reload();
  }

  async function complete(id: string) {
    setMessage(null);
    const response = await fetch(`/api/tasks/${id}/close`, { method: "POST" });
    const body = await readJson(response);
    if (!response.ok) {
      setMessage(typeof body.error === "string" ? body.error : "Could not complete that task.");
      return;
    }
    await tasks.reload();
  }

  return (
    <Panel title="Tasks" href={compact ? "/tasks" : undefined} meta="Due or overdue">
      {tasks.loading ? <PanelMessage>Loading Todoist…</PanelMessage> : null}
      {tasks.data?.connected === false ? <NotConnected missing={tasks.data.missing ?? []} /> : null}
      {tasks.error ? <PanelMessage>{tasks.error}</PanelMessage> : null}
      {tasks.data?.error ? <PanelMessage>{tasks.data.error}</PanelMessage> : null}
      {tasks.data?.connected && visible.length === 0 && !tasks.data.error ? (
        <PanelMessage>No tasks due today or overdue.</PanelMessage>
      ) : null}
      <ul className="space-y-2">
        {visible.map((task) => (
          <li key={task.id} className="flex items-start gap-3">
            <input
              type="checkbox"
              aria-label={`Complete ${task.content}`}
              className="mt-1"
              onChange={() => void complete(task.id)}
            />
            <div className="min-w-0">
              <p className="text-sm">
                {task.code ? (
                  <span className="mr-2 font-mono text-xs text-muted-foreground">{task.code}</span>
                ) : null}
                {task.title}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className={task.priorityLabel === "p1" ? "text-primary" : ""}>{task.priorityLabel}</span>
                {task.duration ? ` · ${task.duration}` : ""}
                {task.overdue ? " · overdue" : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={(event) => void addTask(event)} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Add a task for today"
          aria-label="New task"
        />
        <Input
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
          placeholder="Min"
          aria-label="Estimated minutes"
          inputMode="numeric"
          className="sm:w-20"
        />
        <Button type="submit" disabled={pending || !content.trim()}>
          Add
        </Button>
      </form>
      {message ? <p className="mt-2 text-xs text-destructive">{message}</p> : null}
    </Panel>
  );
}
