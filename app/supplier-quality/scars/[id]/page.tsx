"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function ScarDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [scar, setScar] = useState<any>(null);
  const [supplier, setSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rootCause, setRootCause] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [supplierResponse, setSupplierResponse] = useState("");
  const [effectivenessVerification, setEffectivenessVerification] = useState("");
  const [status, setStatus] = useState("open");

  const fetchScar = async () => {
    const { data, error } = await supabase.from("scars").select("*").eq("id", id).maybeSingle();
    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setScar(data);
    setRootCause(data?.root_cause || "");
    setCorrectiveAction(data?.corrective_action || "");
    setSupplierResponse(data?.supplier_response || "");
    setEffectivenessVerification(data?.effectiveness_verification || "");
    setStatus(data?.status || "open");

    if (data?.supplier_id) {
      const supplierRes = await supabase.from("suppliers").select("*").eq("id", data.supplier_id).maybeSingle();
      if (!supplierRes.error) setSupplier(supplierRes.data || null);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (id) fetchScar();
  }, [id]);

  const saveScar = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { error } = await supabase
      .from("scars")
      .update({
        root_cause: rootCause,
        corrective_action: correctiveAction,
        supplier_response: supplierResponse,
        effectiveness_verification: effectivenessVerification,
        status,
        supplier_response_date: supplierResponse ? new Date().toISOString() : scar.supplier_response_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return alert(error.message);

    await supabase.from("audit_logs").insert({
      entity_type: "scar",
      entity_id: id,
      action: "scar_updated",
      details: `SCAR updated. Status: ${status}`,
      user_email: userEmail,
    });

    alert("SCAR saved.");
    fetchScar();
  };

  const closeScar = async () => {
    if (!rootCause || !correctiveAction || !effectivenessVerification) {
      alert("Root cause, corrective action, and effectiveness verification are required before closure.");
      return;
    }

    if (!window.confirm("Close this SCAR with electronic signature confirmation?")) return;

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { error } = await supabase
      .from("scars")
      .update({
        root_cause: rootCause,
        corrective_action: correctiveAction,
        supplier_response: supplierResponse,
        effectiveness_verification: effectivenessVerification,
        status: "closed",
        closed_by: userEmail,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return alert(error.message);

    await supabase.from("audit_logs").insert({
      entity_type: "scar",
      entity_id: id,
      action: "scar_closed",
      details: "SCAR closed with electronic signature confirmation.",
      user_email: userEmail,
    });

    alert("SCAR closed.");
    fetchScar();
  };

  if (loading) return <main style={{ padding: "24px" }}>Loading SCAR...</main>;
  if (!scar) return <main style={{ padding: "24px" }}>SCAR not found.</main>;

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <h1>{scar.scar_number || "SCAR"} — {scar.title}</h1>
        <Link href="/supplier-quality/scars">Back to SCARs</Link>
      </div>

      <section style={sectionStyle}>
        <h2>SCAR Summary</h2>
        <Field label="Supplier" value={scar.supplier_name} />
        <Field label="Supplier Status" value={supplier?.supplier_status} />
        <Field label="Supplier Risk" value={supplier?.supplier_risk_level} />
        <Field label="Linked NCMR" value={scar.linked_ncmr_number} />
        <Field label="Severity" value={scar.severity} />
        <Field label="Risk Level" value={scar.risk_level} />
        <Field label="Status" value={scar.status} />
        <Field label="Due Date" value={scar.due_date} />
        {scar.linked_ncmr_id ? <p><Link href={`/ncmrs/${scar.linked_ncmr_id}`}>Open Linked NCMR</Link></p> : null}
        {scar.supplier_id ? <p><Link href={`/suppliers/${scar.supplier_id}`}>Open Supplier Profile</Link></p> : null}
      </section>

      <section style={sectionStyle}>
        <h2>Supplier Issue</h2>
        <Field label="Description" value={scar.description} />
        <Field label="Issue Summary" value={scar.issue_summary} />
      </section>

      <section style={sectionStyle}>
        <h2>Supplier Response / Corrective Action</h2>
        <label>Supplier Response</label><br />
        <textarea value={supplierResponse} onChange={(e) => setSupplierResponse(e.target.value)} rows={5} style={textareaStyle} />
        <br />
        <label>Root Cause</label><br />
        <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={5} style={textareaStyle} />
        <br />
        <label>Corrective Action</label><br />
        <textarea value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} rows={5} style={textareaStyle} />
        <br />
        <label>Effectiveness Verification</label><br />
        <textarea value={effectivenessVerification} onChange={(e) => setEffectivenessVerification(e.target.value)} rows={5} style={textareaStyle} />
        <br />
        <label>Status</label><br />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
          <option value="open">Open</option>
          <option value="supplier_response_pending">Supplier Response Pending</option>
          <option value="quality_review">Quality Review</option>
          <option value="effectiveness_check">Effectiveness Check</option>
          <option value="closed">Closed</option>
        </select>
        <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
          <button onClick={saveScar}>Save SCAR</button>
          <button onClick={closeScar}>Close SCAR</button>
        </div>
      </section>
    </main>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return <div style={{ marginBottom: "8px" }}><strong>{label}:</strong> {value || "N/A"}</div>;
}

const sectionStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: "10px", padding: "14px", marginBottom: "20px" };
const inputStyle: React.CSSProperties = { padding: "8px", width: "100%", maxWidth: "700px" };
const textareaStyle: React.CSSProperties = { padding: "8px", width: "100%", maxWidth: "900px", marginBottom: "12px" };
