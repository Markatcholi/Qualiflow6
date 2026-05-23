import { supabase } from "./supabaseClient";

export type NotificationSeverity = "info" | "medium" | "high" | "critical";

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
};

export function normalizeEmail(value?: string | null) {
  const text = String(value || "").trim();

  if (!text) return null;
  if (!text.includes("@")) return null;

  return text.toLowerCase();
}

export async function createNotification(input: CreateNotificationInput) {
  const userEmail = normalizeEmail(input.userEmail);

  if (!userEmail) return { skipped: true };

  const { error } = await supabase.from("notifications").insert({
    user_email: userEmail,
    assigned_role: input.assignedRole || null,
    title: input.title,
    message: input.message || null,
    notification_type: input.notificationType,
    severity: input.severity || "info",
    related_record_id: input.relatedRecordId || null,
    related_module: input.relatedModule || null,
    related_url: input.relatedUrl || null,
    created_by: input.createdBy || null,
  });

  if (error) {
    console.warn("Notification create failed:", error.message);
    return { error };
  }

  return { success: true };
}

export async function createRoleNotifications({
  role,
  title,
  message,
  notificationType,
  severity = "info",
  relatedRecordId,
  relatedModule,
  relatedUrl,
  createdBy,
}: {
  role: string;
  title: string;
  message?: string;
  notificationType: string;
  severity?: NotificationSeverity;
  relatedRecordId?: string | null;
  relatedModule?: string;
  relatedUrl?: string;
  createdBy?: string | null;
}) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_email")
    .eq("role", role);

  if (error) {
    console.warn("Role notification lookup failed:", error.message);
    return { error };
  }

  const recipients = Array.from(
    new Set(
      (data || [])
        .map((row: any) => normalizeEmail(row.user_email))
        .filter(Boolean)
    )
  );

  for (const recipient of recipients) {
    await createNotification({
      userEmail: recipient,
      assignedRole: role,
      title,
      message,
      notificationType,
      severity,
      relatedRecordId,
      relatedModule,
      relatedUrl,
      createdBy,
    });
  }

  return { success: true, count: recipients.length };
}
