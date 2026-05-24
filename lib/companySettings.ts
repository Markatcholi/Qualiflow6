import { supabase } from "./supabaseClient";

export type CompanySettings = {
  id?: string;
  company_name: string;

  enable_notifications: boolean;
  enable_overdue_scan: boolean;
  enable_task_sla_dashboard: boolean;
  enable_escalation_dashboard: boolean;
  enable_email_notifications: boolean;

  overdue_scan_mode: "manual" | "scheduled" | "disabled";
  notification_default_frequency: "immediate" | "daily" | "weekly" | "off";

  overdue_bucket_1: number;
  overdue_bucket_2: number;
  overdue_bucket_3: number;

  allow_users_to_override_preferences: boolean;
};

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  company_name: "Default Company",

  enable_notifications: true,
  enable_overdue_scan: true,
  enable_task_sla_dashboard: true,
  enable_escalation_dashboard: true,
  enable_email_notifications: false,

  overdue_scan_mode: "manual",
  notification_default_frequency: "immediate",

  overdue_bucket_1: 7,
  overdue_bucket_2: 14,
  overdue_bucket_3: 30,

  allow_users_to_override_preferences: true,
};

export async function getCompanySettings(): Promise<CompanySettings> {
  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_COMPANY_SETTINGS;
  }

  return {
    ...DEFAULT_COMPANY_SETTINGS,
    ...data,
  };
}

export async function saveCompanySettings(settings: CompanySettings) {
  const payload = {
    company_name: settings.company_name || DEFAULT_COMPANY_SETTINGS.company_name,

    enable_notifications: settings.enable_notifications,
    enable_overdue_scan: settings.enable_overdue_scan,
    enable_task_sla_dashboard: settings.enable_task_sla_dashboard,
    enable_escalation_dashboard: settings.enable_escalation_dashboard,
    enable_email_notifications: settings.enable_email_notifications,

    overdue_scan_mode: settings.overdue_scan_mode,
    notification_default_frequency: settings.notification_default_frequency,

    overdue_bucket_1: Number(settings.overdue_bucket_1) || 7,
    overdue_bucket_2: Number(settings.overdue_bucket_2) || 14,
    overdue_bucket_3: Number(settings.overdue_bucket_3) || 30,

    allow_users_to_override_preferences: settings.allow_users_to_override_preferences,

    updated_at: new Date().toISOString(),
  };

  if (settings.id) {
    return supabase
      .from("company_settings")
      .update(payload)
      .eq("id", settings.id);
  }

  return supabase
    .from("company_settings")
    .insert(payload)
    .select()
    .single();
}
