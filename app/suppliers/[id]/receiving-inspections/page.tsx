"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function SupplierReceivingInspectionsPage() {
  const params = useParams<{ id: string }>();
  const supplierId = params.id;

  const [supplier, setSupplier] = useState<any>(null);
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [partNumber, setPartNumber] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [quantityReceived, setQuantityReceived] = useState("");

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

    const inspectionRes = await supabase
      .from("receiving_inspections")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });

    if (inspectionRes.error) {
      alert(inspectionRes.error.message);
      setLoading(false);
      return;
    }

    setInspections(inspectionRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (supplierId) fetchData();
  }, [supplierId]);

  const createInspection = async () => {
    if (!partNumber.trim()) return alert("Part number is required.");
    if (!lotNumber.trim()) return alert("Lot number is required.");

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { data, error } = await supabase
      .from("receiving_inspections")
      .insert({
        supplier_id: supplierId,
        part_number: partNumber,
        lot_number: lotNumber,
        receipt_date: receiptDate || null,
        quantity_received: quantityReceived ? Number(quantityReceived) : null,
        inspection_result: "pending",
        created_by: userEmail,
      })
      .select()
      .single();

    if (error) return alert(error.message);

    await supabase.from("audit_logs").insert({
      entity_type: "receiving_inspection",
      entity_id: data.id,
      action: "receiving_inspection_created",
      details: `Receiving inspection created for supplier ${supplier?.supplier_name || "supplier"}.`,
      user_email: userEmail,
    });

    alert("Receiving inspection created.");
    setPartNumber("");
    setLotNumber("");
    setReceiptDate("");
    setQuantityReceived("");
    fetchData();
  };

  if (loading) return <main style={{ padding: "24px", fontFamily: "Arial" }}>Loading receiving inspections...</main>;
  if (!supplier) return <main style={{ padding: "24px", fontFamily: "Arial" }}>Supplier not found.</main>;

  if (!supplier.receiving_inspection_enabled) {
    return (
      <main style={{ padding: "24px", fontFamily: "Arial" }}>
        <h1>Receiving Inspection — {supplier.supplier_name}</h1>
        <p>Receiving inspection is not enabled for this supplier.</p>
        <Link href={`/suppliers/${supplierId}`}>Back to Supplier Profile</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <h1>Receiving Inspections — {supplier.supplier_name}</h1>
        <Link href={`/suppliers/${supplierId}`}>Supplier Profile</Link>
      </div>

      <section style={sectionStyle}>
        <h2>Create Receiving Inspection</h2>
        <Field label="Part Number"><input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} style={inputStyle} /></Field>
        <Field label="Lot Number"><input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} style={inputStyle} /></Field>
        <Field label="Receipt Date"><input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} style={inputStyle} /></Field>
        <Field label="Quantity Received"><input type="number" value={quantityReceived} onChange={(e) => setQuantityReceived(e.target.value)} style={inputStyle} /></Field>
        <button onClick={createInspection}>Create Inspection</button>
      </section>

      <section style={sectionStyle}>
        <h2>Inspection History</h2>
        {inspections.length === 0 ? <p>No receiving inspections recorded.</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Part Number</th><th style={thStyle}>Lot Number</th><th style={thStyle}>Receipt Date</th>
                <th style={thStyle}>Qty Received</th><th style={thStyle}>Qty Accepted</th><th style={thStyle}>Qty Rejected</th>
                <th style={thStyle}>Result</th><th style={thStyle}>Linked NCMR</th><th style={thStyle}>Open</th>
              </tr>
            </thead>
            <tbody>
              {inspections.map((inspection) => (
                <tr key={inspection.id}>
                  <td style={tdStyle}>{inspection.part_number || "N/A"}</td>
                  <td style={tdStyle}>{inspection.lot_number || "N/A"}</td>
                  <td style={tdStyle}>{inspection.receipt_date || "N/A"}</td>
                  <td style={tdStyle}>{inspection.quantity_received ?? "N/A"}</td>
                  <td style={tdStyle}>{inspection.quantity_accepted ?? "N/A"}</td>
                  <td style={tdStyle}>{inspection.quantity_rejected ?? "N/A"}</td>
                  <td style={tdStyle}>{inspection.inspection_result || "pending"}</td>
                  <td style={tdStyle}>{inspection.linked_ncmr_id ? <Link href={`/ncmrs/${inspection.linked_ncmr_id}`}>Open NCMR</Link> : "N/A"}</td>
                  <td style={tdStyle}><Link href={`/suppliers/${supplierId}/receiving-inspections/${inspection.id}`}>Open Inspection</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: "12px" }}><label>{label}</label><br />{children}</div>;
}

const sectionStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: "10px", padding: "14px", marginBottom: "20px" };
const inputStyle: React.CSSProperties = { padding: "8px", width: "100%", maxWidth: "700px" };
const thStyle: React.CSSProperties = { border: "1px solid #d1d5db", padding: "10px", background: "#f3f4f6", textAlign: "left" };
const tdStyle: React.CSSProperties = { border: "1px solid #d1d5db", padding: "10px" };
