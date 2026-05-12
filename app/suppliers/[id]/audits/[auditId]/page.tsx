"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";

export default function SupplierAuditDetailPage() {
  const params = useParams<{ id: string; auditId: string }>();
  const supplierId = params.id;
  const auditId = params.auditId;

  const [supplier, setSupplier] = useState<any>(null);
  const [audit, setAudit] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [auditStatus, setAuditStatus] = useState("planned");
  const [actualAuditDate, setActualAuditDate] = useState("");
  const [auditResult, setAuditResult] = useState("");
  const [complianceScore, setComplianceScore] = useState("");
  const [auditSummary, setAuditSummary] = useState("");

  const [findingTitle, setFindingTitle] = useState("");
  const [findingDescription, setFindingDescription] = useState("");
  const [findingType, setFindingType] = useState("observation");
  const [requirementReference, setRequirementReference] = useState("");
  const [findingDueDate, setFindingDueDate] = useState("");
  const [escalateToScar, setEscalateToScar] = useState(false);

  const fetchData = async () => {
    setLoading(true);

    const supplierRes = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", supplierId)
      .maybeSingle();

    if (!supplierRes.error) setSupplier(supplierRes.data || null);

    const auditRes = await supabase
      .from("supplier_audits")
      .select("*")
      .eq("id", auditId)
      .maybeSingle();

    if (auditRes.error) {
      alert(auditRes.error.message);
      setLoading(false);
      return;
    }

    setAudit(auditRes.data);
    setAuditStatus(auditRes.data?.audit_status || "planned");
    setActualAuditDate(auditRes.data?.actual_audit_date || "");
    setAuditResult(auditRes.data?.audit_result || "");
    setComplianceScore(
      auditRes.data?.compliance_score !== null && auditRes.data?.compliance_score !== undefined
        ? String(auditRes.data.compliance_score)
        : ""
    );
    setAuditSummary(auditRes.data?.audit_summary || "");

    const findingsRes = await supabase
      .from("supplier_audit_findings")
      .select("*")
      .eq("audit_id", auditId)
      .order("created_at", { ascending: true });

    if (!findingsRes.error) setFindings(findingsRes.data || []);

    setLoading(false);
  };

  useEffect(() => {
    if (auditId) fetchData();
  }, [auditId]);

  const addAuditLog = async (action: string, details: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    await supabase.from("audit_logs").insert({
      entity_type: "supplier_audit",
      entity_id: auditId,
      action,
      details,
      user_email: userEmail,
    });
  };

  const saveAudit = async () => {
    const { error } = await supabase
      .from("supplier_audits")
      .update({
        audit_status: auditStatus,
        actual_audit_date: actualAuditDate || null,
        audit_result: auditResult || null,
        compliance_score: complianceScore ? Number(complianceScore) : null,
        audit_summary: auditSummary || null,
      })
      .eq("id", auditId);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("supplier_audit_saved", "Supplier audit workflow fields saved.");
    alert("Supplier audit saved.");
    fetchData();
  };

  const addFinding = async () => {
    if (!findingTitle.trim()) {
      alert("Finding title is required.");
      return;
    }

    if (!findingDescription.trim()) {
      alert("Finding description is required.");
      return;
    }

    const { data: findingData, error } = await supabase
      .from("supplier_audit_findings")
      .insert({
        audit_id: auditId,
        finding_title: findingTitle,
        finding_description: findingDescription,
        finding_type: findingType,
        requirement_reference: requirementReference,
        due_date: findingDueDate || null,
        escalation_to_scar: escalateToScar,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    if (escalateToScar) {
      const { data: scarData, error: scarError } = await supabase
        .from("scars")
        .insert({
          supplier_id: supplierId,
          supplier_name: supplier?.supplier_name || null,
          title: `SCAR from supplier audit finding: ${findingTitle}`,
          description: findingDescription,
          severity: findingType === "critical" ? "critical" : findingType === "major" ? "major" : "minor",
          risk_level: findingType === "critical" ? "critical" : findingType === "major" ? "high" : "medium",
          issue_summary: findingDescription,
          due_date: findingDueDate || null,
          response_due_date: findingDueDate || null,
          status: "supplier_response_pending",
          assigned_supplier_contact: supplier?.primary_contact_email || null,
        })
        .select()
        .single();

      if (scarError) {
        alert(scarError.message);
        return;
      }

      await supabase
        .from("supplier_audit_findings")
        .update({
          scar_id: scarData.id,
        })
        .eq("id", findingData.id);

      await supabase
        .from("supplier_audits")
        .update({
          escalation_to_scar: true,
          scar_required: true,
          scar_id: scarData.id,
        })
        .eq("id", auditId);
    }

    await addAuditLog(
      "supplier_audit_finding_added",
      `Finding added: ${findingTitle}. Escalated to SCAR: ${escalateToScar ? "Yes" : "No"}.`
    );

    alert("Finding added.");
    setFindingTitle("");
    setFindingDescription("");
    setFindingType("observation");
    setRequirementReference("");
    setFindingDueDate("");
    setEscalateToScar(false);
    fetchData();
  };

  const closeAudit = async () => {
    if (!auditSummary.trim()) {
      alert("Audit summary is required before closure.");
      return;
    }

    if (!auditResult) {
      alert("Audit result is required before closure.");
      return;
    }

    const confirmed = window.confirm("Close this supplier audit?");
    if (!confirmed) return;

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { error } = await supabase
      .from("supplier_audits")
      .update({
        audit_status: "closed",
        audit_result: auditResult,
        compliance_score: complianceScore ? Number(complianceScore) : null,
        audit_summary: auditSummary,
        closed_by: userEmail,
        closed_at: new Date().toISOString(),
      })
      .eq("id", auditId);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("supplier_audit_closed", "Supplier audit closed.");
    alert("Supplier audit closed.");
    fetchData();
  };

  if (loading) return <main style={{ padding: "24px", fontFamily: "Arial" }}>Loading supplier audit...</main>;
  if (!audit) return <main style={{ padding: "24px", fontFamily: "Arial" }}>Supplier audit not found.</main>;

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <h1>Supplier Audit — {audit.audit_title || "Untitled Audit"}</h1>
        <div>
          <button onClick={() => window.print()} style={{ marginRight: "12px" }}>Print / Save PDF</button>
          <Link href={`/suppliers/${supplierId}/audits`}>Back to Supplier Audits</Link>
        </div>
      </div>

      <section style={sectionStyle}>
        <h2>Audit Summary</h2>
        <Field label="Supplier" value={supplier?.supplier_name} />
        <Field label="Audit Type" value={audit.audit_type} />
        <Field label="Audit Method" value={audit.audit_method} />
        <Field label="Planned Audit Date" value={audit.planned_audit_date} />
        <Field label="Lead Auditor" value={audit.lead_auditor} />
        <Field label="Audit Scope" value={audit.audit_scope} />
        <Field label="Created By" value={audit.created_by} />
      </section>

      <section style={sectionStyle}>
        <h2>Audit Execution</h2>

        <FieldInput label="Actual Audit Date">
          <input type="date" value={actualAuditDate} onChange={(e) => setActualAuditDate(e.target.value)} style={inputStyle} />
        </FieldInput>

        <FieldInput label="Audit Status">
          <select value={auditStatus} onChange={(e) => setAuditStatus(e.target.value)} style={inputStyle}>
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
            <option value="supplier_response_pending">Supplier Response Pending</option>
            <option value="quality_review">Quality Review</option>
            <option value="closed">Closed</option>
          </select>
        </FieldInput>

        <FieldInput label="Audit Result">
          <select value={auditResult} onChange={(e) => setAuditResult(e.target.value)} style={inputStyle}>
            <option value="">Select result</option>
            <option value="satisfactory">Satisfactory</option>
            <option value="conditional">Conditional</option>
            <option value="unsatisfactory">Unsatisfactory</option>
          </select>
        </FieldInput>

        <FieldInput label="Compliance Score">
          <input type="number" value={complianceScore} onChange={(e) => setComplianceScore(e.target.value)} style={inputStyle} />
        </FieldInput>

        <FieldInput label="Audit Summary">
          <textarea value={auditSummary} onChange={(e) => setAuditSummary(e.target.value)} rows={5} style={textareaStyle} />
        </FieldInput>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={saveAudit}>Save Audit</button>
          <button onClick={closeAudit}>Close Audit</button>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Add Audit Finding</h2>

        <FieldInput label="Finding Title">
          <input value={findingTitle} onChange={(e) => setFindingTitle(e.target.value)} style={inputStyle} />
        </FieldInput>

        <FieldInput label="Finding Type">
          <select value={findingType} onChange={(e) => setFindingType(e.target.value)} style={inputStyle}>
            <option value="observation">Observation</option>
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </select>
        </FieldInput>

        <FieldInput label="Requirement Reference">
          <input value={requirementReference} onChange={(e) => setRequirementReference(e.target.value)} style={inputStyle} />
        </FieldInput>

        <FieldInput label="Finding Description">
          <textarea value={findingDescription} onChange={(e) => setFindingDescription(e.target.value)} rows={4} style={textareaStyle} />
        </FieldInput>

        <FieldInput label="Due Date">
          <input type="date" value={findingDueDate} onChange={(e) => setFindingDueDate(e.target.value)} style={inputStyle} />
        </FieldInput>

        <label>
          <input
            type="checkbox"
            checked={escalateToScar}
            onChange={(e) => setEscalateToScar(e.target.checked)}
          />{" "}
          Escalate this finding to SCAR
        </label>

        <div style={{ marginTop: "12px" }}>
          <button onClick={addFinding}>Add Finding</button>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Audit Findings</h2>

        {findings.length === 0 ? (
          <p>No findings recorded.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {findings.map((finding) => (
              <div key={finding.id} style={findingCardStyle(finding.finding_type)}>
                <h3 style={{ marginTop: 0 }}>{finding.finding_title}</h3>
                <Field label="Type" value={finding.finding_type} />
                <Field label="Requirement Reference" value={finding.requirement_reference} />
                <Field label="Description" value={finding.finding_description} />
                <Field label="Due Date" value={finding.due_date} />
                <Field label="Supplier Response" value={finding.supplier_response} />
                <Field label="Corrective Action" value={finding.corrective_action} />
                <Field label="Effectiveness Verified" value={finding.effectiveness_verified ? "Yes" : "No"} />
                <Field label="Escalated to SCAR" value={finding.escalation_to_scar ? "Yes" : "No"} />
                {finding.scar_id ? (
                  <Link href={`/supplier-quality/scars/${finding.scar_id}`}>Open Linked SCAR</Link>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <style jsx global>{`
        @media print {
          .no-print button,
          .no-print a {
            display: none !important;
          }

          body {
            color: black;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          section {
            page-break-inside: avoid;
          }
        }

        @page {
          margin: 0.75in;
        }
      `}</style>
    </main>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return <div style={{ marginBottom: "8px" }}><strong>{label}:</strong> {value || "N/A"}</div>;
}

function FieldInput({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: "12px" }}><label>{label}</label><br />{children}</div>;
}

function findingCardStyle(type: string): React.CSSProperties {
  return {
    border:
      type === "critical"
        ? "1px solid #ef4444"
        : type === "major"
        ? "1px solid #f59e0b"
        : "1px solid #d1d5db",
    background:
      type === "critical"
        ? "#fef2f2"
        : type === "major"
        ? "#fffbeb"
        : "#f9fafb",
    borderRadius: "10px",
    padding: "12px",
  };
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
  maxWidth: "900px",
};
