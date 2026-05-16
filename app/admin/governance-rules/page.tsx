"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import {
  StatusBadge,
  EmptyStateCard,
  FormField,
  standardInputStyle,
  standardTextareaStyle,
  primaryButtonStyle,
} from "../../components/workflow/WorkflowComponents";

export default function GovernanceRulesPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState("");

  const [ruleName, setRuleName] = useState("");
  const [sourceModule, setSourceModule] = useState("ncmr");
  const [targetModule, setTargetModule] = useState("capa");
  const [ruleType, setRuleType] = useState("severity_based");
  const [severityLevels, setSeverityLevels] = useState<string[]>([]);
  const [recurrenceThreshold, setRecurrenceThreshold] = useState("");
  const [riskLevels, setRiskLevels] = useState<string[]>([]);
  const [supplierRelated, setSupplierRelated] = useState(false);
  const [customerImpact, setCustomerImpact] = useState(false);
  const [actionType, setActionType] = useState("require_capa_evaluation");
  const [justificationRequired, setJustificationRequired] = useState(true);
  const [active, setActive] = useState(true);
  const [ruleDescription, setRuleDescription] = useState("");

  const fetchRules = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("governance_rules")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setRules(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const resetForm = () => {
    setEditingRuleId("");
    setRuleName("");
    setSourceModule("ncmr");
    setTargetModule("capa");
    setRuleType("severity_based");
    setSeverityLevels([]);
    setRecurrenceThreshold("");
    setRiskLevels([]);
    setSupplierRelated(false);
    setCustomerImpact(false);
    setActionType("require_capa_evaluation");
    setJustificationRequired(true);
    setActive(true);
    setRuleDescription("");
  };

  const toggleValue = (
    value: string,
    currentValues: string[],
    setValues: (values: string[]) => void
  ) => {
    setValues(
      currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value]
    );
  };

  const startEdit = (rule: any) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.rule_name || "");
    setSourceModule(rule.source_module || "ncmr");
    setTargetModule(rule.target_module || "capa");
    setRuleType(rule.rule_type || "severity_based");
    setSeverityLevels(rule.severity_levels || []);
    setRecurrenceThreshold(
      rule.recurrence_threshold !== null && rule.recurrence_threshold !== undefined
        ? String(rule.recurrence_threshold)
        : ""
    );
    setRiskLevels(rule.risk_levels || []);
    setSupplierRelated(!!rule.supplier_related);
    setCustomerImpact(!!rule.customer_impact);
    setActionType(rule.action_type || "require_capa_evaluation");
    setJustificationRequired(!!rule.justification_required);
    setActive(rule.active !== false);
    setRuleDescription(rule.rule_description || "");
    setShowCreateRule(true);
  };

  const saveRule = async () => {
    if (!ruleName.trim()) return alert("Rule name is required.");
    if (!sourceModule) return alert("Source module is required.");
    if (!targetModule) return alert("Target module is required.");
    if (!actionType) return alert("Action type is required.");

    const payload: any = {
      rule_name: ruleName,
      source_module: sourceModule,
      target_module: targetModule,
      rule_type: ruleType,
      severity_levels: severityLevels,
      recurrence_threshold: recurrenceThreshold ? Number(recurrenceThreshold) : null,
      risk_levels: riskLevels,
      supplier_related: supplierRelated,
      customer_impact: customerImpact,
      action_type: actionType,
      active,
      justification_required: justificationRequired,
      rule_description: ruleDescription || null,
    };

    if (editingRuleId) {
      const { error } = await supabase
        .from("governance_rules")
        .update(payload)
        .eq("id", editingRuleId);

      if (error) return alert(error.message);
      alert("Governance rule updated.");
    } else {
      const { error } = await supabase.from("governance_rules").insert(payload);
      if (error) return alert(error.message);
      alert("Governance rule created.");
    }

    resetForm();
    setShowCreateRule(false);
    fetchRules();
  };

  const deactivateRule = async (rule: any) => {
    const confirmed = window.confirm(`Deactivate governance rule: ${rule.rule_name}?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from("governance_rules")
      .update({ active: false })
      .eq("id", rule.id);

    if (error) return alert(error.message);
    fetchRules();
  };

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "flex-start",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "6px" }}>Governance Rules</h1>
          <p style={{ color: "#4b5563", marginTop: 0 }}>
            Configure customer-specific, risk-based escalation rules without hardcoding workflow triggers.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/suppliers">Supplier Quality</Link>
          <Link href="/ncmrs">NCMRs</Link>
          <Link href="/capa">CAPA</Link>
        </div>
      </div>

      <section style={sectionStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ marginTop: 0 }}>Create / Edit Governance Rule</h2>
            <p style={{ color: "#4b5563", marginTop: 0 }}>
              Prefer “Require Evaluation” over automatic creation to preserve risk-based decision making.
            </p>
          </div>

          {!showCreateRule ? (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowCreateRule(true);
              }}
              style={primaryButtonStyle}
            >
              + Create Rule
            </button>
          ) : null}
        </div>

        {showCreateRule ? (
          <div
            style={{
              border: "1px solid #d1d5db",
              borderRadius: "10px",
              padding: "14px",
              background: "#f9fafb",
              marginTop: "12px",
            }}
          >
            <FormField label="Rule Name">
              <input
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="Example: Critical NCMR requires CAPA evaluation"
                style={standardInputStyle}
              />
            </FormField>

            <FormField label="Rule Description">
              <textarea
                value={ruleDescription}
                onChange={(e) => setRuleDescription(e.target.value)}
                rows={3}
                placeholder="Explain the intent of this governance rule."
                style={standardTextareaStyle}
              />
            </FormField>

            <FormField label="Source Module">
              <select value={sourceModule} onChange={(e) => setSourceModule(e.target.value)} style={standardInputStyle}>
                <option value="receiving_inspection">Receiving Inspection</option>
                <option value="ncmr">NCMR</option>
                <option value="scar">SCAR</option>
                <option value="capa">CAPA</option>
                <option value="audit">Audit</option>
                <option value="oos_oot">OOS/OOT</option>
                <option value="complaint">Complaint</option>
              </select>
            </FormField>

            <FormField label="Target Module">
              <select value={targetModule} onChange={(e) => setTargetModule(e.target.value)} style={standardInputStyle}>
                <option value="ncmr">NCMR</option>
                <option value="scar">SCAR</option>
                <option value="capa">CAPA</option>
                <option value="audit">Audit</option>
                <option value="management_review">Management Review</option>
              </select>
            </FormField>

            <FormField label="Rule Type">
              <select value={ruleType} onChange={(e) => setRuleType(e.target.value)} style={standardInputStyle}>
                <option value="severity_based">Severity Based</option>
                <option value="recurrence_based">Recurrence Based</option>
                <option value="risk_based">Risk Based</option>
                <option value="supplier_based">Supplier Based</option>
                <option value="audit_finding_based">Audit Finding Based</option>
                <option value="custom">Custom</option>
              </select>
            </FormField>

            <div style={{ marginBottom: "12px" }}>
              <label>Severity Levels</label>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "6px" }}>
                {["minor", "major", "critical"].map((severity) => (
                  <label key={severity}>
                    <input
                      type="checkbox"
                      checked={severityLevels.includes(severity)}
                      onChange={() => toggleValue(severity, severityLevels, setSeverityLevels)}
                    />{" "}
                    {severity}
                  </label>
                ))}
              </div>
            </div>

            <FormField label="Recurrence Threshold">
              <input
                type="number"
                value={recurrenceThreshold}
                onChange={(e) => setRecurrenceThreshold(e.target.value)}
                placeholder="Example: 3"
                style={standardInputStyle}
              />
            </FormField>

            <div style={{ marginBottom: "12px" }}>
              <label>Risk Levels</label>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "6px" }}>
                {["low", "medium", "high", "critical"].map((risk) => (
                  <label key={risk}>
                    <input
                      type="checkbox"
                      checked={riskLevels.includes(risk)}
                      onChange={() => toggleValue(risk, riskLevels, setRiskLevels)}
                    />{" "}
                    {risk}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "12px", display: "grid", gap: "8px" }}>
              <label>
                <input type="checkbox" checked={supplierRelated} onChange={(e) => setSupplierRelated(e.target.checked)} /> Supplier related condition
              </label>
              <label>
                <input type="checkbox" checked={customerImpact} onChange={(e) => setCustomerImpact(e.target.checked)} /> Customer impact condition
              </label>
              <label>
                <input type="checkbox" checked={justificationRequired} onChange={(e) => setJustificationRequired(e.target.checked)} /> Justification required if user chooses not to escalate
              </label>
              <label>
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
              </label>
            </div>

            <FormField label="Action Type">
              <select value={actionType} onChange={(e) => setActionType(e.target.value)} style={standardInputStyle}>
                <option value="suggest_ncmr">Suggest NCMR</option>
                <option value="require_ncmr_evaluation">Require NCMR Evaluation</option>
                <option value="suggest_scar">Suggest SCAR</option>
                <option value="require_scar_evaluation">Require SCAR Evaluation</option>
                <option value="suggest_capa">Suggest CAPA</option>
                <option value="require_capa_evaluation">Require CAPA Evaluation</option>
                <option value="mandatory_escalation">Mandatory Escalation</option>
              </select>
            </FormField>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button" onClick={saveRule} style={primaryButtonStyle}>
                {editingRuleId ? "Update Rule" : "Save Rule"}
              </button>

              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowCreateRule(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Governance Rules Register</h2>

        {loading ? (
          <p>Loading governance rules...</p>
        ) : rules.length === 0 ? (
          <EmptyStateCard
            title="No governance rules configured"
            message="Create rules to enable customer-configurable, risk-based workflow escalation."
          />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Rule Name</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Target</th>
                <th style={thStyle}>Rule Type</th>
                <th style={thStyle}>Criteria</th>
                <th style={thStyle}>Action</th>
                <th style={thStyle}>Justification</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td style={tdStyle}>
                    <strong>{rule.rule_name}</strong>
                    {rule.rule_description ? (
                      <div style={{ color: "#6b7280", fontSize: "12px", marginTop: "4px" }}>
                        {rule.rule_description}
                      </div>
                    ) : null}
                  </td>
                  <td style={tdStyle}>{rule.source_module}</td>
                  <td style={tdStyle}>{rule.target_module}</td>
                  <td style={tdStyle}>{rule.rule_type}</td>
                  <td style={tdStyle}>
                    <div><strong>Severity:</strong> {(rule.severity_levels || []).join(", ") || "Any"}</div>
                    <div><strong>Risk:</strong> {(rule.risk_levels || []).join(", ") || "Any"}</div>
                    <div><strong>Recurrence:</strong> {rule.recurrence_threshold ?? "N/A"}</div>
                    <div><strong>Supplier Related:</strong> {rule.supplier_related ? "Yes" : "No"}</div>
                    <div><strong>Customer Impact:</strong> {rule.customer_impact ? "Yes" : "No"}</div>
                  </td>
                  <td style={tdStyle}><StatusBadge status={rule.action_type} /></td>
                  <td style={tdStyle}>{rule.justification_required ? "Required" : "Optional"}</td>
                  <td style={tdStyle}><StatusBadge status={rule.active ? "Active" : "Inactive"} /></td>
                  <td style={tdStyle}>
                    <button type="button" onClick={() => startEdit(rule)}>Edit</button>
                    {rule.active ? (
                      <button type="button" onClick={() => deactivateRule(rule)} style={{ marginLeft: "8px" }}>
                        Deactivate
                      </button>
                    ) : null}
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

const sectionStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "20px",
  background: "white",
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
