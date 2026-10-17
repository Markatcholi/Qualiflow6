"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

type Doc = { id: string; document_number: string; title: string; revision: string; status: string };
type Employee = { user_email: string; full_name: string | null; department: string | null; role_name: string | null };
type RecordRow = {
  id: string; tenant_id: string; document_id: string | null; assigned_to_email: string;
  training_title: string | null; training_completed_on: string | null;
  training_valid_until: string | null; training_evidence_storage_path: string | null;
  training_evidence_file_name: string | null; training_description: string | null; department: string | null;
  completed_by: string | null; created_at: string;
};
const box: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: 8, padding: 16, marginBottom: 18 };
const field: React.CSSProperties = { display: "block", width: "100%", padding: 9, border: "1px solid #9ca3af", borderRadius: 5, marginTop: 5 };
const label: React.CSSProperties = { display: "block", marginBottom: 12, fontWeight: 600 };
const released = (s: string) => ["release", "effective"].includes((s || "").toLowerCase());

export default function CertificationRegister() {
  const [tenant, setTenant] = useState<string | null>(null);
  const [coordinator, setCoordinator] = useState(false);
  const [email, setEmail] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [search, setSearch] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [expiry, setExpiry] = useState("");
  const [comments, setComments] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const userEmail = user.user?.email || "";
      setEmail(userEmail);
      if (!userEmail) throw new Error("Sign in to view certification records.");
      const t = await supabase.rpc("qualisphere_resolve_training_tenant");
      if (t.error || !t.data) throw new Error("No active Training tenant was found.");
      setTenant(t.data);
      const permission = await supabase.rpc("qualisphere_training_is_coordinator", { p_tenant: t.data });
      if (permission.error) throw permission.error;
      setCoordinator(permission.data === true);
      const [d, e, r] = await Promise.all([
        supabase.from("controlled_documents").select("id,document_number,title,revision,status").eq("tenant_id", t.data),
        supabase.from("employee_profiles").select("user_email,full_name,department,role_name").eq("tenant_id", t.data).eq("active", true),
        supabase.from("training_assignments").select("id,tenant_id,document_id,assigned_to_email,training_title,training_description,training_completed_on,training_valid_until,training_evidence_storage_path,training_evidence_file_name,department,completed_by,created_at").eq("tenant_id", t.data).eq("training_category", "certification").eq("status", "completed").order("created_at", { ascending: false })
      ]);
      if (d.error) throw d.error;
      if (e.error) throw e.error;
      if (r.error) throw r.error;
      setDocs((d.data || []) as Doc[]);
      setEmployees((e.data || []) as Employee[]);
      setRecords((r.data || []) as RecordRow[]);
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load certifications.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const docMap = useMemo(() => new Map(docs.map(d => [d.id, d])), [docs]);
  const employeeMap = useMemo(() => new Map(employees.map(e => [e.user_email.toLowerCase(), e])), [employees]);
  const selectedDoc = docs.find(d => d.id === documentId);
  const filtered = records.filter(r => {
    const d = r.document_id ? docMap.get(r.document_id) : null;
    const person = employeeMap.get(r.assigned_to_email.toLowerCase());
    return [r.assigned_to_email, person?.full_name, r.training_title, d?.document_number, d?.revision, d?.title]
      .some(x => String(x || "").toLowerCase().includes(search.toLowerCase()));
  });

  const register = async () => {
    if (!coordinator || !tenant || saving) return;
    const doc = docs.find(d => d.id === documentId);
    const person = employees.find(e => e.user_email.toLowerCase() === employeeEmail.toLowerCase());
    if (!doc || !released(doc.status)) { alert("Select a currently released SOP revision."); return; }
    if (!person) { alert("Select an active employee."); return; }
    if (!date || !evidence) { alert("Certification date and approved signed form are required."); return; }
    if (expiry && expiry < date) { alert("Expiration cannot precede certification."); return; }
    if (evidence.size > 10485760 || !/\.pdf$/i.test(evidence.name)) { alert("Upload an approved signed PDF form (maximum 10 MB)."); return; }
    setSaving(true);
    let uploadedPath: string | null = null;
    let createdId: string | null = null;
    try {
      const check = await supabase.from("controlled_documents").select("id,status,tenant_id").eq("id", doc.id).eq("tenant_id", tenant).maybeSingle();
      if (check.error || !check.data || !released(check.data.status)) throw new Error("This SOP revision is no longer released.");
      const id = crypto.randomUUID();
      // Storage RLS requires the matching assignment row to exist before upload.
      // Keep the row incomplete until signed evidence has been uploaded successfully.
      const pending = await supabase.from("training_assignments").insert({
        id, tenant_id: tenant, document_id: doc.id, assigned_to_email: person.user_email.toLowerCase(),
        assigned_by_email: email, assignment_source: "certification_register",
        training_category: "certification", training_title: title.trim() || `Certification: ${doc.document_number} Rev ${doc.revision}`,
        training_description: comments.trim() || null, department: person.department, role_name: person.role_name,
        status: "assigned", training_completed_on: null, training_valid_until: expiry || null,
        completed_at: null, completed_by: null,
        effectiveness_required: false, effectiveness_status: "not_required",
        acknowledgement_required: false, supervisor_verification_required: false
      });
      if (pending.error) throw pending.error;
      createdId = id;
      uploadedPath = `${tenant}/${id}/${crypto.randomUUID()}.pdf`;
      const upload = await supabase.storage.from("training-completion-evidence").upload(uploadedPath, evidence, { upsert: false, contentType: "application/pdf" });
      if (upload.error) throw upload.error;
      const completed = await supabase.from("training_assignments").update({
        status: "completed", training_completed_on: date,
        training_evidence_storage_path: uploadedPath, training_evidence_file_name: evidence.name,
        completed_at: new Date().toISOString(), completed_by: email
      }).eq("id", id).eq("tenant_id", tenant).select("id").single();
      if (completed.error) throw completed.error;
      createdId = null;
      setDocumentId(""); setEmployeeEmail(""); setTitle(""); setDate(""); setExpiry(""); setComments(""); setEvidence(null);
      await load();
      alert("Approved certification registered.");
    } catch (err: unknown) {
      if (uploadedPath) await supabase.storage.from("training-completion-evidence").remove([uploadedPath]);
      if (createdId) {
        const cleanup = await supabase.from("training_assignments").delete().eq("id", createdId).eq("tenant_id", tenant);
        if (cleanup.error) {
          alert("Registration failed and a pending record could not be removed. Please contact the administrator. " + cleanup.error.message);
        }
      }
      alert(err instanceof Error ? err.message : "Could not register certification.");
    } finally { setSaving(false); }
  };

  const openEvidence = async (path: string) => {
    const result = await supabase.storage.from("training-completion-evidence").createSignedUrl(path, 60);
    if (result.error || !result.data?.signedUrl) { alert(result.error?.message || "Evidence unavailable."); return; }
    window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return <main style={{ maxWidth: 1160, margin: "24px auto", padding: 20 }}>
    <Link href="/training">← Training</Link>
    <h1>Certification Register</h1>
    <p>Approved individual certifications by employee and controlled SOP revision. Historical revisions remain visible.</p>
    {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
    {coordinator && <section style={box}>
      <h2>Register approved certification</h2>
      <p>Register approved, externally signed certifications only. Completed registrations are read-only; corrections must preserve an audit trail.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
        <label style={label}>Released SOP<select style={field} value={documentId} onChange={e => setDocumentId(e.target.value)}><option value="">Select SOP</option>{docs.filter(d => released(d.status)).map(d => <option key={d.id} value={d.id}>{d.document_number} Rev {d.revision} — {d.title}</option>)}</select></label>
        <label style={label}>Description<input style={field} value={selectedDoc?.title || ""} readOnly /></label>
        <label style={label}>Revision<input style={field} value={selectedDoc?.revision || ""} readOnly /></label>
        <label style={label}>Employee<select style={field} value={employeeEmail} onChange={e => setEmployeeEmail(e.target.value)}><option value="">Select employee</option>{employees.map(e => <option key={e.user_email} value={e.user_email}>{e.user_email}</option>)}</select></label>
        <label style={label}>Certification Title (optional)<input style={field} value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label style={label}>Certification Date<input style={field} type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label style={label}>Expiration Date (optional)<input style={field} type="date" value={expiry} onChange={e => setExpiry(e.target.value)} /></label>
        <label style={label}>Approved Certification Form (PDF)<input style={field} type="file" accept=".pdf,application/pdf" onChange={e => setEvidence(e.target.files?.[0] || null)} /></label>
      </div>
      <label style={label}>Comments (optional)<textarea style={field} value={comments} onChange={e => setComments(e.target.value)} /></label>
      <button type="button" disabled={saving} onClick={register} style={{ padding: "10px 18px" }}>{saving ? "Registering..." : "Register Certification"}</button>
    </section>}
    <section style={box}>
      <h2>Registered Certifications — Read Only</h2>
      <label style={label}>Search employee, SOP number, revision, or title<input style={field} value={search} onChange={e => setSearch(e.target.value)} placeholder="e.g. SOP-0001 or Rev A" /></label>
      {loading ? <p>Loading...</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}><thead><tr>{["Released SOP","Description","Revision","Employee","Certification Title","Certification Date","Expiration Date","Approved Form","Comments","Action"].map(h => <th key={h} style={{ padding: 8, borderBottom: "1px solid #aaa" }}>{h}</th>)}</tr></thead><tbody>
        {filtered.map(r => { const d = r.document_id ? docMap.get(r.document_id) : null; return <tr key={r.id}>
          <td style={{ padding: 8 }}>{d?.document_number || "—"}</td>
          <td style={{ padding: 8 }}>{d?.title || "—"}</td>
          <td style={{ padding: 8 }}>{d?.revision || "—"}</td>
          <td style={{ padding: 8 }}>{r.assigned_to_email}</td>
          <td style={{ padding: 8 }}>{r.training_title || "—"}</td>
          <td style={{ padding: 8 }}>{r.training_completed_on || "—"}</td>
          <td style={{ padding: 8 }}>{r.training_valid_until || "—"}</td>
          <td style={{ padding: 8 }}>{r.training_evidence_storage_path ? <button type="button" onClick={() => void openEvidence(r.training_evidence_storage_path!)}>View Signed Form</button> : "Not attached"}</td>
          <td style={{ padding: 8 }}>{r.training_description || "—"}</td>
          <td style={{ padding: 8 }}><Link href={`/training/${r.id}`}>Open Record</Link></td>
        </tr>; })}
        {!filtered.length && <tr><td colSpan={10} style={{ padding: 12 }}>No completed certification records match.</td></tr>}
      </tbody></table></div>}
    </section>
  </main>;
}
