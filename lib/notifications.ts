import { supabase } from "./supabaseClient";

export type NotificationSeverity = "info" | "medium" | "high" | "critical";
export type NotificationFrequency = "immediate" | "daily" | "weekly" | "off";

export type NotificationCategory =
  | "assignment"
  | "approval"
  | "workflow"
  | "reminder"
  | "escalation"
  | "sla"
  | "training"
  | "system";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type CreateNotificationInput = {
  userEmail?: string | null;
  assignedRole?: string | null;
  title: string;
  message?: string;
  notificationType: string;
  severity?: NotificationSeverity;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  relatedRecordId?: string | null;
  relatedModule?: string;
  relatedUrl?: string;
  createdBy?: string | null;
  deduplicationKey?: string | null;
};

export type CreateRoleNotificationsInput = {
  role?: string;
  title?: string;
  message?: string;
  notificationType?: string;
  severity?: NotificationSeverity;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  relatedRecordId?: string | null;
  relatedModule?: string;
  relatedUrl?: string;
  createdBy?: string | null;
  deduplicationKey?: string | null;
};

export type CreateNotificationResult =
  | {
      success: true;
      frequency: NotificationFrequency;
      deliveryStatus: "in_app" | "pending_digest";
    }
  | {
      skipped: true;
      reason: string;
    }
  | {
      error: unknown;
    };

type NotificationPreference = {
  enabled: boolean;
  frequency: NotificationFrequency;
};

const VALID_FREQUENCIES = new Set<NotificationFrequency>([
  "immediate",
  "daily",
  "weekly",
  "off",
]);

const TYPE_ALIASES: Record<string, string> = {
  task_assigned: "task_assigned",
  task_overdue: "task_overdue",
  capa_task_assigned: "capa_task_assigned",
  capa_task_overdue: "capa_task_overdue",
};

const MODULE_ALIASES: Record<string, string> = {
  capa: "capa",
  capas: "capa",
  ncmr: "ncmr",
  ncmrs: "ncmr",
  scar: "scar",
  scars: "scar",
  change_control: "change_control",
  "change-control": "change_control",
  document: "documents",
  documents: "documents",
  controlled_documents: "documents",
  training: "training",
  complaint: "complaints",
  complaints: "complaints",
  audit: "audits",
  audits: "audits",
  supplier: "suppliers",
  suppliers: "suppliers",
  equipment: "equipment",
  general: "general",
};

function normalizeText(value?: string | null) {
  return String(value || "").trim();
}

function normalizeKeyPart(value?: string | null) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeEmail(value?: string | null) {
  const text = normalizeText(value).toLowerCase();

  if (!text || !text.includes("@")) {
    return null;
  }

  return text;
}

export function normalizeNotificationType(type?: string | null) {
  const normalized = normalizeKeyPart(type) || "general_notification";
  return TYPE_ALIASES[normalized] || normalized;
}

export function normalizeRelatedModule(module?: string | null) {
  const normalized = normalizeKeyPart(module) || "general";
  return MODULE_ALIASES[normalized] || normalized;
}

export function inferNotificationCategory(
  notificationType?: string | null
): NotificationCategory {
  const type = normalizeNotificationType(notificationType);

  if (type.includes("assign")) return "assignment";
  if (type.includes("approval") || type.includes("review")) return "approval";
  if (type.includes("overdue") || type.includes("sla")) return "sla";
  if (type.includes("reminder") || type.includes("due")) return "reminder";
  if (type.includes("escalat")) return "escalation";
  if (type.includes("training")) return "training";
  if (type.includes("system")) return "system";

  return "workflow";
}

export function inferNotificationPriority(
  severity: NotificationSeverity = "info",
  category?: NotificationCategory
): NotificationPriority {
  if (severity === "critical") return "urgent";
  if (severity === "high") return "high";
  if (category === "escalation" || category === "sla") return "high";
  if (severity === "medium") return "normal";
  return "normal";
}

function buildDeduplicationKey(input: CreateNotificationInput) {
  if (normalizeText(input.deduplicationKey)) {
    return normalizeText(input.deduplicationKey);
  }

  const userEmail = normalizeEmail(input.userEmail);
  const notificationType = normalizeNotificationType(input.notificationType);
  const relatedModule = normalizeRelatedModule(input.relatedModule);
  const relatedRecordId = normalizeKeyPart(input.relatedRecordId);

  if (!userEmail || !relatedRecordId) {
    return null;
  }

  return [
    relatedModule,
    relatedRecordId,
    notificationType,
    userEmail,
  ].join(":");
}

async function queryPreference(
  userEmail: string,
  module: string,
  type: string
) {
  return supabase
    .from("notification_preferences")
    .select("frequency,is_enabled")
    .eq("user_email", userEmail)
    .eq("module", module)
    .eq("notification_type", type)
    .maybeSingle();
}

