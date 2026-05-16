"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import {
  StatusBadge,
  EmptyStateCard,
  FormField,
  standardInputStyle,
  standardTextareaStyle,
  primaryButtonStyle,
} from "../../components/workflow/WorkflowComponents";

type SupplierOption = {
  id: string;
  supplier_name: string;
  supplier_number: string | null;
  supplier_status: string | null;
  supplier_risk_level: string | null;
};

export default function GlobalSupplierAuditsPage() {
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateAudit, setShowCreateAudit] = useState(false);
  const [search, setSearch] = useState("");

  const [supplierId, setSupplierId] = useState("");
  const [auditTitle, setAuditTitle] = useState("");
  const [auditType, setAuditType] = useState("surveillance");
  const [auditMethod, setAuditMethod] = useState("remote");
  const [plannedAuditDate, setPlannedAuditDate] = useState("");
  const [leadAuditor, setLeadAuditor] = useState("");
  const [auditScope, setAuditScope] = useState("");

  const supplierMap = useMemo(() => {
    const map: Record<string, SupplierOption> = {};
    suppliers.forEach((supplier) => {
      map[supplier.id] = supplier;
    });
    return map;
  }, [suppliers]);

  const filteredAudits = audits.filter((audit) => {
    const supplier = supplierMap[audit.supplier_id];
    const haystack = [
      audit.audit_title,
      audit.audit_type,
      audit.audit_method,
      audit.audit_status,
      audit.audit_result,
      supplier?.supplier_name,
      supplier?.supplier_number,
      audit.lead_auditor,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return search.trim()
      ? haystack.includes(search.trim().toLowerCase())
      : true;
  });

  const fetchData = async () => {
    setLoading(true);

    const suppliersRes = await supabase
      .from("suppliers")
      .select("id, supplier_name, supplier_number, supplier_status, supplier_risk_level")
      .order("supplier_name", { ascending: true });

    if (suppliersRes.error) {
      alert(suppliersRes.error.message);
      setLoading(false);
      return;
    }

    setSuppliers(suppliersRes.data || []);

    const auditsRes = await supabase
      .from("supplier_audits")
      .select("*")
      .order("created_at", { ascending: false });

    if (auditsRes.error) {
      alert(auditsRes.error.message);
      setLoading(false);
      return;
    }

    setAudits(auditsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetAuditForm = () => {
    setSupplierId("");
    setAuditTitle("");
    setAuditType("surveillance");
    setAuditMethod("remote");
    setPlannedAuditDate("");
    setLeadAuditor("");
    setAuditScope("");
  };

  const createAudit = async () => {
    if (!supplierId) return alert("Supplier is required.");
    if (!auditTitle.trim()) return alert("Audit title is required.");
    if (!plannedAuditDate) return alert("Planned audit date is required.");

    const selectedSupplier = supplierMap[supplierId];
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { data, error } = await supabase
      .from("supplier_audits")
      .insert({
        supplier_id: supplierId,
        audit_title: auditTitle,
        audit_type: auditType,
        audit_method: auditMethod,
        planned_audit_date: plannedAuditDate,
        lead_auditor: leadAuditor,
        audit_scope: auditScope,
        audit_status: "planned",
        created_by: userEmail,
      })
      .select()
      .single();

    if (error) return alert(error.message);

    await supabase.from("audit_logs").insert({
      entity_type: "supplier_audit",
      entity_id: data.id,
      action: "supplier_audit_created",
      details: `Supplier audit created for ${selectedSupplier?.supplier_name || "supplier"}.`,
      user_email: userEmail,
    });

    alert("Supplier audit created.");
    resetAuditForm();
    setShowCreateAudit(false);
    fetchData();
  };

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" }}>
        <div>
          <h1 style={{ marginBottom: "6px" }}>Global Supplier Audits</h1>
          <p style={{ color: "#4b5563", marginTop: 0 }}>Create and view supplier audits across all suppliers.</p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/suppliers">Supplier Quality</Link>
          <Link href="/supplier-quality/scars">SCARs</Link>
          <Link href="/supplier-quality/scorecards">Scorecards</Link>
        </div>
      </div>

      <section style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Create Supplier Audit</h2>
            <p style={{ color: "#4b5563", marginTop: 0 }}>Select a supplier, then create a qualification, surveillance, for-cause, or requalification audit.</p>
          </div>

          {!showCreateAudit ? (
            <button type="button" onClick={() => setShowCreateAudit(true)} style={primaryButtonStyle}>
              + Create Audit
            </button>
          ) : null}
        </div>

        {showCreateAudit ? (
          <div style={{ border: "1px solid #d1d5db", borderRadius: "10px", padding: "14px", background: "#f9fafb", marginTop: "12px" }}>
            <FormField label="Supplier">
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} style={standardInputStyle}>
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplier_number ? `${supplier.supplier_number} - ` : ""}
                    {supplier.supplier_name}
                  </option>
                ))}
              </select>
            </FormField>

            {supplierId ? (
              <div style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px", background: "white", marginBottom: "12px" }}>
                <strong>Selected Supplier</strong>
                <div style={{ marginTop: "6px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <StatusBadge status={supplierMap[supplierId]?.supplier_status || "unknown"} />
                  <StatusBadge status={supplierMap[supplierId]?.supplier_risk_level || "unknown"} />
                  <Link href={`/suppliers/${supplierId}`}>Open Supplier Profile</Link>
                </div>
              </div>
            ) : null}

            <FormField label="Audit Title">
              <input value={auditTitle} onChange={(e) => setAuditTitle(e.target.value)} style={standardInputStyle} />
            </FormField>

            <FormField label="Audit Type">
              <select value={auditType} onChange={(e) => setAuditType(e.target.value)} style={standardInputStyle}>
                <option value="qualification">Qualification</option>
                <option value="surveillance">Surveillance</option>
                <option value="for_cause">For Cause</option>
                <option value="requalification">Requalification</option>
              </select>
            </FormField>

            <FormField label="Audit Method">
              <select value={auditMethod} onChange={(e) => setAuditMethod(e.target.value)} style={standardInputStyle}>
                <option value="remote">Remote</option>
                <option value="onsite">Onsite</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </FormField>

            <FormField label="Planned Audit Date">
              <input type="date" value={plannedAuditDate} onChange={(e) => setPlannedAuditDate(e.target.value)} style={standardInputStyle} />
            </FormField>

            <FormField label="Lead Auditor">
              <input value={leadAuditor} onChange={(e) => setLeadAuditor(e.target.value)} style={standardInputStyle} />
            </FormField>

            <FormField label="Audit Scope">
              <textarea value={auditScope} onChange={(e) => setAuditScope(e.target.value)} rows={4} style={standardTextareaStyle} />
            </FormField>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button" onClick={createAudit}>Create Audit</button>
              <button type="button" onClick={() => { resetAuditForm(); setShowCreateAudit(false); }}>Cancel</button>
            </div>
          </div>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Supplier Audit Register</h2>

        <div style={{ marginBottom: "14px" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search audits by supplier, title, status, auditor" style={{ padding: "10px", width: "360px", maxWidth: "100%" }} />
          <span style={{ marginLeft: "10px", color: "#6b7280" }}>Showing {filteredAudits.length} of {audits.length}</span>
        </div>

        {loading ? (
          <p>Loading audits...</p>
        ) : audits.length === 0 ? (
          <EmptyStateCard title="No supplier audits recorded" message="Create an audit from this page or from a supplier profile." />
        ) : filteredAudits.length === 0 ? (
          <EmptyStateCard title="No audits match the search" message="Adjust the search field to view more supplier audits." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Supplier</th>
                <th style={thStyle}>Audit Title</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Method</th>
                <th style={thStyle}>Planned Date</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Result</th>
                <th style={thStyle}>Score</th>
                <th style={thStyle}>Open</th>
              </tr>
            </thead>
            <tbody>
              {filteredAudits.map((audit) => {
                const supplier = supplierMap[audit.supplier_id];

                return (
                  <tr key={audit.id}>
                    <td style={tdStyle}>{supplier ? <Link href={`/suppliers/${supplier.id}`}>{supplier.supplier_name}</Link> : "N/A"}</td>
                    <td style={tdStyle}>{audit.audit_title || "Untitled"}</td>
                    <td style={tdStyle}>{audit.audit_type || "N/A"}</td>
                    <td style={tdStyle}>{audit.audit_method || "N/A"}</td>
                    <td style={tdStyle}>{audit.planned_audit_date || "N/A"}</td>
                    <td style={tdStyle}><StatusBadge status={audit.audit_status || "planned"} /></td>
                    <td style={tdStyle}><StatusBadge status={audit.audit_result || "N/A"} /></td>
                    <td style={tdStyle}>{audit.compliance_score ?? "N/A"}</td>
                    <td style={tdStyle}>{audit.supplier_id ? <Link href={`/suppliers/${audit.supplier_id}/audits/${audit.id}`}>Open Audit</Link> : "N/A"}</td>
                  </tr>
                );
              })}
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
