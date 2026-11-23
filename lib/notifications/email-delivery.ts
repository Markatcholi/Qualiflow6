import { createClient } from "@supabase/supabase-js";

export type NotificationEmail = {
  id: string;
  user_email: string | null;
  title: string | null;
  message: string | null;
  related_url: string | null;
};

export type NotificationDeliveryConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  resendApiKey: string;
  fromEmail: string;
  siteUrl: string;
};

/** Server-only transport. Reusable by any QualiSphere module after its queue policy is approved. */
export async function deliverNotificationEmails(
  config: NotificationDeliveryConfig,
  options: { module: string; notificationType: string; createdBy: string; limit?: number },
) {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("notifications")
    .select("id,user_email,title,message,related_url")
    .eq("related_module", options.module)
    .eq("notification_type", options.notificationType)
    .eq("created_by", options.createdBy)
    .or("delivery_status.is.null,delivery_status.eq.pending")
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(options.limit ?? 50, 1), 100));

  if (error) throw new Error("Unable to read notification email queue");

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const item of (data || []) as NotificationEmail[]) {
    if (!item.id || !item.user_email) {
      skipped++;
      continue;
    }

    // Atomic conditional claim avoids concurrent workers processing the same row.
    const { data: claimed, error: claimError } = await supabase
      .from("notifications")
      .update({ delivery_status: "processing" })
      .eq("id", item.id)
      .or("delivery_status.is.null,delivery_status.eq.pending")
      .select("id")
      .maybeSingle();
    if (claimError || !claimed) {
      skipped++;
      continue;
    }

    try {
      // Prevent an untrusted stored URL from becoming an external email link.
      const path = item.related_url?.startsWith("/") && !item.related_url.startsWith("//")
        ? item.related_url
        : "/";
      const target = new URL(path, config.siteUrl).toString();
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `qualisphere-${item.id}`,
        },
        body: JSON.stringify({
          from: config.fromEmail,
          to: [item.user_email],
          subject: item.title || "QualiSphere task notification",
          text: `${item.message || "You have a QualiSphere notification."}\n\nView notification: ${target}`,
        }),
      });
      if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
      const { error: updateError } = await supabase
        .from("notifications").update({ delivery_status: "sent" }).eq("id", item.id);
      if (updateError) throw updateError;
      sent++;
    } catch {
      await supabase.from("notifications").update({ delivery_status: "failed" }).eq("id", item.id);
      failed++;
    }
  }
  return { processed: (data || []).length, sent, failed, skipped };
}
