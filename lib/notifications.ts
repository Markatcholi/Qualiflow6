import { supabase } from "./supabaseClient";

export type NotificationSeverity = "info" | "medium" | "high" | "critical";
export type NotificationFrequency = "immediate" | "daily" | "weekly" | "off";

type CreateNotificationInput = {
  userEmail?: string | null;
  assignedRole?: string | null;
  title: string;
  message?: string;
  notificationType: string;
  severity?: NotificationSeverity;
  relatedRecordId?: string | null;
  relatedModule?: string;
  relatedUrl?: string;
  createdBy?: string | null;
  deduplicationKey?: string | null;
};

type CreateRoleNotificationsInput = {
  role?: string;
  title?: string;
  message?: string;
  notificationType?: string;
  severity?: NotificationSeverity;
  relatedRecordId?: string | null;
  relatedModule?: string;
  relatedUrl?: string;
  createdBy?: string | null;
};

const ENABLED_V1_TYPES = new Set([
  "capa_task_assigned",
  "capa_task_overdue",
  "task_assigned",
  "task_overdue",
]);

function normalizeNotificationType(type: string) {
  if (type === "task_assigned") return "capa_task_assigned";
  if (type === "task_overdue") return "capa_task_overdue";
  return type;
}

export function normalizeEmail(value?: string | null) {
  const text = String(value || "").trim();
  if (!text || !text.includes("@")) return null;
  return text.toLowerCase();
}

async function getNotificationPreference(
  userEmail: string,
  module: string,
  type: string
): Promise<{ enabled: boolean; frequency: NotificationFrequency }> {
  const normalizedType = normalizeNotificationType(type);

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("frequency,is_enabled")
    .eq("user_email", userEmail)
    .eq("module", module)
    .eq("notification_type", normalizedType)
    .maybeSingle();

  if (error || !data) {
    return { enabled: true, frequency: "immediate" };
  }

  if (!data.is_enabled || data.frequency === "off") {
    return { enabled: false, frequency: "off" };
  }

  const frequency = ["immediate", "daily", "weekly"].includes(data.frequency)
    ? (data.frequency as NotificationFrequency)
    : "immediate";

  return { enabled: true, frequency };
}

async function alreadyExistsToday(deduplicationKey?: string | null) {
  if (!deduplicationKey) return false;

  const today = new Date().toISOString().slice(0, 10);

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("deduplication_key", deduplicationKey)
    .gte("created_at", `${today}T00:00:00.000Z`);

  if (error) return false;

  return (count || 0) > 0;
}

export async function createNotification(input: CreateNotificationInput) {
  const userEmail = normalizeEmail(input.userEmail);
  const relatedModule = input.relatedModule || "general";
  const notificationType = normalizeNotificationType(input.notificationType);

  if (!userEmail) return { skipped: true, reason: "missing_user_email" };

  // V1 intentionally limits notification noise to task assignment and task overdue.
  if (
    !ENABLED_V1_TYPES.has(input.notificationType) &&
    !ENABLED_V1_TYPES.has(notificationType)
  ) {
    return { skipped: true, reason: "notification_type_disabled_in_v1" };
  }

  const preference = await getNotificationPreference(
    userEmail,
    relatedModule,
    notificationType
  );

  if (!preference.enabled) {
    return { skipped: true, reason: "user_preference_off" };
  }

  if (await alreadyExistsToday(input.deduplicationKey)) {
    return { skipped: true, reason: "duplicate_today" };
  }

  const deliveryStatus =
    preference.frequency === "immediate" ? "in_app" : "pending_digest";

  const { error } = await supabase.from("notifications").insert({
    user_email: userEmail,
    assigned_role: input.assignedRole || null,
    title: input.title,
    message: input.message || null,
    notification_type: notificationType,
    severity: input.severity || "info",
    related_record_id: input.relatedRecordId || null,
    related_module: relatedModule,
    related_url: input.relatedUrl || null,
    created_by: input.createdBy || null,
    delivery_frequency: preference.frequency,
    delivery_status: deliveryStatus,
    deduplication_key: input.deduplicationKey || null,
  });

  if (error) return { error };

  return {
    success: true,
    frequency: preference.frequency,
    deliveryStatus,
  };
}

// Backward-compatible export for existing CAPA workflow imports.
// Accepts the existing argument shape so TypeScript builds, but intentionally
// does not send role-wide notifications in V1 to avoid alert fatigue.
export async function createRoleNotifications(
  _input?: CreateRoleNotificationsInput
) {
  return { skipped: true, reason: "role_notifications_disabled_in_v1" };
}
