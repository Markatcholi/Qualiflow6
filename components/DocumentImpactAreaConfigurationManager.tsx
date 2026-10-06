"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type ImpactAreaItem = {
  id: string;
  code: string;
  label: string;
  sort_order: number;
  behavior_type: string;
  is_active: boolean;
  is_system_seed: boolean;
};

export default function DocumentImpactAreaConfigurationManager({ tenantId }: { tenantId: string }) {
  const [impactAreas, setImpactAreas] = useState<ImpactAreaItem[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from("md_document_impact_areas")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("sort_order")
      .order("label");
    if (error) return setMessage(error.message);
    setImpactAreas((data as ImpactAreaItem[]) || []);
  };

  useEffect(() => { load(); }, [tenantId]);

  const add = async () => {
    const code = newCode.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const label = newLabel.trim();
    if (!code || !label) return setMessage("Impact Area code and label are required.");
    const nextOrder = impactAreas.length ? Math.max(...impactAreas.map((area) => Number(area.sort_order || 0))) + 10 : 10;
    setBusy(true);
    const { error } = await supabase.from("md_document_impact_areas").insert({
      tenant_id: tenantId, code, label, sort_order: nextOrder,
      behavior_type: "generic", is_active: true, is_system_seed: false,
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    setNewCode(""); setNewLabel(""); setMessage("Impact Assessment Area added successfully.");
    await load();
  };

  const save = async (item: ImpactAreaItem) => {
    setBusy(true);
    const { error } = await supabase.from("md_document_impact_areas")
      .update({ label: item.label.trim(), sort_order: Number(item.sort_order || 0), is_active: item.is_active })
      .eq("id", item.id).eq("tenant_id", tenantId);
    setBusy(false);
    if (error) return setMessage(error.message);
    setMessage("Impact Assessment Area updated successfully.");
    await load();
  };

  const remove = async (item: ImpactAreaItem) => {
    const { count, error: countError } = await supabase.from("document_impact_assessments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("impact_area", item.code);
    if (countError) return setMessage(countError.message);

    setBusy(true);
    if ((count || 0) > 0) {
      const { error } = await supabase.from("md_document_impact_areas")
        .update({ is_active: false }).eq("id", item.id).eq("tenant_id", tenantId);
      setBusy(false);
      if (error) return setMessage(error.message);
      setMessage("This Impact Assessment Area has historical use, so it was deactivated rather than deleted.");
    } else {
      if (!window.confirm(`Delete Impact Assessment Area "${item.label}"? It has not been used in an assessment.`)) {
        setBusy(false); return;
      }
      const { error } = await supabase.from("md_document_impact_areas")
        .delete().eq("id", item.id).eq("tenant_id", tenantId);
      setBusy(false);
      if (error) return setMessage(error.message);
      setMessage("Impact Assessment Area deleted.");
    }
    await load();
  };

  const sectionStyle: React.CSSProperties = { border: "1px solid #ccc", padding: 16, marginBottom: 20, borderRadius: 8 };
  const inputStyle: React.CSSProperties = { padding: 8, marginRight: 8, marginBottom: 8 };
  const selectStyle: React.CSSProperties = { padding: 8, marginRight: 8, marginBottom: 8, minWidth: 140 };

  return (
    <section style={sectionStyle}>
      <h2>Controlled Document Impact Assessment Areas</h2>
      <p style={{ color: "#4b5563" }}>
        QualiSphere provides a starter assessment framework. Add, rename, reorder, activate, or deactivate areas for this Company Account. Areas already used in historical assessments are deactivated instead of deleted.
      </p>
      {message ? <p>{message}</p> : null}
      <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Code, e.g. sterilization" style={inputStyle} />
      <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label, e.g. Sterilization" style={{ ...inputStyle, minWidth: 260 }} />
      <button onClick={add} disabled={busy}>Add Impact Area</button>
      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th align="left">Code</th><th align="left">Label</th><th align="left">Order</th><th align="left">Status</th><th align="left">Actions</th></tr></thead>
          <tbody>
            {impactAreas.map((item) => (
              <tr key={item.id}>
                <td>{item.code}</td>
                <td><input value={item.label} onChange={(e) => setImpactAreas((current) => current.map((area) => area.id === item.id ? { ...area, label: e.target.value } : area))} style={inputStyle} /></td>
                <td><input type="number" value={item.sort_order} onChange={(e) => setImpactAreas((current) => current.map((area) => area.id === item.id ? { ...area, sort_order: Number(e.target.value) } : area))} style={{ ...inputStyle, width: 80 }} /></td>
                <td><select value={item.is_active ? "active" : "inactive"} onChange={(e) => setImpactAreas((current) => current.map((area) => area.id === item.id ? { ...area, is_active: e.target.value === "active" } : area))} style={selectStyle}><option value="active">Active</option><option value="inactive">Inactive</option></select></td>
                <td><button onClick={() => save(item)} disabled={busy} style={{ marginRight: 8 }}>Save</button><button onClick={() => remove(item)} disabled={busy}>{item.is_active ? "Remove" : "Delete / Keep Inactive"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
