"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function AuditReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [audit, setAudit] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);

  useEffect(() => {
    const fetchReport = async () => {
      const auditRes = await supabase
        .from("audits")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      const findingRes = await supabase
        .from("audit_findings")
        .select("*")
        .eq("audit_id", id)
        .order("created_at", { ascending: true });

      if (auditRes.error) alert(auditRes.error.message);
      if (findingRes.error) alert(findingRes.error.message);

      setAudit(auditRes.data);
      setFindings(findingRes.data || []);
    };

    if (id) fetchReport();
  }, [id]);

  if (!audit) {
    return <main style={{ padding: "20px" }}>Loading audit report...</main>;
  }

  return (
    <main style={{ padding: "30px", fontFamily: "Arial, sans-serif" }}>
      <button onClick={() => window.print()} className="no-print">
        Print / Save as PDF
      </button>

      <h1>Audit Report</h1>

      <h2>Audit Summary</h2>
      <p><strong>Audit Number:</strong> {audit.audit_number}</p>
      <p><strong>Audit Title:</strong> {audit.audit_title}</p>
      <p><strong>Audit Type:</strong> {audit.audit_type}</p>
      <p><strong>Scope:</strong> {audit.audit_scope}</p>
      <p><strong>Auditor:</strong> {audit.auditor}</p>
      <p><strong>Audit Date:</strong> {audit.audit_date}</p>
      <p><strong>Status:</strong> {audit.status}</p>
      <p><strong>Created At:</strong> {audit.created_at}</p>

      <h2>Findings Summary</h2>
      <p><strong>Total Findings:</strong> {findings.length}</p>
      <p><strong>Minor Findings:</strong> {findings.filter((f) => f.finding_severity === "minor").length}</p>
      <p><strong>Major Findings:</strong> {findings.filter((f) => f.finding_severity === "major").length}</p>
      <p><strong>Critical Findings:</strong> {findings.filter((f) => f.finding_severity === "critical").length}</p>
      <p><strong>CAPA Required Findings:</strong> {findings.filter((f) => f.capa_required).length}</p>
      <p><strong>Open Findings:</strong> {findings.filter((f) => f.finding_status !== "closed").length}</p>
      <p><strong>Closed Findings:</strong> {findings.filter((f) => f.finding_status === "closed").length}</p>

      <h2>Audit Findings</h2>

      {findings.length === 0 ? (
        <p>No findings recorded.</p>
      ) : (
        findings.map((finding) => (
          <section
            key={finding.id}
            style={{
              border: "1px solid #ccc",
              padding: "12px",
              marginBottom: "12px",
            }}
          >
            <h3>{finding.finding_title}</h3>
            <p><strong>Description:</strong> {finding.finding_description}</p>
            <p><strong>Severity:</strong> {finding.finding_severity}</p>
            <p><strong>Clause / Requirement:</strong> {finding.clause_reference}</p>
            <p><strong>Evidence:</strong> {finding.evidence}</p>
            <p><strong>CAPA Required:</strong> {finding.capa_required ? "Yes" : "No"}</p>
            <p><strong>Linked CAPA ID:</strong> {finding.capa_id || "N/A"}</p>
            <p><strong>Status:</strong> {finding.finding_status}</p>
            <p><strong>Closed At:</strong> {finding.closed_at || "N/A"}</p>
          </section>
        ))
      )}

      <h2>Audit Closure / Electronic Signature</h2>
      <p><strong>Closed By:</strong> {audit.closed_by || "N/A"}</p>
      <p><strong>Closed At:</strong> {audit.closed_at || "N/A"}</p>
      <p><strong>Signed By:</strong> {audit.signed_by || "N/A"}</p>
      <p><strong>Signed At:</strong> {audit.signed_at || "N/A"}</p>
      <p><strong>Signature Email Entered:</strong> {audit.signature_email_entered || "N/A"}</p>
      <p><strong>Signature Meaning:</strong> {audit.signature_meaning || "N/A"}</p>

      <div className="no-print">
        <a href="/audits">Back to Audits</a>
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none;
          }
          body {
            color: black;
          }
        }
      `}</style>
    </main>
  );
}
