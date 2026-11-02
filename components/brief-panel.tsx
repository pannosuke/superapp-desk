"use client";

import { useCallback, useEffect, useState } from "react";
import { clientHints } from "@/components/client-store";
import { useLocalDayWindow } from "@/components/day-window";
import { NotConnected, Panel, PanelMessage } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { readJson } from "@/components/use-api";

export function BriefPanel() {
  const day = useLocalDayWindow();
  const [text, setText] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const pull = useCallback(async () => {
    if (!day) return;
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "brief",
        start: day.start,
        end: day.end,
        clients: JSON.stringify(clientHints()),
      }),
    });
    const body = await readJson(response);
    setLoading(false);
    if (body.connected === false) {
      setMissing((body.missing as string[] | undefined) ?? ["GOOGLE_GENERATIVE_AI_API_KEY"]);
      setText(null);
      return;
    }
    setMissing(null);
    if (!response.ok || typeof body.text !== "string") {
      setError(typeof body.error === "string" ? body.error : "The brief did not come back.");
      setText(null);
      return;
    }
    setError(null);
    setText(body.text);
  }, [day]);

  useEffect(() => {
    if (!day) return;
    let cancelled = false;
    async function run() {
      try {
        await pull();
      } catch {
        if (!cancelled) {
          setLoading(false);
          setError("Desk could not reach its own API.");
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [day, pull]);

  function refresh() {
    setLoading(true);
    setError(null);
    void pull();
  }

  return (
    <Panel
      title="Daily brief"
      meta={
        <Button size="xs" variant="ghost" onClick={refresh} disabled={loading}>
          Refresh
        </Button>
      }
    >
      {loading ? <PanelMessage>Writing the brief…</PanelMessage> : null}
      {missing ? <NotConnected missing={missing} /> : null}
      {error ? <PanelMessage>{error}</PanelMessage> : null}
      {text ? <p className="text-sm leading-6 whitespace-pre-wrap">{text}</p> : null}
      <p className="mt-3 text-xs text-muted-foreground">
        Subjects, titles, and statuses only. Mail bodies and draft bodies are not sent to the model and are not stored.
      </p>
    </Panel>
  );
}
