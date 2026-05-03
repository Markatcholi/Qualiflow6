"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function AuditReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [audit, setAudit] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

      if (auditRes.error) {
        alert(auditRes.error.message);
        setLoading(false);
        return;
      }

      if (findingRes.error) {
        alert(findingRes.error.message);
        setLoading(false);
        return;
      }

      setAudit(auditRes.data);
      setFindings(findingRes.data || []);

      const logRes = await supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_id", id)
        .order("created_at", { ascending: true });

      if (!logRes.error) setAuditLogs(logRes.data || []);

      setLoading(false);
    };

    if (id) fetchReport();
  }, [id]);

  if (loading) return <main style={{ padding: "20px" }}>Loading audit report...</main>;
  if (!audit) return <main style={{ padding: "20px" }}>Audit record not found.</main>;

  return (
    <main style={pageStyle}>
      <div className="no-print" style={{ marginBottom: "18px" }}>
        <button onClick={() => window.print()} style={{ padding: "8px 12px", marginRight: "10px" }}>
          Print / Save as PDF
        </button>
        <a href="/audits">Back to Audits</a>
      </div>

      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Audit Full Controlled Record</h1>
          <div><strong>Audit Number:</strong> {displayValue(audit.audit_number || "AUD-PENDING")}</div>
          <div><strong>Record ID:</strong> {displayValue(audit.id)}</div>
          <div><strong>Status:</strong> {displayValue(audit.status)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div><strong>Generated:</strong> {new Date().toISOString()}</div>
          <div><strong>QMS Record Type:</strong> Audit Report</div>
          <div><strong>Print Use:</strong> Audit / controlled record review</div>
        </div>
      </header>

      <section style={sectionStyle}>
        <h2>1. Audit Initiation / Identification</h2>
        <div style={gridStyle}>
          <Field label="Audit Number" value={audit.audit_number} />
          <Field label="Audit Title" value={audit.audit_title} />
          <Field label="Audit Type" value={audit.audit_type} />
          <Field label="Audit Scope" value={audit.audit_scope} />
          <Field label="Auditor" value={audit.auditor} />
          <Field label="Audit Date" value={audit.audit_date} />
          <Field label="Status" value={audit.status} />
          <Field label="Created At" value={audit.created_at} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>2. Findings Summary</h2>
        <div style={gridStyle}>
          <Field label="Total Findings" value={findings.length} />
          <Field label="Minor Findings" value={findings.filter((f) => f.finding_severity === "minor").length} />
          <Field label="Major Findings" value={findings.filter((f) => f.finding_severity === "major").length} />
          <Field label="Critical Findings" value={findings.filter((f) => f.finding_severity === "critical").length} />
          <Field label="CAPA Required Findings" value={findings.filter((f) => f.capa_required).length} />
          <Field label="Open Findings" value={findings.filter((f) => f.finding_status !== "closed").length} />
          <Field label="Closed Findings" value={findings.filter((f) => f.finding_status === "closed").length} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>3. Audit Findings / Evidence / CAPA Linkage</h2>
        {findings.length === 0 ? (
          <p>No findings recorded.</p>
        ) : (
          findings.map((finding, index) => (
            <section key={finding.id} style={{ ...sectionStyle, marginTop: "10px" }}>
              <h3>Finding {index + 1}: {finding.finding_title}</h3>
              <Field label="Finding Description" value={finding.finding_description} />
              <Field label="Severity" value={finding.finding_severity} />
              <Field label="Clause / Requirement Reference" value={finding.clause_reference} />
              <Field label="Evidence" value={finding.evidence} />
              <Field label="CAPA Required" value={finding.capa_required ? "Yes" : "No"} />
              <Field label="Linked CAPA ID" value={finding.capa_id} />
              <Field label="Finding Status" value={finding.finding_status} />
              <Field label="Closed At" value={finding.closed_at} />
              <Field label="Created At" value={finding.created_at} />
            </section>
          ))
        )}
      </section>

      <section style={sectionStyle}>
        <h2>4. Audit Closure / Electronic Signature</h2>
        <div style={signatureStyle}>
          <Field label="Closed By" value={audit.closed_by} />
          <Field label="Closed At" value={audit.closed_at} />
          <Field label="Signed By" value={audit.signed_by} />
          <Field label="Signed At" value={audit.signed_at} />
          <Field label="Signature Email Entered" value={audit.signature_email_entered} />
          <Field label="Signature Meaning" value={audit.signature_meaning} />
          <Field label="Authentication Method" value="Active authenticated session with email re-entry confirmation" />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>5. Audit Trail Summary</h2>
        {auditLogs.length === 0 ? (
          <p>No audit log entries found for this audit report.</p>
        ) : (
          auditLogs.map((log) => (
            <div key={log.id} style={{ borderTop: "1px solid #ddd", paddingTop: "8px", marginTop: "8px" }}>
              <Field label="Date / Time" value={log.created_at} />
              <Field label="User" value={log.user_email} />
              <Field label="Action" value={log.action} />
              <Field label="Details" value={log.details} />
            </div>
          ))
        )}
      </section>

      <footer className="print-footer">
        Audit Controlled Record | {audit.audit_number || audit.id} | Generated {new Date().toISOString()}
      </footer>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }

          body {
            color: black;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          main {
            padding: 18px !important;
          }

          section {
            page-break-inside: avoid;
          }

          .print-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            font-size: 10px;
            border-top: 1px solid #999;
            padding: 6px 20px;
            background: white;
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
  return (
    <div style={{ marginBottom: "8px" }}>
      <strong>{label}:</strong> {displayValue(value)}
    </div>
  );
}

function displayValue(input: any) {
  return input === null || input === undefined || input === "" ? "N/A" : String(input);
}

const pageStyle: React.CSSProperties = {
  padding: "36px",
  fontFamily: "Arial, sans-serif",
  color: "#111",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  borderBottom: "2px solid #111",
  paddingBottom: "14px",
  marginBottom: "18px",
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "14px",
  marginTop: "16px",
  background: "#fff",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "8px",
};

const signatureStyle: React.CSSProperties = {
  border: "1px solid #94a3b8",
  borderRadius: "8px",
  padding: "12px",
  marginTop: "10px",
  background: "#f8fafc",
};
