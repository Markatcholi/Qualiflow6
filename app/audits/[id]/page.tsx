"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function AuditDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [audit, setAudit] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const auditRes = await supabase
        .from("audits")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      const findingsRes = await supabase
        .from("audit_findings")
        .select("*")
        .eq("audit_id", id)
        .order("created_at", { ascending: true });

      if (auditRes.error) alert(auditRes.error.message);
      if (findingsRes.error) alert(findingsRes.error.message);

      setAudit(auditRes.data);
      setFindings(findingsRes.data || []);
    };

    if (id) fetchData();
  }, [id]);

  if (!audit) return <main style={{ padding: 20 }}>Loading audit...</main>;

  return (
    <main style={{ padding: 30, fontFamily: "Arial, sans-serif" }}>
      
      {/* ✅ PRINT BUTTON */}
      <div style={{ marginBottom: "16px" }}>
        <button
          onClick={() => window.open(`/audits/${id}/report`, "_blank")}
          style={{
            padding: "10px 14px",
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600"
          }}
        >
          📄 Print Full Audit Report
        </button>
      </div>

      <h1>Audit Workflow</h1>

      <h2>Audit Summary</h2>
      <p><strong>Audit Number:</strong> {audit.audit_number}</p>
      <p><strong>Title:</strong> {audit.audit_title}</p>
      <p><strong>Type:</strong> {audit.audit_type}</p>
      <p><strong>Scope:</strong> {audit.audit_scope}</p>
      <p><strong>Auditor:</strong> {audit.auditor}</p>
      <p><strong>Date:</strong> {audit.audit_date}</p>
      <p><strong>Status:</strong> {audit.status}</p>

      <h2>Findings</h2>

      {findings.length === 0 ? (
        <p>No findings</p>
      ) : (
        findings.map((f) => (
          <div key={f.id} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
            <h3>{f.finding_title}</h3>
            <p><strong>Description:</strong> {f.finding_description}</p>
            <p><strong>Severity:</strong> {f.finding_severity}</p>
            <p><strong>Status:</strong> {f.finding_status}</p>
          </div>
        ))
      )}
    </main>
  );
}
