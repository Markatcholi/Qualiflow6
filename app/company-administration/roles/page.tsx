"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type CustomerRole = {
  id: string;
  tenant_id: string;
  role_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

type RolePermission = {
  role_id: string;
  permission_code: string;
};

type Membership = {
  user_email: string;
  membership_status: string;
};

type RoleAssignment = {
  id: string;
  user_email: string;
  role_id: string;
  is_active: boolean;
};

type ModuleAccess = {
  module_code: string;
  is_enabled: boolean;
};

type PermissionDefinition = {
  code: string;
  label: string;
  module: string;
};

const PERMISSION_CATALOG: PermissionDefinition[] = [
  { code: "capa.view", label: "View CAPA", module: "capa" },
  { code: "capa.create", label: "Create CAPA", module: "capa" },
  { code: "capa.edit", label: "Edit CAPA", module: "capa" },
  { code: "capa.approve", label: "Approve CAPA", module: "capa" },
  { code: "capa.close", label: "Close CAPA", module: "capa" },
  { code: "ncmr.view", label: "View NCMR", module: "ncmr" },
  { code: "ncmr.create", label: "Create NCMR", module: "ncmr" },
  { code: "ncmr.edit", label: "Edit NCMR", module: "ncmr" },
  { code: "ncmr.approve", label: "Approve NCMR / MRB", module: "ncmr" },
  { code: "ncmr.close", label: "Close NCMR", module: "ncmr" },
  { code: "change_control.view", label: "View Change Control", module: "change_control" },
  { code: "change_control.create", label: "Create Change Control", module: "change_control" },
  { code: "change_control.edit", label: "Edit Change Control", module: "change_control" },
  { code: "change_control.approve", label: "Approve Change Control", module: "change_control" },
  { code: "documents.view", label: "View Controlled Documents", module: "controlled_documents" },
  { code: "documents.create", label: "Create / Revise Documents", module: "controlled_documents" },
  { code: "documents.approve", label: "Approve Documents", module: "controlled_documents" },
  { code: "documents.release", label: "Release Documents", module: "controlled_documents" },
  { code: "training.view", label: "View Training", module: "training" },
  { code: "training.manage", label: "Manage Training", module: "training" },
  { code: "scar.view", label: "View SCAR", module: "scar" },
  { code: "scar.create", label: "Create SCAR", module: "scar" },
  { code: "scar.edit", label: "Edit SCAR", module: "scar" },
  { code: "scar.close", label: "Close SCAR", module: "scar" },
  { code: "complaints.view", label: "View Complaints", module: "complaints" },
  { code: "complaints.create", label: "Create Complaints", module: "complaints" },
  { code: "complaints.edit", label: "Edit Complaints", module: "complaints" },
  { code: "complaints.close", label: "Close Complaints", module: "complaints" },
  { code: "audits.view", label: "View Audits", module: "audit_management" },
  { code: "audits.manage", label: "Manage Audits", module: "audit_management" },
  { code: "oos_oot.view", label: "View OOS / OOT", module: "oos_oot" },
  { code: "oos_oot.manage", label: "Manage OOS / OOT", module: "oos_oot" },
  { code: "suppliers.view", label: "View Suppliers", module: "suppliers" },
  { code: "suppliers.manage", label: "Manage Suppliers", module: "suppliers" },
  { code: "equipment.view", label: "View Equipment", module: "equipment" },
  { code: "equipment.manage", label: "Manage Equipment", module: "equipment" },
  { code: "analytics.dashboard", label: "View Executive Dashboard", module: "executive_dashboard" },
  { code: "analytics.management_review", label: "Access Management Review", module: "management_review" },
  { code: "analytics.kpi", label: "View KPI Reports", module: "kpi_reports" },
  { code: "analytics.audit_trail", label: "View Audit Trail", module: "audit_trail" },
];

