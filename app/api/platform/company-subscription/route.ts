import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PLATFORM_MODULE_CATALOG } from "../../../../lib/platformModuleCatalog";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    const platformAdminEmail = String(userData?.user?.email || "").trim().toLowerCase();

    if (userError || !platformAdminEmail) {
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
    const requestedCodes = Array.isArray(body?.enabledModuleCodes)
      ? body.enabledModuleCodes.map((value: unknown) => String(value).trim())
      : [];

    if (!tenantId) {
      return NextResponse.json({ error: "Company Account ID is required." }, { status: 400 });
    }

    if (requestedCodes.length === 0) {
      return NextResponse.json(
        { error: "Select at least one subscribed QualiSphere module." },
        { status: 400 },
      );
    }

    const allowedCodes = new Set(PLATFORM_MODULE_CATALOG.map((module) => module.code));
    const invalidCodes = requestedCodes.filter((code: string) => !allowedCodes.has(code));

    if (invalidCodes.length > 0) {
      return NextResponse.json(
        { error: `Invalid subscription module: ${invalidCodes.join(", ")}.` },
        { status: 400 },
      );
    }

    const enabledCodes = new Set(requestedCodes);
    const changedAt = new Date().toISOString();
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: tenant, error: tenantError } = await adminClient
      .from("tenants")
      .select("id")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError) {
      return NextResponse.json({ error: tenantError.message }, { status: 500 });
    }

    if (!tenant) {
      return NextResponse.json({ error: "Company Account not found." }, { status: 404 });
    }

    const rows = PLATFORM_MODULE_CATALOG.map((module) => ({
      tenant_id: tenantId,
      module_code: module.code,
      is_enabled: enabledCodes.has(module.code),
      enabled_by: platformAdminEmail,
      enabled_at: changedAt,
    }));

    const { error: saveError } = await adminClient
      .from("tenant_module_access")
      .upsert(rows, { onConflict: "tenant_id,module_code" });

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    const { data: savedModules, error: refreshError } = await adminClient
      .from("tenant_module_access")
      .select("id,tenant_id,module_code,is_enabled,enabled_by,enabled_at")
      .eq("tenant_id", tenantId)
      .order("module_code");

    if (refreshError) {
      return NextResponse.json({ error: refreshError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      tenantId,
      enabledModuleCodes: (savedModules || [])
        .filter((module: any) => module.is_enabled)
        .map((module: any) => module.module_code),
      modules: savedModules || [],
      updatedBy: platformAdminEmail,
      message: "Company subscription updated successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unable to update the Company Account subscription." },
      { status: 500 },
    );
  }
}
