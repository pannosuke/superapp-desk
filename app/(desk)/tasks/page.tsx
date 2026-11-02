import { PageHeader } from "@/components/panel";
import { TasksPanel } from "@/components/tasks-panel";

export default function TasksPage() {
  return (
    <div>
      <PageHeader
        title="Tasks"
        lede="Todoist tasks due today or already overdue. p1 sits first. A four-digit code in the title stays visible as the prefix."
      />
      <TasksPanel />
    </div>
  );
}
