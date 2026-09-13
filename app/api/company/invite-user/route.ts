import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configuredAppUrl = process.env.QUALISPHERE_APP_URL || process.env.NEXT_PUBLIC_QUALISPHERE_APP_URL;

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function isAlreadyRegisteredError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already been registered") ||
    normalized.includes("already registered") ||
    normalized.includes("user already exists") ||
    normalized.includes("already exists")
  );
}

async function findAuthUserByEmail(adminClient: any, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 200;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    const match = users.find(
      (user: any) => String(user?.email || "").trim().toLowerCase() === normalizedEmail,
    );

    if (match) return match;
    if (users.length < perPage) return null;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration is missing SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500 },
      );
    }

    const authorization = request.headers.get("authorization") || "";
    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!accessToken) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    const administratorEmail = String(userData?.user?.email || "").trim().toLowerCase();

    if (userError || !administratorEmail) {
      return NextResponse.json({ error: "Invalid QualiSphere session." }, { status: 401 });
    }

    const body = await request.json();
    const tenantId = String(body?.tenantId || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();

    if (!tenantId || !email) {
      return NextResponse.json(
        { error: "Company Account and user email are required." },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "A valid user email is required." }, { status: 400 });
    }

    const { data: isCompanyAdmin, error: adminCheckError } = await userClient.rpc(
      "qualisphere_is_company_admin",
      { p_tenant_id: tenantId },
    );

    if (adminCheckError || isCompanyAdmin !== true) {
      return NextResponse.json(
        { error: "Company Administrator access required." },
        { status: 403 },
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [{ data: tenant, error: tenantError }, { data: profile, error: profileError }, { data: membership, error: membershipError }] = await Promise.all([
      adminClient
        .from("tenants")
        .select("id,company_name,status,is_internal")
        .eq("id", tenantId)
        .maybeSingle(),
      adminClient
        .from("tenant_user_profiles")
        .select("tenant_id,user_email,account_status")
        .eq("tenant_id", tenantId)
        .eq("user_email", email)
        .maybeSingle(),
      adminClient
        .from("tenant_memberships")
        .select("tenant_id,user_email,membership_role,membership_status")
        .eq("tenant_id", tenantId)
        .eq("user_email", email)
        .maybeSingle(),
    ]);

    const lookupError = tenantError || profileError || membershipError;
    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (!tenant || tenant.status !== "active") {
      return NextResponse.json({ error: "The Company Account is not active." }, { status: 400 });
    }

    if (tenant.is_internal === true) {
      return NextResponse.json(
        { error: "Customer user activation is not used for the QualiSphere Development / Validation environment." },
        { status: 400 },
      );
    }

    if (!profile || String(profile.account_status || "").toLowerCase() !== "active") {
      return NextResponse.json(
        { error: "The user must have an Active Company Account profile before activation can be sent." },
        { status: 400 },
      );
    }

    if (!membership || String(membership.membership_status || "").toLowerCase() !== "active") {
      return NextResponse.json(
        { error: "The user must have Active Company Account membership before activation can be sent." },
        { status: 400 },
      );
    }

    const { count: roleCount, error: roleCountError } = await adminClient
      .from("tenant_user_role_assignments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("user_email", email)
      .eq("is_active", true);

    if (roleCountError) {
      return NextResponse.json({ error: roleCountError.message }, { status: 500 });
    }

    if (!roleCount) {
      return NextResponse.json(
        { error: "Assign at least one active QualiSphere access role before sending account activation." },
        { status: 400 },
      );
    }

    const requestOrigin = new URL(request.url).origin;
    const appBaseUrl = normalizeBaseUrl(configuredAppUrl || requestOrigin);
    const activationUrl = new URL("/activate-account", `${appBaseUrl}/`);
    activationUrl.searchParams.set("tenant", tenantId);
    const redirectTo = activationUrl.toString();

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        qualisphere_tenant_id: tenantId,
        qualisphere_account_authority: "company_user",
        qualisphere_company_name: tenant.company_name,
      },
    });

    if (!inviteError) {
      await userClient.rpc("qualisphere_add_audit_log", {
        p_entity_type: "tenant_user",
        p_entity_id: tenantId,
        p_action: "customer_user_activation_sent",
        p_details: `Activation email sent to ${email} for ${tenant.company_name}.`,
      });

      return NextResponse.json({
        ok: true,
        mode: "invited",
        email,
        tenantId,
        invitedUserId: inviteData.user?.id || null,
        message:
          "Activation email sent. The user can verify the email, create a private password, and then sign in to this Company Account.",
      });
    }

    if (!isAlreadyRegisteredError(inviteError.message || "")) {
      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }

    const existingUser = await findAuthUserByEmail(adminClient, email);
    const alreadyConfirmed = Boolean(existingUser?.email_confirmed_at || existingUser?.confirmed_at);

    await userClient.rpc("qualisphere_add_audit_log", {
      p_entity_type: "tenant_user",
      p_entity_id: tenantId,
      p_action: "customer_user_existing_auth_account_detected",
      p_details: `Existing QualiSphere Auth account detected for ${email} while activating access to ${tenant.company_name}.`,
    });

    return NextResponse.json({
      ok: true,
      mode: alreadyConfirmed ? "existing_account" : "existing_unconfirmed",
      email,
      tenantId,
      message: alreadyConfirmed
        ? "This email already has an active QualiSphere sign-in account. Company access is ready; the user can sign in with the existing password."
        : "This email already exists in QualiSphere Auth but has not completed email confirmation. Use the existing invitation email or the Forgot Password flow to complete account access.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unable to send customer user activation." },
      { status: 500 },
    );
  }
}
