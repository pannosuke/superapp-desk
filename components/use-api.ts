"use client";

import { useCallback, useEffect, useState } from "react";

export async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: "Desk returned a response that was not JSON." };
  }
}

async function fetchBody<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await readJson(response)) as T & { error?: string; connected?: boolean };
  const error =
    !response.ok && body.connected !== false
      ? (body.error ?? `Request failed (${response.status})`)
      : null;
  return { body, error };
}

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!url) return;
    const target = url;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchBody<T>(target);
      setData(result.body);
      setError(result.error);
    } catch {
      setError("Desk could not reach its own API.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (!url) return;
    const target = url;
    let cancelled = false;
    async function run() {
      try {
        const result = await fetchBody<T>(target);
        if (cancelled) return;
        setData(result.body);
        setError(result.error);
      } catch {
        if (cancelled) return;
        setError("Desk could not reach its own API.");
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, error, loading, reload, setData };
}
