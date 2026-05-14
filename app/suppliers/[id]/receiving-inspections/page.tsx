"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import {
  SectionCard,
  ActionToolbar,
  StatusBadge,
  EmptyStateCard,
  FormField,
  primaryButtonStyle,
  standardInputStyle,
} from "../../../components/QualityWorkflowComponents";

export default function SupplierReceivingInspectionsPage() {
  const params = useParams<{ id: string }>();
  const supplierId = params.id;

  const [supplier, setSupplier] = useState<any>(null);
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateInspection, setShowCreateInspection] = useState(false);

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

  const resetCreateInspectionForm = () => {
    setPartNumber("");
    setLotNumber("");
    setReceiptDate("");
    setQuantityReceived("");
    setShowCreateInspection(false);
  };

  const createInspection = async () => {
    if (!partNumber.trim()) {
      alert("Part number is required.");
      return;
    }

    if (!lotNumber.trim()) {
      alert("Lot number is required.");
      return;
    }

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

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: "receiving_inspection",
      entity_id: data.id,
      action: "receiving_inspection_created",
      details: `Receiving inspection created for supplier ${supplier?.supplier_name || "supplier"}.`,
      user_email: userEmail,
    });

    alert("Receiving inspection created.");
    resetCreateInspectionForm();
    fetchData();
  };

  if (loading) {
    return <main style={{ padding: "24px", fontFamily: "Arial" }}>Loading receiving inspections...</main>;
  }

  if (!supplier) {
    return <main style={{ padding: "24px", fontFamily: "Arial" }}>Supplier not found.</main>;
  }

  if (!supplier.receiving_inspection_enabled) {
    return (
      <main style={{ padding: "24px", fontFamily: "Arial" }}>
        <h1>Receiving Inspection</h1>
        <p style={{ color: "#4b5563" }}>{supplier.supplier_name}</p>

        <SectionCard
          title="Receiving Inspection Not Enabled"
          subtitle="Receiving inspection is optional and can be enabled from the supplier profile."
          defaultOpen={true}
        >
          <EmptyStateCard
            title="Optional module disabled"
            message="Enable receiving inspection on the supplier profile before creating inspection records."
            action={<Link href={`/suppliers/${supplierId}`}>Back to Supplier Profile</Link>}
          />
        </SectionCard>
      </main>
    );
  }

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        <div>
          <h1>Receiving Inspections</h1>
          <p style={{ color: "#4b5563", marginTop: 0 }}>{supplier.supplier_name}</p>
        </div>

        <ActionToolbar>
          <Link href={`/suppliers/${supplierId}`}>Supplier Profile</Link>
        </ActionToolbar>
      </div>

      <SectionCard
        title="Create Receiving Inspection"
        subtitle="Create a receiving inspection record only when incoming material inspection is required."
        defaultOpen={showCreateInspection}
        rightAction={
          !showCreateInspection ? (
            <button
              type="button"
              onClick={() => setShowCreateInspection(true)}
              style={primaryButtonStyle}
            >
              + Add Inspection
            </button>
          ) : null
        }
      >
        {showCreateInspection ? (
          <div
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              padding: "14px",
              background: "#f8fafc",
            }}
          >
            <FormField label="Part Number">
              <input
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                style={standardInputStyle}
              />
            </FormField>

            <FormField label="Lot Number">
              <input
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                style={standardInputStyle}
              />
            </FormField>

            <FormField label="Receipt Date">
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                style={standardInputStyle}
              />
            </FormField>

            <FormField label="Quantity Received">
              <input
                type="number"
                value={quantityReceived}
                onChange={(e) => setQuantityReceived(e.target.value)}
                style={standardInputStyle}
              />
            </FormField>

            <ActionToolbar>
              <button type="button" onClick={createInspection} style={primaryButtonStyle}>
                Save Inspection
              </button>
              <button type="button" onClick={resetCreateInspectionForm}>
                Cancel
              </button>
            </ActionToolbar>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Inspection History"
        subtitle="Receiving inspection records are linked directly to the supplier and can escalate to NCMR when inspection fails."
        defaultOpen={true}
      >
        {inspections.length === 0 ? (
          <EmptyStateCard
            title="No receiving inspections recorded"
            message="Use + Add Inspection when incoming material requires inspection tracking."
            action={
              <button
                type="button"
                onClick={() => setShowCreateInspection(true)}
                style={primaryButtonStyle}
              >
                + Add Inspection
              </button>
            }
          />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Part Number</th>
                <th style={thStyle}>Lot Number</th>
                <th style={thStyle}>Receipt Date</th>
                <th style={thStyle}>Qty Received</th>
                <th style={thStyle}>Qty Accepted</th>
                <th style={thStyle}>Qty Rejected</th>
                <th style={thStyle}>Result</th>
                <th style={thStyle}>Linked NCMR</th>
                <th style={thStyle}>Open</th>
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
                  <td style={tdStyle}>
                    <StatusBadge status={inspection.inspection_result || "pending"} />
                  </td>
                  <td style={tdStyle}>
                    {inspection.linked_ncmr_id ? (
                      <Link href={`/ncmrs/${inspection.linked_ncmr_id}`}>Open NCMR</Link>
                    ) : (
                      "N/A"
                    )}
                  </td>
                  <td style={tdStyle}>
                    <Link href={`/suppliers/${supplierId}/receiving-inspections/${inspection.id}`}>
                      Open Inspection
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
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
