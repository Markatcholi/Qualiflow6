"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Department = { id: string; code: string; label: string };
const field = { display: "block", width: "100%", padding: 10, marginTop: 6, border: "1px solid #94a3b8", borderRadius: 6, boxSizing: "border-box" as const };
const button = { padding: "10px 16px", border: "1px solid #0f766e", borderRadius: 6, background: "#0f766e", color: "white", cursor: "pointer" };

export default function SandboxCompanyConfiguration({ tenantId, initialName, onSaved }: { tenantId: string; initialName: string; onSaved: (name: string) => void }) {
  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState("America/Chicago");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const loadDepartments = async () => {
    const { data, error } = await supabase.from("md_departments").select("id,code,label").eq("tenant_id", tenantId).order("label");
    if (error) throw error;
    setDepartments(data || []);
  };
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [profile, rows] = await Promise.all([
        supabase.from("tenants").select("company_name,default_timezone").eq("id", tenantId).single(),
        supabase.from("md_departments").select("id,code,label").eq("tenant_id", tenantId).order("label")
      ]);
      if (cancelled) return;
      if (profile.error || rows.error) throw profile.error || rows.error;
      setName(profile.data.company_name); setTimezone(profile.data.default_timezone);
      setDepartments(rows.data || []); setReady(true);
    })().catch(() => { if (!cancelled) setMessage("Company configuration could not be loaded. Refresh the page and try again."); });
    return () => { cancelled = true; };
  }, [tenantId]);
  const act = async (operation: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await operation(); } catch (error: any) { setMessage(error?.code === "23505" ? "That department code already exists. Choose a different code." : error?.message || "Unable to save configuration."); }
    finally { setBusy(false); }
  };
  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    void act(async () => {
      const { error } = await supabase.rpc("qualisphere_sandbox_save_profile", { p_tenant: tenantId, p_company_name: name, p_timezone: timezone });
      if (error) throw error;
      const savedName = name.trim(); setName(savedName); onSaved(savedName);
      setMessage("Company profile saved in the sandbox.");
    });
  };
  const saveDepartment = (event: React.FormEvent) => {
    event.preventDefault();
    void act(async () => {
      const { error } = await supabase.rpc("qualisphere_sandbox_save_department", { p_tenant: tenantId, p_id: editId, p_code: code, p_label: label });
      if (error) throw error;
      await loadDepartments(); setCode(""); setLabel(""); setEditId(null);
      setMessage("Department saved in the sandbox.");
    });
  };
  const remove = (department: Department) => {
    if (!window.confirm(`Remove department “${department.label}” from sandbox setup?`)) return;
    void act(async () => {
      const { data, error } = await supabase.from("md_departments").delete().eq("id", department.id).eq("tenant_id", tenantId).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Department could not be removed. Refresh the page and try again.");
      await loadDepartments();
      if (editId === department.id) { setCode(""); setLabel(""); setEditId(null); }
      setMessage("Department removed from sandbox setup.");
    });
  };
  const zones = Array.from(new Set([timezone, "America/Chicago", "America/New_York", "America/Denver", "America/Los_Angeles", "UTC", "Europe/London", "Europe/Paris", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"]));
  return <section style={{ marginTop: 32, borderTop: "1px solid #cbd5e1", paddingTop: 24 }}>
    <h2 style={{ fontSize: 24 }}>Company configuration</h2>
    <p>Set your sandbox company profile and departments. These changes stay in the sandbox.</p>
    <p role="status" style={{ marginTop: 12 }}>{message}</p>
    {!ready ? <p>Configuration is not ready to edit yet.</p> : <>
      <form onSubmit={saveProfile} style={{ display: "grid", gap: 16, marginTop: 20 }}>
        <label>Company name<input required maxLength={200} value={name} onChange={e => setName(e.target.value)} style={field} disabled={busy} /></label>
        <label>Time zone<input required list="sandbox-timezones" value={timezone} onChange={e => setTimezone(e.target.value)} style={field} disabled={busy} /><datalist id="sandbox-timezones">{zones.map(zone => <option key={zone} value={zone} />)}</datalist><small>Choose a suggestion or enter an IANA time zone, such as America/Chicago.</small></label>
        <button disabled={busy} style={button} type="submit">{busy ? "Working…" : "Save company profile"}</button>
      </form>
      <h3 style={{ fontSize: 20, marginTop: 32 }}>Departments</h3>
      {!departments.length ? <p>No departments yet. Add your first department below.</p> : <ul style={{ listStyle: "none", padding: 0 }}>{departments.map(department => <li key={department.id} style={{ padding: "12px 0", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ flex: 1 }}>{department.code} — {department.label}</span>
        <button type="button" disabled={busy} onClick={() => { setEditId(department.id); setCode(department.code); setLabel(department.label); setMessage(""); }}>Edit</button>
        <button type="button" disabled={busy} onClick={() => remove(department)}>Remove</button>
      </li>)}</ul>}
      <form onSubmit={saveDepartment} style={{ display: "grid", gap: 16, marginTop: 20 }}>
        <label>Department code<input required maxLength={50} value={code} onChange={e => setCode(e.target.value)} style={field} disabled={busy} /></label>
        <label>Department name<input required maxLength={200} value={label} onChange={e => setLabel(e.target.value)} style={field} disabled={busy} /></label>
        <button type="submit" disabled={busy} style={button}>{editId ? "Save department" : "Add department"}</button>
        {editId && <button type="button" disabled={busy} onClick={() => { setEditId(null); setCode(""); setLabel(""); }}>Cancel edit</button>}
      </form>
    </>}
  </section>;
}
