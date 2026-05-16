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

export default function GlobalSupplierDocumentsPage() {
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState("");

  const [supplierId, setSupplierId] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("quality_agreement");
  const [documentStatus, setDocumentStatus] = useState("active");
  const [expirationDate, setExpirationDate] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [notes, setNotes] = useState("");

  const supplierMap = useMemo(() => {
    const map: Record<string, SupplierOption> = {};

    suppliers.forEach((supplier) => {
      map[supplier.id] = supplier;
    });

    return map;
  }, [suppliers]);

  const filteredDocuments = documents.filter((doc) => {
    const supplier = supplierMap[doc.supplier_id];

    const haystack = [
      doc.document_name,
      doc.document_type,
      doc.document_status,
      supplier?.supplier_name,
      supplier?.supplier_number,
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
      .select(
        "id, supplier_name, supplier_number, supplier_status, supplier_risk_level"
      )
      .order("supplier_name", { ascending: true });

    if (suppliersRes.error) {
      alert(suppliersRes.error.message);
      setLoading(false);
      return;
    }

    setSuppliers(suppliersRes.data || []);

    const docsRes = await supabase
      .from("supplier_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (docsRes.error) {
      alert(docsRes.error.message);
      setLoading(false);
      return;
    }

    setDocuments(docsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setSupplierId("");
    setDocumentName("");
    setDocumentType("quality_agreement");
    setDocumentStatus("active");
    setExpirationDate("");
    setExternalUrl("");
    setNotes("");
  };

  const addDocument = async () => {
    if (!supplierId) {
      alert("Supplier is required.");
      return;
    }

    if (!documentName.trim()) {
      alert("Document name is required.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    const userEmail = userData?.user?.email || "unknown";

    const { error } = await supabase
      .from("supplier_documents")
      .insert({
        supplier_id: supplierId,
        document_name: documentName,
        document_type: documentType,
        document_status: documentStatus,
        expiration_date: expirationDate || null,
        external_document_url: externalUrl || null,
        notes,
        created_by: userEmail,
      });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Supplier document added.");

    resetForm();
    setShowAddForm(false);
    fetchData();
  };

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "6px" }}>
            Global Supplier Documents
          </h1>

          <p style={{ color: "#4b5563", marginTop: 0 }}>
            Centralized supplier document management across all suppliers.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/suppliers">Supplier Quality</Link>
          <Link href="/supplier-quality/audits">Audits</Link>
          <Link href="/supplier-quality/receiving-inspections">
            Receiving Inspection
          </Link>
        </div>
      </div>

      {/* Add Document */}
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
            <h2 style={{ marginTop: 0 }}>
              Create Supplier Document
            </h2>

            <p style={{ color: "#4b5563", marginTop: 0 }}>
              Create and manage supplier quality agreements, certifications,
              questionnaires, and supplier records.
            </p>
          </div>

          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              style={primaryButtonStyle}
            >
              + Add Document
            </button>
          ) : null}
        </div>

        {showAddForm ? (
          <div
            style={{
              border: "1px solid #d1d5db",
              borderRadius: "10px",
              padding: "14px",
              background: "#f9fafb",
              marginTop: "12px",
            }}
          >
            <FormField label="Supplier">
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                style={standardInputStyle}
              >
                <option value="">Select supplier</option>

                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplier_number
                      ? `${supplier.supplier_number} - `
                      : ""}
                    {supplier.supplier_name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Document Name">
              <input
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                style={standardInputStyle}
              />
            </FormField>

            <FormField label="Document Type">
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                style={standardInputStyle}
              >
                <option value="quality_agreement">
                  Quality Agreement
                </option>

                <option value="iso_certificate">
                  ISO Certificate
                </option>

                <option value="supplier_questionnaire">
                  Supplier Questionnaire
                </option>

                <option value="audit_report">
                  Audit Report
                </option>

                <option value="drawing">
                  Drawing
                </option>

                <option value="specification">
                  Specification
                </option>

                <option value="other">
                  Other
                </option>
              </select>
            </FormField>

            <FormField label="Document Status">
              <select
                value={documentStatus}
                onChange={(e) => setDocumentStatus(e.target.value)}
                style={standardInputStyle}
              >
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="retired">Retired</option>
              </select>
            </FormField>

            <FormField label="Expiration Date">
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                style={standardInputStyle}
              />
            </FormField>

            <FormField label="External URL / Storage Link">
              <input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                style={standardInputStyle}
              />
            </FormField>

            <FormField label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                style={standardTextareaStyle}
              />
            </FormField>

            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" onClick={addDocument}>
                Save Document
              </button>

              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowAddForm(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Document Register */}
      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>
          Supplier Document Register
        </h2>

        <div style={{ marginBottom: "14px" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents"
            style={{
              padding: "10px",
              width: "320px",
              maxWidth: "100%",
            }}
          />

          <span style={{ marginLeft: "10px", color: "#6b7280" }}>
            Showing {filteredDocuments.length} of {documents.length}
          </span>
        </div>

        {loading ? (
          <p>Loading documents...</p>
        ) : documents.length === 0 ? (
          <EmptyStateCard
            title="No supplier documents recorded"
            message="Create supplier documents to manage agreements, certifications, and supplier records."
          />
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Supplier</th>
                <th style={thStyle}>Document</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Expiration</th>
                <th style={thStyle}>Open</th>
              </tr>
            </thead>

            <tbody>
              {filteredDocuments.map((doc) => {
                const supplier = supplierMap[doc.supplier_id];

                return (
                  <tr key={doc.id}>
                    <td style={tdStyle}>
                      {supplier ? (
                        <Link href={`/suppliers/${supplier.id}`}>
                          {supplier.supplier_name}
                        </Link>
                      ) : (
                        "N/A"
                      )}
                    </td>

                    <td style={tdStyle}>
                      {doc.document_name || "N/A"}
                    </td>

                    <td style={tdStyle}>
                      {doc.document_type || "N/A"}
                    </td>

                    <td style={tdStyle}>
                      <StatusBadge
                        status={doc.document_status || "active"}
                      />
                    </td>

                    <td style={tdStyle}>
                      {doc.expiration_date || "N/A"}
                    </td>

                    <td style={tdStyle}>
                      {doc.external_document_url ? (
                        <a
                          href={doc.external_document_url}
                          target="_blank"
                        >
                          Open Document
                        </a>
                      ) : (
                        "N/A"
                      )}
                    </td>
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
