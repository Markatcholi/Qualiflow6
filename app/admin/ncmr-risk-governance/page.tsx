use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type ConfigurationVersion = {
  id: string;
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
  configuration_version_id: string;
  severity: "high" | "medium" | "low";
  occurrence: "high" | "medium" | "low";
  detection: "high" | "medium" | "low";
  overall_risk: "critical" | "high" | "medium" | "low";
};

type CapaRule = {
  id: string;
  configuration_version_id: string;
  trigger_type: "risk_level" | "recurrence";
  trigger_value: string;
  governance_action:
    | "no_automatic_recommendation"
    | "capa_recommended"
    | "capa_required";
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

const riskRuleLabels: Record<string, string> = {
  critical: "Critical Risk",
  high: "High Risk",
  medium: "Medium Risk",
  low: "Low Risk",
  no_risk: "No Risk",
  recurring_issue: "Recurring Issue",
};

export default function NcmrRiskGovernanceAdminPage() {
  const [loading, setLoading] = useState(true);
  const [savingRisk, setSavingRisk] = useState(false);
  const [savingCapa, setSavingCapa] = useState(false);
  const [activating, setActivating] = useState("");
  const [cloning, setCloning] = useState("");

  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");

  const [versions, setVersions] = useState<ConfigurationVersion[]>([]);
  const [riskVersionId, setRiskVersionId] = useState("");
  const [capaVersionId, setCapaVersionId] = useState("");

  const [riskRules, setRiskRules] = useState<RiskRule[]>([]);
  const [capaRules, setCapaRules] = useState<CapaRule[]>([]);

  const [riskChangeSummary, setRiskChangeSummary] = useState("");
  const [riskChangeJustification, setRiskChangeJustification] = useState("");
  const [capaChangeSummary, setCapaChangeSummary] = useState("");
  const [capaChangeJustification, setCapaChangeJustification] = useState("");

  const canAdminister =
    userRole === "vp_quality" ||
    userRole === "admin" ||
    userRole === "administrator";

  const riskVersions = useMemo(
    () => versions.filter((item) => item.configuration_type === "risk_assessment"),
    [versions]
  );

  const capaVersions = useMemo(
    () => versions.filter((item) => item.configuration_type === "capa_governance"),
    [versions]
  );

  const selectedRiskVersion =
    riskVersions.find((item) => item.id === riskVersionId) || null;

  const selectedCapaVersion =
    capaVersions.find((item) => item.id === capaVersionId) || null;

  const fetchIdentity = async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) return alert(userError.message);

    const email = userData?.user?.email || "";
    setUserEmail(email);
    if (!email) return;

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", email)
      .maybeSingle();

    if (error) return alert(error.message);
    setUserRole(data?.role || "");
  };

  const fetchVersions = async () => {
    const { data, error } = await supabase
      .from("qms_configuration_versions")
      .select("id,module_code,configuration_type,version_code,version_name,status,change_summary,change_justification,created_by,created_at,activated_by,activated_at")
      .eq("module_code", "NCMR")
      .in("configuration_type", ["risk_assessment", "capa_governance"])
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);

    const rows = (data as ConfigurationVersion[]) || [];
    setVersions(rows);

    const riskPreferred =
      rows.find((x) => x.configuration_type === "risk_assessment" && x.status === "draft") ||
      rows.find((x) => x.configuration_type === "risk_assessment" && x.status === "active") ||
      rows.find((x) => x.configuration_type === "risk_assessment");

    const capaPreferred =
      rows.find((x) => x.configuration_type === "capa_governance" && x.status === "draft") ||
      rows.find((x) => x.configuration_type === "capa_governance" && x.status === "active") ||
      rows.find((x) => x.configuration_type === "capa_governance");

    setRiskVersionId((current) => current || riskPreferred?.id || "");
    setCapaVersionId((current) => current || capaPreferred?.id || "");
  };

  const fetchRiskRules = async (versionId: string) => {
    if (!versionId) return setRiskRules([]);
    const { data, error } = await supabase
      .from("qms_risk_matrix_rules")
      .select("*")
      .eq("configuration_version_id", versionId);

    if (error) return alert(error.message);
    setRiskRules((data as RiskRule[]) || []);
  };

  const fetchCapaRules = async (versionId: string) => {
    if (!versionId) return setCapaRules([]);
    const { data, error } = await supabase
      .from("qms_capa_governance_rules")
      .select("*")
      .eq("configuration_version_id", versionId);

    if (error) return alert(error.message);
    setCapaRules((data as CapaRule[]) || []);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchIdentity();
      await fetchVersions();
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!riskVersionId) return;
    fetchRiskRules(riskVersionId);
    const version = versions.find((x) => x.id === riskVersionId);
    setRiskChangeSummary(version?.change_summary || "");
    setRiskChangeJustification(version?.change_justification || "");
  }, [riskVersionId, versions]);

  useEffect(() => {
    if (!capaVersionId) return;
    fetchCapaRules(capaVersionId);
    const version = versions.find((x) => x.id === capaVersionId);
    setCapaChangeSummary(version?.change_summary || "");
    setCapaChangeJustification(version?.change_justification || "");
  }, [capaVersionId, versions]);

  const updateRiskRule = (
    severity: string,
    occurrence: string,
    detection: string,
    overallRisk: string
  ) => {
    setRiskRules((current) =>
      current.map((rule) =>
        rule.severity === severity &&
        rule.occurrence === occurrence &&
        rule.detection === detection
          ? { ...rule, overall_risk: overallRisk as RiskRule["overall_risk"] }
          : rule
      )
    );
  };

  const saveDraftMetadata = async (
    versionId: string,
    summary: string,
    justification: string
  ) => {
    const { error } = await supabase
      .from("qms_configuration_versions")
      .update({
        change_summary: summary.trim() || null,
        change_justification: justification.trim() || null,
      })
      .eq("id", versionId)
      .eq("status", "draft");
    if (error) throw error;
  };

  const appendAudit = async (
    configurationType: string,
    versionId: string,
    action: string,
    details: any,
    justification: string
  ) => {
    const { error } = await supabase
      .from("qms_configuration_audit_log")
      .insert({
        module_code: "NCMR",
        configuration_type: configurationType,
        configuration_version_id: versionId,
        action,
        new_value: details,
        change_justification: justification.trim() || null,
        changed_by: userEmail || "unknown",
      });
    if (error) throw error;
  };

  const saveRiskDraft = async () => {
    if (!canAdminister || selectedRiskVersion?.status !== "draft") return;
    if (riskRules.length !== 27) return alert(`Risk Matrix must contain 27 rules. Current count: ${riskRules.length}.`);
    if (!riskChangeJustification.trim()) return alert("Change justification is required.");

    setSavingRisk(true);
    try {
      for (const rule of riskRules) {
        const { error } = await supabase
          .from("qms_risk_matrix_rules")
          .update({
            overall_risk: rule.overall_risk,
            updated_by: userEmail || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", rule.id);
        if (error) throw error;
      }

      await saveDraftMetadata(selectedRiskVersion.id, riskChangeSummary, riskChangeJustification);
      await appendAudit(
        "risk_assessment",
        selectedRiskVersion.id,
        "risk_matrix_draft_saved",
        { version_code: selectedRiskVersion.version_code, rule_count: 27 },
        riskChangeJustification
      );

      alert("Risk Matrix Draft saved.");
      await fetchVersions();
      await fetchRiskRules(selectedRiskVersion.id);
    } catch (error: any) {
      alert(error?.message || "Unable to save Risk Matrix Draft.");
    } finally {
      setSavingRisk(false);
    }
  };

  const saveCapaDraft = async () => {
    if (!canAdminister || selectedCapaVersion?.status !== "draft") return;
    if (capaRules.length !== 6) return alert(`CAPA Governance must contain 6 rules. Current count: ${capaRules.length}.`);
    if (!capaChangeJustification.trim()) return alert("Change justification is required.");

    setSavingCapa(true);
    try {
      for (const rule of capaRules) {
        const { error } = await supabase
          .from("qms_capa_governance_rules")
          .update({
            governance_action: rule.governance_action,
            is_enabled: rule.is_enabled,
            updated_by: userEmail || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", rule.id);
        if (error) throw error;
      }

      await saveDraftMetadata(selectedCapaVersion.id, capaChangeSummary, capaChangeJustification);
      await appendAudit(
        "capa_governance",
        selectedCapaVersion.id,
        "capa_governance_draft_saved",
        { version_code: selectedCapaVersion.version_code, rule_count: 6 },
        capaChangeJustification
      );

      alert("CAPA Governance Draft saved.");
      await fetchVersions();
      await fetchCapaRules(selectedCapaVersion.id);
    } catch (error: any) {
      alert(error?.message || "Unable to save CAPA Governance Draft.");
    } finally {
      setSavingCapa(false);
    }
  };

  const activateVersion = async (version: ConfigurationVersion | null, justification: string) => {
    if (!canAdminister || !version || version.status !== "draft") return;
    if (!justification.trim()) return alert("Activation justification is required.");

    const confirmed = window.confirm(
      `Activate ${version.version_code}?\n\nActivated configurations are immutable. Future changes require a new controlled version.`
    );
    if (!confirmed) return;

    setActivating(version.id);
    const { error } = await supabase.rpc("activate_qms_configuration_version", {
      p_configuration_version_id: version.id,
      p_change_justification: justification.trim(),
    });
    setActivating("");

    if (error) return alert(error.message);

    alert(`${version.version_code} activated successfully.`);
    await fetchVersions();
  };

  const createNewVersion = async (version: ConfigurationVersion | null) => {
    if (!canAdminister || !version) return;

    const nextCode = window.prompt(
      `Create a new Draft from ${version.version_code}.\n\nEnter the new version code:`,
      suggestNextVersionCode(version.version_code)
    );
    if (!nextCode?.trim()) return;

    const nextName = window.prompt(
      "Enter the new version name:",
      `${version.version_name || version.version_code} - New Version`
    );
    if (nextName === null) return;

    const summary = window.prompt("Enter a short change summary:", "Controlled configuration revision.");
    if (summary === null) return;

    const justification = window.prompt("Enter the required change justification:");
    if (!justification?.trim()) return alert("Change justification is required.");

    setCloning(version.id);
    const { data, error } = await supabase.rpc("clone_qms_configuration_version", {
      p_source_configuration_version_id: version.id,
      p_new_version_code: nextCode.trim(),
      p_new_version_name: nextName.trim() || nextCode.trim(),
      p_change_summary: summary.trim() || null,
      p_change_justification: justification.trim(),
    });
    setCloning("");

    if (error) return alert(error.message);

    alert(`New Draft ${nextCode.trim()} created.`);
    await fetchVersions();

    if (version.configuration_type === "risk_assessment") setRiskVersionId(String(data || ""));
    else setCapaVersionId(String(data || ""));
  };

  if (loading) return <main style={pageStyle}>Loading NCMR governance configuration...</main>;

  if (!canAdminister) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <div style={eyebrowStyle}>ACCESS RESTRICTED</div>
          <h1>NCMR Risk & CAPA Governance</h1>
          <p>This controlled configuration is restricted to Administrator and VP Quality roles.</p>
          <p style={subtleText}>Signed in as {userEmail || "unknown"} ({userRole || "user"}).</p>
          <Link href="/admin/master-data" style={secondaryLinkStyle}>Return to Admin Master Data</Link>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>CONTROLLED QMS CONFIGURATION</div>
          <h1 style={{ margin: "5px 0" }}>NCMR Risk & CAPA Governance</h1>
          <p style={subtleText}>
            Configure version-controlled NCMR automatic risk calculation and CAPA governance.
            Activated versions cannot be edited in place.
          </p>
        </div>
        <div style={buttonRowStyle}>
          <Link href="/admin/master-data" style={secondaryLinkStyle}>Admin Master Data</Link>
          <Link href="/dashboard" style={darkLinkStyle}>Dashboard</Link>
        </div>
      </header>

      <section style={noticeStyle}>
        <strong>Version-control rule:</strong> Draft configurations may be edited.
        Active and Retired versions are read-only. Changes to an activated configuration require
        <strong> Create New Version</strong>.
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>AUTOMATIC RISK ASSESSMENT</div>
            <h2 style={{ margin: "4px 0" }}>27-Cell Risk Matrix</h2>
            <p style={subtleText}>
              Automatic risk uses Severity + Occurrence + Detection. No Risk is handled separately
              through the NCMR Risk Determination pathway and is not produced by this matrix.
            </p>
          </div>
          <VersionBadge version={selectedRiskVersion} />
        </div>

        <VersionSelector versions={riskVersions} value={riskVersionId} onChange={setRiskVersionId} />

        {riskRules.length !== 27 ? (
          <div style={warningStyle}>Expected 27 risk rules. Loaded {riskRules.length}.</div>
        ) : null}

        <div style={{ overflowX: "auto", marginTop: "16px" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Severity</th>
                <th style={thStyle}>Occurrence</th>
                <th style={thStyle}>Detection</th>
                <th style={thStyle}>Overall Risk</th>
              </tr>
            </thead>
            <tbody>
              {severityOrder.flatMap((severity) =>
                occurrenceOrder.flatMap((occurrence) =>
                  detectionOrder.map((detection) => {
                    const rule = riskRules.find(
                      (item) =>
                        item.severity === severity &&
                        item.occurrence === occurrence &&
                        item.detection === detection
                    );

                    return (
                      <tr key={`${severity}-${occurrence}-${detection}`}>
                        <td style={tdStyle}>{formatLabel(severity)}</td>
                        <td style={tdStyle}>{formatLabel(occurrence)}</td>
                        <td style={tdStyle}>{formatLabel(detection)}</td>
                        <td style={tdStyle}>
                          {rule ? (
                            <select
                              value={rule.overall_risk}
                              disabled={selectedRiskVersion?.status !== "draft"}
                              onChange={(event) =>
                                updateRiskRule(severity, occurrence, detection, event.target.value)
                              }
                              style={selectStyle}
                            >
                              {riskOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          ) : <strong style={{ color: "#b91c1c" }}>Missing rule</strong>}
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>

        <DraftControls
          version={selectedRiskVersion}
          changeSummary={riskChangeSummary}
          changeJustification={riskChangeJustification}
          onSummaryChange={setRiskChangeSummary}
          onJustificationChange={setRiskChangeJustification}
          saving={savingRisk}
          activating={activating === selectedRiskVersion?.id}
          cloning={cloning === selectedRiskVersion?.id}
          onSave={saveRiskDraft}
          onActivate={() => activateVersion(selectedRiskVersion, riskChangeJustification)}
          onClone={() => createNewVersion(selectedRiskVersion)}
        />
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>CAPA GOVERNANCE</div>
            <h2 style={{ margin: "4px 0" }}>Final Effective Risk & Recurrence Rules</h2>
            <p style={subtleText}>
              CAPA governance is driven by Final Effective Risk and recurrence. Severity is not a direct CAPA trigger.
            </p>
          </div>
          <VersionBadge version={selectedCapaVersion} />
        </div>

        <VersionSelector versions={capaVersions} value={capaVersionId} onChange={setCapaVersionId} />

        {capaRules.length !== 6 ? (
          <div style={warningStyle}>Expected 6 CAPA governance rules. Loaded {capaRules.length}.</div>
        ) : null}

        <div style={{ overflowX: "auto", marginTop: "16px" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Governance Signal</th>
                <th style={thStyle}>Enabled</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortCapaRules(capaRules).map((rule) => (
                <tr key={rule.id}>
                  <td style={tdStyle}>
                    <strong>{riskRuleLabels[rule.trigger_value] || formatLabel(rule.trigger_value)}</strong>
                    <div style={{ ...subtleText, fontSize: "12px", marginTop: "4px" }}>
                      {rule.trigger_type === "recurrence" ? "Independent recurrence governance trigger" : "Final Effective Risk"}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={rule.is_enabled}
                      disabled={selectedCapaVersion?.status !== "draft"}
                      onChange={(e) =>
                        setCapaRules((current) =>
                          current.map((item) =>
                            item.id === rule.id ? { ...item, is_enabled: e.target.checked } : item
                          )
                        )
                      }
                    />
                  </td>
                  <td style={tdStyle}>
                    <select
                      value={rule.governance_action}
                      disabled={selectedCapaVersion?.status !== "draft" || !rule.is_enabled}
                      onChange={(e) =>
                        setCapaRules((current) =>
                          current.map((item) =>
                            item.id === rule.id
                              ? { ...item, governance_action: e.target.value as CapaRule["governance_action"] }
                              : item
                          )
                        )
                      }
                      style={{ ...selectStyle, minWidth: "250px" }}
                    >
                      {governanceOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DraftControls
          version={selectedCapaVersion}
          changeSummary={capaChangeSummary}
          changeJustification={capaChangeJustification}
          onSummaryChange={setCapaChangeSummary}
          onJustificationChange={setCapaChangeJustification}
          saving={savingCapa}
          activating={activating === selectedCapaVersion?.id}
          cloning={cloning === selectedCapaVersion?.id}
          onSave={saveCapaDraft}
          onActivate={() => activateVersion(selectedCapaVersion, capaChangeJustification)}
          onClone={() => createNewVersion(selectedCapaVersion)}
        />
      </section>
    </main>
  );
}

function VersionSelector({ versions, value, onChange }: {
  versions: ConfigurationVersion[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ marginTop: "16px" }}>
      <label style={labelStyle}>Configuration Version</label><br />
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...selectStyle, minWidth: "360px" }}>
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            {version.version_code} — {version.version_name || "Unnamed"} — {formatLabel(version.status)}
          </option>
        ))}
      </select>
    </div>
  );
}

function VersionBadge({ version }: { version: ConfigurationVersion | null }) {
  if (!version) return null;
  const background = version.status === "active" ? "#dcfce7" : version.status === "draft" ? "#dbeafe" : "#f3f4f6";
  const color = version.status === "active" ? "#166534" : version.status === "draft" ? "#1d4ed8" : "#4b5563";

  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ display: "inline-block", background, color, borderRadius: "999px", padding: "7px 10px", fontWeight: 800 }}>
        {formatLabel(version.status)}
      </div>
      <div style={{ ...subtleText, marginTop: "6px", fontSize: "12px" }}>{version.version_code}</div>
    </div>
  );
}

function DraftControls(props: {
  version: ConfigurationVersion | null;
  changeSummary: string;
  changeJustification: string;
  onSummaryChange: (value: string) => void;
  onJustificationChange: (value: string) => void;
  saving: boolean;
  activating: boolean;
  cloning: boolean;
  onSave: () => void;
  onActivate: () => void;
  onClone: () => void;
}) {
  const { version, changeSummary, changeJustification, onSummaryChange, onJustificationChange,
    saving, activating, cloning, onSave, onActivate, onClone } = props;
  if (!version) return null;
  const isDraft = version.status === "draft";

  return (
    <div style={controlPanelStyle}>
      <div style={twoColumnStyle}>
        <div>
          <label style={labelStyle}>Change Summary</label>
          <textarea value={changeSummary} disabled={!isDraft} onChange={(e) => onSummaryChange(e.target.value)}
            rows={3} style={textareaStyle} placeholder="Summarize what is changing in this configuration version." />
        </div>
        <div>
          <label style={labelStyle}>Change Justification *</label>
          <textarea value={changeJustification} disabled={!isDraft} onChange={(e) => onJustificationChange(e.target.value)}
            rows={3} style={textareaStyle} placeholder="Required controlled justification for the configuration." />
        </div>
      </div>

      <div style={{ ...buttonRowStyle, marginTop: "14px" }}>
        {isDraft ? (
          <>
            <button onClick={onSave} disabled={saving} style={primaryButtonStyle}>{saving ? "Saving..." : "Save Draft"}</button>
            <button onClick={onActivate} disabled={activating} style={activateButtonStyle}>{activating ? "Activating..." : "Activate Configuration"}</button>
          </>
        ) : (
          <button onClick={onClone} disabled={cloning} style={primaryButtonStyle}>{cloning ? "Creating..." : "Create New Version"}</button>
        )}
      </div>
    </div>
  );
}

function sortCapaRules(rules: CapaRule[]) {
  const order = ["critical", "high", "medium", "low", "no_risk", "recurring_issue"];
  return [...rules].sort((a, b) => order.indexOf(a.trigger_value) - order.indexOf(b.trigger_value));
}

function suggestNextVersionCode(value: string) {
  const match = String(value || "").match(/^(.*?)(\d+)$/);
  if (!match) return `${value}-NEW`;
  return `${match[1]}${String(Number(match[2]) + 1).padStart(match[2].length, "0")}`;
}

function formatLabel(value: any) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const pageStyle: React.CSSProperties = { padding: "24px", fontFamily: "Arial, sans-serif", background: "#f8fafc", minHeight: "100vh" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start", marginBottom: "20px" };
const sectionHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", color: "#64748b" };
const subtleText: React.CSSProperties = { color: "#64748b", margin: "4px 0" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "12px", padding: "20px", marginBottom: "20px" };
const noticeStyle: React.CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "14px", marginBottom: "20px" };
const warningStyle: React.CSSProperties = { background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "8px", padding: "10px 12px", marginTop: "14px" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "10px", borderBottom: "2px solid #d1d5db", background: "#f8fafc" };
const tdStyle: React.CSSProperties = { padding: "10px", borderBottom: "1px solid #e5e7eb" };
const selectStyle: React.CSSProperties = { padding: "8px", border: "1px solid #cbd5e1", borderRadius: "7px", background: "white" };
const labelStyle: React.CSSProperties = { fontWeight: 700 };
const textareaStyle: React.CSSProperties = { width: "100%", padding: "9px", marginTop: "6px", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: "7px", fontFamily: "Arial, sans-serif" };
const controlPanelStyle: React.CSSProperties = { borderTop: "1px solid #e5e7eb", marginTop: "20px", paddingTop: "18px" };
const twoColumnStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" };
const primaryButtonStyle: React.CSSProperties = { border: "none", background: "#2563eb", color: "white", borderRadius: "8px", padding: "10px 14px", fontWeight: 800, cursor: "pointer" };
const activateButtonStyle: React.CSSProperties = { ...primaryButtonStyle, background: "#0f766e" };
const secondaryLinkStyle: React.CSSProperties = { display: "inline-block", background: "white", color: "#1e293b", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "10px 14px", textDecoration: "none", fontWeight: 700 };
const darkLinkStyle: React.CSSProperties = { ...secondaryLinkStyle, background: "#111827", borderColor: "#111827", color: "white" };