export default function CustomerRoleManagementPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [roles, setRoles] = useState<CustomerRole[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [modules, setModules] = useState<ModuleAccess[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [assignmentEmail, setAssignmentEmail] = useState("");
  const [assignmentRoleId, setAssignmentRoleId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userEmail = String(authData?.user?.email || "").trim().toLowerCase();
      const activeTenantId = window.localStorage.getItem("qualisphere_active_tenant_id") || "";
      const activeCompanyName = window.localStorage.getItem("qualisphere_active_tenant_name") || "";

      setEmail(userEmail);
      setTenantId(activeTenantId);
      setCompanyName(activeCompanyName);

      if (!userEmail || !activeTenantId) {
        setAuthorized(false);
        setError("An active Company Account is required.");
        return;
      }

      const { data: contactAuthority, error: authorityError } = await supabase.rpc(
        "qualisphere_is_customer_contact",
        { p_tenant_id: activeTenantId },
      );

      if (authorityError) throw authorityError;

      if (contactAuthority !== true) {
        setAuthorized(false);
        return;
      }

      setAuthorized(true);

      const [roleResult, permissionResult, membershipResult, assignmentResult, moduleResult] = await Promise.all([
        supabase.from("customer_roles").select("*").eq("tenant_id", activeTenantId).order("role_name"),
        supabase.from("customer_role_permissions").select("role_id,permission_code").eq("tenant_id", activeTenantId),
        supabase.from("tenant_memberships").select("user_email,membership_status").eq("tenant_id", activeTenantId).eq("membership_status", "active").order("user_email"),
        supabase.from("tenant_user_role_assignments").select("id,user_email,role_id,is_active").eq("tenant_id", activeTenantId).eq("is_active", true),
        supabase.from("tenant_module_access").select("module_code,is_enabled").eq("tenant_id", activeTenantId),
      ]);

      if (roleResult.error) throw roleResult.error;
      if (permissionResult.error) throw permissionResult.error;
      if (membershipResult.error) throw membershipResult.error;
      if (assignmentResult.error) throw assignmentResult.error;
      if (moduleResult.error) throw moduleResult.error;

      setRoles((roleResult.data || []) as CustomerRole[]);
      setPermissions((permissionResult.data || []) as RolePermission[]);
      setMembers((membershipResult.data || []) as Membership[]);
      setAssignments((assignmentResult.data || []) as RoleAssignment[]);
      setModules((moduleResult.data || []) as ModuleAccess[]);
    } catch (loadError: any) {
      setError(loadError?.message || "Unable to load Company Role Management.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedRoleId) {
      setSelectedPermissions([]);
      return;
    }
    setSelectedPermissions(
      permissions
        .filter((permission) => permission.role_id === selectedRoleId)
        .map((permission) => permission.permission_code),
    );
  }, [selectedRoleId, permissions]);

  const enabledModuleKeys = useMemo(() => {
    return new Set(
      modules
        .filter((module) => module.is_enabled)
        .map((module) => normalizeModuleCode(module.module_code)),
    );
  }, [modules]);

  const availablePermissions = useMemo(() => {
    return PERMISSION_CATALOG.filter((permission) =>
      moduleIsEnabled(permission.module, enabledModuleKeys),
    );
  }, [enabledModuleKeys]);

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionDefinition[]> = {};
    availablePermissions.forEach((permission) => {
      const group = permission.module;
      groups[group] = groups[group] || [];
      groups[group].push(permission);
    });
    return groups;
  }, [availablePermissions]);

  const createRole = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const roleName = newRoleName.trim();
    if (!roleName) {
      setError("Role name is required.");
      return;
    }

    setSaving(true);
    try {
      const { data, error: createError } = await supabase
        .from("customer_roles")
        .insert({
          tenant_id: tenantId,
          role_name: roleName,
          description: newRoleDescription.trim() || null,
          created_by: email,
          updated_by: email,
        })
        .select("id")
        .single();

      if (createError) throw createError;

      setNewRoleName("");
      setNewRoleDescription("");
      setSelectedRoleId(String(data.id));
      setMessage(`Role “${roleName}” created. Select permissions for the role below.`);
      await load();
    } catch (createError: any) {
      setError(createError?.message || "Unable to create role.");
    } finally {
      setSaving(false);
    }
  };

  const savePermissions = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("customer_role_permissions")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("role_id", selectedRoleId);

      if (deleteError) throw deleteError;

      if (selectedPermissions.length > 0) {
        const { error: insertError } = await supabase
          .from("customer_role_permissions")
          .insert(
            selectedPermissions.map((permissionCode) => ({
              tenant_id: tenantId,
              role_id: selectedRoleId,
              permission_code: permissionCode,
              created_by: email,
            })),
          );
        if (insertError) throw insertError;
      }

      setMessage("Role permissions saved.");
      await load();
    } catch (saveError: any) {
      setError(saveError?.message || "Unable to save role permissions.");
    } finally {
      setSaving(false);
    }
  };

  const assignRole = async () => {
    if (!assignmentEmail || !assignmentRoleId) {
      setError("Select both a user and a role.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const { error: assignmentError } = await supabase
        .from("tenant_user_role_assignments")
        .upsert(
          {
            tenant_id: tenantId,
            user_email: assignmentEmail.toLowerCase(),
            role_id: assignmentRoleId,
            is_active: true,
            assigned_by: email,
          },
          { onConflict: "tenant_id,user_email,role_id" },
        );

      if (assignmentError) throw assignmentError;

      setAssignmentEmail("");
      setAssignmentRoleId("");
      setMessage("Role assigned.");
      await load();
    } catch (assignmentError: any) {
      setError(assignmentError?.message || "Unable to assign role.");
    } finally {
      setSaving(false);
    }
  };

  const removeAssignment = async (assignmentId: string) => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const { error: removeError } = await supabase
        .from("tenant_user_role_assignments")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("id", assignmentId);
      if (removeError) throw removeError;
      setMessage("Role assignment removed.");
      await load();
    } catch (removeError: any) {
      setError(removeError?.message || "Unable to remove role assignment.");
    } finally {
      setSaving(false);
    }
  };

  const selectedRole = roles.find((role) => role.id === selectedRoleId) || null;

  if (loading) return <main style={pageStyle}>Loading Company Role Management...</main>;

  if (!authorized) {
    return (
      <main style={pageStyle}>
        <div style={eyebrowStyle}>COMPANY ADMINISTRATION</div>
        <h1>Role Management</h1>
        <div style={warningStyle}>
          Customer Contact authority is required to create or manage this Company's QMS roles.
        </div>
        <a href="/workspace" style={linkButtonStyle}>Return to Workspace</a>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>COMPANY ADMINISTRATION</div>
          <h1 style={titleStyle}>QMS Role Management</h1>
          <p style={subtitleStyle}>
            {companyName || "Company Account"} owns and manages its own QMS roles. QualiSphere provides the permission framework but does not create customer roles.
          </p>
        </div>
        <a href="/workspace" style={linkButtonStyle}>Return to Workspace</a>
      </div>

      <div style={identityStyle}>
        <strong>Customer Contact:</strong> {email} &nbsp; • &nbsp; <strong>Company Account:</strong> {companyName || tenantId}
      </div>

      {message ? <div style={successStyle}>{message}</div> : null}
      {error ? <div style={warningStyle}>{error}</div> : null}

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Create Customer QMS Role</h2>
        <p style={helperStyle}>Create the role names your organization actually uses. No default QualiSphere roles are imposed.</p>
        <form onSubmit={createRole} style={formGridStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Role Name *</span>
            <input value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} placeholder="Example: VP Quality" style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Description</span>
            <input value={newRoleDescription} onChange={(event) => setNewRoleDescription(event.target.value)} placeholder="Purpose of this role" style={inputStyle} />
          </label>
          <div style={{ alignSelf: "end" }}>
            <button type="submit" disabled={saving} style={primaryButtonStyle}>{saving ? "Saving..." : "Create Role"}</button>
          </div>
        </form>
      </section>

      <section style={twoColumnStyle}>
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Customer Roles</h2>
          {roles.length === 0 ? <div style={emptyStyle}>No customer QMS roles have been created yet.</div> : null}
          <div style={roleListStyle}>
            {roles.map((role) => (
              <button
                type="button"
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                style={{ ...roleButtonStyle, ...(selectedRoleId === role.id ? activeRoleButtonStyle : {}) }}
              >
                <strong>{role.role_name}</strong>
                <span style={smallStyle}>{role.description || "No description"}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Role Permissions</h2>
          {!selectedRole ? (
            <div style={emptyStyle}>Select a customer role to configure its permissions.</div>
          ) : (
            <>
              <p style={helperStyle}>Configuring permissions for <strong>{selectedRole.role_name}</strong>. Only capabilities associated with modules enabled for this Company Account are available.</p>
              {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
                <div key={module} style={permissionGroupStyle}>
                  <div style={permissionGroupTitleStyle}>{humanize(module)}</div>
                  <div style={permissionGridStyle}>
                    {modulePermissions.map((permission) => (
                      <label key={permission.code} style={permissionLabelStyle}>
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(permission.code)}
                          onChange={(event) => {
                            setSelectedPermissions((current) => event.target.checked
                              ? [...current, permission.code]
                              : current.filter((code) => code !== permission.code));
                          }}
                        />
                        <span>{permission.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button type="button" onClick={savePermissions} disabled={saving} style={primaryButtonStyle}>
                {saving ? "Saving..." : "Save Permissions"}
              </button>
            </>
          )}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Assign Customer Roles</h2>
        <p style={helperStyle}>Assign one or more customer-created QMS roles to active users in this Company Account.</p>
        <div style={assignmentControlsStyle}>
          <select value={assignmentEmail} onChange={(event) => setAssignmentEmail(event.target.value)} style={inputStyle}>
            <option value="">Select user</option>
            {members.map((member) => <option key={member.user_email} value={member.user_email}>{member.user_email}</option>)}
          </select>
          <select value={assignmentRoleId} onChange={(event) => setAssignmentRoleId(event.target.value)} style={inputStyle}>
            <option value="">Select role</option>
            {roles.filter((role) => role.is_active).map((role) => <option key={role.id} value={role.id}>{role.role_name}</option>)}
          </select>
          <button type="button" onClick={assignRole} disabled={saving} style={primaryButtonStyle}>Assign Role</button>
        </div>

        <div style={{ overflowX: "auto", marginTop: 18 }}>
          <table style={tableStyle}>
            <thead>
              <tr><th style={thStyle}>User</th><th style={thStyle}>Role</th><th style={thStyle}>Action</th></tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => {
                const role = roles.find((item) => item.id === assignment.role_id);
                return (
                  <tr key={assignment.id}>
                    <td style={tdStyle}>{assignment.user_email}</td>
                    <td style={tdStyle}>{role?.role_name || "Unknown role"}</td>
                    <td style={tdStyle}><button type="button" onClick={() => removeAssignment(assignment.id)} disabled={saving} style={secondaryButtonStyle}>Remove</button></td>
                  </tr>
                );
              })}
              {assignments.length === 0 ? <tr><td style={tdStyle} colSpan={3}>No customer role assignments yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={noteStyle}>
        <strong>Authority boundary:</strong> Customer-created QMS roles do not change QualiSphere subscription entitlements and do not grant Platform Administration access. QualiSphere controls which modules are enabled for this Company Account.
      </section>
    </main>
  );
}

function normalizeModuleCode(value: string) {
  return String(value || "").trim().toLowerCase().replace(/[\s/-]+/g, "_").replace(/_+/g, "_");
}

function moduleIsEnabled(requiredModule: string, enabledModules: Set<string>) {
  const required = normalizeModuleCode(requiredModule);
  const aliases: Record<string, string[]> = {
    capa: ["capa"],
    ncmr: ["ncmr", "ncmrs"],
    change_control: ["change_control", "change"],
    controlled_documents: ["controlled_documents", "document_control", "documents"],
    training: ["training", "training_management"],
    scar: ["scar", "scars", "supplier_quality"],
    complaints: ["complaints", "complaint"],
    audit_management: ["audit_management", "audits", "audit"],
    oos_oot: ["oos_oot", "oos", "oot"],
    suppliers: ["suppliers", "supplier_management"],
    equipment: ["equipment", "equipment_management"],
    executive_dashboard: ["executive_dashboard", "dashboard", "analytics"],
    management_review: ["management_review", "management_reviews", "analytics"],
    kpi_reports: ["kpi_reports", "kpi", "analytics"],
    audit_trail: ["audit_trail", "audit_log", "analytics"],
  };
  return (aliases[required] || [required]).some((alias) => enabledModules.has(alias));
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

const pageStyle: React.CSSProperties = { minHeight: "100vh", background: "#f8fafc", padding: 28, fontFamily: "Arial, sans-serif", color: "#0f172a" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 18 };
const eyebrowStyle: React.CSSProperties = { fontSize: 12, fontWeight: 900, letterSpacing: "0.14em", color: "#2563eb" };
const titleStyle: React.CSSProperties = { margin: "6px 0", fontSize: 36 };
const subtitleStyle: React.CSSProperties = { margin: 0, maxWidth: 800, color: "#475569", lineHeight: 1.5 };
const identityStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", borderRadius: 12, padding: 14, marginBottom: 18 };
const cardStyle: React.CSSProperties = { background: "#ffffff", border: "1px solid #dbe3ef", borderRadius: 16, padding: 22, marginBottom: 20, boxShadow: "0 8px 22px rgba(15,23,42,0.05)" };
const sectionTitleStyle: React.CSSProperties = { margin: "0 0 6px", fontSize: 22 };
const helperStyle: React.CSSProperties = { color: "#64748b", lineHeight: 1.45, margin: "6px 0 16px" };
const formGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(280px, 2fr) auto", gap: 14 };
const fieldStyle: React.CSSProperties = { display: "grid", gap: 6 };
const labelStyle: React.CSSProperties = { fontWeight: 800, fontSize: 13 };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 9, padding: "10px 11px", background: "#ffffff" };
const primaryButtonStyle: React.CSSProperties = { border: 0, borderRadius: 9, background: "#2563eb", color: "#ffffff", padding: "10px 14px", fontWeight: 900, cursor: "pointer" };
const secondaryButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 8, background: "#ffffff", color: "#334155", padding: "7px 10px", fontWeight: 800, cursor: "pointer" };
const linkButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 9, background: "#ffffff", color: "#0f172a", padding: "10px 14px", textDecoration: "none", fontWeight: 800 };
const twoColumnStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(260px, 0.8fr) minmax(420px, 1.5fr)", gap: 20 };
const roleListStyle: React.CSSProperties = { display: "grid", gap: 8 };
const roleButtonStyle: React.CSSProperties = { display: "grid", gap: 4, textAlign: "left", border: "1px solid #dbe3ef", borderRadius: 10, padding: 12, background: "#ffffff", cursor: "pointer" };
const activeRoleButtonStyle: React.CSSProperties = { borderColor: "#60a5fa", background: "#eff6ff" };
const smallStyle: React.CSSProperties = { color: "#64748b", fontSize: 12 };
const permissionGroupStyle: React.CSSProperties = { borderTop: "1px solid #e2e8f0", paddingTop: 12, marginTop: 12 };
const permissionGroupTitleStyle: React.CSSProperties = { fontWeight: 900, marginBottom: 8 };
const permissionGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8, marginBottom: 14 };
const permissionLabelStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 14 };
const assignmentControlsStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(240px, 1fr) minmax(220px, 1fr) auto", gap: 12 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 620 };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "10px", borderBottom: "1px solid #cbd5e1", background: "#f8fafc" };
const tdStyle: React.CSSProperties = { padding: "11px 10px", borderBottom: "1px solid #e2e8f0" };
const emptyStyle: React.CSSProperties = { color: "#64748b", border: "1px dashed #cbd5e1", borderRadius: 10, padding: 14 };
const successStyle: React.CSSProperties = { background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#166534", borderRadius: 12, padding: 14, marginBottom: 16 };
const warningStyle: React.CSSProperties = { background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412", borderRadius: 12, padding: 14, marginBottom: 16 };
const noteStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", borderRadius: 12, padding: 16, lineHeight: 1.5 };
