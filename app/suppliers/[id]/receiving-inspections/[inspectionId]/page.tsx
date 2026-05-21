"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";

export default function SupplierReceivingInspectionDetailPage() {
  const params = useParams<{ id: string; inspectionId: string }>();
  const supplierId = params.id;
  const inspectionId = params.inspectionId;

  const [supplier, setSupplier] = useState<any>(null);
  const [inspection, setInspection] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [partRevision, setPartRevision] = useState("");
  const [partDescription, setPartDescription] = useState("");
  const [receivingInspectionProcedure, setReceivingInspectionProcedure] = useState("");
  const [receivingInspectionProcedureRevision, setReceivingInspectionProcedureRevision] = useState("");

  const [inspectionDate, setInspectionDate] = useState("");
  const [quantityInspected, setQuantityInspected] = useState("");
  const [quantityAccepted, setQuantityAccepted] = useState("");
  const [quantityRejected, setQuantityRejected] = useState("");
  const [inspectionResult, setInspectionResult] = useState("pending");
  const [defectCategory, setDefectCategory] = useState("");
  const [defectDescription, setDefectDescription] = useState("");
  const [coaVerified, setCoaVerified] = useState(false);
  const [documentsVerified, setDocumentsVerified] = useState(false);
  const [inspector, setInspector] = useState("");
  const [automaticNcmrRequired, setAutomaticNcmrRequired] = useState(false);
  const [notes, setNotes] = useState("");

  const isLocked =
    inspection?.is_locked === true || inspection?.approval_status === "approved";

  const fetchData = async () => {
    setLoading(true);

    const supplierRes = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", supplierId)
      .maybeSingle();

    if (!supplierRes.error) setSupplier(supplierRes.data || null);

    const inspectionRes = await supabase
      .from("receiving_inspections")
      .select("*")
      .eq("id", inspectionId)
      .maybeSingle();

    if (inspectionRes.error) {
      alert(inspectionRes.error.message);
      setLoading(false);
      return;
    }

    const data = inspectionRes.data;

    setInspection(data);
    setPartRevision(data?.part_revision || "");
    setPartDescription(data?.part_description || "");
    setReceivingInspectionProcedure(data?.receiving_inspection_procedure || "");
    setReceivingInspectionProcedureRevision(
      data?.receiving_inspection_procedure_revision || ""
    );

    setInspectionDate(data?.inspection_date || "");
    setQuantityInspected(
      data?.quantity_inspected !== null && data?.quantity_inspected !== undefined
        ? String(data.quantity_inspected)
        : ""
    );
    setQuantityAccepted(
      data?.quantity_accepted !== null && data?.quantity_accepted !== undefined
        ? String(data.quantity_accepted)
        : ""
    );
    setQuantityRejected(
      data?.quantity_rejected !== null && data?.quantity_rejected !== undefined
        ? String(data.quantity_rejected)
        : ""
    );
    setInspectionResult(data?.inspection_result || "pending");
    setDefectCategory(data?.defect_category || "");
    setDefectDescription(data?.defect_description || "");
    setCoaVerified(data?.coa_verified || false);
    setDocumentsVerified(data?.documents_verified || false);
    setInspector(data?.inspector || "");
    setAutomaticNcmrRequired(data?.automatic_ncmr_required || false);
    setNotes(data?.notes || "");
    setLoading(false);
  };

  useEffect(() => {
    if (inspectionId) fetchData();
  }, [inspectionId]);

  const addAuditLog = async (action: string, details: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    await supabase.from("audit_logs").insert({
      entity_type: "receiving_inspection",
      entity_id: inspectionId,
      action,
      details,
      user_email: userEmail,
    });
  };

  const validateBeforeSave = () => {
    if (isLocked) {
      alert("This inspection is approved/locked and cannot be edited.");
      return false;
    }

    if (inspectionResult === "rejected" && Number(quantityRejected || 0) <= 0) {
      alert("Rejected inspections require a rejected quantity greater than zero.");
      return false;
    }

    if (inspectionResult === "rejected" && !defectCategory.trim()) {
      alert("Rejected inspections require a defect category.");
      return false;
    }

    return true;
  };

  const saveInspection = async () => {
    if (!validateBeforeSave()) return;

    const rejectedQty =
      inspectionResult === "accepted" ? 0 : quantityRejected ? Number(quantityRejected) : null;

    const ncmrRequired =
      inspectionResult === "rejected" ||
      Number(rejectedQty || 0) > 0 ||
      automaticNcmrRequired;

    const { error } = await supabase
      .from("receiving_inspections")
      .update({
        part_revision: partRevision || null,
        part_description: partDescription || null,
        receiving_inspection_procedure: receivingInspectionProcedure || null,
        receiving_inspection_procedure_revision:
          receivingInspectionProcedureRevision || null,
        inspection_date: inspectionDate || null,
        quantity_inspected: quantityInspected ? Number(quantityInspected) : null,
        quantity_accepted: quantityAccepted ? Number(quantityAccepted) : null,
        quantity_rejected: rejectedQty,
        inspection_result: inspectionResult,
        defect_category: defectCategory || null,
        defect_description: defectDescription || null,
        coa_verified: coaVerified,
        documents_verified: documentsVerified,
        inspector: inspector || null,
        automatic_ncmr_required: ncmrRequired,
        notes: notes || null,
      })
      .eq("id", inspectionId);

    if (error) return alert(error.message);

    await addAuditLog("receiving_inspection_saved", "Receiving inspection saved.");

    alert("Receiving inspection saved.");
    fetchData();
  };

  const createNcmrFromInspection = async () => {
    if (isLocked) {
      alert("This inspection is approved/locked and cannot be changed.");
      return;
    }

    if (inspection?.linked_ncmr_id) {
      alert("This inspection already has a linked NCMR.");
      return;
    }

    if (
      inspectionResult !== "rejected" &&
      Number(quantityRejected || 0) <= 0 &&
      !automaticNcmrRequired
    ) {
      alert(
        "NCMR creation is recommended only for rejected or nonconforming inspection outcomes."
      );
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { data: ncmrData, error: ncmrError } = await supabase
      .from("ncmrs")
      .insert({
        title: `Receiving inspection failure - ${
          inspection?.part_number || "Part"
        } Rev ${partRevision || "N/A"} / Lot ${inspection?.lot_number || "Lot"}`,
        issue_description:
          defectDescription ||
          notes ||
          `Receiving inspection nonconformance. Part Revision: ${
            partRevision || "N/A"
          }. Part Description: ${partDescription || "N/A"}. Procedure: ${
            receivingInspectionProcedure || "N/A"
          } ${receivingInspectionProcedureRevision || ""}.`,
        source_of_detection: "Supplier / Receiving Inspection",
        department: "Receiving Inspection",
        date_detected: inspectionDate || new Date().toISOString().slice(0, 10),
        supplier_id: supplierId,
        supplier_name: supplier?.supplier_name || null,
        supplier_lot: inspection?.lot_number || null,
        defect_category: defectCategory || null,
        status: "open",
        review_status: "draft",
        owner: userEmail,
      })
      .select()
      .single();

    if (ncmrError) return alert(ncmrError.message);

    await supabase.from("ncmr_affected_items").insert({
      ncmr_id: ncmrData.id,
      product_part_number: inspection?.part_number || null,
      lot_number: inspection?.lot_number || null,
      workorder_number: inspection?.work_order || null,
      quantity_affected: quantityRejected
        ? Number(quantityRejected)
        : Number(inspection?.quantity_received || quantityInspected || 0),
      quarantined_quantity: quantityRejected ? Number(quantityRejected) : null,
    });

    const { error: updateError } = await supabase
      .from("receiving_inspections")
      .update({
        automatic_ncmr_required: true,
        linked_ncmr_id: ncmrData.id,
        ncmr_created: true,
      })
      .eq("id", inspectionId);

    if (updateError) return alert(updateError.message);

    await addAuditLog(
      "ncmr_created_from_receiving_inspection",
      `NCMR created from receiving inspection: ${ncmrData.id}`
    );

    alert("NCMR created and linked to receiving inspection.");
    fetchData();
  };

  const printAuditRecord = () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receiving Inspection Audit Record</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
            .header { border-bottom: 3px solid #111827; padding-bottom: 16px; margin-bottom: 24px; }
            .eyebrow { font-size: 12px; letter-spacing: 0.08em; color: #6b7280; font-weight: 700; }
            h1 { margin: 6px 0 0; font-size: 28px; }
            h2 { font-size: 18px; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; margin-top: 24px; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
            .field { border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; min-height: 48px; }
            .label { font-size: 11px; color: #6b7280; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
            .value { font-size: 14px; white-space: pre-wrap; word-break: break-word; }
            .full { grid-column: 1 / -1; }
            .approval { border: 2px solid #111827; border-radius: 10px; padding: 14px; margin-top: 12px; }
            .footer { margin-top: 34px; border-top: 1px solid #d1d5db; padding-top: 10px; color: #6b7280; font-size: 11px; }
            @media print { body { margin: 24px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="eyebrow">QUALIFLOW CONTROLLED QUALITY RECORD</div>
            <h1>Receiving Inspection Audit Record</h1>
            <div>Generated: ${escapeHtml(new Date().toLocaleString())}</div>
          </div>

          <h2>Receipt Summary</h2>
          <div class="grid">
            ${printField("Supplier", supplier?.supplier_name)}
            ${printField("Supplier Number", supplier?.supplier_number)}
            ${printField("Part Number", inspection?.part_number)}
            ${printField("Part Revision", partRevision)}
            ${printField("Part Description", partDescription, TruePlaceholder)}
            ${printField("Lot Number", inspection?.lot_number)}
            ${printField("Work Order", inspection?.work_order)}
            ${printField("Receipt Date", inspection?.receipt_date)}
            ${printField("Quantity Received", inspection?.quantity_received)}
            ${printField("Receiving Inspection Procedure", receivingInspectionProcedure)}
            ${printField("Procedure Revision", receivingInspectionProcedureRevision)}
          </div>

          <h2>Inspection Results</h2>
          <div class="grid">
            ${printField("Inspection Date", inspectionDate)}
            ${printField("Quantity Inspected", quantityInspected)}
            ${printField("Quantity Accepted", quantityAccepted)}
            ${printField("Quantity Rejected", quantityRejected)}
            ${printField("Inspection Result", inspectionResult)}
            ${printField("Defect Category", defectCategory)}
            ${printField("Defect Description", defectDescription, TruePlaceholder)}
            ${printField("COA Verified", coaVerified ? "Yes" : "No")}
            ${printField("Documents Verified", documentsVerified ? "Yes" : "No")}
            ${printField("Inspector", inspector)}
            ${printField("NCMR Required", automaticNcmrRequired ? "Yes" : "No")}
            ${printField("Notes", notes, TruePlaceholder)}
          </div>

          <h2>Linked Quality Records</h2>
          <div class="grid">
            ${printField("Linked NCMR", inspection?.linked_ncmr_id ? "Yes" : "No")}
            ${printField("Linked NCMR ID", inspection?.linked_ncmr_id)}
          </div>

          <h2>Approval / Lock Evidence</h2>
          <div class="approval">
            <div class="grid">
              ${printField("Approval Status", inspection?.approval_status || "pending_approval")}
              ${printField("Record Locked", inspection?.is_locked ? "Yes" : "No")}
              ${printField("Approved By", inspection?.approved_by)}
              ${printField("Approved At", inspection?.approved_at)}
              ${printField("Locked By", inspection?.locked_by)}
              ${printField("Locked At", inspection?.locked_at)}
              ${printField("Signature Meaning", inspection?.approval_signature_meaning, TruePlaceholder)}
              ${printField("Approval Notes", inspection?.approval_notes, TruePlaceholder)}
            </div>
          </div>

          <div class="footer">
            Confidential quality system record. Printed for audit review and controlled record evidence.
          </div>

          <script>window.onload = function(){ window.print(); };</script>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1000,height=800");

    if (!printWindow) {
      alert("Unable to open print window. Please allow pop-ups and try again.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <main style={{ padding: "24px", fontFamily: "Arial" }}>
        Loading inspection...
      </main>
    );
  }

  if (!inspection) {
    return (
      <main style={{ padding: "24px", fontFamily: "Arial" }}>
        Inspection not found.
      </main>
    );
  }

  return (
    <main
      style={{
        padding: "24px",
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>CONTROLLED RECEIVING INSPECTION RECORD</div>
          <h1 style={{ margin: "6px 0" }}>
            {inspection.part_number || "Part"} Rev {partRevision || "N/A"} / Lot{" "}
            {inspection.lot_number || "Lot"}
          </h1>
          <p style={{ color: "#4b5563", margin: 0 }}>
            Material traceability, procedural traceability, inspection result,
            linked quality records, and approval evidence.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href={`/suppliers/${supplierId}/receiving-inspections`}>
            Back to Receiving Inspections
          </Link>
          <Link href="/supplier-quality/receiving-inspections">
            Global Register
          </Link>
          <button type="button" onClick={printAuditRecord} style={secondaryButtonStyle}>
            Print Audit Record
          </button>
        </div>
      </div>

      {isLocked ? (
        <div style={lockedBannerStyle}>
          🔒 This receiving inspection is approved and locked. Editing is disabled.
          <div style={{ fontWeight: 400, marginTop: "4px" }}>
            Approved By: {inspection.approved_by || "N/A"} | Approved At:{" "}
            {inspection.approved_at || "N/A"}
          </div>
        </div>
      ) : null}

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Receipt Summary</h2>

        <div style={gridStyle}>
          <Field label="Supplier" value={supplier?.supplier_name} />
          <Field label="Supplier Risk" value={supplier?.supplier_risk_level} />
          <Field label="Part Number" value={inspection.part_number} />
          <Field label="Part Revision" value={partRevision} />
          <Field label="Part Description" value={partDescription} />
          <Field label="Lot Number" value={inspection.lot_number} />
          <Field label="Work Order" value={inspection.work_order} />
          <Field label="Receipt Date" value={inspection.receipt_date} />
          <Field label="Quantity Received" value={inspection.quantity_received} />
          <Field
            label="Receiving Inspection Procedure"
            value={receivingInspectionProcedure}
          />
          <Field
            label="Procedure Revision"
            value={receivingInspectionProcedureRevision}
          />
          <Field label="Linked NCMR" value={inspection.linked_ncmr_id ? "Yes" : "No"} />
        </div>

        {inspection.linked_ncmr_id ? (
          <p>
            <Link href={`/ncmrs/${inspection.linked_ncmr_id}`}>
              Open Linked NCMR
            </Link>
          </p>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Traceability Updates</h2>

        <FieldInput label="Part Revision">
          <input
            value={partRevision}
            onChange={(e) => setPartRevision(e.target.value)}
            style={inputStyle}
            disabled={isLocked}
          />
        </FieldInput>

        <FieldInput label="Part Description">
          <textarea
            value={partDescription}
            onChange={(e) => setPartDescription(e.target.value)}
            rows={3}
            style={textareaStyle}
            disabled={isLocked}
          />
        </FieldInput>

        <FieldInput label="Receiving Inspection Procedure">
          <input
            value={receivingInspectionProcedure}
            onChange={(e) => setReceivingInspectionProcedure(e.target.value)}
            placeholder="Example: SOP-QA-014 Receiving Inspection"
            style={inputStyle}
            disabled={isLocked}
          />
        </FieldInput>

        <FieldInput label="Procedure Revision">
          <input
            value={receivingInspectionProcedureRevision}
            onChange={(e) => setReceivingInspectionProcedureRevision(e.target.value)}
            placeholder="Example: Rev 07"
            style={inputStyle}
            disabled={isLocked}
          />
        </FieldInput>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Inspection Results</h2>

        <FieldInput label="Inspection Date">
          <input
            type="date"
            value={inspectionDate}
            onChange={(e) => setInspectionDate(e.target.value)}
            style={inputStyle}
            disabled={isLocked}
          />
        </FieldInput>

        <FieldInput label="Quantity Inspected">
          <input
            type="number"
            value={quantityInspected}
            onChange={(e) => setQuantityInspected(e.target.value)}
            style={inputStyle}
            disabled={isLocked}
          />
        </FieldInput>

        <FieldInput label="Quantity Accepted">
          <input
            type="number"
            value={quantityAccepted}
            onChange={(e) => setQuantityAccepted(e.target.value)}
            style={inputStyle}
            disabled={isLocked}
          />
        </FieldInput>

        <FieldInput label="Quantity Rejected">
          <input
            type="number"
            value={quantityRejected}
            onChange={(e) => setQuantityRejected(e.target.value)}
            style={inputStyle}
            disabled={isLocked}
          />
        </FieldInput>

        <FieldInput label="Inspection Result">
          <select
            value={inspectionResult}
            onChange={(e) => setInspectionResult(e.target.value)}
            style={inputStyle}
            disabled={isLocked}
          >
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="conditional">Conditional</option>
            <option value="rejected">Rejected</option>
          </select>
        </FieldInput>

        <FieldInput label="Defect Category">
          <input
            value={defectCategory}
            onChange={(e) => setDefectCategory(e.target.value)}
            style={inputStyle}
            disabled={isLocked}
          />
        </FieldInput>

        <FieldInput label="Defect Description">
          <textarea
            value={defectDescription}
            onChange={(e) => setDefectDescription(e.target.value)}
            rows={4}
            style={textareaStyle}
            disabled={isLocked}
          />
        </FieldInput>

        <label>
          <input
            type="checkbox"
            checked={coaVerified}
            onChange={(e) => setCoaVerified(e.target.checked)}
            disabled={isLocked}
          />{" "}
          COA Verified
        </label>
        <br />

        <label>
          <input
            type="checkbox"
            checked={documentsVerified}
            onChange={(e) => setDocumentsVerified(e.target.checked)}
            disabled={isLocked}
          />{" "}
          Documents Verified
        </label>
        <br />

        <label>
          <input
            type="checkbox"
            checked={automaticNcmrRequired}
            onChange={(e) => setAutomaticNcmrRequired(e.target.checked)}
            disabled={isLocked}
          />{" "}
          NCMR Required
        </label>

        <FieldInput label="Inspector">
          <input
            value={inspector}
            onChange={(e) => setInspector(e.target.value)}
            style={inputStyle}
            disabled={isLocked}
          />
        </FieldInput>

        <FieldInput label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            style={textareaStyle}
            disabled={isLocked}
          />
        </FieldInput>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={saveInspection} disabled={isLocked} style={buttonDisabledStyle(isLocked)}>
            Save Inspection
          </button>

          <button
            onClick={createNcmrFromInspection}
            disabled={isLocked || Boolean(inspection.linked_ncmr_id)}
            style={buttonDisabledStyle(isLocked || Boolean(inspection.linked_ncmr_id))}
          >
            Create NCMR from Inspection
          </button>

          <button type="button" onClick={printAuditRecord} style={secondaryButtonStyle}>
            Print Audit Record
          </button>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Approval / Electronic Signature</h2>

        <div style={gridStyle}>
          <Field label="Approval Status" value={inspection.approval_status || "pending_approval"} />
          <Field label="Record Locked" value={inspection.is_locked ? "Yes" : "No"} />
          <Field label="Approved By" value={inspection.approved_by} />
          <Field label="Approved At" value={inspection.approved_at} />
          <Field label="Locked By" value={inspection.locked_by} />
          <Field label="Locked At" value={inspection.locked_at} />
          <Field label="Signature Meaning" value={inspection.approval_signature_meaning} />
          <Field label="Approval Notes" value={inspection.approval_notes} />
        </div>
      </section>
    </main>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div style={fieldCardStyle}>
      <div style={fieldLabelStyle}>{label}</div>
      <div style={fieldValueStyle}>{value || "N/A"}</div>
    </div>
  );
}

function FieldInput({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{ fontWeight: 700 }}>{label}</label>
      <br />
      {children}
    </div>
  );
}

function printField(label: string, value: any, full = false) {
  return `
    <div class="field ${full ? "full" : ""}">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value ?? "N/A")}</div>
    </div>
  `;
}

const TruePlaceholder = true;

function escapeHtml(value: any) {
  return String(value ?? "N/A")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const buttonDisabledStyle = (disabled: boolean): React.CSSProperties => ({
  opacity: disabled ? 0.55 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
});

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: "20px",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.08em",
  color: "#6b7280",
  fontWeight: 800,
};

const lockedBannerStyle: React.CSSProperties = {
  padding: "14px",
  background: "#f3f4f6",
  border: "1px solid #9ca3af",
  borderRadius: "12px",
  marginBottom: "20px",
  color: "#374151",
  fontWeight: 800,
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "18px",
  marginBottom: "20px",
  background: "white",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "12px",
};

const fieldCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  padding: "12px",
  background: "#f9fafb",
};

const fieldLabelStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  fontWeight: 800,
  marginBottom: "4px",
};

const fieldValueStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: "14px",
  whiteSpace: "pre-wrap",
};

const inputStyle: React.CSSProperties = {
  padding: "10px",
  width: "100%",
  maxWidth: "700px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
};

const textareaStyle: React.CSSProperties = {
  padding: "10px",
  width: "100%",
  maxWidth: "900px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #374151",
  background: "#374151",
  color: "white",
  cursor: "pointer",
};
