"use client";

import { useSyncExternalStore } from "react";
import {
  CLIENT_STORAGE_KEY,
  SEED_CLIENTS,
  type ClientRecord,
} from "@/lib/clients";

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readRaw() {
  return window.localStorage.getItem(CLIENT_STORAGE_KEY) ?? "";
}

function parseClients(raw: string): ClientRecord[] {
  if (!raw) return SEED_CLIENTS;
  try {
    const parsed = JSON.parse(raw) as ClientRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) return SEED_CLIENTS;
    return parsed;
  } catch {
    return SEED_CLIENTS;
  }
}

export function loadClients() {
  if (typeof window === "undefined") return SEED_CLIENTS;
  return parseClients(readRaw());
}

export function saveClients(clients: ClientRecord[]) {
  window.localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(clients));
  emit();
}

export function clientHints() {
  return loadClients().map((client) => ({ name: client.name, cloud: client.cloud }));
}

export function useClients() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  return parseClients(raw);
}
