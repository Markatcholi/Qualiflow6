"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Audit = {
  id: string;
  audit_number: string | null;
  audit_title: string | null;
  audit_type: string | null;
  audit_scope: string | null;
  auditor: string | null;
  audit_date: string | null;
  status: string | null;
  created_at: string | null;
};

type AuditFinding = {
  id: string;
  audit_id: string | null;
  finding_title: string | null;
  finding_description: string | null;
  finding_severity: string | null;
  clause_reference: string | null;
  evidence: string | null;
  capa_required: boolean | null;
  capa_id: string | null;
  finding_status: string | null;
  created_at: string | null;
};

export default function AuditsPage() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);

  const [auditTitle, setAuditTitle] = useState("");
  const [auditType, setAuditType] = useState("internal_audit");
  const [auditScope, setAuditScope] = useState("");
  const [auditor, setAuditor] = useState("");
  const [auditDate, setAuditDate] = useState("");

  const [selectedAuditId, setSelectedAuditId] = useState("");
  const [findingTitle, setFindingTitle] = useState("");
  const [findingDescription, setFindingDescription] = useState("");
  const [findingSeverity, setFindingSeverity] = useState("minor");
  const [clauseReference, setClauseReference] = useState("");
  const [evidence, setEvidence] = useState("");
  const [capaRequired, setCapaRequired] = useState("no");

  const [auditSearch, setAuditSearch] = useState("");
  const [auditStatusFilter, setAuditStatusFilter] = useState("");
  const [auditTypeFilter, setAuditTypeFilter] = useState("");

  const fetchData = async () => {
    const auditRes = await supabase
      .from("audits")
      .select("*")
      .order("created_at", { ascending: false });

    const findingRes = await supabase
      .from("audit_findings")
      .select("*")
      .order("created_at", { ascending: false });

    if (auditRes.error) {
      alert(auditRes.error.message);
      return;
    }

    if (findingRes.error) {
      alert(findingRes.error.message);
      return;
    }

    setAudits((auditRes.data as Audit[]) || []);
    setFindings((findingRes.data as AuditFinding[]) || []);
  };

  const addAuditLog = async (
    entityType: string,
    entityId: string,
    action: string,
    details: string
  ) => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "unknown";

    await supabase.from("audit_logs").insert({
      entity_type: entityType,
      entity_id: entityId,
      action,
      details,
      user_email: email,
    });
  };

  const createAudit = async () => {
    if (!auditTitle) {
      alert("Audit title is required.");
      return;
    }

    const { data, error } = await supabase
      .from("audits")
      .insert({
        audit_title: auditTitle,
        audit_type: auditType,
        audit_scope: auditScope,
        auditor,
        audit_date: auditDate || null,
        status: "open",
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "audit",
      data.id,
      "created",
      `Audit created: ${data.audit_number || ""} ${auditTitle}`
    );

    setAuditTitle("");
    setAuditType("internal_audit");
    setAuditScope("");
    setAuditor("");
    setAuditDate("");

    fetchData();
  };

  const createFinding = async () => {
    if (!selectedAuditId) {
      alert("Select an audit first.");
      return;
    }

    if (!findingTitle) {
      alert("Finding title is required.");
      return;
    }

    const selectedAudit = audits.find((a) => a.id === selectedAuditId);

    let createdCapaId: string | null = null;

    if (capaRequired === "yes") {
      const { data: capaData, error: capaError } = await supabase
        .from("capas")
        .insert({
          title: `CAPA for audit finding: ${findingTitle}`,
          status: "open",
          source_type: "audit",
          capa_source: selectedAudit?.audit_number || "Audit",
          capa_type: "internal_capa",
          problem_description: findingDescription || findingTitle,
          investigation_summary: evidence,
          root_cause: "",
          corrective_action_plan: "",
          action_plan: "",
        })
        .select()
        .single();

      if (capaError) {
        alert(capaError.message);
        return;
      }

      createdCapaId = capaData.id;
    }

    const { data, error } = await supabase
      .from("audit_findings")
      .insert({
        audit_id: selectedAuditId,
        finding_title: findingTitle,
        finding_description: findingDescription,
        finding_severity: findingSeverity,
        clause_reference: clauseReference,
        evidence,
        capa_required: capaRequired === "yes",
        capa_id: createdCapaId,
        finding_status: "open",
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "audit_finding",
      data.id,
      "created",
      `Audit finding created: ${findingTitle}. CAPA required: ${capaRequired}`
    );

    if (createdCapaId) {
      await addAuditLog(
        "audit_finding",
        data.id,
        "capa_created",
        `CAPA created from audit finding: ${findingTitle}`
      );
    }

    setSelectedAuditId("");
    setFindingTitle("");
    setFindingDescription("");
    setFindingSeverity("minor");
    setClauseReference("");
    setEvidence("");
    setCapaRequired("no");

    fetchData();
  };

  const updateAuditStatus = async (audit: Audit, status: string) => {
  const auditFindings = findingsForAudit(audit.id);
  const openFindings = auditFindings.filter(
    (finding) => finding.finding_status !== "closed"
  );

  if (status === "closed" && openFindings.length > 0) {
    alert("Cannot close audit while findings remain open.");
    return;
  }

  if (status === "closed") {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";

    const enteredEmail = window.prompt(
      "Electronic Signature Required\n\nRe-enter your email to close this audit:"
    );

    if (!enteredEmail) {
      alert("Audit closure cancelled. Email re-entry is required.");
      return;
    }

    if (enteredEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
      alert("Electronic signature email does not match logged-in user.");
      return;
    }

    const confirmed = window.confirm(
      "Electronic Signature:\n\nI confirm this audit has been reviewed, findings have been addressed or appropriately documented, and the audit is approved for closure."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();
    const meaning =
      "I confirm this audit has been reviewed, findings have been addressed or appropriately documented, and the audit is approved for closure.";

    const { error } = await supabase
      .from("audits")
      .update({
        status: "closed",
        closed_at: now,
        closed_by: email,
        signed_by: email,
        signed_at: now,
        signature_email_entered: enteredEmail,
        signature_meaning: meaning,
      })
      .eq("id", audit.id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "audit",
      audit.id,
      "audit_closed_signature",
      `Audit closed with e-signature. Meaning: ${meaning}`
    );

    fetchData();
    return;
  }

  const { error } = await supabase
    .from("audits")
    .update({
      status,
      closed_at: null,
      closed_by: null,
      signed_by: null,
      signed_at: null,
      signature_email_entered: null,
      signature_meaning: null,
    })
    .eq("id", audit.id);

  if (error) {
    alert(error.message);
    return;
  }

  await addAuditLog(
    "audit",
    audit.id,
    "status_changed",
    `Audit status changed to ${status}`
  );

  fetchData();
};

  const closeFinding = async (finding: AuditFinding) => {
    const { error } = await supabase
      .from("audit_findings")
      .update({
        finding_status: "closed",
        closed_at: new Date().toISOString(),
      })
      .eq("id", finding.id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "audit_finding",
      finding.id,
      "closed",
      `Audit finding closed: ${finding.finding_title}`
    );

    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, []);

  const findingsForAudit = (auditId: string) => {
    return findings.filter((f) => f.audit_id === auditId);
  };

  const filteredAudits = audits.filter((audit) => {
    const searchText = `${audit.audit_number || ""} ${audit.audit_title || ""} ${audit.auditor || ""} ${audit.audit_scope || ""}`.toLowerCase();
    const matchesSearch = searchText.includes(auditSearch.toLowerCase());
    const matchesStatus = auditStatusFilter ? audit.status === auditStatusFilter : true;
    const matchesType = auditTypeFilter ? audit.audit_type === auditTypeFilter : true;

    return matchesSearch && matchesStatus && matchesType;
  });

  const totalOpenFindings = findings.filter((f) => f.finding_status !== "closed").length;
  const totalCapaRequiredFindings = findings.filter((f) => f.capa_required).length;

  const auditStatusColor = (status: string | null) => {
    if (status === "closed") return "#16a34a";
    if (status === "in_progress") return "#f59e0b";
    return "#2563eb";
  };

  const findingSeverityColor = (severity: string | null) => {
    if (severity === "critical") return "#dc2626";
    if (severity === "major") return "#f59e0b";
    return "#16a34a";
  };

  const summaryCardStyle: React.CSSProperties = {
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    padding: "14px",
    background: "#f9fafb",
  };

  const summaryLabelStyle: React.CSSProperties = {
    fontSize: "13px",
    color: "#4b5563",
    marginBottom: "4px",
  };

  const summaryValueStyle: React.CSSProperties = {
    fontSize: "24px",
    fontWeight: "bold",
  };

  const badgeStyle: React.CSSProperties = {
    color: "white",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    display: "inline-block",
  };

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Audit Module</h1>

      <section style={sectionStyle}>
        <h2>Create Audit</h2>

        <div style={rowStyle}>
          <label>Audit Title</label>
          <br />
          <input
            value={auditTitle}
            onChange={(e) => setAuditTitle(e.target.value)}
            placeholder="Example: Internal Audit Q2"
            style={fieldStyle}
          />
        </div>

        <div style={rowStyle}>
          <label>Audit Type</label>
          <br />
          <select
            value={auditType}
            onChange={(e) => setAuditType(e.target.value)}
            style={fieldStyle}
          >
            <option value="internal_audit">Internal Audit</option>
            <option value="supplier_audit">Supplier Audit</option>
            <option value="process_audit">Process Audit</option>
            <option value="qms_audit">QMS Audit</option>
            <option value="regulatory_audit">Regulatory Audit</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label>Audit Scope</label>
          <br />
          <textarea
            value={auditScope}
            onChange={(e) => setAuditScope(e.target.value)}
            placeholder="Scope, area, process, supplier, or department"
            rows={3}
            style={textAreaStyle}
          />
        </div>

        <div style={rowStyle}>
          <label>Auditor</label>
          <br />
          <input
            value={auditor}
            onChange={(e) => setAuditor(e.target.value)}
            placeholder="Auditor name"
            style={fieldStyle}
          />
        </div>

        <div style={rowStyle}>
          <label>Audit Date</label>
          <br />
          <input
            type="date"
            value={auditDate}
            onChange={(e) => setAuditDate(e.target.value)}
            style={fieldStyle}
          />
        </div>

        <button onClick={createAudit}>Create Audit</button>
      </section>

      <section style={sectionStyle}>
        <h2>Add Audit Finding</h2>

        <div style={rowStyle}>
          <label>Select Audit</label>
          <br />
          <select
            value={selectedAuditId}
            onChange={(e) => setSelectedAuditId(e.target.value)}
            style={fieldStyle}
          >
            <option value="">Select audit</option>
            {audits.map((audit) => (
              <option key={audit.id} value={audit.id}>
                {audit.audit_number || "AUD-PENDING"} - {audit.audit_title}
              </option>
            ))}
          </select>
        </div>

        <div style={rowStyle}>
          <label>Finding Title</label>
          <br />
          <input
            value={findingTitle}
            onChange={(e) => setFindingTitle(e.target.value)}
            placeholder="Short finding title"
            style={fieldStyle}
          />
        </div>

        <div style={rowStyle}>
          <label>Finding Description</label>
          <br />
          <textarea
            value={findingDescription}
            onChange={(e) => setFindingDescription(e.target.value)}
            rows={4}
            style={textAreaStyle}
          />
        </div>

        <div style={rowStyle}>
          <label>Finding Severity</label>
          <br />
          <select
            value={findingSeverity}
            onChange={(e) => setFindingSeverity(e.target.value)}
            style={fieldStyle}
          >
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div style={rowStyle}>
          <label>Clause / Requirement Reference</label>
          <br />
          <input
            value={clauseReference}
            onChange={(e) => setClauseReference(e.target.value)}
            placeholder="Example: ISO 13485 8.5.2 or SOP-QA-001"
            style={fieldStyle}
          />
        </div>

        <div style={rowStyle}>
          <label>Evidence</label>
          <br />
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            rows={3}
            style={textAreaStyle}
          />
        </div>

        <div style={rowStyle}>
          <label>CAPA Required?</label>
          <br />
          <select
            value={capaRequired}
            onChange={(e) => setCapaRequired(e.target.value)}
            style={fieldStyle}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        <button onClick={createFinding}>Create Finding</button>
      </section>

      <section style={sectionStyle}>
        <h2>Existing Audits</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Total Audits</div>
            <div style={summaryValueStyle}>{audits.length}</div>
          </div>
          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Open / Active</div>
            <div style={summaryValueStyle}>{audits.filter((x) => x.status !== "closed").length}</div>
          </div>
          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Total Findings</div>
            <div style={summaryValueStyle}>{findings.length}</div>
          </div>
          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Open Findings</div>
            <div style={summaryValueStyle}>{totalOpenFindings}</div>
          </div>
          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Findings Requiring CAPA</div>
            <div style={summaryValueStyle}>{totalCapaRequiredFindings}</div>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #d1d5db",
            borderRadius: "10px",
            padding: "14px",
            marginBottom: "20px",
            background: "#f9fafb",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Filters</h3>

          <input
            placeholder="Search audit title, number, auditor, scope"
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
            style={{ padding: "8px", marginRight: "8px", marginBottom: "8px", minWidth: "280px" }}
          />

          <select
            value={auditStatusFilter}
            onChange={(e) => setAuditStatusFilter(e.target.value)}
            style={{ padding: "8px", marginRight: "8px", marginBottom: "8px" }}
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={auditTypeFilter}
            onChange={(e) => setAuditTypeFilter(e.target.value)}
            style={{ padding: "8px", marginRight: "8px", marginBottom: "8px" }}
          >
            <option value="">All Audit Types</option>
            <option value="internal_audit">Internal Audit</option>
            <option value="supplier_audit">Supplier Audit</option>
            <option value="process_audit">Process Audit</option>
            <option value="qms_audit">QMS Audit</option>
            <option value="regulatory_audit">Regulatory Audit</option>
          </select>

          <button
            onClick={() => {
              setAuditSearch("");
              setAuditStatusFilter("");
              setAuditTypeFilter("");
            }}
          >
            Clear Filters
          </button>

          <div style={{ marginTop: "10px", fontSize: "14px" }}>
            Showing {filteredAudits.length} of {audits.length} audits
          </div>
        </div>

        {filteredAudits.length === 0 ? (
          <p>No audits match the current filters.</p>
        ) : (
          <div style={{ display: "grid", gap: "16px" }}>
            {filteredAudits.map((audit) => {
              const auditFindings = findingsForAudit(audit.id);
              const openFindings = auditFindings.filter(
                (finding) => finding.finding_status !== "closed"
              );
              const capaRequiredFindings = auditFindings.filter(
                (finding) => finding.capa_required
              );

              return (
                <article
                  key={audit.id}
                  style={{
                    border: openFindings.length > 0 ? "2px solid #f59e0b" : "1px solid #d1d5db",
                    borderRadius: "12px",
                    padding: "16px",
                    background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h3 style={{ margin: "0 0 6px 0" }}>
                        {audit.audit_number || "AUD-PENDING"} — {audit.audit_title || "Untitled Audit"}
                      </h3>
                      <div style={{ color: "#4b5563", fontSize: "14px" }}>
                        {audit.audit_scope || "No audit scope provided."}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ ...badgeStyle, background: auditStatusColor(audit.status) }}>
                        {audit.status || "unknown"}
                      </span>
                      <span style={{ ...badgeStyle, background: "#2563eb" }}>
                        {audit.audit_type || "type_not_set"}
                      </span>
                      {openFindings.length > 0 ? (
                        <span style={{ ...badgeStyle, background: "#f59e0b" }}>
                          Open Findings: {openFindings.length}
                        </span>
                      ) : null}
                      {capaRequiredFindings.length > 0 ? (
                        <span style={{ ...badgeStyle, background: "#dc2626" }}>
                          CAPA Required: {capaRequiredFindings.length}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "8px",
                      marginTop: "14px",
                      fontSize: "14px",
                    }}
                  >
                    <div><strong>Auditor:</strong> {audit.auditor || "N/A"}</div>
                    <div><strong>Audit Date:</strong> {audit.audit_date || "N/A"}</div>
                    <div><strong>Total Findings:</strong> {auditFindings.length}</div>
                    <div><strong>Open Findings:</strong> {openFindings.length}</div>
                  </div>

                  <div style={{ marginTop: "14px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => updateAuditStatus(audit, "in_progress")}
                    >
                      In Progress
                    </button>

                    <button
                      onClick={() => updateAuditStatus(audit, "closed")}
                    >
                      Close Audit
                    </button>

                      <a
  href={`/audits/${audit.id}/report`}
  target="_blank"
  rel="noreferrer"
  style={{
    padding: "8px 14px",
    background:
      audit.status === "closed"
        ? "#16a34a"
        : audit.status === "draft"
        ? "#6b7280"
        : "#2563eb",
    color: "white",
    borderRadius: "6px",
    textDecoration: "none",
    fontWeight: "600",
    display: "inline-block"
  }}
>
  Audit Report
                        
                    </a>
                  </div>

                  {auditFindings.length > 0 ? (
                    <div
                      style={{
                        marginTop: "14px",
                        padding: "12px",
                        background: "#f9fafb",
                        borderRadius: "10px",
                      }}
                    >
                      <strong>Findings</strong>
                      <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
                        {auditFindings.map((finding) => (
                          <div
                            key={finding.id}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                              padding: "10px",
                              background: "white",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                              <strong>{finding.finding_title}</strong>
                              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                <span style={{ ...badgeStyle, background: findingSeverityColor(finding.finding_severity) }}>
                                  {finding.finding_severity || "severity_not_set"}
                                </span>
                                <span style={{ ...badgeStyle, background: finding.finding_status === "closed" ? "#16a34a" : "#f59e0b" }}>
                                  {finding.finding_status || "open"}
                                </span>
                                {finding.capa_required ? (
                                  <span style={{ ...badgeStyle, background: "#dc2626" }}>CAPA Required</span>
                                ) : null}
                              </div>
                            </div>

                            <div style={{ marginTop: "8px", fontSize: "14px" }}>
                              <div><strong>Clause:</strong> {finding.clause_reference || "N/A"}</div>
                              <div><strong>Description:</strong> {finding.finding_description || "N/A"}</div>
                              <div><strong>Evidence:</strong> {finding.evidence || "N/A"}</div>
                            </div>

                            <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              {finding.capa_id ? (
                                <a href={`/capa/${finding.capa_id}`}>Open CAPA</a>
                              ) : null}

                              {finding.finding_status !== "closed" ? (
                                <button onClick={() => closeFinding(finding)}>
                                  Close Finding
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

const sectionStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "16px",
  marginBottom: "20px",
  borderRadius: "8px",
};

const rowStyle: React.CSSProperties = {
  marginBottom: "12px",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "500px",
  padding: "8px",
  marginTop: "4px",
};

const textAreaStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "800px",
  padding: "8px",
  marginTop: "4px",
};

const cardStyle: React.CSSProperties = {
  marginBottom: "18px",
  border: "1px solid #ddd",
  padding: "12px",
  borderRadius: "8px",
};
