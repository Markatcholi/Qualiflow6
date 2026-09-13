"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type ConfigurationVersion = {
  id: string;
  tenant_id: string;
  module_code: string;
  configuration_type: "risk_assessment" | "capa_governance";
  version_code: string;
  version_name: string | null;
  status: "draft" | "active" | "retired";
  change_summary: string | null;
  change_justification: string | null;
  created_by: string | null;
  created_at: string | null;
  activated_by: string | null;
  activated_at: string | null;
};

type RiskRule = {
  id: string;
  tenant_id: string;
  configuration_version_id: string;
  severity: "high" | "medium" | "low";
  occurrence: "high" | "medium" | "low";
  detection: "high" | "medium" | "low";
  overall_risk: "critical" | "high" | "medium" | "low";
};

type CapaRule = {
  id: string;
  tenant_id: string;
  configuration_version_id: string;
  trigger_type: "risk_level" | "recurrence";
  trigger_value: string;
  governance_action: "no_automatic_recommendation" | "capa_recommended" | "capa_required";
  is_enabled: boolean;
};

const severityOrder = ["high", "medium", "low"] as const;
const occurrenceOrder = ["high", "medium", "low"] as const;
const detectionOrder = ["low", "medium", "high"] as const;

const riskOptions = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const governanceOptions = [
  { value: "no_automatic_recommendation", label: "No Automatic Recommendation" },
  { value: "capa_recommended", label: "CAPA Recommended" },
  { value: "capa_required", label: "CAPA Required" },
];

const capaLabels: Record<string, string> = {
  critical: "Critical Risk",
  high: "High Risk",
  medium: "Medium Risk",
  low: "Low Risk",
  no_risk: "No Risk",
  recurring_issue: "Recurring Issue",
};

