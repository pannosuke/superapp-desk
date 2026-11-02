"use client";

import { useMemo, useSyncExternalStore } from "react";
import { localDayWindow } from "@/lib/format";

function subscribe() {
  return () => {};
}

export function useLocalDayWindow() {
  const raw = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(localDayWindow()),
    () => "",
  );
  return useMemo(() => {
    if (!raw) return null;
    return JSON.parse(raw) as { start: string; end: string };
  }, [raw]);
}
