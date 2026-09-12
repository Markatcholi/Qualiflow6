"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type MasterTable = {
  table: string;
  title: string;
  codeField: string;
  labelField: string;
};

const MASTER_TABLES: MasterTable[] = [
  { table: "md_product_part_numbers", title: "Product Part Master", codeField: "code", labelField: "part_description" },
  { table: "md_dispositions", title: "Dispositions", codeField: "code", labelField: "label" },
  { table: "md_detection_sources", title: "Detection Sources", codeField: "code", labelField: "label" },
  { table: "md_departments", title: "Departments", codeField: "code", labelField: "label" },
  { table: "md_material_statuses", title: "Material Statuses", codeField: "code", labelField: "label" },
  { table: "md_defect_categories", title: "Defect Categories", codeField: "code", labelField: "label" },
  { table: "md_defect_subcategories", title: "Defect Subcategories", codeField: "code", labelField: "label" },
  { table: "md_rooms", title: "OOS/OOT Rooms / Areas", codeField: "code", labelField: "label" },
  { table: "md_equipment", title: "OOS/OOT Equipment", codeField: "equipment_id", labelField: "equipment_name" },
  { table: "md_test_methods", title: "OOS/OOT Test Methods", codeField: "code", labelField: "label" },
  { table: "md_oos_limits", title: "OOS/OOT Limits", codeField: "test_method_code", labelField: "investigation_source" },
];

export default function CompanyMasterDataPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [rows, setRows] = useState<Record<string, any[]>>({});
  const [drafts, setDrafts] = useState<Record<string, { code: string; label: string }>>({});
  const [message, setMessage] = useState("");

  const loadRows = async (activeTenantId: string) => {
    const results = await Promise.all(
      MASTER_TABLES.map(async (definition) => {
        const response = await supabase
          .from(definition.table)
          .select("*")
          .eq("tenant_id", activeTenantId)
          .order(definition.labelField, { ascending: true });
        return { table: definition.table, response };
      })
    );

    const next: Record<string, any[]> = {};
    for (const result of results) {
      if (result.response.error) throw new Error(result.response.error.message);
      next[result.table] = result.response.data || [];
    }
    setRows(next);
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        const userEmail = String(userData?.user?.email || "").trim().toLowerCase();
        setEmail(userEmail);
        if (!userEmail) return;

        const storedTenantId = window.localStorage.getItem("qualisphere_active_tenant_id") || "";
        if (!storedTenantId) return;

        const { data: membership, error: membershipError } = await supabase
          .from("tenant_memberships")
          .select("tenant_id,membership_role,membership_status,tenants(company_name)")
          .eq("tenant_id", storedTenantId)
          .ilike("user_email", userEmail)
          .eq("membership_status", "active")
          .maybeSingle();
        if (membershipError) throw membershipError;
        if (!membership) return;

        const { data: isCompanyAdmin, error: adminError } = await supabase.rpc(
          "qualisphere_is_company_admin",
          { p_tenant_id: storedTenantId }
        );
        if (adminError) throw adminError;
        if (isCompanyAdmin !== true) return;

        const tenant = Array.isArray((membership as any).tenants)
          ? (membership as any).tenants[0]
          : (membership as any).tenants;

        setTenantId(storedTenantId);
        setCompanyName(String(tenant?.company_name || window.localStorage.getItem("qualisphere_active_tenant_name") || "Company Account"));
        setAuthorized(true);
        await loadRows(storedTenantId);
      } catch (error: any) {
        setMessage(error?.message || "Unable to load Company Administration.");
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  const addRow = async (definition: MasterTable) => {
    const draft = drafts[definition.table] || { code: "", label: "" };
    const code = draft.code.trim();
    const label = draft.label.trim();
    if (!code || !label) {
      setMessage("Both values are required.");
      return;
    }

    const payload: Record<string, any> = {
      tenant_id: tenantId,
      [definition.codeField]: code,
      [definition.labelField]: label,
    };
    if (definition.table === "md_product_part_numbers") {
      payload.label = code;
      payload.is_active = true;
    }
    if (["md_rooms", "md_equipment", "md_test_methods", "md_oos_limits"].includes(definition.table)) {
      payload.is_active = true;
    }

    const { error } = await supabase.from(definition.table).insert(payload);
    if (error) {
      setMessage(error.message);
      return;
    }
    setDrafts((current) => ({ ...current, [definition.table]: { code: "", label: "" } }));
    setMessage(`${definition.title} updated successfully.`);
    await loadRows(tenantId);
  };

  const deleteRow = async (definition: MasterTable, id: string) => {
    if (!window.confirm("Delete this Company Account Master Data item?")) return;
    const { error } = await supabase
      .from(definition.table)
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`${definition.title} updated successfully.`);
    await loadRows(tenantId);
  };

  if (loading) return <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>Loading Company Administration...</main>;

  if (!authorized) {
    return (
      <main style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <h1>Access Denied</h1>
        <p>Only a Company Administrator for the active Company Account can access Master Data Administration.</p>
        <p><strong>Logged-in Email:</strong> {email || "none"}</p>
        {message ? <p style={{ color: "#b45309" }}>{message}</p> : null}
        <Link href="/workspace">Back to My Workspace</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", letterSpacing: ".08em" }}>COMPANY ADMINISTRATION</div>
          <h1 style={{ marginBottom: 6 }}>Master Data Administration</h1>
          <p style={{ marginTop: 0 }}><strong>Company Account:</strong> {companyName}</p>
          <p><strong>Company Administrator:</strong> {email}</p>
        </div>
        <Link href="/workspace" style={{ padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, textDecoration: "none", fontWeight: 700 }}>Back to My Workspace</Link>
      </div>

      <div style={{ padding: 14, background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, margin: "18px 0" }}>
        This Master Data belongs only to <strong>{companyName}</strong>. QualiSphere Platform Administration controls subscription entitlements separately.
      </div>
      {message ? <div style={{ padding: 12, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, marginBottom: 18 }}>{message}</div> : null}

      {MASTER_TABLES.map((definition) => {
        const draft = drafts[definition.table] || { code: "", label: "" };
        const items = rows[definition.table] || [];
        return (
          <section key={definition.table} style={{ border: "1px solid #d1d5db", padding: 18, marginBottom: 18, borderRadius: 10 }}>
            <h2 style={{ marginTop: 0 }}>{definition.title}</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={draft.code} onChange={(e) => setDrafts((current) => ({ ...current, [definition.table]: { ...draft, code: e.target.value } }))} placeholder={definition.codeField.replaceAll("_", " ")} style={{ padding: 9, minWidth: 220 }} />
              <input value={draft.label} onChange={(e) => setDrafts((current) => ({ ...current, [definition.table]: { ...draft, label: e.target.value } }))} placeholder={definition.labelField.replaceAll("_", " ")} style={{ padding: 9, minWidth: 300 }} />
              <button onClick={() => addRow(definition)} style={{ padding: "9px 14px", fontWeight: 700 }}>Add</button>
            </div>
            {items.length === 0 ? (
              <p style={{ color: "#64748b" }}>No Company Account-specific records configured yet.</p>
            ) : (
              <div style={{ overflowX: "auto", marginTop: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{definition.codeField.replaceAll("_", " ")}</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{definition.labelField.replaceAll("_", " ")}</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Action</th></tr></thead>
                  <tbody>{items.map((item: any) => <tr key={item.id}><td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>{String(item[definition.codeField] || "")}</td><td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>{String(item[definition.labelField] || "")}</td><td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}><button onClick={() => deleteRow(definition, item.id)}>Delete</button></td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