export default function CompanyNcmrRiskGovernancePage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [versions, setVersions] = useState<ConfigurationVersion[]>([]);
  const [riskVersionId, setRiskVersionId] = useState("");
  const [capaVersionId, setCapaVersionId] = useState("");
  const [riskRules, setRiskRules] = useState<RiskRule[]>([]);
  const [capaRules, setCapaRules] = useState<CapaRule[]>([]);
  const [riskSummary, setRiskSummary] = useState("");
  const [riskJustification, setRiskJustification] = useState("");
  const [capaSummary, setCapaSummary] = useState("");
  const [capaJustification, setCapaJustification] = useState("");
  const [saving, setSaving] = useState("");

  const riskVersions = useMemo(
    () => versions.filter((v) => v.configuration_type === "risk_assessment"),
    [versions]
  );
  const capaVersions = useMemo(
    () => versions.filter((v) => v.configuration_type === "capa_governance"),
    [versions]
  );
  const selectedRiskVersion = riskVersions.find((v) => v.id === riskVersionId) || null;
  const selectedCapaVersion = capaVersions.find((v) => v.id === capaVersionId) || null;

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!riskVersionId || !tenantId) return;
    loadRiskRules(riskVersionId);
    const version = versions.find((v) => v.id === riskVersionId);
    setRiskSummary(version?.change_summary || "");
    setRiskJustification(version?.change_justification || "");
  }, [riskVersionId, versions, tenantId]);

  useEffect(() => {
    if (!capaVersionId || !tenantId) return;
    loadCapaRules(capaVersionId);
    const version = versions.find((v) => v.id === capaVersionId);
    setCapaSummary(version?.change_summary || "");
    setCapaJustification(version?.change_justification || "");
  }, [capaVersionId, versions, tenantId]);

  const initialize = async () => {
    try {
      setLoading(true);
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const email = String(authData?.user?.email || "").trim().toLowerCase();
      setUserEmail(email);
      if (!email) return;

      const activeTenantId = window.localStorage.getItem("qualisphere_active_tenant_id") || "";
      if (!activeTenantId) {
        setMessage("No active Company Account is selected.");
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("tenant_memberships")
        .select("tenant_id,membership_status,tenants(company_name)")
        .eq("tenant_id", activeTenantId)
        .ilike("user_email", email)
        .eq("membership_status", "active")
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) {
        setMessage("You do not have an active membership in this Company Account.");
        return;
      }

      const { data: isAdmin, error: adminError } = await supabase.rpc("qualisphere_is_company_admin", {
        p_tenant_id: activeTenantId,
      });
      if (adminError) throw adminError;
      if (isAdmin !== true) {
        setMessage("Company Administrator authority is required to manage NCMR governance.");
        return;
      }

      const tenant = Array.isArray((membership as any).tenants)
        ? (membership as any).tenants[0]
        : (membership as any).tenants;
      const resolvedName = String(
        tenant?.company_name || window.localStorage.getItem("qualisphere_active_tenant_name") || "Company Account"
      );

      setTenantId(activeTenantId);
      setCompanyName(resolvedName);
      setAuthorized(true);
      await loadVersions(activeTenantId);
    } catch (error: any) {
      setMessage(error?.message || "Unable to load NCMR Risk & CAPA Governance.");
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async (activeTenantId = tenantId) => {
    if (!activeTenantId) return;
    const { data, error } = await supabase
      .from("qms_configuration_versions")
      .select("id,tenant_id,module_code,configuration_type,version_code,version_name,status,change_summary,change_justification,created_by,created_at,activated_by,activated_at")
      .eq("tenant_id", activeTenantId)
      .eq("module_code", "NCMR")
      .in("configuration_type", ["risk_assessment", "capa_governance"])
      .order("created_at", { ascending: false });
    if (error) throw error;

    const rows = (data || []) as ConfigurationVersion[];
    setVersions(rows);

    const preferredRisk = rows.find((v) => v.configuration_type === "risk_assessment" && v.status === "draft")
      || rows.find((v) => v.configuration_type === "risk_assessment" && v.status === "active")
      || rows.find((v) => v.configuration_type === "risk_assessment");
    const preferredCapa = rows.find((v) => v.configuration_type === "capa_governance" && v.status === "draft")
      || rows.find((v) => v.configuration_type === "capa_governance" && v.status === "active")
      || rows.find((v) => v.configuration_type === "capa_governance");

    setRiskVersionId((current) => rows.some((v) => v.id === current) ? current : preferredRisk?.id || "");
    setCapaVersionId((current) => rows.some((v) => v.id === current) ? current : preferredCapa?.id || "");
  };

  const loadRiskRules = async (versionId: string) => {
    const { data, error } = await supabase
      .from("qms_risk_matrix_rules")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("configuration_version_id", versionId);
    if (error) return alert(error.message);
    setRiskRules((data || []) as RiskRule[]);
  };

  const loadCapaRules = async (versionId: string) => {
    const { data, error } = await supabase
      .from("qms_capa_governance_rules")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("configuration_version_id", versionId);
    if (error) return alert(error.message);
    setCapaRules((data || []) as CapaRule[]);
  };

  const saveRiskDraft = async () => {
    if (!selectedRiskVersion || selectedRiskVersion.status !== "draft") return;
    if (riskRules.length !== 27) return alert(`Risk Matrix must contain 27 rules. Current count: ${riskRules.length}.`);
    if (!riskJustification.trim()) return alert("Change justification is required.");
    try {
      setSaving("risk");
      for (const rule of riskRules) {
        const { error } = await supabase
          .from("qms_risk_matrix_rules")
          .update({ overall_risk: rule.overall_risk, updated_by: userEmail, updated_at: new Date().toISOString() })
          .eq("tenant_id", tenantId)
          .eq("id", rule.id);
        if (error) throw error;
      }
      const { error: versionError } = await supabase
        .from("qms_configuration_versions")
        .update({ change_summary: riskSummary.trim() || null, change_justification: riskJustification.trim() })
        .eq("tenant_id", tenantId)
        .eq("id", selectedRiskVersion.id)
        .eq("status", "draft");
      if (versionError) throw versionError;

      const { error: auditError } = await supabase.from("qms_configuration_audit_log").insert({
        tenant_id: tenantId,
        module_code: "NCMR",
        configuration_type: "risk_assessment",
        configuration_version_id: selectedRiskVersion.id,
        action: "risk_matrix_draft_saved",
        new_value: { version_code: selectedRiskVersion.version_code, rule_count: 27 },
        change_justification: riskJustification.trim(),
        changed_by: userEmail,
      });
      if (auditError) throw auditError;
      alert("Risk Matrix Draft saved.");
      await loadVersions();
    } catch (error: any) {
      alert(error?.message || "Unable to save Risk Matrix Draft.");
    } finally {
      setSaving("");
    }
  };

  const saveCapaDraft = async () => {
    if (!selectedCapaVersion || selectedCapaVersion.status !== "draft") return;
    if (capaRules.length !== 6) return alert(`CAPA Governance must contain 6 rules. Current count: ${capaRules.length}.`);
    if (!capaJustification.trim()) return alert("Change justification is required.");
    try {
      setSaving("capa");
      for (const rule of capaRules) {
        const { error } = await supabase
          .from("qms_capa_governance_rules")
          .update({ governance_action: rule.governance_action, is_enabled: rule.is_enabled, updated_by: userEmail, updated_at: new Date().toISOString() })
          .eq("tenant_id", tenantId)
          .eq("id", rule.id);
        if (error) throw error;
      }
      const { error: versionError } = await supabase
        .from("qms_configuration_versions")
        .update({ change_summary: capaSummary.trim() || null, change_justification: capaJustification.trim() })
        .eq("tenant_id", tenantId)
        .eq("id", selectedCapaVersion.id)
        .eq("status", "draft");
      if (versionError) throw versionError;

      const { error: auditError } = await supabase.from("qms_configuration_audit_log").insert({
        tenant_id: tenantId,
        module_code: "NCMR",
        configuration_type: "capa_governance",
        configuration_version_id: selectedCapaVersion.id,
        action: "capa_governance_draft_saved",
        new_value: { version_code: selectedCapaVersion.version_code, rule_count: 6 },
        change_justification: capaJustification.trim(),
        changed_by: userEmail,
      });
      if (auditError) throw auditError;
      alert("CAPA Governance Draft saved.");
      await loadVersions();
    } catch (error: any) {
      alert(error?.message || "Unable to save CAPA Governance Draft.");
    } finally {
      setSaving("");
    }
  };

  const cloneVersion = async (version: ConfigurationVersion | null) => {
    if (!version) return;
    const nextCode = window.prompt("Enter the new controlled version code:", suggestNextVersionCode(version.version_code));
    if (!nextCode?.trim()) return;
    const nextName = window.prompt("Enter the new version name:", `${version.version_name || version.version_code} - New Version`);
    if (nextName === null) return;
    const summary = window.prompt("Enter a short change summary:", "Controlled configuration revision.");
    if (summary === null) return;
    const justification = window.prompt("Enter the required change justification:");
    if (!justification?.trim()) return alert("Change justification is required.");

    setSaving(`clone-${version.id}`);
    const { data, error } = await supabase.rpc("qualisphere_clone_tenant_qms_configuration_version", {
      p_source_configuration_version_id: version.id,
      p_new_version_code: nextCode.trim(),
      p_new_version_name: nextName.trim() || nextCode.trim(),
      p_change_summary: summary.trim() || null,
      p_change_justification: justification.trim(),
    });
    setSaving("");
    if (error) return alert(error.message);
    await loadVersions();
    if (version.configuration_type === "risk_assessment") setRiskVersionId(String(data || ""));
    else setCapaVersionId(String(data || ""));
  };

  const activateVersion = async (version: ConfigurationVersion | null, justification: string) => {
    if (!version || version.status !== "draft") return;
    if (!justification.trim()) return alert("Activation justification is required.");
    if (!window.confirm(`Activate ${version.version_code}?\n\nThe active version will become read-only and the previous active version will be retired.`)) return;
    setSaving(`activate-${version.id}`);
    const { error } = await supabase.rpc("qualisphere_activate_tenant_qms_configuration_version", {
      p_configuration_version_id: version.id,
      p_change_justification: justification.trim(),
    });
    setSaving("");
    if (error) return alert(error.message);
    alert(`${version.version_code} activated.`);
    await loadVersions();
  };

  if (loading) return <main style={pageStyle}>Loading NCMR Risk & CAPA Governance...</main>;

  if (!authorized) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <div style={eyebrowStyle}>COMPANY ADMINISTRATION</div>
          <h1>NCMR Risk & CAPA Governance</h1>
          <p>{message || "Company Administrator authority is required."}</p>
          <Link href="/workspace" style={darkLinkStyle}>My Workspace</Link>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>CONTROLLED COMPANY QMS CONFIGURATION</div>
          <h1 style={{ margin: "5px 0" }}>NCMR Risk & CAPA Governance</h1>
          <p style={subtleText}>Configure the version-controlled NCMR risk model and CAPA governance for {companyName}.</p>
        </div>
        <div style={buttonRowStyle}>
          <Link href="/company-administration/master-data" style={secondaryLinkStyle}>Admin Master Data</Link>
          <Link href="/company-administration/approval-matrix" style={secondaryLinkStyle}>Approval Matrix</Link>
          <Link href="/company-administration/settings" style={secondaryLinkStyle}>Company Settings</Link>
          <Link href="/workspace" style={darkLinkStyle}>My Workspace</Link>
        </div>
      </header>

      <section style={contextStyle}><strong>Company Account:</strong> {companyName} &nbsp;&nbsp; <strong>Company Administrator:</strong> {userEmail}</section>
      <section style={noticeStyle}><strong>Version-control rule:</strong> Draft configurations may be edited. Active and Retired versions are read-only. Changes to an activated configuration require <strong>Create New Version</strong>.</section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>AUTOMATIC RISK ASSESSMENT</div>
            <h2 style={{ margin: "4px 0" }}>27-Cell Risk Matrix</h2>
            <p style={subtleText}>Automatic risk uses Severity + Occurrence + Detection. The initial active version is the QualiSphere controlled baseline supplied to this Company Account.</p>
          </div>
          <VersionBadge version={selectedRiskVersion} />
        </div>
        <VersionSelector versions={riskVersions} value={riskVersionId} onChange={setRiskVersionId} />
        {riskRules.length !== 27 ? <div style={warningStyle}>Expected 27 risk rules. Loaded {riskRules.length}.</div> : null}
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Severity</th><th style={thStyle}>Occurrence</th><th style={thStyle}>Detection</th><th style={thStyle}>Overall Risk</th></tr></thead>
            <tbody>
              {severityOrder.flatMap((severity) => occurrenceOrder.flatMap((occurrence) => detectionOrder.map((detection) => {
                const rule = riskRules.find((r) => r.severity === severity && r.occurrence === occurrence && r.detection === detection);
                return <tr key={`${severity}-${occurrence}-${detection}`}>
                  <td style={tdStyle}>{formatLabel(severity)}</td><td style={tdStyle}>{formatLabel(occurrence)}</td><td style={tdStyle}>{formatLabel(detection)}</td>
                  <td style={tdStyle}>{rule ? <select value={rule.overall_risk} disabled={selectedRiskVersion?.status !== "draft"} onChange={(e) => setRiskRules((current) => current.map((item) => item.id === rule.id ? { ...item, overall_risk: e.target.value as RiskRule["overall_risk"] } : item))} style={selectStyle}>{riskOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : <strong style={{ color: "#b91c1c" }}>Missing rule</strong>}</td>
                </tr>;
              })))}
            </tbody>
          </table>
        </div>
        <DraftControls version={selectedRiskVersion} summary={riskSummary} justification={riskJustification} onSummary={setRiskSummary} onJustification={setRiskJustification} onSave={saveRiskDraft} onClone={() => cloneVersion(selectedRiskVersion)} onActivate={() => activateVersion(selectedRiskVersion, riskJustification)} saving={saving === "risk" || saving.includes(selectedRiskVersion?.id || "__none__")} />
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>CAPA GOVERNANCE</div>
            <h2 style={{ margin: "4px 0" }}>Final Effective Risk & Recurrence Rules</h2>
            <p style={subtleText}>CAPA governance is driven by Final Effective Risk and recurrence. Severity is not a direct CAPA trigger.</p>
          </div>
          <VersionBadge version={selectedCapaVersion} />
        </div>
        <VersionSelector versions={capaVersions} value={capaVersionId} onChange={setCapaVersionId} />
        {capaRules.length !== 6 ? <div style={warningStyle}>Expected 6 CAPA governance rules. Loaded {capaRules.length}.</div> : null}
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Governance Signal</th><th style={thStyle}>Enabled</th><th style={thStyle}>Action</th></tr></thead>
            <tbody>{capaRules.map((rule) => <tr key={rule.id}>
              <td style={tdStyle}><strong>{capaLabels[rule.trigger_value] || formatLabel(rule.trigger_value)}</strong><div style={smallText}>{rule.trigger_type === "recurrence" ? "Independent recurrence governance trigger" : "Final Effective Risk"}</div></td>
              <td style={tdStyle}><input type="checkbox" checked={rule.is_enabled} disabled={selectedCapaVersion?.status !== "draft"} onChange={(e) => setCapaRules((current) => current.map((item) => item.id === rule.id ? { ...item, is_enabled: e.target.checked } : item))} /></td>
              <td style={tdStyle}><select value={rule.governance_action} disabled={selectedCapaVersion?.status !== "draft"} onChange={(e) => setCapaRules((current) => current.map((item) => item.id === rule.id ? { ...item, governance_action: e.target.value as CapaRule["governance_action"] } : item))} style={selectStyle}>{governanceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
            </tr>)}</tbody>
          </table>
        </div>
        <DraftControls version={selectedCapaVersion} summary={capaSummary} justification={capaJustification} onSummary={setCapaSummary} onJustification={setCapaJustification} onSave={saveCapaDraft} onClone={() => cloneVersion(selectedCapaVersion)} onActivate={() => activateVersion(selectedCapaVersion, capaJustification)} saving={saving === "capa" || saving.includes(selectedCapaVersion?.id || "__none__")} />
      </section>
    </main>
  );
}

function VersionSelector({ versions, value, onChange }: { versions: ConfigurationVersion[]; value: string; onChange: (value: string) => void }) {
  return <label style={{ display: "block", fontWeight: 700, marginBottom: 12 }}>Configuration Version<select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...selectStyle, display: "block", marginTop: 6, minWidth: 420 }}>{versions.map((v) => <option key={v.id} value={v.id}>{v.version_code} — {v.version_name || "Configuration"} — {formatLabel(v.status)}</option>)}</select></label>;
}

