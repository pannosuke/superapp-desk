"use client";

import { useParams } from "next/navigation";
import { DraftEditor } from "@/components/draft-editor";

export function DraftRoute() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id) return null;
  return <DraftEditor id={decodeURIComponent(id)} />;
}
