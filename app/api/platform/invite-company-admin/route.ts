import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configuredAppUrl = process.env.QUALISPHERE_APP_URL || process.env.NEXT_PUBLIC_QUALISPHERE_APP_URL;

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
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
    if (userError || !userData?.user?.email) {
      return NextResponse.json({ error: "Invalid QualiSphere session." }, { status: 401 });
    }

    const { data: isPlatformAdmin, error: adminCheckError } = await userClient.rpc(
      "is_platform_admin",
    );

    if (adminCheckError || isPlatformAdmin !== true) {
      return NextResponse.json(
        { error: "Platform Administrator access required." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const tenantId = String(body?.tenantId || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();

    if (!tenantId || !email) {
      return NextResponse.json(
        { error: "Tenant ID and Company Administrator email are required." },
        { status: 400 },
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: membership, error: membershipError } = await adminClient
      .from("tenant_memberships")
      .select("tenant_id,user_email,membership_role,membership_status")
      .eq("tenant_id", tenantId)
      .eq("user_email", email)
      .eq("membership_role", "company_admin")
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }

    if (!membership) {
      return NextResponse.json(
        { error: "The email is not registered as a Company Administrator for this tenant." },
        { status: 400 },
      );
    }

    const requestOrigin = new URL(request.url).origin;
    const appBaseUrl = normalizeBaseUrl(configuredAppUrl || requestOrigin);
    const activationUrl = new URL("/activate-account", `${appBaseUrl}/`);
    activationUrl.searchParams.set("tenant", tenantId);
    const redirectTo = activationUrl.toString();

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        qualisphere_tenant_id: tenantId,
        qualisphere_membership_role: "company_admin",
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      email,
      tenantId,
      invitedUserId: data.user?.id || null,
      activationRedirect: redirectTo,
      message:
        "Activation email sent. The email link verifies the address and opens the secure QualiSphere password-creation page.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unable to send Company Administrator activation email." },
      { status: 500 },
    );
  }
}
