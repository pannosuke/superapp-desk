import { DraftsPanel } from "@/components/drafts-panel";
import { PageHeader } from "@/components/panel";

export default function DraftsPage() {
  return (
    <div>
      <PageHeader
        title="Drafts"
        lede="Messages sitting in your Outlook Drafts folder, including the ones your bots created. Open one to edit, save, send, or discard it."
      />
      <DraftsPanel />
    </div>
  );
}
