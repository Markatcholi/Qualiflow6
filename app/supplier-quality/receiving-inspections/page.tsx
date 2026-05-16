"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import {
  StatusBadge,
  EmptyStateCard,
  FormField,
  standardInputStyle,
  primaryButtonStyle,
} from "../../components/workflow/WorkflowComponents";

type SupplierOption = {
  id: string;
  supplier_name: string;
  supplier_number: string | null;
  supplier_status: string | null;
  supplier_risk_level: string | null;
  receiving_inspection_enabled: boolean | null;
};

export default function GlobalReceivingInspectionsPage() {
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateInspection, setShowCreateInspection] = useState(false);
  const [search, setSearch] = useState("");

  const [supplierId, setSupplierId] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [quantityReceived, setQuantityReceived] = useState("");

  const supplierMap = useMemo(() => {
    const map: Record<string, SupplierOption> = {};
    suppliers.forEach((supplier) => {
      map[supplier.id] = supplier;
    });
    return map;
  }, [suppliers]);

  const enabledSuppliers = suppliers.filter(
    (supplier) => supplier.receiving_inspection_enabled
  );

  const filteredInspections = inspections.filter((inspection) => {
    const supplier = supplierMap[inspection.supplier_id];
    const haystack = [
      supplier?.supplier_name,
      supplier?.supplier_number,
      inspection.part_number,
      inspection.lot_number,
      inspection.inspection_result,
      inspection.receipt_date,
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
        "id, supplier_name, supplier_number, supplier_status, supplier_risk_level, receiving_inspection_enabled"
      )
      .order("supplier_name", { ascending: true });

    if (suppliersRes.error) {
      alert(suppliersRes.error.message);
      setLoading(false);
      return;
    }

    setSuppliers(suppliersRes.data || []);

    const inspectionRes = await supabase
      .from("receiving_inspections")
      .select("*")
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
    fetchData();
  }, []);

  const resetInspectionForm = () => {
    setSupplierId("");
    setPartNumber("");
    setLotNumber("");
    setReceiptDate("");
    setQuantityReceived("");
  };

  const createInspection = async () => {
    if (!supplierId) return alert("Supplier is required.");
    if (!partNumber.trim()) return alert("Part number is required.");
    if (!lotNumber.trim()) return alert("Lot number is required.");

    const selectedSupplier = supplierMap[supplierId];

    if (!selectedSupplier?.receiving_inspection_enabled) {
      alert("Receiving inspection is not enabled for the selected supplier.");
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

    if (error) return alert(error.message);

    await supabase.from("audit_logs").insert({
      entity_type: "receiving_inspection",
      entity_id: data.id,
      action: "receiving_inspection_created",
      details: `Receiving inspection created for supplier ${selectedSupplier?.supplier_name || "supplier"}.`,
      user_email: userEmail,
    });

    alert("Receiving inspection created.");
    resetInspectionForm();
    setShowCreateInspection(false);
    fetchData();
  };

  const inspectionRequiresNcmr = (inspection: any) => {
    const result = String(inspection.inspection_result || "").toLowerCase();

    return (
      result.includes("reject") ||
      result.includes("fail") ||
      result.includes("nonconform") ||
      result.includes("non-conform") ||
      result.includes("ncmr")
    );
  };

  const createLinkedNcmr = async (inspection: any) => {
    if (inspection.linked_ncmr_id) {
      alert("This receiving inspection already has a linked NCMR.");
      return;
    }

    if (!inspectionRequiresNcmr(inspection)) {
      alert("NCMR creation is intended for rejected, failed, or nonconforming inspections.");
      return;
    }

    const supplier = supplierMap[inspection.supplier_id];

    const confirmed = window.confirm(
      "Create a linked NCMR from this receiving inspection?\\n\\nThis will auto-populate supplier, part, lot, quantity, source, and inspection reference."
    );

    if (!confirmed) return;

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const title = `Receiving Inspection Nonconformance - ${inspection.part_number || "Part"} / Lot ${inspection.lot_number || "N/A"}`;

    const issueDescription = `Receiving inspection identified a nonconforming or rejected result. Supplier: ${supplier?.supplier_name || "N/A"}. Part: ${inspection.part_number || "N/A"}. Lot: ${inspection.lot_number || "N/A"}. Quantity received: ${inspection.quantity_received ?? "N/A"}. Quantity rejected: ${inspection.quantity_rejected ?? "N/A"}. Inspection result: ${inspection.inspection_result || "N/A"}.`;

    const { data: ncmrData, error: ncmrError } = await supabase
      .from("ncmrs")
      .insert({
        title,
        issue_description: issueDescription,
        status: "open",
        source_of_detection: "receiving_inspection",
        source_module: "receiving_inspection",
        source_record_id: inspection.id,
        linked_receiving_inspection_id: inspection.id,
        linked_supplier_id: inspection.supplier_id || null,
        product_part_number: inspection.part_number || null,
        lot_number: inspection.lot_number || null,
        quantity_affected: inspection.quantity_rejected ?? inspection.quantity_received ?? null,
        owner: userEmail,
      })
      .select()
      .single();

    if (ncmrError) {
      alert(ncmrError.message);
      return;
    }

    const { error: inspectionUpdateError } = await supabase
      .from("receiving_inspections")
      .update({
        linked_ncmr_id: ncmrData.id,
        ncmr_created: true,
      })
      .eq("id", inspection.id);

    if (inspectionUpdateError) {
      alert(inspectionUpdateError.message);
      return;
    }

    await supabase.from("audit_logs").insert([
      {
        entity_type: "receiving_inspection",
        entity_id: inspection.id,
        action: "linked_ncmr_created",
        details: `Linked NCMR created from receiving inspection. NCMR title: ${title}.`,
        user_email: userEmail,
      },
      {
        entity_type: "ncmr",
        entity_id: ncmrData.id,
        action: "ncmr_created_from_receiving_inspection",
        details: `NCMR created from receiving inspection for supplier ${supplier?.supplier_name || "N/A"}, part ${inspection.part_number || "N/A"}, lot ${inspection.lot_number || "N/A"}.`,
        user_email: userEmail,
      },
    ]);

    alert("Linked NCMR created.");
    fetchData();
    window.open(`/ncmrs/${ncmrData.id}`, "_blank");
  };

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
          <h1 style={{ marginBottom: "6px" }}>Global Receiving Inspections</h1>
          <p style={{ color: "#4b5563", marginTop: 0 }}>
            Create and view receiving inspections for suppliers where receiving inspection is enabled.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/suppliers">Supplier Quality</Link>
          <Link href="/supplier-quality/audits">Supplier Audits</Link>
          <Link href="/supplier-quality/scars">SCARs</Link>
          <Link href="/supplier-quality/asl">ASL / Qualification</Link>
        </div>
      </div>

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
            <h2 style={{ marginTop: 0 }}>Create Receiving Inspection</h2>
            <p style={{ color: "#4b5563", marginTop: 0 }}>
              Only suppliers with receiving inspection enabled are available for selection.
            </p>
          </div>

          {!showCreateInspection ? (
            <button
              type="button"
              onClick={() => setShowCreateInspection(true)}
              style={primaryButtonStyle}
            >
              + Create Inspection
            </button>
          ) : null}
        </div>

        {showCreateInspection ? (
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
                {enabledSuppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplier_number ? `${supplier.supplier_number} - ` : ""}
                    {supplier.supplier_name}
                  </option>
                ))}
              </select>
            </FormField>

            {enabledSuppliers.length === 0 ? (
              <div
                style={{
                  border: "1px solid #facc15",
                  background: "#fefce8",
                  borderRadius: "8px",
                  padding: "10px",
                  marginBottom: "12px",
                }}
              >
                No suppliers currently have receiving inspection enabled. Enable it from ASL / Qualification or a supplier profile first.
              </div>
            ) : null}

            {supplierId ? (
              <div
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  padding: "10px",
                  background: "white",
                  marginBottom: "12px",
                }}
              >
                <strong>Selected Supplier</strong>
                <div
                  style={{
                    marginTop: "6px",
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <StatusBadge status={supplierMap[supplierId]?.supplier_status || "unknown"} />
                  <StatusBadge status={supplierMap[supplierId]?.supplier_risk_level || "unknown"} />
                  <Link href={`/suppliers/${supplierId}`}>Open Supplier Profile</Link>
                </div>
              </div>
            ) : null}

            <FormField label="Part Number">
              <input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} style={standardInputStyle} />
            </FormField>

            <FormField label="Lot Number">
              <input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} style={standardInputStyle} />
            </FormField>

            <FormField label="Receipt Date">
              <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} style={standardInputStyle} />
            </FormField>

            <FormField label="Quantity Received">
              <input type="number" value={quantityReceived} onChange={(e) => setQuantityReceived(e.target.value)} style={standardInputStyle} />
            </FormField>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button type="button" onClick={createInspection}>Create Inspection</button>
              <button type="button" onClick={() => { resetInspectionForm(); setShowCreateInspection(false); }}>Cancel</button>
            </div>
          </div>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Receiving Inspection Register</h2>

        <div style={{ marginBottom: "14px" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inspections by supplier, part, lot, result"
            style={{ padding: "10px", width: "360px", maxWidth: "100%" }}
          />
          <span style={{ marginLeft: "10px", color: "#6b7280" }}>
            Showing {filteredInspections.length} of {inspections.length}
          </span>
        </div>

        {loading ? (
          <p>Loading receiving inspections...</p>
        ) : inspections.length === 0 ? (
          <EmptyStateCard
            title="No receiving inspections recorded"
            message="Create receiving inspections from this page or from an enabled supplier profile."
          />
        ) : filteredInspections.length === 0 ? (
          <EmptyStateCard
            title="No inspections match the search"
            message="Adjust the search field to view more receiving inspections."
          />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Supplier</th>
                <th style={thStyle}>Part Number</th>
                <th style={thStyle}>Lot Number</th>
                <th style={thStyle}>Receipt Date</th>
                <th style={thStyle}>Qty Received</th>
                <th style={thStyle}>Qty Accepted</th>
                <th style={thStyle}>Qty Rejected</th>
                <th style={thStyle}>Result</th>
                <th style={thStyle}>NCMR</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInspections.map((inspection) => {
                const supplier = supplierMap[inspection.supplier_id];
                const shouldCreateNcmr = inspectionRequiresNcmr(inspection);

                return (
                  <tr key={inspection.id}>
                    <td style={tdStyle}>
                      {supplier ? (
                        <Link href={`/suppliers/${supplier.id}`}>
                          {supplier.supplier_name}
                        </Link>
                      ) : (
                        "N/A"
                      )}
                    </td>
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
                        <Link href={`/ncmrs/${inspection.linked_ncmr_id}`}>
                          Open NCMR
                        </Link>
                      ) : shouldCreateNcmr ? (
                        <StatusBadge status="NCMR Needed" />
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "grid", gap: "6px" }}>
                        {inspection.supplier_id ? (
                          <Link href={`/suppliers/${inspection.supplier_id}/receiving-inspections/${inspection.id}`}>
                            Open Inspection
                          </Link>
                        ) : null}

                        {shouldCreateNcmr && !inspection.linked_ncmr_id ? (
                          <button type="button" onClick={() => createLinkedNcmr(inspection)}>
                            Create Linked NCMR
                          </button>
                        ) : null}
                      </div>
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
