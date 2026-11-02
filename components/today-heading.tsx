"use client";

import { useSyncExternalStore } from "react";
import { PageHeader } from "@/components/panel";
import { formatDay } from "@/lib/format";

function subscribe() {
  return () => {};
}

export function TodayHeading() {
  const eyebrow = useSyncExternalStore(subscribe, () => formatDay(), () => "");
  return (
    <PageHeader
      eyebrow={eyebrow}
      title="Today"
      lede="Decisions first. Drafts and the calendar next, then the queue. The brief waits at the bottom until the panels have reported in."
    />
  );
}
