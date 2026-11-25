import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Rule = { schedule_configuration_id: string; days_before_due: number; recipient_type: string; recipient_email: string | null; notification_type: string };
const dateDiff = (due: string, today: string) => Math.round((Date.parse(due + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000);

/**
 * Equipment notification generation. Dry-run by default; enabling requires
 * EQUIPMENT_REMINDERS_ENABLED=true after configuration and security validation.
 * This endpoint never sends mail directly: the existing email cron sends queued
 * notifications after this generator runs.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Scheduler configuration incomplete" }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const enabled = process.env.EQUIPMENT_REMINDERS_ENABLED === "true";
  const today = new Date().toISOString().slice(0, 10);
  let due = 0, created = 0, skipped = 0;
  // Paginate to avoid silently skipping customer schedules beyond the first 1000.
  for (let offset = 0; ; offset += 200) {
    const { data: schedules, error } = await db.from("equipment_schedule_configurations")
      .select("id,tenant_id,equipment_id,activity_type,nominal_due_date,is_active")
      .eq("is_active", true).in("activity_type", ["calibration", "preventive_maintenance"])
      .order("id").range(offset, offset + 199);
    if (error) return NextResponse.json({ error: "Unable to read Equipment schedules" }, { status: 500 });
    if (!schedules?.length) break;
    const ids = schedules.map(s => s.id);
    const { data: rules, error: ruleError } = await db.from("equipment_schedule_notifications")
      .select("schedule_configuration_id,days_before_due,recipient_type,recipient_email,notification_type")
      .eq("is_enabled", true).in("schedule_configuration_id", ids);
    if (ruleError) return NextResponse.json({ error: "Unable to read reminder rules" }, { status: 500 });
    const scheduleById = new Map(schedules.map(s => [s.id, s]));
    for (const rule of (rules || []) as Rule[]) {
      const schedule = scheduleById.get(rule.schedule_configuration_id);
      if (!schedule?.nominal_due_date || !schedule.tenant_id || !schedule.equipment_id) continue;
      const remaining = dateDiff(schedule.nominal_due_date, today);
      if (!Number.isFinite(remaining) || remaining !== rule.days_before_due) continue;
      due++;
      // Check completion before queueing any reminder. Only a new due cycle
      // may generate a notification after a completed event.
      const eventsTable = schedule.activity_type === "calibration" ? "equipment_calibration_events" : "equipment_maintenance_events";
      const { data: completed, error: eventError } = await db.from(eventsTable)
        .select("id").eq("tenant_id", schedule.tenant_id).eq("equipment_id", schedule.equipment_id)
        .eq("status", "completed").not("performed_date", "is", null)
        .eq("nominal_due_date", schedule.nominal_due_date).limit(1);
      if (eventError) return NextResponse.json({ error: "Unable to verify Equipment completion" }, { status: 500 });
      if (completed?.length) { skipped++; continue; }
      const { data: equipment, error: equipmentError } = await db.from("equipment")
        .select("id,tenant_id,equipment_number,equipment_name,owner_email,record_status")
        .eq("id", schedule.equipment_id).eq("tenant_id", schedule.tenant_id).maybeSingle();
      if (equipmentError || !equipment || equipment.record_status !== "released") { skipped++; continue; }
      // Until role-specific coordinator lookup is validated, only configured
      // owner or explicit recipient rules are eligible for generation.
      const email = rule.recipient_type === "owner" ? equipment.owner_email : rule.recipient_type === "specific_user" ? rule.recipient_email : null;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped++; continue; }
      const { data: membership, error: membershipError } = await db.from("tenant_memberships")
        .select("tenant_id").eq("tenant_id", schedule.tenant_id).eq("membership_status", "active")
        .ilike("user_email", email).limit(1);
      if (membershipError || !membership?.length) { skipped++; continue; }
      if (!enabled) continue;
      const keyPart = [schedule.tenant_id, schedule.id, schedule.nominal_due_date, rule.days_before_due, email.toLowerCase()].join(":");
      const emailEnabled = rule.notification_type === "both" || rule.notification_type === "email";
      const { error: insertError } = await db.from("notifications").insert({
        user_email: email.toLowerCase(),
        title: `Equipment ${schedule.activity_type === "calibration" ? "calibration" : "maintenance"} reminder: ${equipment.equipment_number}`,
        message: `${equipment.equipment_name || equipment.equipment_number} ${remaining < 0 ? "was due" : "is due"} for ${schedule.activity_type === "calibration" ? "calibration" : "preventive maintenance"} on ${schedule.nominal_due_date}.`,
        related_module: "equipment", related_record_id: equipment.id, related_url: `/equipment/${equipment.id}`,
        notification_type: "equipment_schedule_reminder", created_by: "equipment_scheduler",
        deduplication_key: keyPart, delivery_status: emailEnabled ? "pending" : "not_required",
      });
      if (insertError && insertError.code !== "23505") return NextResponse.json({ error: "Unable to queue Equipment reminder" }, { status: 500 });
      if (insertError?.code === "23505") { skipped++; continue; }
      created++;
    }
    if (schedules.length < 200) break;
  }
  return NextResponse.json({ mode: enabled ? "generate" : "preview", today, dueRules: due, queuedAttempts: created, skipped, emailsSent: 0 });
}
