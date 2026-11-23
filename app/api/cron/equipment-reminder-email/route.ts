import { NextRequest, NextResponse } from "next/server";
import { deliverNotificationEmails } from "../../../../lib/notifications/email-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Equipment is the first module enrolled in the shared notification email transport. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail || !siteUrl) {
    return NextResponse.json({ error: "Notification email configuration incomplete" }, { status: 503 });
  }

  try {
    const result = await deliverNotificationEmails(
      { supabaseUrl, serviceRoleKey, resendApiKey, fromEmail, siteUrl },
      {
        module: "equipment",
        notificationType: "equipment_schedule_reminder",
        createdBy: "equipment_scheduler",
      },
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Notification email processing failed" }, { status: 500 });
  }
}