function VersionBadge({ version }: { version: ConfigurationVersion | null }) {
  if (!version) return null;
  const background = version.status === "active" ? "#dcfce7" : version.status === "draft" ? "#dbeafe" : "#f1f5f9";
  const color = version.status === "active" ? "#166534" : version.status === "draft" ? "#1d4ed8" : "#475569";
  return <div style={{ textAlign: "right" }}><span style={{ background, color, borderRadius: 999, padding: "7px 12px", fontWeight: 800 }}>{formatLabel(version.status)}</span><div style={smallText}>{version.version_code}</div></div>;
}

function DraftControls({ version, summary, justification, onSummary, onJustification, onSave, onClone, onActivate, saving }: any) {
  if (!version) return null;
  const draft = version.status === "draft";
  return <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
    <div style={gridStyle}>
      <label style={labelStyle}>Change Summary<textarea value={summary} disabled={!draft} onChange={(e) => onSummary(e.target.value)} rows={3} style={textareaStyle} /></label>
      <label style={labelStyle}>Change Justification *<textarea value={justification} disabled={!draft} onChange={(e) => onJustification(e.target.value)} rows={3} style={textareaStyle} /></label>
    </div>
    <div style={buttonRowStyle}>
      {draft ? <><button onClick={onSave} disabled={saving} style={primaryButtonStyle}>Save Draft</button><button onClick={onActivate} disabled={saving} style={successButtonStyle}>Activate Version</button></> : null}
      <button onClick={onClone} disabled={saving} style={primaryButtonStyle}>Create New Version</button>
    </div>
  </div>;
}

