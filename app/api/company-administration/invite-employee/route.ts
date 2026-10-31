import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  try {
    const token = (request.headers.get("authorization") || "").match(/^Bearer (.+)$/)?.[1];
    if (!token) return reply({ error: "Authentication required." }, 401);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !secret) return reply({ error: "Account invitation email is not configured on the server." }, 500);

    const userClient = createClient(url, anon, { ...clientOptions, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: identity, error: authError } = await userClient.auth.getUser(token);
    if (authError || !identity.user?.email) return reply({ error: "Invalid QualiSphere session." }, 401);
    let body;
    try { body = await request.json(); } catch { return reply({ error: "Invalid request." }, 400); }
    const tenantId = typeof body?.tenantId === "string" ? body.tenantId.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply({ error: "A Company Account and valid employee email are required." }, 400);
    }
    const { data: authorized, error: adminError } = await userClient.rpc("qualisphere_is_company_admin", { p_tenant_id: tenantId });
    if (adminError || authorized !== true) return reply({ error: "Company Administrator access required for this Company Account." }, 403);

    // Read through the caller's RLS before constructing a privileged Auth client.
    const [company, membership, profile] = await Promise.all([
      userClient.from("tenants").select("id,status,is_internal").eq("id", tenantId).maybeSingle(),
      userClient.from("tenant_memberships").select("user_email,membership_status").eq("tenant_id", tenantId).eq("user_email", email).maybeSingle(),
      userClient.from("tenant_user_profiles").select("user_email,account_status").eq("tenant_id", tenantId).eq("user_email", email).maybeSingle(),
    ]);
    if ([company, membership, profile].some(result => result.error)) return reply({ error: "Unable to verify employee authorization." }, 500);
    if (!company.data || company.data.status !== "active" || company.data.is_internal !== false) return reply({ error: "An active customer Company Account is required." }, 403);
    if (!membership.data || membership.data.membership_status !== "active" || !profile.data || profile.data.account_status !== "active") {
      return reply({ error: "Save and activate this employee in your Company Account before sending an invitation." }, 403);
    }

    const appUrl = process.env.QUALISPHERE_APP_URL || process.env.NEXT_PUBLIC_QUALISPHERE_APP_URL || new URL(request.url).origin;
    const redirect = new URL("/activate-account", appUrl);
    redirect.searchParams.set("tenant", tenantId);
    const adminClient = createClient(url, secret, clientOptions);
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo: redirect.toString() });
    if (!inviteError) return reply({ ok: true, mode: "invited", message: `Invitation email sent to ${email}. The employee can verify their email and create a private password.` });
    // Supabase cannot invite an existing Auth identity again. Send its own secure
    // password setup/recovery link; never create a password or alter company roles.
    if (!["email_exists", "user_already_exists"].includes(inviteError.code || "") && !/already (?:been )?registered|user already exists/i.test(inviteError.message || "")) {
      return reply({ error: inviteError.message || "Unable to send invitation." }, 400);
    }
    const mailClient = createClient(url, anon, clientOptions);
    const { error: resendError } = await mailClient.auth.resetPasswordForEmail(email, { redirectTo: redirect.toString() });
    if (resendError) return reply({ error: resendError.message || "Unable to resend account setup email." }, 400);
    return reply({ ok: true, mode: "resent", message: `Account setup email resent to ${email}. This link lets the employee set or reset their password for this environment.` });
  } catch {
    return reply({ error: "Unable to send employee invitation. Please try again." }, 500);
  }
}
