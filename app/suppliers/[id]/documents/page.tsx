"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import {
  WorkflowSection,
  WorkflowActionBar,
  SaveCancelActions,
  StatusBadge,
  EmptyStateCard,
  FormField,
  standardInputStyle,
  standardTextareaStyle,
  primaryButtonStyle,
} from "../../../components/workflow/WorkflowComponents";

export default function SupplierDocumentsPage() {
  const params = useParams<{ id: string }>();
  const supplierId = params.id;

  const [supplier, setSupplier] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [documentTitle, setDocumentTitle] = useState("");
  const [documentType, setDocumentType] = useState("quality_agreement");
  const [documentStatus, setDocumentStatus] = useState("active");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  const fetchData = async () => {
    setLoading(true);

    const supplierRes = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", supplierId)
      .maybeSingle();

    if (supplierRes.error) {
      alert(supplierRes.error.message);
      setLoading(false);
      return;
    }

    setSupplier(supplierRes.data);

    const docsRes = await supabase
      .from("supplier_documents")
      .select("*")
      .eq("supplier_id", supplierId)
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
    if (supplierId) fetchData();
  }, [supplierId]);

  const resetForm = () => {
    setDocumentTitle("");
    setDocumentType("quality_agreement");
    setDocumentStatus("active");
    setEffectiveDate("");
    setExpirationDate("");
    setDocumentUrl("");
    setUploadedFileUrl("");
    setSelectedFile(null);
    setNotes("");

    const fileInput = document.getElementById("supplier-document-file") as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";

    setShowAddForm(false);
  };

  const uploadFile = async () => {
    if (!selectedFile) {
      alert("Please select a file to upload.");
      return;
    }

    setUploading(true);

    const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `suppliers/${supplierId}/${Date.now()}_${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("supplier-documents")
      .upload(filePath, selectedFile, { upsert: false });

    if (uploadError) {
      alert(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage
      .from("supplier-documents")
      .getPublicUrl(filePath);

    setUploadedFileUrl(data.publicUrl);
    setUploading(false);
    alert("File uploaded. Click Add Document to save the document record.");
  };

  const addDocument = async () => {
    if (!documentTitle.trim()) {
      alert("Document title is required.");
      return;
    }

    if (!documentUrl.trim() && !uploadedFileUrl.trim()) {
      alert("Please provide an external URL, upload a file, or both.");
      return;
    }

    const finalDocumentUrl = uploadedFileUrl || documentUrl;

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { data, error } = await supabase
      .from("supplier_documents")
      .insert({
        supplier_id: supplierId,
        document_title: documentTitle,
        document_type: documentType,
        document_status: documentStatus,
        effective_date: effectiveDate || null,
        expiration_date: expirationDate || null,
        document_url: finalDocumentUrl,
        external_url: documentUrl || null,
        uploaded_file_url: uploadedFileUrl || null,
        notes: notes || null,
        created_by: userEmail,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: "supplier_document",
      entity_id: data.id,
      action: "supplier_document_added",
      details: `Supplier document added: ${documentTitle}. Uploaded file: ${uploadedFileUrl ? "Yes" : "No"}. External URL: ${documentUrl ? "Yes" : "No"}.`,
      user_email: userEmail,
    });

    alert("Supplier document added.");
    resetForm();
    fetchData();
  };

  const retireDocument = async (documentId: string) => {
    const confirmed = window.confirm("Retire this supplier document?");
    if (!confirmed) return;

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { error } = await supabase
      .from("supplier_documents")
      .update({
        document_status: "retired",
        retired_by: userEmail,
        retired_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: "supplier_document",
      entity_id: documentId,
      action: "supplier_document_retired",
      details: "Supplier document retired.",
      user_email: userEmail,
    });

    alert("Supplier document retired.");
    fetchData();
  };

  if (loading) {
    return <main style={{ padding: "24px", fontFamily: "Arial" }}>Loading supplier documents...</main>;
  }

  if (!supplier) {
    return <main style={{ padding: "24px", fontFamily: "Arial" }}>Supplier not found.</main>;
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <h1>Supplier Documents — {supplier.supplier_name}</h1>
        <Link href={`/suppliers/${supplierId}`}>Supplier Profile</Link>
      </div>

      <WorkflowSection
        title="Supplier Documents"
        subtitle="Add supplier documents using an uploaded file, an external URL/storage link, or both."
        defaultOpen={true}
        rightAction={
          !showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              style={primaryButtonStyle}
            >
              + Add Supplier Document
            </button>
          ) : null
        }
      >
        {showAddForm ? (
          <div
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              padding: "14px",
              background: "#f8fafc",
              marginTop: "12px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>New Supplier Document</h3>

            <FormField label="Document Title">
              <input value={documentTitle} onChange={(e) => setDocumentTitle(e.target.value)} style={standardInputStyle} />
            </FormField>

            <FormField label="Document Type">
              <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} style={standardInputStyle}>
                <option value="quality_agreement">Quality Agreement</option>
                <option value="iso_certificate">ISO Certificate</option>
                <option value="audit_report">Audit Report</option>
                <option value="insurance_certificate">Insurance Certificate</option>
                <option value="regulatory_certificate">Regulatory Certificate</option>
                <option value="supplier_questionnaire">Supplier Questionnaire</option>
                <option value="other">Other</option>
              </select>
            </FormField>

            <FormField label="Document Status">
              <select value={documentStatus} onChange={(e) => setDocumentStatus(e.target.value)} style={standardInputStyle}>
                <option value="active">Active</option>
                <option value="pending_review">Pending Review</option>
                <option value="expired">Expired</option>
                <option value="retired">Retired</option>
              </select>
            </FormField>

            <FormField label="Effective Date">
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} style={standardInputStyle} />
            </FormField>

            <FormField label="Expiration Date">
              <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} style={standardInputStyle} />
            </FormField>

            <div
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                padding: "12px",
                background: "white",
                marginBottom: "12px",
              }}
            >
              <h4 style={{ marginTop: 0 }}>Option 1 — Upload File</h4>

              <input
                id="supplier-document-file"
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />

              <button
                type="button"
                onClick={uploadFile}
                disabled={uploading || !selectedFile}
                style={{ marginLeft: "10px" }}
              >
                {uploading ? "Uploading..." : "Upload File"}
              </button>

              {uploadedFileUrl ? (
                <p>
                  <strong>Uploaded File:</strong>{" "}
                  <a href={uploadedFileUrl} target="_blank" rel="noreferrer">
                    Open Uploaded File
                  </a>
                </p>
              ) : null}
            </div>

            <div
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                padding: "12px",
                background: "white",
                marginBottom: "12px",
              }}
            >
              <h4 style={{ marginTop: 0 }}>Option 2 — External URL / Storage Link</h4>

              <input
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
                placeholder="SharePoint, Google Drive, Supabase, or other controlled document link"
                style={standardInputStyle}
              />
            </div>

            <FormField label="Notes">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={standardTextareaStyle} />
            </FormField>

            <SaveCancelActions
              onSave={addDocument}
              onCancel={resetForm}
              saveLabel="Save Document"
              cancelLabel="Cancel"
            />
          </div>
        ) : null}
      </WorkflowSection>

      <WorkflowSection
        title="Supplier Document Register"
        subtitle="Controlled supplier document register with upload, external link, expiration, and retirement tracking."
        defaultOpen={true}
      >

        {documents.length === 0 ? (
          <EmptyStateCard
            title="No supplier documents recorded"
            message="Use + Add Supplier Document to add a quality agreement, certificate, audit report, or supplier questionnaire."
            action={
              <button type="button" onClick={() => setShowAddForm(true)} style={primaryButtonStyle}>
                + Add Supplier Document
              </button>
            }
          />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Effective</th>
                <th style={thStyle}>Expiration</th>
                <th style={thStyle}>Alert</th>
                <th style={thStyle}>Uploaded File</th>
                <th style={thStyle}>External URL</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const isExpired = doc.expiration_date && doc.expiration_date < today;
                const alertText = isExpired ? "Expired" : doc.expiration_date ? "Active / Monitor" : "No Expiration";

                return (
                  <tr key={doc.id}>
                    <td style={tdStyle}>{doc.document_title || "N/A"}</td>
                    <td style={tdStyle}>{doc.document_type || "N/A"}</td>
                    <td style={tdStyle}>
                      <StatusBadge status={doc.document_status || "N/A"} />
                    </td>
                    <td style={tdStyle}>{doc.effective_date || "N/A"}</td>
                    <td style={tdStyle}>{doc.expiration_date || "N/A"}</td>
                    <td style={tdStyle}>{alertText}</td>
                    <td style={tdStyle}>
                      {doc.uploaded_file_url || doc.document_url ? (
                        <a href={doc.uploaded_file_url || doc.document_url} target="_blank" rel="noreferrer">Open</a>
                      ) : "N/A"}
                    </td>
                    <td style={tdStyle}>
                      {doc.external_url ? (
                        <a href={doc.external_url} target="_blank" rel="noreferrer">Open</a>
                      ) : "N/A"}
                    </td>
                    <td style={tdStyle}>
                      {doc.document_status !== "retired" ? (
                        <button type="button" onClick={() => retireDocument(doc.id)}>Retire</button>
                      ) : "Retired"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </WorkflowSection>
    </main>
  );
}

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