function suggestNextVersionCode(code: string) {
  const match = code.match(/^(.*?)(\d+)$/);
  if (!match) return `${code}-002`;
  const next = String(Number(match[2]) + 1).padStart(match[2].length, "0");
  return `${match[1]}${next}`;
}

function formatLabel(value: string) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const pageStyle: React.CSSProperties = { padding: 24, background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 18 };
const eyebrowStyle: React.CSSProperties = { color: "#64748b", fontSize: 12, fontWeight: 800, letterSpacing: ".08em" };
const subtleText: React.CSSProperties = { color: "#64748b", marginTop: 6 };
const smallText: React.CSSProperties = { color: "#64748b", fontSize: 12, marginTop: 6 };
const contextStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: 14, marginBottom: 16 };
const noticeStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: 16, marginBottom: 20 };
const warningStyle: React.CSSProperties = { background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: 12, color: "#9a3412", marginTop: 10 };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: 16, padding: 20, marginBottom: 20 };
const sectionHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { background: "#f8fafc", padding: 12, textAlign: "left", borderBottom: "2px solid #d1d5db" };
const tdStyle: React.CSSProperties = { padding: 12, borderBottom: "1px solid #e5e7eb", verticalAlign: "top" };
const selectStyle: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", background: "white" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 };
const labelStyle: React.CSSProperties = { fontWeight: 700 };
const textareaStyle: React.CSSProperties = { width: "100%", marginTop: 6, border: "1px solid #cbd5e1", borderRadius: 8, padding: 10, fontFamily: "inherit" };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 };
const primaryButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", border: 0, borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "pointer" };
const successButtonStyle: React.CSSProperties = { background: "#15803d", color: "white", border: 0, borderRadius: 8, padding: "10px 14px", fontWeight: 700, cursor: "pointer" };
const secondaryLinkStyle: React.CSSProperties = { background: "#334155", color: "white", textDecoration: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700 };
const darkLinkStyle: React.CSSProperties = { background: "#0f172a", color: "white", textDecoration: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700 };