async function getNotificationPreference(
  userEmail: string,
  module: string,
  type: string
): Promise<NotificationPreference> {
  const normalizedModule = normalizeRelatedModule(module);
  const normalizedType = normalizeNotificationType(type);

  const exact = await queryPreference(
    userEmail,
    normalizedModule,
    normalizedType
  );

  if (!exact.error && exact.data) {
    return resolvePreference(exact.data);
  }

  /*
   * Backward-compatible fallback:
   * older preference rows may use "general" as the module.
   */
  if (normalizedModule !== "general") {
    const fallback = await queryPreference(
      userEmail,
      "general",
      normalizedType
    );

    if (!fallback.error && fallback.data) {
      return resolvePreference(fallback.data);
    }
  }

  /*
   * Missing preference rows default to immediate delivery.
   * A preference read failure does not block operational notifications.
   */
  return { enabled: true, frequency: "immediate" };
}

function resolvePreference(data: {
  frequency?: string | null;
  is_enabled?: boolean | null;
}): NotificationPreference {
  const rawFrequency = normalizeText(data.frequency).toLowerCase();
  const frequency = VALID_FREQUENCIES.has(
    rawFrequency as NotificationFrequency
  )
    ? (rawFrequency as NotificationFrequency)
    : "immediate";

  if (data.is_enabled === false || frequency === "off") {
    return { enabled: false, frequency: "off" };
  }

  return { enabled: true, frequency };
}

async function alreadyExistsToday(
  userEmail: string,
  deduplicationKey?: string | null
) {
  const key = normalizeText(deduplicationKey);

  if (!key) {
    return false;
  }

  const now = new Date();
  const startOfUtcDay = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0
    )
  ).toISOString();

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_email", userEmail)
    .eq("deduplication_key", key)
    .gte("created_at", startOfUtcDay);

  if (error) {
    /*
     * Notification creation should not fail only because the duplicate
     * check could not be completed.
     */
    return false;
  }

  return (count || 0) > 0;
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<CreateNotificationResult> {
  const userEmail = normalizeEmail(input.userEmail);
  const title = normalizeText(input.title);
  const notificationType = normalizeNotificationType(
    input.notificationType
  );
  const relatedModule = normalizeRelatedModule(input.relatedModule);
  const severity = input.severity || "info";
  const category =
    input.category || inferNotificationCategory(notificationType);
  const priority =
    input.priority || inferNotificationPriority(severity, category);

  if (!userEmail) {
    return { skipped: true, reason: "missing_user_email" };
  }

  if (!title) {
    return { skipped: true, reason: "missing_title" };
  }

  const preference = await getNotificationPreference(
    userEmail,
    relatedModule,
    notificationType
  );

  if (!preference.enabled) {
    return { skipped: true, reason: "user_preference_off" };
  }

  const deduplicationKey = buildDeduplicationKey({
    ...input,
    userEmail,
    notificationType,
    relatedModule,
  });

  if (await alreadyExistsToday(userEmail, deduplicationKey)) {
    return { skipped: true, reason: "duplicate_today" };
  }

  const deliveryStatus =
    preference.frequency === "immediate"
      ? "in_app"
      : "pending_digest";

  /*
   * Only columns already used by the existing QualiSphere notification
   * table are inserted here. Category and priority remain available to
   * callers and can be persisted later after the database schema is
   * expanded, without breaking current deployments.
   */
  const { error } = await supabase.from("notifications").insert({
    user_email: userEmail,
    assigned_role: normalizeText(input.assignedRole) || null,
    title,
    message: normalizeText(input.message) || null,
    notification_type: notificationType,
    severity,
    related_record_id: normalizeText(input.relatedRecordId) || null,
    related_module: relatedModule,
    related_url: normalizeText(input.relatedUrl) || null,
    created_by: normalizeEmail(input.createdBy) || normalizeText(input.createdBy) || null,
    delivery_frequency: preference.frequency,
    delivery_status: deliveryStatus,
    deduplication_key: deduplicationKey,
  });

  if (error) {
    return { error };
  }

  void priority;

  return {
    success: true,
    frequency: preference.frequency,
    deliveryStatus,
  };
}

export async function createNotifications(
  inputs: CreateNotificationInput[]
) {
  const results = await Promise.all(
    inputs.map((input) => createNotification(input))
  );

  return {
    successCount: results.filter(
      (result) => "success" in result && result.success
    ).length,
    skippedCount: results.filter(
      (result) => "skipped" in result && result.skipped
    ).length,
    errorCount: results.filter((result) => "error" in result).length,
    results,
  };
}

