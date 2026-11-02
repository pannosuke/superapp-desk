import { assertCommercialUrl, readJson, UpstreamError } from "@/lib/http";
import type { TaskItem } from "@/lib/types";

type TodoistTask = {
  id: string;
  content: string;
  priority: number;
  due?: { date?: string; datetime?: string } | null;
  duration?: { amount?: number; unit?: "minute" | "day" } | null;
  url: string;
};

const PRIORITY_LABEL: Record<number, string> = {
  4: "p1",
  3: "p2",
  2: "p3",
  1: "p4",
};

function durationLabel(duration: TodoistTask["duration"]) {
  if (!duration?.amount || !duration.unit) return null;
  if (duration.unit === "day") return `${duration.amount}d`;
  if (duration.amount >= 60 && duration.amount % 60 === 0) {
    return `${duration.amount / 60}h`;
  }
  return `${duration.amount}m`;
}

function splitTitle(content: string) {
  const match = content.match(/^(\d{4})\s[·•]\s([\s\S]+)$/);
  if (!match) return { code: null, title: content };
  return { code: match[1], title: match[2] };
}

function isOverdue(due: TodoistTask["due"]) {
  if (due?.datetime) {
    const when = new Date(due.datetime);
    return !Number.isNaN(when.getTime()) && when.getTime() < Date.now();
  }
  if (!due?.date) return false;
  const today = new Date();
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return due.date < stamp;
}

function mapTask(task: TodoistTask): TaskItem {
  const parts = splitTitle(task.content);
  return {
    id: task.id,
    content: task.content,
    code: parts.code,
    title: parts.title,
    priority: task.priority,
    priorityLabel: PRIORITY_LABEL[task.priority] ?? "p4",
    due: task.due?.datetime || task.due?.date || null,
    overdue: isOverdue(task.due),
    duration: durationLabel(task.duration),
    url: task.url,
  };
}

async function todoist(path: string, init?: RequestInit) {
  const token = process.env.TODOIST_API_TOKEN?.trim();
  if (!token) throw new UpstreamError("TODOIST_API_TOKEN is not set.", 503);
  const url = assertCommercialUrl(`https://api.todoist.com/rest/v2${path}`, "todoist");
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
    throw new UpstreamError(`Todoist returned ${response.status}.`, response.status);
  }
  return body;
}

export async function listDueTasks() {
  const filter = encodeURIComponent("today | overdue");
  const body = (await todoist(`/tasks?filter=${filter}`)) as TodoistTask[] | null;
  return (body ?? [])
    .map(mapTask)
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title));
}

export async function closeTask(id: string) {
  if (!/^\d+$/.test(id)) throw new UpstreamError("Invalid task id.", 400);
  await todoist(`/tasks/${id}/close`, { method: "POST" });
}

export async function addTask(input: { content: string; minutes?: number }) {
  const payload: Record<string, unknown> = {
    content: input.content,
    due_string: "today",
  };
  if (input.minutes && input.minutes > 0) {
    payload.duration = { amount: input.minutes, unit: "minute" };
  }
  const created = (await todoist("/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  })) as TodoistTask;
  return mapTask(created);
}
