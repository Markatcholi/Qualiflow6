"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

import EmployeeProfileForm from "../../../components/EmployeeProfileForm";
import UserExcelImport from "../../../components/UserExcelImport";

type CustomerUser = {
  full_name?: string | null;
  manager_email?: string | null;
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
  const [managers,setManagers] = useState<{email:string;name?:string|null}[]>([]);
  const [users, setUsers] = useState<CustomerUser[]>([]);
  const [roles, setRoles] = useState<CustomerRole[]>([]);
  const [assignments, setAssignments] = useState<CustomerRoleAssignment[]>([]);
  const [message, setMessage] = useState("");

  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserManagerEmail, setNewUserManagerEmail] = useState("");
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

  const inputStyle: React.CSSProperties = { padding: 8, marginRight: 8, marginBottom: 8 };
  const selectStyle: React.CSSProperties = { padding: 8, marginRight: 8, marginBottom: 8, minWidth: 190 };

  const load = async () => {
    const [usersRes, rolesRes, assignmentsRes, employeesRes, membersRes] = await Promise.all([
      supabase.from("tenant_user_profiles").select("*").eq("tenant_id", tenantId).order("user_email"),
      supabase.from("customer_roles").select("id,tenant_id,role_name,description,is_active").eq("tenant_id", tenantId).order("role_name"),
      supabase
        .from("tenant_user_role_assignments")
        .select("id,tenant_id,user_email,role_id,is_active,customer_roles(id,tenant_id,role_name,description,is_active)")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("user_email"),
      supabase.from("employee_profiles").select("user_email,full_name,manager_email").eq("tenant_id",tenantId),
      supabase.from("tenant_memberships").select("user_email,membership_status").eq("tenant_id",tenantId).eq("membership_status","active"),
    ]);

    const firstError = [usersRes, rolesRes, assignmentsRes, employeesRes, membersRes].find((response) => response.error)?.error;
    if (firstError) {
      setMessage(firstError.message);
      return;
    }

    const profiles = new Map((employeesRes.data || []).map(p=>[p.user_email.toLowerCase(),p]));
    setUsers(((usersRes.data as CustomerUser[]) || []).map(u=>({...u,...profiles.get(u.user_email.toLowerCase())})));
    setManagers((membersRes.data || []).map(m=>({email:m.user_email,name:profiles.get(m.user_email.toLowerCase())?.full_name})));
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
    const { error } = await supabase.rpc("qualisphere_save_company_employee", {
      p_full_name: newUserFullName.trim() || null,
      p_manager_email: newUserManagerEmail.trim().toLowerCase() || null,
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

    setNewUserFullName("");
    setNewUserManagerEmail("");
    setNewUserEmail("");
    setNewUserJobTitle("");
    setNewUserDepartment("");
    setNewUserStatus("active");
    setMessage(
      newUserStatus === "active"
        ? "Company user profile and Company Account access updated successfully."
        : "Company user profile updated and Company Account access deactivated."
    );
    await load();
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
    setMessage("Module access role assigned successfully.");
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
        Maintain users for this Company Account and assign customer-controlled QualiSphere access roles. Users and assignments from other Company Accounts are never displayed here.
      </p>

      {message ? (
        <div style={{ padding: 10, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, marginBottom: 14 }}>
          {message}
        </div>
      ) : null}

      <UserExcelImport customerAccount tenantId={tenantId} onImported={load} />
      <EmployeeProfileForm
        value={{fullName:newUserFullName,email:newUserEmail,jobTitle:newUserJobTitle,department:newUserDepartment,managerEmail:newUserManagerEmail,status:newUserStatus}}
        onChange={v=>{setNewUserFullName(v.fullName);setNewUserEmail(v.email);setNewUserJobTitle(v.jobTitle);setNewUserDepartment(v.department);setNewUserManagerEmail(v.managerEmail);setNewUserStatus(v.status);}}
        onSave={()=>void saveUser()} saving={savingUser} managers={managers}
      />

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
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #d1d5db" }}>Employee Name / Email</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #d1d5db" }}>Job Title</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #d1d5db" }}>Department</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #d1d5db" }}>Manager Email</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #d1d5db" }}>Status</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #d1d5db" }}>Module Access</th>
              <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #d1d5db" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const userAssignments = assignmentsByUser.get(user.user_email.toLowerCase()) || [];
              return (
                <tr key={user.id}>
                  <td style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}><strong>{user.full_name || "Not specified"}</strong><div>{user.user_email}</div></td>
                  <td style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>{user.job_title || "Not specified"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>{user.department || "Not specified"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>{user.manager_email || "No manager"}</td>
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
                    <button onClick={() => {
                      setNewUserFullName(user.full_name || "");
                      setNewUserManagerEmail(user.manager_email || "");
                      setNewUserEmail(user.user_email);
                      setNewUserJobTitle(user.job_title || "");
                      setNewUserDepartment(user.department || "");
                      setNewUserStatus(user.account_status || "active");
                      document.getElementById("user-administration")?.scrollIntoView({ behavior: "smooth" });
                    }}>Edit</button>
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