/*
 * Backward-compatible role notification support.
 *
 * Existing callers may continue passing the old shape. The service resolves
 * active users from user_roles and applies each user's own notification
 * preferences before inserting a notification.
 */
export async function createRoleNotifications(
  input: CreateRoleNotificationsInput = {}
) {
  const role = normalizeText(input.role).toLowerCase();
  const title = normalizeText(input.title);
  const notificationType = normalizeNotificationType(
    input.notificationType || "role_notification"
  );

  if (!role) {
    return { skipped: true, reason: "missing_role" };
  }

  if (!title) {
    return { skipped: true, reason: "missing_title" };
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("user_email")
    .eq("role", role);

  if (error) {
    return { error };
  }

  const recipients = Array.from(
    new Set(
      (data || [])
        .map((row: { user_email?: string | null }) =>
          normalizeEmail(row.user_email)
        )
        .filter((value): value is string => Boolean(value))
    )
  );

  if (recipients.length === 0) {
    return { skipped: true, reason: "no_role_recipients" };
  }

  const results = await Promise.all(
    recipients.map((userEmail) =>
      createNotification({
        userEmail,
        assignedRole: role,
        title,
        message: input.message,
        notificationType,
        severity: input.severity,
        category: input.category,
        priority: input.priority,
        relatedRecordId: input.relatedRecordId,
        relatedModule: input.relatedModule,
        relatedUrl: input.relatedUrl,
        createdBy: input.createdBy,
        deduplicationKey: input.deduplicationKey
          ? `${input.deduplicationKey}:${userEmail}`
          : null,
      })
    )
  );

  return {
    success: true,
    role,
    recipientCount: recipients.length,
    successCount: results.filter(
      (result) => "success" in result && result.success
    ).length,
    skippedCount: results.filter(
      (result) => "skipped" in result && result.skipped
    ).length,
    errorCount: results.filter((result) => "error" in result).length,
    results,
  };
}

export function buildTaskNotification(input: {
  userEmail: string;
  recordNumber: string;
  taskName: string;
  relatedRecordId: string;
  relatedModule: string;
  relatedUrl: string;
  createdBy?: string | null;
  severity?: NotificationSeverity;
  dueDate?: string | null;
}): CreateNotificationInput {
  const dueText = normalizeText(input.dueDate)
    ? ` Due date: ${normalizeText(input.dueDate)}.`
    : "";

  return {
    userEmail: input.userEmail,
    title: `${input.recordNumber}: ${input.taskName}`,
    message: `A task has been assigned to you.${dueText}`,
    notificationType: `${normalizeRelatedModule(
      input.relatedModule
    )}_task_assigned`,
    severity: input.severity || "info",
    category: "assignment",
    priority:
      input.severity === "critical"
        ? "urgent"
        : input.severity === "high"
          ? "high"
          : "normal",
    relatedRecordId: input.relatedRecordId,
    relatedModule: input.relatedModule,
    relatedUrl: input.relatedUrl,
    createdBy: input.createdBy,
    deduplicationKey: [
      normalizeRelatedModule(input.relatedModule),
      normalizeKeyPart(input.relatedRecordId),
      "task_assigned",
      normalizeKeyPart(input.taskName),
      normalizeEmail(input.userEmail),
    ]
      .filter(Boolean)
      .join(":"),
  };
}

export function buildOverdueNotification(input: {
  userEmail: string;
  recordNumber: string;
  taskName: string;
  relatedRecordId: string;
  relatedModule: string;
  relatedUrl: string;
  createdBy?: string | null;
  daysOverdue?: number | null;
}): CreateNotificationInput {
  const daysOverdue =
    typeof input.daysOverdue === "number" && input.daysOverdue > 0
      ? input.daysOverdue
      : null;

  return {
    userEmail: input.userEmail,
    title: `${input.recordNumber}: overdue task`,
    message: `${input.taskName} is overdue${
      daysOverdue
        ? ` by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`
        : ""
    }.`,
    notificationType: `${normalizeRelatedModule(
      input.relatedModule
    )}_task_overdue`,
    severity: daysOverdue && daysOverdue >= 7 ? "critical" : "high",
    category: "sla",
    priority: daysOverdue && daysOverdue >= 7 ? "urgent" : "high",
    relatedRecordId: input.relatedRecordId,
    relatedModule: input.relatedModule,
    relatedUrl: input.relatedUrl,
    createdBy: input.createdBy,
    deduplicationKey: [
      normalizeRelatedModule(input.relatedModule),
      normalizeKeyPart(input.relatedRecordId),
      "task_overdue",
      normalizeKeyPart(input.taskName),
      normalizeEmail(input.userEmail),
    ]
      .filter(Boolean)
      .join(":"),
  };
}
