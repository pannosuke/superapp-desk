import { z } from "zod";
import { SEED_CLIENTS } from "@/lib/clients";
import { allowedEmail } from "@/lib/env";
import type { GraphEvent } from "@/lib/graph";

const clientSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1).max(80),
      cloud: z.enum(["commercial", "gcc-high"]),
    }),
  )
  .max(40);

export function clientsForMatching(raw: string | null) {
  const seeds = SEED_CLIENTS.map((client) => ({
    name: client.name,
    cloud: client.cloud,
  }));
  if (!raw) return seeds;
  try {
    const parsed = clientSchema.parse(JSON.parse(raw));
    return parsed.length ? parsed : seeds;
  } catch {
    return seeds;
  }
}

export function parseDayWindow(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const from = new Date(start);
  const to = new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const span = to.getTime() - from.getTime();
  if (span <= 0 || span > 48 * 60 * 60 * 1000) return null;
  return { start: from.toISOString(), end: to.toISOString() };
}

function stamp(value: string | undefined) {
  if (!value) return "";
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) return new Date(value).toISOString();
  return new Date(`${value}Z`).toISOString();
}

export function describeEvent(
  event: GraphEvent,
  clients: { name: string; cloud: "commercial" | "gcc-high" }[],
) {
  const subject = event.subject?.trim() || "(no subject)";
  const matched = clients.find((client) =>
    subject.toLowerCase().includes(client.name.toLowerCase()),
  );
  const selfDomain = allowedEmail().split("@")[1]?.toLowerCase() ?? "";
  const external = (event.attendees ?? []).some((attendee) => {
    const domain = attendee.emailAddress?.address?.split("@")[1]?.toLowerCase();
    return Boolean(domain && selfDomain && domain !== selfDomain);
  });
  return {
    id: event.id,
    subject,
    start: stamp(event.start?.dateTime),
    end: stamp(event.end?.dateTime),
    location: event.location?.displayName ?? "",
    clientMeeting: Boolean(matched) || external,
    clientName: matched?.name ?? null,
    gccHigh: matched?.cloud === "gcc-high",
    onlineMeetingUrl: event.onlineMeetingUrl ?? null,
  };
}
