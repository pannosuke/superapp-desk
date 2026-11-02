"use client";

import Link from "next/link";
import { NotConnected, Panel, PanelMessage } from "@/components/panel";
import { useApi } from "@/components/use-api";
import { formatStamp } from "@/lib/format";
import type { DraftSummary } from "@/lib/types";

type DraftResponse = {
  connected?: boolean;
  missing?: string[];
  error?: string;
  drafts?: DraftSummary[];
};

export function DraftsPanel({ compact = false }: { compact?: boolean }) {
  const { data, error, loading } = useApi<DraftResponse>("/api/drafts");
  const drafts = compact ? (data?.drafts ?? []).slice(0, 6) : (data?.drafts ?? []);

  return (
    <Panel title="Drafts" href={compact ? "/drafts" : undefined} meta="Outlook">
      {loading ? <PanelMessage>Loading drafts…</PanelMessage> : null}
      {data?.connected === false ? <NotConnected missing={data.missing ?? []} /> : null}
      {error ? <PanelMessage>{error}</PanelMessage> : null}
      {data?.error ? <PanelMessage>{data.error}</PanelMessage> : null}
      {data?.connected && drafts.length === 0 && !data.error ? (
        <PanelMessage>No drafts in Outlook.</PanelMessage>
      ) : null}
      <ul className="divide-y divide-border">
        {drafts.map((draft) => (
          <li key={draft.id}>
            <Link href={`/drafts/${encodeURIComponent(draft.id)}`} className="block py-3 hover:text-primary">
              <p className="text-sm font-medium">{draft.subject}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                To {draft.to.join(", ") || "nobody yet"}
                {draft.cc.length ? ` · Cc ${draft.cc.join(", ")}` : ""}
                {draft.lastModifiedDateTime ? ` · ${formatStamp(draft.lastModifiedDateTime)}` : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
