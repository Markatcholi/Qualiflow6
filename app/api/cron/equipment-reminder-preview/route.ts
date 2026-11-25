import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only preview of configured Equipment reminders.
 * No notifications are inserted or emails sent. Keep generation disabled until
 * deduplication, completion gates, and tenant-scoped recipients are verified.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Equipment scheduler configuration incomplete" }, { status: 503 });
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const today = new Date().toISOString().slice(0, 10);
  const { data: schedules, error } = await db
    .from("equipment_schedule_configurations")
    .select("id,tenant_id,equipment_id,activity_type,nominal_due_date,is_active")
    .eq("is_active", true)
    .in("activity_type", ["calibration", "preventive_maintenance"])
    .limit(1000);
  if (error) return NextResponse.json({ error: "Unable to read Equipment schedules" }, { status: 500 });
  const ids = (schedules || []).map(s => s.id);
  if (!ids.length) return NextResponse.json({ mode: "preview", today, schedules: 0, dueRules: 0, notificationsCreated: 0, emailsSent: 0 });
  const { data: rules, error: ruleError } = await db
    .from("equipment_schedule_notifications")
    .select("schedule_configuration_id,days_before_due,recipient_type,notification_type,is_enabled")
    .in("schedule_configuration_id", ids)
    .eq("is_enabled", true);
  if (ruleError) return NextResponse.json({ error: "Unable to read Equipment reminder rules" }, { status: 500 });
  const scheduleById = new Map((schedules || []).map(s => [s.id, s]));
  let dueRules = 0;
  for (const rule of rules || []) {
    const schedule = scheduleById.get(rule.schedule_configuration_id);
    if (!schedule?.nominal_due_date) continue;
    const due = Date.parse(`${schedule.nominal_due_date}T00:00:00Z`);
    const now = Date.parse(`${today}T00:00:00Z`);
    if (Number.isFinite(due) && Math.round((due - now) / 86400000) === rule.days_before_due) dueRules++;
  }
  return NextResponse.json({
    mode: "preview", today, schedules: schedules?.length || 0,
    configuredRules: rules?.length || 0, dueRules,
    notificationsCreated: 0, emailsSent: 0,
    note: "Preview only. No customer notifications or emails were generated.",
  });
}
