"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function SupplierAuditsPage() {
  const params = useParams<{ id: string }>();
  const supplierId = params.id;

  const [supplier, setSupplier] = useState<any>(null);
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [auditTitle, setAuditTitle] = useState("");
  const [auditType, setAuditType] = useState("surveillance");
  const [auditMethod, setAuditMethod] = useState("remote");
  const [plannedAuditDate, setPlannedAuditDate] = useState("");
  const [leadAuditor, setLeadAuditor] = useState("");
  const [auditScope, setAuditScope] = useState("");

  const fetchData = async () => {
    setLoading(true);

    const supplierRes = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", supplierId)
      .maybeSingle();

    if (supplierRes.error) {
      alert(supplierRes.error.message);
      setLoading(false);
      return;
    }

    setSupplier(supplierRes.data);

    const auditRes = await supabase
      .from("supplier_audits")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });

    if (auditRes.error) {
      alert(auditRes.error.message);
      setLoading(false);
      return;
    }

    setAudits(auditRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (supplierId) fetchData();
  }, [supplierId]);

  const createAudit = async () => {
    if (!auditTitle.trim()) {
      alert("Audit title is required.");
      return;
    }

    if (!plannedAuditDate) {
      alert("Planned audit date is required.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { data, error } = await supabase
      .from("supplier_audits")
      .insert({
        supplier_id: supplierId,
        audit_title: auditTitle,
        audit_type: auditType,
        audit_method: auditMethod,
        planned_audit_date: plannedAuditDate,
        lead_auditor: leadAuditor,
        audit_scope: auditScope,
        audit_status: "planned",
        created_by: userEmail,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: "supplier_audit",
      entity_id: data.id,
      action: "supplier_audit_created",
      details: `Supplier audit created for ${supplier?.supplier_name || "supplier"}.`,
      user_email: userEmail,
    });

    alert("Supplier audit created.");
    setAuditTitle("");
    setAuditType("surveillance");
    setAuditMethod("remote");
    setPlannedAuditDate("");
    setLeadAuditor("");
    setAuditScope("");
    fetchData();
  };

  if (loading) {
    return <main style={{ padding: "24px", fontFamily: "Arial" }}>Loading supplier audits...</main>;
  }

  if (!supplier) {
    return <main style={{ padding: "24px", fontFamily: "Arial" }}>Supplier not found.</main>;
  }

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <h1>Supplier Audits — {supplier.supplier_name}</h1>
        <div>
          <Link href={`/suppliers/${supplierId}`} style={{ marginRight: "12px" }}>Supplier Profile</Link>
          <Link href="/supplier-quality/scorecards">Scorecards</Link>
        </div>
      </div>

      <section style={sectionStyle}>
        <h2>Create Supplier Audit</h2>

        <Field label="Audit Title">
          <input value={auditTitle} onChange={(e) => setAuditTitle(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Audit Type">
          <select value={auditType} onChange={(e) => setAuditType(e.target.value)} style={inputStyle}>
            <option value="qualification">Qualification</option>
            <option value="surveillance">Surveillance</option>
            <option value="for_cause">For Cause</option>
            <option value="requalification">Requalification</option>
          </select>
        </Field>

        <Field label="Audit Method">
          <select value={auditMethod} onChange={(e) => setAuditMethod(e.target.value)} style={inputStyle}>
            <option value="remote">Remote</option>
            <option value="onsite">Onsite</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </Field>

        <Field label="Planned Audit Date">
          <input type="date" value={plannedAuditDate} onChange={(e) => setPlannedAuditDate(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Lead Auditor">
          <input value={leadAuditor} onChange={(e) => setLeadAuditor(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Audit Scope">
          <textarea value={auditScope} onChange={(e) => setAuditScope(e.target.value)} rows={4} style={textareaStyle} />
        </Field>

        <button onClick={createAudit}>Create Audit</button>
      </section>

      <section style={sectionStyle}>
        <h2>Supplier Audit History</h2>

        {audits.length === 0 ? (
          <p>No supplier audits recorded.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Audit Title</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Method</th>
                <th style={thStyle}>Planned Date</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Result</th>
                <th style={thStyle}>Score</th>
                <th style={thStyle}>Open</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.id}>
                  <td style={tdStyle}>{audit.audit_title || "Untitled"}</td>
                  <td style={tdStyle}>{audit.audit_type || "N/A"}</td>
                  <td style={tdStyle}>{audit.audit_method || "N/A"}</td>
                  <td style={tdStyle}>{audit.planned_audit_date || "N/A"}</td>
                  <td style={tdStyle}>{audit.audit_status || "planned"}</td>
                  <td style={tdStyle}>{audit.audit_result || "N/A"}</td>
                  <td style={tdStyle}>{audit.compliance_score ?? "N/A"}</td>
                  <td style={tdStyle}>
                    <Link href={`/suppliers/${supplierId}/audits/${audit.id}`}>Open Audit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label>{label}</label><br />
      {children}
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "20px",
};

const inputStyle: React.CSSProperties = {
  padding: "8px",
  width: "100%",
  maxWidth: "700px",
};

const textareaStyle: React.CSSProperties = {
  padding: "8px",
  width: "100%",
  maxWidth: "800px",
};

const thStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px",
  background: "#f3f4f6",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px",
};
