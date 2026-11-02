import { PageHeader } from "@/components/panel";
import { TicketsPanel } from "@/components/tickets-panel";

export default function TicketsPage() {
  return (
    <div>
      <PageHeader
        title="Tickets"
        lede="Open NinjaOne tickets assigned to you. Change requests are highlighted with whatever approval state the ticket payload includes. Nothing on this page writes back."
      />
      <TicketsPanel />
    </div>
  );
}
