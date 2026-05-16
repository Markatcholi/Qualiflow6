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

type SupplierRecord = {
  id: string;
  supplier_number: string | null;
  supplier_name: string | null;
  supplier_category: string | null;
  supplier_status: string | null;
  supplier_risk_level: string | null;
  iso_expiration_date: string | null;
  receiving_inspection_enabled: boolean | null;
  qualification_status: string | null;
  qualification_decision: string | null;
  qualification_decision_justification: string | null;
  asl_status: string | null;
  asl_approval_scope: string | null;
  asl_qualification_basis: string | null;
  supplier_criticality: string | null;
  requalification_due_date: string | null;
  asl_approved_by: string | null;
  asl_approved_at: string | null;
};

export default function GlobalAslQualificationPage() {
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [editingSupplierId, setEditingSupplierId] = useState("");

  const [supplierStatus, setSupplierStatus] = useState("");
  const [supplierRiskLevel, setSupplierRiskLevel] = useState("");
  const [qualificationStatus, setQualificationStatus] = useState("");
  const [qualificationDecision, setQualificationDecision] = useState("");
  const [qualificationJustification, setQualificationJustification] = useState("");
  const [aslStatus, setAslStatus] = useState("");
  const [aslApprovalScope, setAslApprovalScope] = useState("");
  const [aslQualificationBasis, setAslQualificationBasis] = useState("");
  const [supplierCriticality, setSupplierCriticality] = useState("");
  const [requalificationDueDate, setRequalificationDueDate] = useState("");
  const [receivingInspectionEnabled, setReceivingInspectionEnabled] = useState(false);

  const selectedSupplier = useMemo(() => {
    return suppliers.find((supplier) => supplier.id === editingSupplierId) || null;
  }, [suppliers, editingSupplierId]);

  const filteredSuppliers = suppliers.filter((supplier) => {
    const haystack = [
      supplier.supplier_number,
      supplier.supplier_name,
      supplier.supplier_category,
      supplier.supplier_status,
      supplier.supplier_risk_level,
      supplier.qualification_status,
      supplier.asl_status,
      supplier.supplier_criticality,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = search.trim()
      ? haystack.includes(search.trim().toLowerCase())
      : true;

    const matchesStatus = statusFilter
      ? supplier.supplier_status === statusFilter || supplier.asl_status === statusFilter
      : true;

    const matchesRisk = riskFilter ? supplier.supplier_risk_level === riskFilter : true;

    return matchesSearch && matchesStatus && matchesRisk;
  });

  const fetchSuppliers = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("supplier_name", { ascending: true });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setSuppliers((data as SupplierRecord[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const startEdit = (supplier: SupplierRecord) => {
    setEditingSupplierId(supplier.id);
    setSupplierStatus(supplier.supplier_status || "approved");
    setSupplierRiskLevel(supplier.supplier_risk_level || "medium");
    setQualificationStatus(supplier.qualification_status || "qualified");
    setQualificationDecision(supplier.qualification_decision || "");
    setQualificationJustification(supplier.qualification_decision_justification || "");
    setAslStatus(supplier.asl_status || supplier.supplier_status || "approved");
    setAslApprovalScope(supplier.asl_approval_scope || "");
    setAslQualificationBasis(supplier.asl_qualification_basis || "");
    setSupplierCriticality(supplier.supplier_criticality || "non_critical");
    setRequalificationDueDate(supplier.requalification_due_date || "");
    setReceivingInspectionEnabled(!!supplier.receiving_inspection_enabled);
  };

  const cancelEdit = () => {
    setEditingSupplierId("");
    setSupplierStatus("");
    setSupplierRiskLevel("");
    setQualificationStatus("");
    setQualificationDecision("");
    setQualificationJustification("");
    setAslStatus("");
    setAslApprovalScope("");
    setAslQualificationBasis("");
    setSupplierCriticality("");
    setRequalificationDueDate("");
    setReceivingInspectionEnabled(false);
  };

  const saveAslQualification = async () => {
    if (!editingSupplierId) {
      alert("Select a supplier first.");
      return;
    }

    if (!qualificationDecision.trim()) {
      alert("Qualification decision is required.");
      return;
    }

    if (!qualificationJustification.trim()) {
      alert("Qualification decision justification is required.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("suppliers")
      .update({
        supplier_status: supplierStatus,
        supplier_risk_level: supplierRiskLevel,
        qualification_status: qualificationStatus,
        qualification_decision: qualificationDecision,
        qualification_decision_justification: qualificationJustification,
        asl_status: aslStatus,
        asl_approval_scope: aslApprovalScope,
        asl_qualification_basis: aslQualificationBasis,
        supplier_criticality: supplierCriticality,
        requalification_due_date: requalificationDueDate || null,
        receiving_inspection_enabled: receivingInspectionEnabled,
        asl_approved_by: userEmail,
        asl_approved_at: now,
        updated_at: now,
      })
      .eq("id", editingSupplierId);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: "supplier",
      entity_id: editingSupplierId,
      action: "global_asl_qualification_updated",
      details: `Global ASL / Qualification decision updated. Status: ${supplierStatus}. ASL: ${aslStatus}. Qualification: ${qualificationStatus}.`,
      user_email: userEmail,
    });

    alert("ASL / Qualification decision saved.");
    cancelEdit();
    fetchSuppliers();
  };

  const approvedCount = suppliers.filter(
    (supplier) =>
      supplier.asl_status === "approved" ||
      supplier.supplier_status === "approved" ||
      supplier.qualification_status === "qualified"
  ).length;

  const atRiskCount = suppliers.filter(
    (supplier) =>
      supplier.supplier_risk_level === "high" ||
      supplier.asl_status === "probation" ||
      supplier.supplier_status === "probation"
  ).length;

  const inspectionEnabledCount = suppliers.filter(
    (supplier) => supplier.receiving_inspection_enabled
  ).length;

  const requalificationDueCount = suppliers.filter((supplier) => {
    if (!supplier.requalification_due_date) return false;
    const due = new Date(supplier.requalification_due_date).getTime();
    const today = new Date().getTime();
    const days = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return days <= 60;
  }).length;

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "6px" }}>Global ASL / Qualification</h1>
          <p style={{ color: "#4b5563", marginTop: 0 }}>
            Centralized approved supplier list governance, qualification decisions,
            supplier status, risk, requalification, and receiving inspection controls.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/suppliers">Supplier Quality</Link>
          <Link href="/supplier-quality/audits">Audits</Link>
          <Link href="/supplier-quality/documents">Documents</Link>
          <Link href="/supplier-quality/receiving-inspections">Receiving Inspection</Link>
        </div>
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <MetricCard label="Total Suppliers" value={suppliers.length} />
        <MetricCard label="Approved / Qualified" value={approvedCount} />
        <MetricCard label="At Risk / Probation" value={atRiskCount} />
        <MetricCard label="Receiving Inspection Enabled" value={inspectionEnabledCount} />
        <MetricCard label="Requalification Due ≤ 60 Days" value={requalificationDueCount} />
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Search / Filters</h2>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search supplier, category, status, risk"
            style={{ padding: "10px", width: "340px", maxWidth: "100%" }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "10px" }}
          >
            <option value="">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="qualified">Qualified</option>
            <option value="conditional">Conditional</option>
            <option value="probation">Probation</option>
            <option value="disqualified">Disqualified</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            style={{ padding: "10px" }}
          >
            <option value="">All Risk Levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setRiskFilter("");
            }}
          >
            Clear Filters
          </button>

          <span style={{ color: "#6b7280" }}>
            Showing {filteredSuppliers.length} of {suppliers.length}
          </span>
        </div>
      </section>

      {editingSupplierId && selectedSupplier ? (
        <section style={sectionStyle}>
          <h2 style={{ marginTop: 0 }}>
            Edit ASL / Qualification — {selectedSupplier.supplier_name}
          </h2>

          <div style={{ marginBottom: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <StatusBadge status={selectedSupplier.supplier_status || "unknown"} />
            <StatusBadge status={selectedSupplier.supplier_risk_level || "unknown"} />
            <Link href={`/suppliers/${selectedSupplier.id}`}>Open Supplier Profile</Link>
          </div>

          <FormField label="Supplier Status">
            <select
              value={supplierStatus}
              onChange={(e) => setSupplierStatus(e.target.value)}
              style={standardInputStyle}
            >
              <option value="approved">Approved</option>
              <option value="conditional">Conditional</option>
              <option value="probation">Probation</option>
              <option value="disqualified">Disqualified</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormField>

          <FormField label="Supplier Risk Level">
            <select
              value={supplierRiskLevel}
              onChange={(e) => setSupplierRiskLevel(e.target.value)}
              style={standardInputStyle}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </FormField>

          <FormField label="Qualification Status">
            <select
              value={qualificationStatus}
              onChange={(e) => setQualificationStatus(e.target.value)}
              style={standardInputStyle}
            >
              <option value="qualified">Qualified</option>
              <option value="conditionally_qualified">Conditionally Qualified</option>
              <option value="pending_qualification">Pending Qualification</option>
              <option value="not_qualified">Not Qualified</option>
            </select>
          </FormField>

          <FormField label="Qualification Decision">
            <input
              value={qualificationDecision}
              onChange={(e) => setQualificationDecision(e.target.value)}
              placeholder="Example: Approved for critical components with annual surveillance"
              style={standardInputStyle}
            />
          </FormField>

          <FormField label="Qualification Decision Justification">
            <textarea
              value={qualificationJustification}
              onChange={(e) => setQualificationJustification(e.target.value)}
              rows={4}
              style={standardTextareaStyle}
            />
          </FormField>

          <FormField label="ASL Status">
            <select
              value={aslStatus}
              onChange={(e) => setAslStatus(e.target.value)}
              style={standardInputStyle}
            >
              <option value="approved">Approved</option>
              <option value="conditional">Conditional</option>
              <option value="probation">Probation</option>
              <option value="disqualified">Disqualified</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormField>

          <FormField label="ASL Approval Scope">
            <textarea
              value={aslApprovalScope}
              onChange={(e) => setAslApprovalScope(e.target.value)}
              rows={3}
              placeholder="Example: Approved for raw material supply, coating service, sterilization service, etc."
              style={standardTextareaStyle}
            />
          </FormField>

          <FormField label="ASL Qualification Basis">
            <textarea
              value={aslQualificationBasis}
              onChange={(e) => setAslQualificationBasis(e.target.value)}
              rows={3}
              placeholder="Example: ISO certificate, supplier audit, quality agreement, historical performance, risk assessment."
              style={standardTextareaStyle}
            />
          </FormField>

          <FormField label="Supplier Criticality">
            <select
              value={supplierCriticality}
              onChange={(e) => setSupplierCriticality(e.target.value)}
              style={standardInputStyle}
            >
              <option value="non_critical">Non-Critical</option>
              <option value="critical">Critical</option>
              <option value="single_source">Single Source</option>
              <option value="critical_single_source">Critical Single Source</option>
            </select>
          </FormField>

          <FormField label="Requalification Due Date">
            <input
              type="date"
              value={requalificationDueDate}
              onChange={(e) => setRequalificationDueDate(e.target.value)}
              style={standardInputStyle}
            />
          </FormField>

          <div style={{ marginBottom: "14px" }}>
            <label>
              <input
                type="checkbox"
                checked={receivingInspectionEnabled}
                onChange={(e) => setReceivingInspectionEnabled(e.target.checked)}
              />{" "}
              Enable Receiving Inspection for this supplier
            </label>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" onClick={saveAslQualification} style={primaryButtonStyle}>
              Save ASL / Qualification
            </button>

            <button type="button" onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>ASL / Qualification Register</h2>

        {loading ? (
          <p>Loading suppliers...</p>
        ) : suppliers.length === 0 ? (
          <EmptyStateCard
            title="No suppliers found"
            message="Add suppliers before managing ASL and qualification status."
          />
        ) : filteredSuppliers.length === 0 ? (
          <EmptyStateCard
            title="No suppliers match the filters"
            message="Adjust or clear the search filters to view more suppliers."
          />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Supplier</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Supplier Status</th>
                <th style={thStyle}>Risk</th>
                <th style={thStyle}>Qualification</th>
                <th style={thStyle}>ASL Status</th>
                <th style={thStyle}>Criticality</th>
                <th style={thStyle}>Requalification Due</th>
                <th style={thStyle}>Receiving Inspection</th>
                <th style={thStyle}>Last Approved</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td style={tdStyle}>
                    <Link href={`/suppliers/${supplier.id}`}>
                      {supplier.supplier_number ? `${supplier.supplier_number} - ` : ""}
                      {supplier.supplier_name || "Unnamed Supplier"}
                    </Link>
                  </td>
                  <td style={tdStyle}>{supplier.supplier_category || "N/A"}</td>
                  <td style={tdStyle}>
                    <StatusBadge status={supplier.supplier_status || "unknown"} />
                  </td>
                  <td style={tdStyle}>
                    <StatusBadge status={supplier.supplier_risk_level || "unknown"} />
                  </td>
                  <td style={tdStyle}>
                    <StatusBadge status={supplier.qualification_status || "not set"} />
                  </td>
                  <td style={tdStyle}>
                    <StatusBadge status={supplier.asl_status || supplier.supplier_status || "not set"} />
                  </td>
                  <td style={tdStyle}>{supplier.supplier_criticality || "N/A"}</td>
                  <td style={tdStyle}>{supplier.requalification_due_date || "N/A"}</td>
                  <td style={tdStyle}>
                    {supplier.receiving_inspection_enabled ? (
                      <StatusBadge status="Enabled" />
                    ) : (
                      <StatusBadge status="Disabled" />
                    )}
                  </td>
                  <td style={tdStyle}>
                    {supplier.asl_approved_by ? (
                      <>
                        {supplier.asl_approved_by}
                        <br />
                        <span style={{ color: "#6b7280", fontSize: "12px" }}>
                          {supplier.asl_approved_at || "N/A"}
                        </span>
                      </>
                    ) : (
                      "N/A"
                    )}
                  </td>
                  <td style={tdStyle}>
                    <button type="button" onClick={() => startEdit(supplier)}>
                      Edit ASL
                    </button>
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

function MetricCard({ label, value }: { label: string; value: any }) {
  return (
    <div
      style={{
        border: "1px solid #d1d5db",
        borderRadius: "10px",
        padding: "14px",
        background: "#f9fafb",
      }}
    >
      <div style={{ color: "#4b5563", fontSize: "13px", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ fontSize: "24px", fontWeight: 700 }}>{value}</div>
    </div>
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
