import { supabase } from "./supabaseClient";
import { createNotification, normalizeEmail } from "./notifications";

type ScanResult = {
  tasksScanned: number;
  overdueDetected: number;
  notificationsCreated: number;
  skippedNoOwnerEmail: number;
  skippedCompleted: number;
  skippedNoDueDate: number;
  skippedPreferenceOrDuplicate: number;
  errors: string[];
};

export async function runOverdueTaskScan(createdBy?: string | null): Promise<ScanResult> {
  const today = new Date().toISOString().slice(0, 10);

  const result: ScanResult = {
    tasksScanned: 0,
    overdueDetected: 0,
    notificationsCreated: 0,
    skippedNoOwnerEmail: 0,
    skippedCompleted: 0,
    skippedNoDueDate: 0,
    skippedPreferenceOrDuplicate: 0,
    errors: [],
  };

  const { data: tasks, error } = await supabase
    .from("capa_tasks")
    .select("*")
    .order("due_date", { ascending: true });

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const rows = tasks || [];
  result.tasksScanned = rows.length;

  for (const task of rows) {
    if (task.status === "complete") {
      result.skippedCompleted += 1;
      continue;
    }

    if (!task.due_date) {
      result.skippedNoDueDate += 1;
      continue;
    }

    if (task.due_date >= today) {
      continue;
    }

    result.overdueDetected += 1;

    const ownerEmail =
      normalizeEmail(task.owner_email) ||
      normalizeEmail(task.owner);

    if (!ownerEmail) {
      result.skippedNoOwnerEmail += 1;
      continue;
    }

    const deduplicationKey = `OVERDUE_TASK_${task.id}_${today}`;

    const notificationResult = await createNotification({
      userEmail: ownerEmail,
      title: "CAPA Task Overdue",
      message: `Task "${task.task_title || "Untitled Task"}" is overdue. Due date: ${task.due_date}.`,
      notificationType: "capa_task_overdue",
      severity: "high",
      relatedRecordId: task.capa_id || null,
      relatedModule: "capa",
      relatedUrl: task.capa_id ? `/capa/${task.capa_id}` : "/capa",
      createdBy: createdBy || null,
      deduplicationKey,
    });

    if ((notificationResult as any)?.success) {
      result.notificationsCreated += 1;
    } else if ((notificationResult as any)?.error) {
      result.errors.push((notificationResult as any).error.message || "Unknown notification error");
    } else {
      result.skippedPreferenceOrDuplicate += 1;
    }
  }

  return result;
}
