"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const IMPACT_AREAS = [
  ["product_design", "Product / Design"],
  ["manufacturing_process", "Manufacturing / Process"],
  ["tooling_equipment", "Tooling / Equipment"],
  ["inspection_test_methods", "Inspection / Test Methods"],
  ["specifications", "Specifications"],
  ["supplier", "Supplier"],
  ["inventory_wip", "Inventory / WIP"],
  ["regulatory_risk", "Regulatory / Risk"],
  ["validation", "Validation"],
  ["training", "Training"],
] as const;

type Assessment = {
  id: string;
  impact_area: string;
  is_impacted: boolean | null;
  assessment: string | null;
  disposition_required: boolean;
  disposition_summary: string | null;
};

export default function DocumentImpactAssessment({
  documentId,
  tenantId,
  documentNumber,
  revision,
  status,
  userEmail,
  canManage,
}: {
  documentId: string;
  tenantId: string;
  documentNumber: string;
  revision: string;
  status: string;
  userEmail: string;
  canManage: boolean;
}) {
  const [rows, setRows] = useState<Assessment[]>([]);
  const [busy, setBusy] = useState(false);

  const editableAssessment = canManage && ["draft", "rejected", "collaboration"].includes(status);

  const load = async () => {
    const assessmentRes = await supabase
      .from("document_impact_assessments")
      .select("*")
      .eq("document_id", documentId)
      .order("impact_area");
    if (assessmentRes.error) throw new Error(assessmentRes.error.message);
    setRows((assessmentRes.data || []) as Assessment[]);
  };

  useEffect(() => { load().catch((e) => alert(e.message)); }, [documentId]);

  const rowMap = useMemo(() => new Map(rows.map((row) => [row.impact_area, row])), [rows]);

  const saveArea = async (area: string, patch: Partial<Assessment>) => {
    if (!editableAssessment) return;
    setBusy(true);
    try {
      const current = rowMap.get(area);
      const payload = {
        tenant_id: tenantId,
        document_id: documentId,
        impact_area: area,
        is_impacted: patch.is_impacted !== undefined ? patch.is_impacted : current?.is_impacted ?? null,
        assessment: patch.assessment !== undefined ? patch.assessment : current?.assessment ?? null,
        disposition_required: false,
        disposition_summary: patch.disposition_summary !== undefined ? patch.disposition_summary : current?.disposition_summary ?? null,
        assessed_by: userEmail,
        assessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (payload.is_impacted === false) {
        payload.assessment = null;
        payload.disposition_required = false;
        payload.disposition_summary = null;
      }
      const { error } = await supabase.from("document_impact_assessments").upsert(payload, { onConflict: "document_id,impact_area" });
      if (error) throw new Error(error.message);
      await load();
    } catch (e: any) { alert(e.message); }
    setBusy(false);
  };

  const completedAreas = IMPACT_AREAS.filter(([key]) => rowMap.get(key)?.is_impacted !== null && rowMap.get(key)?.is_impacted !== undefined).length;

  return (
    <section style={{ border: "1px solid #d8dee8", borderRadius: 12, padding: 18, marginTop: 18, background: "#fff" }}>
      <h2 style={{ marginTop: 0 }}>Impact Assessment</h2>
      <p style={{ color: "#596579" }}>
        Assess every area independently. Selecting No ends that area's path. Selecting Yes opens the impact assessment.
        Use the assessment to identify post-approval requirements. Task assignment occurs only after formal approval.
      </p>
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <strong>Areas assessed: {completedAreas}/{IMPACT_AREAS.length}</strong>
      </div>

      {IMPACT_AREAS.map(([key, label]) => {
        const row = rowMap.get(key);
        return (
          <div key={key} style={{ borderTop: "1px solid #e6eaf0", padding: "16px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1fr) 180px", gap: 12, alignItems: "center" }}>
              <strong>{label}</strong>
              <select disabled={!editableAssessment || busy} value={row?.is_impacted === true ? "yes" : row?.is_impacted === false ? "no" : ""} onChange={(e) => saveArea(key, { is_impacted: e.target.value === "yes" ? true : e.target.value === "no" ? false : null })} style={inputStyle}>
                <option value="">Select Yes / No</option>
                <option value="yes">Yes — Impacted</option>
                <option value="no">No — Not Impacted</option>
              </select>
            </div>

            {row?.is_impacted === true ? (
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Impact Assessment</label>
                <textarea disabled={!editableAssessment} defaultValue={row.assessment || ""} onBlur={(e) => saveArea(key, { assessment: e.target.value })} rows={3} style={textareaStyle} placeholder={`Describe the ${label.toLowerCase()} impact.`} />
                <label style={labelStyle}>Post-Approval Requirements / Notes</label>
                <textarea
                  disabled={!editableAssessment}
                  defaultValue={row.disposition_summary || ""}
                  onBlur={(e) => saveArea(key, { disposition_summary: e.target.value })}
                  rows={2}
                  style={textareaStyle}
                  placeholder="Identify anticipated post-approval needs, such as validation, TMV, product disposition, regulatory approval, supplier approval, or classroom training."
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 10px", border: "1px solid #cbd3df", borderRadius: 6, boxSizing: "border-box" };
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: "vertical", marginTop: 6 };
const labelStyle: React.CSSProperties = { display: "block", fontWeight: 600, marginTop: 8 };
const buttonStyle: React.CSSProperties = { border: 0, borderRadius: 6, padding: "9px 13px", cursor: "pointer", background: "#172033", color: "#fff", fontWeight: 600 };
const secondaryButtonStyle: React.CSSProperties = { ...buttonStyle, background: "#fff", color: "#172033", border: "1px solid #9aa6b6" };
