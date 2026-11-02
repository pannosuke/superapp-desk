import { AgendaPanel } from "@/components/agenda-panel";
import { BriefPanel } from "@/components/brief-panel";
import { DecisionsPanel } from "@/components/decisions-panel";
import { DraftsPanel } from "@/components/drafts-panel";
import { TasksPanel } from "@/components/tasks-panel";
import { TicketsPanel } from "@/components/tickets-panel";
import { TodayHeading } from "@/components/today-heading";

export default function TodayPage() {
  return (
    <div className="space-y-6">
      <TodayHeading />
      <DecisionsPanel />
      <div className="grid gap-4 lg:grid-cols-2">
        <DraftsPanel compact />
        <AgendaPanel />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TasksPanel compact />
        <TicketsPanel compact />
      </div>
      <BriefPanel />
    </div>
  );
}
