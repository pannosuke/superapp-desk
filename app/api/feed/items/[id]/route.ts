import { feedPatchSchema } from "@/lib/feed";
import { json, requireSession } from "@/lib/session";
import { updateFeed } from "@/lib/storage";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session.ok) return session.response;
  const { id } = await context.params;
  const parsed = feedPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Nothing to update." }, 400);
  const patch: { done?: boolean; handledNote?: string } = {};
  if (parsed.data.done !== undefined) patch.done = parsed.data.done;
  if (parsed.data.handledNote !== undefined) patch.handledNote = parsed.data.handledNote.trim();
  const item = await updateFeed(id, patch);
  if (!item) return json({ error: "Feed item not found." }, 404);
  return json({ item });
}
