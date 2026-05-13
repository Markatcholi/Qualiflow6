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

  const fetchData = async () => {
    setLoading(true);

    const supplierRes = await supabase.from("suppliers").select("*").eq("id", supplierId).maybeSingle();
    if (!supplierRes.error) setSupplier(supplierRes.data || null);

    const inspectionRes = await supabase.from("receiving_inspections").select("*").eq("id", inspectionId).maybeSingle();
    if (inspectionRes.error) {
      alert(inspectionRes.error.message);
      setLoading(false);
      return;
    }

    const data = inspectionRes.data;
    setInspection(data);
    setInspectionDate(data?.inspection_date || "");
    setQuantityInspected(data?.quantity_inspected !== null && data?.quantity_inspected !== undefined ? String(data.quantity_inspected) : "");
    setQuantityAccepted(data?.quantity_accepted !== null && data?.quantity_accepted !== undefined ? String(data.quantity_accepted) : "");
    setQuantityRejected(data?.quantity_rejected !== null && data?.quantity_rejected !== undefined ? String(data.quantity_rejected) : "");
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
    await supabase.from("audit_logs").insert({ entity_type: "receiving_inspection", entity_id: inspectionId, action, details, user_email: userEmail });
  };

  const saveInspection = async () => {
    const ncmrRequired = inspectionResult === "rejected" || Number(quantityRejected || 0) > 0 || automaticNcmrRequired;
    const { error } = await supabase.from("receiving_inspections").update({
      inspection_date: inspectionDate || null,
      quantity_inspected: quantityInspected ? Number(quantityInspected) : null,
      quantity_accepted: quantityAccepted ? Number(quantityAccepted) : null,
      quantity_rejected: quantityRejected ? Number(quantityRejected) : null,
      inspection_result: inspectionResult,
      defect_category: defectCategory || null,
      defect_description: defectDescription || null,
      coa_verified: coaVerified,
      documents_verified: documentsVerified,
      inspector: inspector || null,
      automatic_ncmr_required: ncmrRequired,
      notes: notes || null,
    }).eq("id", inspectionId);

    if (error) return alert(error.message);
    await addAuditLog("receiving_inspection_saved", "Receiving inspection saved.");
    alert("Receiving inspection saved.");
    fetchData();
  };

  const createNcmrFromInspection = async () => {
    if (inspection?.linked_ncmr_id) return alert("This inspection already has a linked NCMR.");
    if (inspectionResult !== "rejected" && Number(quantityRejected || 0) <= 0 && !automaticNcmrRequired) {
      return alert("NCMR creation is recommended only for rejected or nonconforming inspection outcomes.");
    }

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { data: ncmrData, error: ncmrError } = await supabase.from("ncmrs").insert({
      title: `Receiving inspection failure - ${inspection?.part_number || "Part"} / Lot ${inspection?.lot_number || "Lot"}`,
      issue_description: defectDescription || notes || "Receiving inspection nonconformance.",
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
    }).select().single();

    if (ncmrError) return alert(ncmrError.message);

    await supabase.from("ncmr_affected_items").insert({
      ncmr_id: ncmrData.id,
      product_part_number: inspection?.part_number || null,
      lot_number: inspection?.lot_number || null,
      workorder_number: inspection?.work_order || null,
      quantity_affected: quantityRejected ? Number(quantityRejected) : Number(inspection?.quantity_received || quantityInspected || 0),
      quarantined_quantity: quantityRejected ? Number(quantityRejected) : null,
    });

    const { error: updateError } = await supabase.from("receiving_inspections").update({ automatic_ncmr_required: true, linked_ncmr_id: ncmrData.id }).eq("id", inspectionId);
    if (updateError) return alert(updateError.message);

    await addAuditLog("ncmr_created_from_receiving_inspection", `NCMR created from receiving inspection: ${ncmrData.id}`);
    alert("NCMR created and linked to receiving inspection.");
    fetchData();
  };

  if (loading) return <main style={{ padding: "24px", fontFamily: "Arial" }}>Loading inspection...</main>;
  if (!inspection) return <main style={{ padding: "24px", fontFamily: "Arial" }}>Inspection not found.</main>;

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <h1>Receiving Inspection — {inspection.part_number || "Part"} / Lot {inspection.lot_number || "Lot"}</h1>
        <Link href={`/suppliers/${supplierId}/receiving-inspections`}>Back to Receiving Inspections</Link>
      </div>

      <section style={sectionStyle}>
        <h2>Receipt Summary</h2>
        <Field label="Supplier" value={supplier?.supplier_name} />
        <Field label="Part Number" value={inspection.part_number} />
        <Field label="Lot Number" value={inspection.lot_number} />
        <Field label="Work Order" value={inspection.work_order} />
        <Field label="Receipt Date" value={inspection.receipt_date} />
        <Field label="Quantity Received" value={inspection.quantity_received} />
        <Field label="Linked NCMR" value={inspection.linked_ncmr_id ? "Yes" : "No"} />
        {inspection.linked_ncmr_id ? <p><Link href={`/ncmrs/${inspection.linked_ncmr_id}`}>Open Linked NCMR</Link></p> : null}
      </section>

      <section style={sectionStyle}>
        <h2>Inspection Results</h2>
        <FieldInput label="Inspection Date"><input type="date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} style={inputStyle} /></FieldInput>
        <FieldInput label="Quantity Inspected"><input type="number" value={quantityInspected} onChange={(e) => setQuantityInspected(e.target.value)} style={inputStyle} /></FieldInput>
        <FieldInput label="Quantity Accepted"><input type="number" value={quantityAccepted} onChange={(e) => setQuantityAccepted(e.target.value)} style={inputStyle} /></FieldInput>
        <FieldInput label="Quantity Rejected"><input type="number" value={quantityRejected} onChange={(e) => setQuantityRejected(e.target.value)} style={inputStyle} /></FieldInput>
        <FieldInput label="Inspection Result">
          <select value={inspectionResult} onChange={(e) => setInspectionResult(e.target.value)} style={inputStyle}>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="conditional">Conditional</option>
            <option value="rejected">Rejected</option>
          </select>
        </FieldInput>
        <FieldInput label="Defect Category"><input value={defectCategory} onChange={(e) => setDefectCategory(e.target.value)} style={inputStyle} /></FieldInput>
        <FieldInput label="Defect Description"><textarea value={defectDescription} onChange={(e) => setDefectDescription(e.target.value)} rows={4} style={textareaStyle} /></FieldInput>

        <label><input type="checkbox" checked={coaVerified} onChange={(e) => setCoaVerified(e.target.checked)} /> COA Verified</label><br />
        <label><input type="checkbox" checked={documentsVerified} onChange={(e) => setDocumentsVerified(e.target.checked)} /> Documents Verified</label><br />
        <label><input type="checkbox" checked={automaticNcmrRequired} onChange={(e) => setAutomaticNcmrRequired(e.target.checked)} /> NCMR Required</label>

        <FieldInput label="Inspector"><input value={inspector} onChange={(e) => setInspector(e.target.value)} style={inputStyle} /></FieldInput>
        <FieldInput label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} style={textareaStyle} /></FieldInput>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={saveInspection}>Save Inspection</button>
          <button onClick={createNcmrFromInspection}>Create NCMR from Inspection</button>
        </div>
      </section>
    </main>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return <div style={{ marginBottom: "8px" }}><strong>{label}:</strong> {value || "N/A"}</div>;
}
function FieldInput({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: "12px" }}><label>{label}</label><br />{children}</div>;
}
const sectionStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: "10px", padding: "14px", marginBottom: "20px" };
const inputStyle: React.CSSProperties = { padding: "8px", width: "100%", maxWidth: "700px" };
const textareaStyle: React.CSSProperties = { padding: "8px", width: "100%", maxWidth: "900px" };
