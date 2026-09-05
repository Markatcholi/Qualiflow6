"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import {
  StatusBadge,
  EmptyStateCard,
  FormField,
  standardTextareaStyle,
  primaryButtonStyle,
} from "../../components/workflow/WorkflowComponents";

export default function AuditDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [audit, setAudit] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [escalationJustifications, setEscalationJustifications] = useState<Record<string, string>>({});

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

    const map: Record<string, string> = {};
    (findingsRes.data || []).forEach((finding: any) => {
      map[finding.id] = finding.escalation_justification || "";
    });
    setEscalationJustifications(map);
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  if (!audit) return <main style={{ padding: 20 }}>Loading audit...</main>;

  const isLocked = audit?.is_locked === true;

  const requiresEscalation = (finding: any) => {
    const severity = String(finding.finding_severity || "").toLowerCase();
    return (
      severity.includes("major") ||
      severity.includes("critical") ||
      severity.includes("high") ||
      severity.includes("systemic")
    );
  };

  const createScarFromFinding = async (finding: any) => {
    if (isLocked) return alert("This audit is locked and cannot be edited.");
    if (finding.linked_scar_id) return alert("This finding already has a linked SCAR.");

    const confirmed = window.confirm(
      "Create a linked SCAR from this audit finding? This will auto-populate the SCAR with audit finding details."
    );
    if (!confirmed) return;

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const scarTitle = `SCAR from Audit Finding - ${finding.finding_title || "Finding"}`;

    const description = [
      "SCAR initiated from audit finding.",
      audit.audit_number ? `Audit Number: ${audit.audit_number}` : "",
      audit.audit_title ? `Audit Title: ${audit.audit_title}` : "",
      finding.finding_title ? `Finding: ${finding.finding_title}` : "",
      finding.finding_description ? `Description: ${finding.finding_description}` : "",
      finding.finding_severity ? `Severity: ${finding.finding_severity}` : "",
    ]
      .filter(Boolean)
      .join("\\n");

    const { data: scarData, error: scarError } = await supabase
      .from("scars")
      .insert({
        title: scarTitle,
        scar_title: scarTitle,
        status: "open",
        scar_status: "open",
        source_type: "audit_finding",
        source_audit_finding_id: finding.id,
        linked_audit_id: id,
        supplier_id: audit.supplier_id || null,
        linked_supplier_id: audit.supplier_id || null,
        supplier_name: audit.supplier_name || null,
        description,
        issue_summary:
          finding.finding_description ||
          finding.finding_title ||
          "Audit finding requiring supplier corrective action",
        issue_description: description,
        problem_description: description,
        severity: finding.finding_severity || null,
        risk_level: finding.finding_severity || null,
        initiated_by: userEmail,
        initiated_at: new Date().toISOString(),
        created_by: userEmail,
        created_from_module: "audit",
      })
      .select()
      .single();

    if (scarError) return alert(scarError.message);

    const { error: findingUpdateError } = await supabase
      .from("audit_findings")
      .update({
        linked_scar_id: scarData.id,
        scar_evaluation_outcome: "scar_opened",
      })
      .eq("id", finding.id);

    if (findingUpdateError) return alert(findingUpdateError.message);

    await Promise.all([
      supabase.rpc("qualisphere_add_audit_log", {
        p_entity_type: "audit_finding",
        p_entity_id: finding.id,
        p_action: "scar_created_from_audit_finding",
        p_details: `SCAR created from audit finding: ${scarTitle}.`,
      }),
      supabase.rpc("qualisphere_add_audit_log", {
        p_entity_type: "scar",
        p_entity_id: scarData.id,
        p_action: "scar_created_from_audit_finding",
        p_details: `SCAR created from audit finding ${finding.finding_title || finding.id}.`,
      }),
    ]);

    alert("Linked SCAR created.");
    fetchData();
  };

  const createCapaFromFinding = async (finding: any) => {
    if (isLocked) return alert("This audit is locked and cannot be edited.");
    if (finding.linked_capa_id) return alert("This finding already has a linked CAPA.");

    const confirmed = window.confirm(
      "Create a linked CAPA from this audit finding? Use CAPA for systemic, major, critical, or enterprise-level corrective action."
    );
    if (!confirmed) return;

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const capaTitle = `CAPA from Audit Finding - ${finding.finding_title || "Finding"}`;

    const description = [
      "CAPA initiated from audit finding.",
      audit.audit_number ? `Audit Number: ${audit.audit_number}` : "",
      audit.audit_title ? `Audit Title: ${audit.audit_title}` : "",
      audit.audit_type ? `Audit Type: ${audit.audit_type}` : "",
      audit.audit_scope ? `Audit Scope: ${audit.audit_scope}` : "",
      finding.finding_title ? `Finding: ${finding.finding_title}` : "",
      finding.finding_description ? `Description: ${finding.finding_description}` : "",
      finding.finding_severity ? `Severity: ${finding.finding_severity}` : "",
    ]
      .filter(Boolean)
      .join("\\n");

    const { data: capaData, error: capaError } = await supabase
      .from("capas")
      .insert({
        title: capaTitle,
        description,
        status: "open",
        capa_source: "audit_finding",
        capa_type: "internal_capa",
        source_audit_finding_id: finding.id,
        linked_audit_id: id,
        severity: finding.finding_severity || null,
        risk_level: finding.finding_severity || null,
        created_by: userEmail,
      })
      .select()
      .single();

    if (capaError) return alert(capaError.message);

    const { error: findingUpdateError } = await supabase
      .from("audit_findings")
      .update({
        linked_capa_id: capaData.id,
        capa_evaluation_outcome: "capa_opened",
      })
      .eq("id", finding.id);

    if (findingUpdateError) return alert(findingUpdateError.message);

    await Promise.all([
      supabase.rpc("qualisphere_add_audit_log", {
        p_entity_type: "audit_finding",
        p_entity_id: finding.id,
        p_action: "capa_created_from_audit_finding",
        p_details: `CAPA created from audit finding: ${capaTitle}.`,
      }),
      supabase.rpc("qualisphere_add_audit_log", {
        p_entity_type: "capa",
        p_entity_id: capaData.id,
        p_action: "capa_created_from_audit_finding",
        p_details: `CAPA created from audit finding ${finding.finding_title || finding.id}.`,
      }),
    ]);

    alert("Linked CAPA created.");
    fetchData();
  };

  const saveEscalationJustification = async (finding: any) => {
    if (isLocked) return alert("This audit is locked and cannot be edited.");

    const justification = escalationJustifications[finding.id] || "";
    if (!justification.trim()) return alert("Escalation justification is required.");

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { error } = await supabase
      .from("audit_findings")
      .update({
        escalation_justification: justification,
        scar_evaluation_outcome: finding.linked_scar_id
          ? finding.scar_evaluation_outcome
          : "not_opened_with_justification",
        capa_evaluation_outcome: finding.linked_capa_id
          ? finding.capa_evaluation_outcome
          : "not_opened_with_justification",
      })
      .eq("id", finding.id);

    if (error) return alert(error.message);

    await supabase.rpc("qualisphere_add_audit_log", {
      p_entity_type: "audit_finding",
      p_entity_id: finding.id,
      p_action: "audit_finding_escalation_justification_saved",
      p_details: `Escalation justification saved: ${justification}`,
    });

    alert("Escalation justification saved.");
    fetchData();
  };

  return (
    <main style={{ padding: 30, fontFamily: "Arial, sans-serif" }}>
      <div style={{ marginBottom: "16px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button onClick={() => window.open(`/audits/${id}/report`, "_blank")} style={primaryButtonStyle}>
          Audit Report
        </button>

        <Link href="/audits">Back to Audits</Link>
      </div>

      <h1>Audit Workflow</h1>

      {isLocked && (
        <div
          style={{
            padding: "12px",
            background: "#f3f4f6",
            border: "1px solid #9ca3af",
            borderRadius: "8px",
            marginBottom: "16px",
            color: "#374151",
            fontWeight: 600,
          }}
        >
          🔒 This record is locked after electronic signature and cannot be edited.
          <br />
          <span style={{ fontWeight: 400 }}>
            Locked At: {audit.locked_at || "N/A"} | Locked By: {audit.locked_by || "N/A"}
          </span>
        </div>
      )}

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Audit Summary</h2>
        <p><strong>Audit Number:</strong> {audit.audit_number}</p>
        <p><strong>Title:</strong> {audit.audit_title}</p>
        <p><strong>Type:</strong> {audit.audit_type}</p>
        <p><strong>Scope:</strong> {audit.audit_scope}</p>
        <p><strong>Auditor:</strong> {audit.auditor}</p>
        <p><strong>Date:</strong> {audit.audit_date}</p>
        <p><strong>Status:</strong> <StatusBadge status={audit.status || "open"} /></p>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Findings</h2>

        {findings.length === 0 ? (
          <EmptyStateCard
            title="No findings"
            message="Audit findings will appear here when they are added to the audit."
          />
        ) : (
          findings.map((f) => (
            <div key={f.id} style={{ border: "1px solid #d1d5db", borderRadius: "10px", padding: "14px", marginBottom: "14px", background: "white" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ marginTop: 0 }}>{f.finding_title}</h3>
                  <p><strong>Description:</strong> {f.finding_description}</p>
                  <p><strong>Severity:</strong> <StatusBadge status={f.finding_severity || "not set"} /></p>
                  <p><strong>Status:</strong> <StatusBadge status={f.finding_status || "open"} /></p>
                </div>

                <div style={{ minWidth: "240px" }}>
                  <p>
                    <strong>Escalation Signal:</strong>{" "}
                    <StatusBadge status={requiresEscalation(f) ? "Evaluation Recommended" : "Evaluate as Needed"} />
                  </p>

                  <p>
                    <strong>SCAR:</strong>{" "}
                    {f.linked_scar_id ? (
                      <Link href={`/supplier-quality/scars/${f.linked_scar_id}`}>Open Linked SCAR</Link>
                    ) : (
                      <span>N/A</span>
                    )}
                  </p>

                  <p>
                    <strong>CAPA:</strong>{" "}
                    {f.linked_capa_id ? (
                      <Link href={`/capa/${f.linked_capa_id}`}>Open Linked CAPA</Link>
                    ) : (
                      <span>N/A</span>
                    )}
                  </p>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px", marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="button" onClick={() => createScarFromFinding(f)} disabled={isLocked || !!f.linked_scar_id}>
                  Create Linked SCAR
                </button>

                <button type="button" onClick={() => createCapaFromFinding(f)} disabled={isLocked || !!f.linked_capa_id}>
                  Create Linked CAPA
                </button>
              </div>

              <div style={{ marginTop: "12px" }}>
                <FormField label="Risk-Based Justification if SCAR/CAPA is Not Opened">
                  <textarea
                    value={escalationJustifications[f.id] || ""}
                    onChange={(e) =>
                      setEscalationJustifications({
                        ...escalationJustifications,
                        [f.id]: e.target.value,
                      })
                    }
                    disabled={isLocked}
                    rows={4}
                    style={standardTextareaStyle}
                  />
                </FormField>

                <button type="button" onClick={() => saveEscalationJustification(f)} disabled={isLocked}>
                  Save Escalation Justification
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

const sectionStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "20px",
  background: "white",
};
