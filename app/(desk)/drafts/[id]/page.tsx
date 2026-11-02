import { Suspense } from "react";
import { DraftRoute } from "@/components/draft-route";

export default function DraftPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the draft…</p>}>
      <DraftRoute />
    </Suspense>
  );
}
