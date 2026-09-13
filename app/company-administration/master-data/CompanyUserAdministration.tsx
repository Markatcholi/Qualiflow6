"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type CustomerUser = {
  id: string;
  tenant_id: string;
  user_email: string;
  job_title: string | null;
  department: string | null;
  account_status: string;
};

type CustomerRole = {
  id: string;
  tenant_id: string;
  role_name: string;
  description: string | null;
  is_active: boolean;
};

type CustomerRoleAssignment = {
  id: string;
  tenant_id: string;
  user_email: string;
  role_id: string;
  is_active: boolean;
  customer_roles?: CustomerRole | CustomerRole[] | null;
};

type Props = {
  tenantId: string;
  administratorEmail: string;
};

export default function CompanyUserAdministration({ tenantId, administratorEmail }: Props) {
  const [users, setUsers] = useState<CustomerUser[]>([]);
  const [roles, setRoles] = useState<CustomerRole[]>([]);
  const [assignments, setAssignments] = useState<CustomerRoleAssignment[]>([]);
  const [message, setMessage] = useState("");

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserJobTitle, setNewUserJobTitle] = useState("");
  const [newUserDepartment, setNewUserDepartment] = useState("");
  const [newUserStatus, setNewUserStatus] = useState("active");
  const [selectedUserEmail, setSelectedUserEmail] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [activatingEmail, setActivatingEmail] = useState("");

  const inputStyle: React.CSSProperties = { padding: 8, marginRight: 8, marginBottom: 8 };
  const selectStyle: React.CSSProperties = { padding: 8, marginRight: 8, marginBottom: 8, minWidth: 190 };

  const load = async () => {
    const [usersRes, rolesRes, assignmentsRes] = await Promise.all([
      supabase.from("tenant_user_profiles").select("*").eq("tenant_id", tenantId).order("user_email"),
      supabase.from("customer_roles").select("id,tenant_id,role_name,description,is_active").eq("tenant_id", tenantId).order("role_name"),
      supabase
        .from("tenant_user_role_assignments")
        .select("id,tenant_id,user_email,role_id,is_active,customer_roles(id,tenant_id,role_name,description,is_active)")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("user_email"),
    ]);

    const firstError = [usersRes, rolesRes, assignmentsRes].find((response) => response.error)?.error;
    if (firstError) {
      setMessage(firstError.message);
      return;
    }

    setUsers((usersRes.data as CustomerUser[]) || []);
    setRoles((rolesRes.data as CustomerRole[]) || []);
    setAssignments((assignmentsRes.data as CustomerRoleAssignment[]) || []);
  };

  useEffect(() => {
    if (tenantId) load();
  }, [tenantId]);

  const assignmentsByUser = useMemo(() => {
    const result = new Map<string, CustomerRoleAssignment[]>();
    for (const assignment of assignments) {
      const key = String(assignment.user_email || "").trim().toLowerCase();
      result.set(key, [...(result.get(key) || []), assignment]);
    }
    return result;
  }, [assignments]);

  const roleNameForAssignment = (assignment: CustomerRoleAssignment) => {
    const joinedRole = Array.isArray(assignment.customer_roles)
      ? assignment.customer_roles[0]
      : assignment.customer_roles;
    return joinedRole?.role_name || roles.find((role) => role.id === assignment.role_id)?.role_name || "Role";
  };

  const saveUser = async () => {
    const normalizedEmail = newUserEmail.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessage("Enter a valid user email address.");
      return;
    }

    setSavingUser(true);
    const { error } = await supabase.rpc("qualisphere_set_company_user", {
      p_tenant_id: tenantId,
      p_user_email: normalizedEmail,
      p_job_title: newUserJobTitle.trim() || null,
      p_department: newUserDepartment.trim() || null,
      p_account_status: newUserStatus,
    });
    setSavingUser(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewUserEmail("");
    setNewUserJobTitle("");
    setNewUserDepartment("");
    setNewUserStatus("active");
    setMessage(
      newUserStatus === "active"
        ? "Company user profile and Company Account access updated successfully. Assign the required access role(s), then send activation."
        : "Company user profile updated and Company Account access deactivated."
    );
    await load();
  };

  const sendActivation = async (userEmail: string) => {
    const normalizedEmail = String(userEmail || "").trim().toLowerCase();
    if (!normalizedEmail) return;

    setMessage("");
    setActivatingEmail(normalizedEmail);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        setMessage("Your QualiSphere session is no longer available. Sign in again and retry activation.");
        return;
      }

      const response = await fetch("/api/company/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ tenantId, email: normalizedEmail }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result?.error || "Unable to send user activation.");
        return;
      }

      setMessage(result?.message || "User activation processed successfully.");
    } catch (error: any) {
      setMessage(error?.message || "Unable to send user activation.");
    } finally {
      setActivatingEmail("");
    }
  };

  const saveRole = async () => {
    const roleName = newRoleName.trim();
    if (!roleName) {
      setMessage("Role name is required.");
      return;
    }

    setSavingRole(true);
    const { error } = await supabase.from("customer_roles").insert({
      tenant_id: tenantId,
      role_name: roleName,
      description: newRoleDescription.trim() || null,
      is_active: true,
    });
    setSavingRole(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewRoleName("");
    setNewRoleDescription("");
    setMessage("Company access role added successfully.");
    await load();
  };

  const toggleRole = async (role: CustomerRole) => {
    const { error } = await supabase
      .from("customer_roles")
      .update({ is_active: !role.is_active })
      .eq("id", role.id)
      .eq("tenant_id", tenantId);

    if (error) {
      setMessage(error.message);
      return;
    }
    await load();
  };

  const assignRole = async () => {
    if (!selectedUserEmail || !selectedRoleId) {
      setMessage("Select both a user and a module access role.");
      return;
    }

    setSavingAssignment(true);
    const { error } = await supabase.from("tenant_user_role_assignments").upsert(
      {
        tenant_id: tenantId,
        user_email: selectedUserEmail,
        role_id: selectedRoleId,
        is_active: true,
        assigned_by: administratorEmail,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,user_email,role_id" }
    );
    setSavingAssignment(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSelectedRoleId("");
    setMessage("Module access role assigned successfully. You may now send account activation to this user.");
    await load();
  };

  const removeAssignment = async (assignmentId: string) => {
    const { error } = await supabase
      .from("tenant_user_role_assignments")
      .delete()
      .eq("id", assignmentId)
      .eq("tenant_id", tenantId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Module access role removed successfully.");
    await load();
  };

  return (
    <section id="user-administration" style={{ border: "1px solid #ccc", padding: 16, marginBottom: 20, borderRadius: 8 }}>
      <h2>User Administration</h2>
      <p style={{ color: "#4b5563" }}>
        Maintain users for this Company Account, assign customer-controlled QualiSphere access roles, and send secure account activation. Users and assignments from other Company Accounts are never displayed here.
      </p>

      {message ? (
        <div style={{ padding: 10, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, marginBottom: 14 }}>
          {message}
        </div>
      ) : null}

      <h3>Add or Update User Profile</h3>
      <input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="User email" style={inputStyle} />
      <input value={newUserJobTitle} onChange={(e) => setNewUserJobTitle(e.target.value)} placeholder="Job title" style={inputStyle} />
      <input value={newUserDepartment} onChange={(e) => setNewUserDepartment(e.target.value)} placeholder="Department" style={inputStyle} />
      <select value={newUserStatus} onChange={(e) => setNewUserStatus(e.target.value)} style={selectStyle}>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <button onClick={saveUser} disabled={savingUser}>{savingUser ? "Saving..." : "Add / Update User"}</button>
      <p style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
        Recommended sequence: add the user → assign the required role(s) → send activation. QualiSphere never emails a temporary password.
      </p>

      <h3 style={{ marginTop: 24 }}>Assign Module Access</h3>
      <select value={selectedUserEmail} onChange={(e) => setSelectedUserEmail(e.target.value)} style={selectStyle}>
        <option value="">Select user</option>
        {users.filter((user) => user.account_status === "active").map((user) => (
          <option key={user.id} value={user.user_email}>{user.user_email}</option>
        ))}
      </select>
      <select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)} style={{ ...selectStyle, minWidth: 300 }}>
        <option value="">Select module access role</option>
        {roles.filter((role) => role.is_active).map((role) => (
          <option key={role.id} value={role.id}>{role.role_name}</option>
        ))}
      </select>
      <button onClick={assignRole} disabled={savingAssignment}>{savingAssignment ? "Assigning..." : "Assign Access"}</button>

      <details style={{ marginTop: 18, padding: 14, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fafafa" }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Manage Module Access Roles</summary>
        <p style={{ color: "#4b5563" }}>
          QualiSphere provides generic starter roles. Your company may add roles or deactivate starter roles without changing another Company Account.
        </p>
        <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Role name" style={inputStyle} />
        <input value={newRoleDescription} onChange={(e) => setNewRoleDescription(e.target.value)} placeholder="Description (optional)" style={{ ...inputStyle, minWidth: 320 }} />
        <button onClick={saveRole} disabled={savingRole}>{savingRole ? "Adding..." : "Add Module Access Role"}</button>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {roles.map((role) => (
            <span key={role.id} style={{ border: "1px solid #d1d5db", borderRadius: 999, padding: "6px 10px", background: role.is_active ? "white" : "#f3f4f6" }}>
              <strong>{role.role_name}</strong>
              {role.description ? <span style={{ color: "#6b7280" }}> — {role.description}</span> : null}
              <button onClick={() => toggleRole(role)} style={{ marginLeft: 8 }}>{role.is_active ? "Deactivate" : "Activate"}</button>
            </span>
          ))}
        </div>
      </details>

      <div style={{ overflowX: "auto", marginTop: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #d1d5db" }}>User</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #d1d5db" }}>Job Title</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #d1d5db" }}>Department</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #d1d5db" }}>Status</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #d1d5db" }}>Module Access</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #d1d5db" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const normalizedUserEmail = user.user_email.toLowerCase();
              const userAssignments = assignmentsByUser.get(normalizedUserEmail) || [];
              const canActivate = user.account_status === "active" && userAssignments.length > 0;
              const isActivating = activatingEmail === normalizedUserEmail;

              return (
                <tr key={user.id}>
                  <td style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>{user.user_email}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>{user.job_title || "Not specified"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>{user.department || "Not specified"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>{user.account_status === "active" ? "Active" : "Inactive"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>
                    {userAssignments.length === 0 ? (
                      <span style={{ color: "#6b7280" }}>No module access assigned</span>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {userAssignments.map((assignment) => (
                          <span key={assignment.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#ede9fe", color: "#5b21b6", padding: "6px 8px", borderRadius: 999, fontWeight: 700 }}>
                            {roleNameForAssignment(assignment)}
                            <button onClick={() => removeAssignment(assignment.id)} style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 900 }} title="Remove role">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => {
                        setNewUserEmail(user.user_email);
                        setNewUserJobTitle(user.job_title || "");
                        setNewUserDepartment(user.department || "");
                        setNewUserStatus(user.account_status || "active");
                        document.getElementById("user-administration")?.scrollIntoView({ behavior: "smooth" });
                      }}>Edit</button>
                      <button
                        onClick={() => sendActivation(user.user_email)}
                        disabled={!canActivate || Boolean(activatingEmail)}
                        title={!canActivate ? "User must be Active and have at least one assigned access role before activation." : "Send secure QualiSphere account activation"}
                      >
                        {isActivating ? "Sending..." : "Send Activation"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
