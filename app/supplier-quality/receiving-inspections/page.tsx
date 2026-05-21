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
  const [approvalNotesByInspection, setApprovalNotesByInspection] = useState<Record<string, string>>({});

  const [supplierId, setSupplierId] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partRevision, setPartRevision] = useState("");
  const [partDescription, setPartDescription] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [receivingInspectionProcedure, setReceivingInspectionProcedure] = useState("");
  const [receivingInspectionProcedureRevision, setReceivingInspectionProcedureRevision] = useState("");
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
      inspection.part_revision,
      inspection.part_description,
      inspection.lot_number,
      inspection.receiving_inspection_procedure,
      inspection.receiving_inspection_procedure_revision,
      inspection.inspection_result,
      inspection.approval_status,
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

    const rows = inspectionRes.data || [];
    setInspections(rows);

    const notes: Record<string, string> = {};
    rows.forEach((inspection: any) => {
      notes[inspection.id] = inspection.approval_notes || "";
    });
    setApprovalNotesByInspection(notes);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetInspectionForm = () => {
    setSupplierId("");
    setPartNumber("");
    setPartRevision("");
    setPartDescription("");
    setLotNumber("");
    setReceivingInspectionProcedure("");
    setReceivingInspectionProcedureRevision("");
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
        part_revision: partRevision || null,
        part_description: partDescription || null,
        lot_number: lotNumber,
        receiving_inspection_procedure: receivingInspectionProcedure || null,
        receiving_inspection_procedure_revision: receivingInspectionProcedureRevision || null,
        receipt_date: receiptDate || null,
        quantity_received: quantityReceived ? Number(quantityReceived) : null,
        inspection_result: "pending",
        approval_status: "pending_approval",
        is_locked: false,
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

  const canApproveInspection = (inspection: any) => {
    const result = String(inspection.inspection_result || "").toLowerCase();

    if (inspection.is_locked || inspection.approval_status === "approved") return false;
    if (!result || result === "pending") return false;
    if (inspectionRequiresNcmr(inspection) && !inspection.linked_ncmr_id) return false;

    return true;
  };

  const approveInspection = async (inspection: any) => {
    if (!canApproveInspection(inspection)) {
      alert(
        "Inspection cannot be approved yet. Complete disposition first. If the inspection is rejected/nonconforming, create the linked NCMR before approval."
      );
      return;
    }

    const confirmed = window.confirm(
      "Approve and lock this receiving inspection record?\\n\\nSignature meaning: I reviewed the receiving inspection record, disposition, supplier information, quantities, and linked quality records as applicable, and approve this inspection as complete."
    );

    if (!confirmed) return;

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";
    const now = new Date().toISOString();

    const signatureMeaning =
      "I reviewed the receiving inspection record, disposition, supplier information, quantities, and linked quality records as applicable, and approve this inspection as complete.";

    const { error } = await supabase
      .from("receiving_inspections")
      .update({
        approval_status: "approved",
        approved_by: userEmail,
        approved_at: now,
        approval_signature_meaning: signatureMeaning,
        approval_notes: approvalNotesByInspection[inspection.id] || null,
        is_locked: true,
        locked_at: now,
        locked_by: userEmail,
      })
      .eq("id", inspection.id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: "receiving_inspection",
      entity_id: inspection.id,
      action: "receiving_inspection_approved_locked",
      details: "Receiving inspection electronically approved and locked.",
      user_email: userEmail,
    });

    alert("Receiving inspection approved and locked.");
    fetchData();
  };

  const printInspectionRecord = (inspection: any) => {
    const supplier = supplierMap[inspection.supplier_id];

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receiving Inspection Record</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 32px;
              color: #111827;
            }

            .header {
              border-bottom: 3px solid #111827;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }

            .eyebrow {
              font-size: 12px;
              letter-spacing: 0.08em;
              color: #6b7280;
              font-weight: 700;
              margin-bottom: 6px;
            }

            h1 {
              margin: 0;
              font-size: 28px;
            }

            h2 {
              font-size: 18px;
              border-bottom: 1px solid #d1d5db;
              padding-bottom: 6px;
              margin-top: 26px;
            }

            .meta {
              color: #4b5563;
              margin-top: 6px;
              font-size: 13px;
            }

            .grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 12px;
              margin-top: 12px;
            }

            .field {
              border: 1px solid #d1d5db;
              border-radius: 8px;
              padding: 10px;
              min-height: 48px;
            }

            .label {
              font-size: 11px;
              color: #6b7280;
              font-weight: 700;
              text-transform: uppercase;
              margin-bottom: 4px;
            }

            .value {
              font-size: 14px;
              color: #111827;
              white-space: pre-wrap;
              word-break: break-word;
            }

            .full {
              grid-column: 1 / -1;
            }

            .approval {
              border: 2px solid #111827;
              border-radius: 10px;
              padding: 14px;
              margin-top: 12px;
            }

            .footer {
              margin-top: 36px;
              border-top: 1px solid #d1d5db;
              padding-top: 10px;
              color: #6b7280;
              font-size: 11px;
            }

            @media print {
              button {
                display: none;
              }

              body {
                margin: 24px;
              }
            }
          </style>
        </head>

        <body>
          <div class="header">
            <div class="eyebrow">QUALIFLOW QUALITY RECORD</div>
            <h1>Receiving Inspection Record</h1>
            <div class="meta">
              Generated: ${escapeHtml(new Date().toLocaleString())}
            </div>
          </div>

          <h2>Supplier Information</h2>
          <div class="grid">
            <div class="field">
              <div class="label">Supplier Name</div>
              <div class="value">${escapeHtml(supplier?.supplier_name || "N/A")}</div>
            </div>

            <div class="field">
              <div class="label">Supplier Number</div>
              <div class="value">${escapeHtml(supplier?.supplier_number || "N/A")}</div>
            </div>

            <div class="field">
              <div class="label">Supplier Status</div>
              <div class="value">${escapeHtml(supplier?.supplier_status || "N/A")}</div>
            </div>

            <div class="field">
              <div class="label">Supplier Risk Level</div>
              <div class="value">${escapeHtml(supplier?.supplier_risk_level || "N/A")}</div>
            </div>
          </div>

          <h2>Inspection Details</h2>
          <div class="grid">
            <div class="field">
              <div class="label">Part Number</div>
              <div class="value">${escapeHtml(inspection.part_number || "N/A")}</div>
            </div>

            <div class="field">
              <div class="label">Part Revision</div>
              <div class="value">${escapeHtml(inspection.part_revision || "N/A")}</div>
            </div>

            <div class="field full">
              <div class="label">Part Description</div>
              <div class="value">${escapeHtml(inspection.part_description || "N/A")}</div>
            </div>

            <div class="field">
              <div class="label">Lot Number</div>
              <div class="value">${escapeHtml(inspection.lot_number || "N/A")}</div>
            </div>

            <div class="field">
              <div class="label">Receiving Inspection Procedure</div>
              <div class="value">${escapeHtml(inspection.receiving_inspection_procedure || "N/A")}</div>
            </div>

            <div class="field">
              <div class="label">Procedure Revision</div>
              <div class="value">${escapeHtml(inspection.receiving_inspection_procedure_revision || "N/A")}</div>
            </div>

            <div class="field">
              <div class="label">Receipt Date</div>
              <div class="value">${escapeHtml(inspection.receipt_date || "N/A")}</div>
            </div>

            <div class="field">
              <div class="label">Inspection Result</div>
              <div class="value">${escapeHtml(inspection.inspection_result || "pending")}</div>
            </div>

            <div class="field">
              <div class="label">Quantity Received</div>
              <div class="value">${escapeHtml(String(inspection.quantity_received ?? "N/A"))}</div>
            </div>

            <div class="field">
              <div class="label">Quantity Accepted</div>
              <div class="value">${escapeHtml(String(inspection.quantity_accepted ?? "N/A"))}</div>
            </div>

            <div class="field">
              <div class="label">Quantity Rejected</div>
              <div class="value">${escapeHtml(String(inspection.quantity_rejected ?? "N/A"))}</div>
            </div>

            <div class="field">
              <div class="label">Inspection ID</div>
              <div class="value">${escapeHtml(inspection.id || "N/A")}</div>
            </div>
          </div>

          <h2>Linked Quality Records</h2>
          <div class="grid">
            <div class="field">
              <div class="label">NCMR Required</div>
              <div class="value">${inspectionRequiresNcmr(inspection) ? "Yes" : "No"}</div>
            </div>

            <div class="field">
              <div class="label">Linked NCMR ID</div>
              <div class="value">${escapeHtml(inspection.linked_ncmr_id || "N/A")}</div>
            </div>

            <div class="field">
              <div class="label">NCMR Created</div>
              <div class="value">${inspection.ncmr_created ? "Yes" : "No"}</div>
            </div>

            <div class="field">
              <div class="label">Source Module</div>
              <div class="value">Receiving Inspection</div>
            </div>
          </div>

          <h2>Approval / Electronic Signature</h2>
          <div class="approval">
            <div class="grid">
              <div class="field">
                <div class="label">Approval Status</div>
                <div class="value">${escapeHtml(inspection.approval_status || "pending_approval")}</div>
              </div>

              <div class="field">
                <div class="label">Record Locked</div>
                <div class="value">${inspection.is_locked ? "Yes" : "No"}</div>
              </div>

              <div class="field">
                <div class="label">Approved By</div>
                <div class="value">${escapeHtml(inspection.approved_by || "N/A")}</div>
              </div>

              <div class="field">
                <div class="label">Approved At</div>
                <div class="value">${escapeHtml(inspection.approved_at || "N/A")}</div>
              </div>

              <div class="field">
                <div class="label">Locked By</div>
                <div class="value">${escapeHtml(inspection.locked_by || "N/A")}</div>
              </div>

              <div class="field">
                <div class="label">Locked At</div>
                <div class="value">${escapeHtml(inspection.locked_at || "N/A")}</div>
              </div>

              <div class="field full">
                <div class="label">Signature Meaning</div>
                <div class="value">${escapeHtml(inspection.approval_signature_meaning || "N/A")}</div>
              </div>

              <div class="field full">
                <div class="label">Approval Notes</div>
                <div class="value">${escapeHtml(inspection.approval_notes || "N/A")}</div>
              </div>
            </div>
          </div>

          <h2>Record Metadata</h2>
          <div class="grid">
            <div class="field">
              <div class="label">Created By</div>
              <div class="value">${escapeHtml(inspection.created_by || "N/A")}</div>
            </div>

            <div class="field">
              <div class="label">Created At</div>
              <div class="value">${escapeHtml(inspection.created_at || "N/A")}</div>
            </div>

            <div class="field">
              <div class="label">Updated At</div>
              <div class="value">${escapeHtml(inspection.updated_at || "N/A")}</div>
            </div>

            <div class="field">
              <div class="label">Generated From</div>
              <div class="value">QualiFlow Receiving Inspection Module</div>
            </div>
          </div>

          <div class="footer">
            Confidential quality system record. Printed for audit review, inspection verification, and controlled record evidence.
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
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

  const createLinkedNcmr = async (inspection: any) => {
    if (inspection.is_locked) {
      alert("This inspection is locked and cannot be changed.");
      return;
    }

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

    const title = `Receiving Inspection Nonconformance - ${
      inspection.part_number || "Part"
    } / Lot ${inspection.lot_number || "N/A"}`;

    const issueDescription = `Receiving inspection identified a nonconforming or rejected result. Supplier: ${
      supplier?.supplier_name || "N/A"
    }. Part: ${inspection.part_number || "N/A"}. Lot: ${
      inspection.lot_number || "N/A"
    }. Quantity received: ${
      inspection.quantity_received ?? "N/A"
    }. Quantity rejected: ${
      inspection.quantity_rejected ?? "N/A"
    }. Inspection result: ${inspection.inspection_result || "N/A"}.`;

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
        quantity_affected:
          inspection.quantity_rejected ?? inspection.quantity_received ?? null,
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
        details: `NCMR created from receiving inspection for supplier ${
          supplier?.supplier_name || "N/A"
        }, part ${inspection.part_number || "N/A"}, lot ${
          inspection.lot_number || "N/A"
        }.`,
        user_email: userEmail,
      },
    ]);

    alert("Linked NCMR created.");
    fetchData();
    window.open(`/ncmrs/${ncmrData.id}`, "_blank");
  };

  const totalInspections = inspections.length;

  const pendingInspections = inspections.filter(
    (inspection) => String(inspection.inspection_result || "").toLowerCase() === "pending"
  ).length;

  const rejectedInspections = inspections.filter((inspection) =>
    inspectionRequiresNcmr(inspection)
  ).length;

  const linkedNcmrs = inspections.filter((inspection) => inspection.linked_ncmr_id).length;

  const approvedInspections = inspections.filter(
    (inspection) => inspection.approval_status === "approved"
  ).length;

  const pendingApprovalInspections = inspections.filter(
    (inspection) => inspection.approval_status !== "approved"
  ).length;

  const supplierRejectRate =
    totalInspections > 0
      ? ((rejectedInspections / totalInspections) * 100).toFixed(1)
      : "0.0";

  const highRiskSuppliers = suppliers.filter((supplier) => {
    const risk = String(supplier.supplier_risk_level || "").toLowerCase();
    return risk === "high" || risk === "critical";
  }).length;

  const inspectionsNeedingNcmr = inspections.filter(
    (inspection) => inspectionRequiresNcmr(inspection) && !inspection.linked_ncmr_id
  );

  const operationalAlerts = [
    pendingInspections > 0 ? `${pendingInspections} inspection(s) are pending disposition.` : "",
    inspectionsNeedingNcmr.length > 0
      ? `${inspectionsNeedingNcmr.length} inspection(s) require NCMR creation.`
      : "",
    pendingApprovalInspections > 0
      ? `${pendingApprovalInspections} inspection(s) are awaiting approval.`
      : "",
    Number(supplierRejectRate) > 10
      ? `Supplier reject rate is ${supplierRejectRate}%, above target threshold.`
      : "",
    highRiskSuppliers > 0
      ? `${highRiskSuppliers} supplier(s) are currently high or critical risk.`
      : "",
  ].filter(Boolean);

  return (
    <main
      style={{
        padding: "24px",
        fontFamily: "Arial",
        background: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>INCOMING QUALITY OPERATIONS</div>

          <h1 style={{ marginBottom: "6px" }}>Global Receiving Inspections</h1>

          <p style={{ color: "#4b5563", marginTop: 0 }}>
            Incoming inspection operations, supplier lot acceptance, reject
            intelligence, inspection-driven NCMR creation, inspection approval,
            and supplier incoming quality controls.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/suppliers">Supplier Quality</Link>
          <Link href="/supplier-quality-dashboard">Supplier Dashboard</Link>
          <Link href="/supplier-quality/scars">SCARs</Link>
          <Link href="/scar/dashboard">Governance</Link>
        </div>
      </div>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Receiving Inspection Intelligence</h2>

        <div style={kpiGridStyle}>
          <KpiCard title="Total Inspections" value={totalInspections} color="#2563eb" />

          <KpiCard
            title="Pending Inspections"
            value={pendingInspections}
            color={pendingInspections > 0 ? "#d97706" : "#15803d"}
          />

          <KpiCard
            title="Rejected / Nonconforming"
            value={rejectedInspections}
            color={rejectedInspections > 0 ? "#dc2626" : "#15803d"}
          />

          <KpiCard title="Linked NCMRs" value={linkedNcmrs} color="#7c3aed" />

          <KpiCard title="Approved Inspections" value={approvedInspections} color="#15803d" />

          <KpiCard
            title="Awaiting Approval"
            value={pendingApprovalInspections}
            color={pendingApprovalInspections > 0 ? "#d97706" : "#15803d"}
          />

          <KpiCard
            title="Reject Rate"
            value={`${supplierRejectRate}%`}
            color={Number(supplierRejectRate) > 10 ? "#dc2626" : "#15803d"}
          />

          <KpiCard
            title="High Risk Suppliers"
            value={highRiskSuppliers}
            color={highRiskSuppliers > 0 ? "#dc2626" : "#15803d"}
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Operational Alerts</h2>

        {operationalAlerts.length === 0 ? (
          <p style={{ color: "#15803d", fontWeight: 700 }}>
            No significant incoming quality alerts identified.
          </p>
        ) : (
          <div style={alertGridStyle}>
            {operationalAlerts.map((alert, index) => (
              <div key={index} style={alertCardStyle}>
                {alert}
              </div>
            ))}
          </div>
        )}
      </section>

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
          <div style={createCardStyle}>
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
              <div style={warningCardStyle}>
                No suppliers currently have receiving inspection enabled.
              </div>
            ) : null}

            {supplierId ? (
              <div style={supplierInfoCardStyle}>
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

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={createInspection}
                style={primaryButtonStyle}
              >
                Create Inspection
              </button>

              <button
                type="button"
                onClick={() => {
                  resetInspectionForm();
                  setShowCreateInspection(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Receiving Inspection Queue</h2>

        <div style={{ marginBottom: "14px" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inspections by supplier, part, lot, result, approval"
            style={searchInputStyle}
          />

          <span style={searchSummaryStyle}>
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
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Supplier</th>
                  <th style={thStyle}>Risk</th>
                  <th style={thStyle}>Part Number</th>
                  <th style={thStyle}>Lot Number</th>
                  <th style={thStyle}>Receipt Date</th>
                  <th style={thStyle}>Qty Received</th>
                  <th style={thStyle}>Qty Rejected</th>
                  <th style={thStyle}>Result</th>
                  <th style={thStyle}>NCMR Status</th>
                  <th style={thStyle}>Approval</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredInspections.map((inspection, index) => {
                  const supplier = supplierMap[inspection.supplier_id];

                  const shouldCreateNcmr = inspectionRequiresNcmr(inspection);
                  const isApproved = inspection.approval_status === "approved";

                  return (
                    <tr key={inspection.id} style={stripedRowStyle(index)}>
                      <td style={tdStyle}>
                        {supplier ? (
                          <Link href={`/suppliers/${supplier.id}`}>
                            <strong>{supplier.supplier_name}</strong>
                          </Link>
                        ) : (
                          "N/A"
                        )}
                      </td>

                      <td style={tdStyle}>
                        <StatusBadge status={supplier?.supplier_risk_level || "unknown"} />
                      </td>

                      <td style={tdStyle}>{inspection.part_number || "N/A"}</td>

                      <td style={tdStyle}>{inspection.lot_number || "N/A"}</td>

                      <td style={tdStyle}>{inspection.receipt_date || "N/A"}</td>

                      <td style={tdStyle}>{inspection.quantity_received ?? "N/A"}</td>

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
                        <StatusBadge status={inspection.approval_status || "pending_approval"} />

                        {isApproved ? (
                          <div style={{ color: "#6b7280", fontSize: "12px", marginTop: "6px" }}>
                            Approved by {inspection.approved_by || "N/A"}
                            <br />
                            {inspection.approved_at || "N/A"}
                            <br />
                            <span style={{ color: "#15803d", fontWeight: 700 }}>
                              Editing disabled after lock
                            </span>
                          </div>
                        ) : (
                          <textarea
                            value={approvalNotesByInspection[inspection.id] || ""}
                            onChange={(e) =>
                              setApprovalNotesByInspection({
                                ...approvalNotesByInspection,
                                [inspection.id]: e.target.value,
                              })
                            }
                            placeholder="Approval notes"
                            rows={2}
                            style={{
                              width: "180px",
                              marginTop: "6px",
                              padding: "8px",
                              borderRadius: "8px",
                              border: "1px solid #d1d5db",
                            }}
                          />
                        )}
                      </td>

                      <td style={tdStyle}>
                        <div style={{ display: "grid", gap: "6px" }}>
                          {inspection.is_locked ? (
                            <span style={{ color: "#15803d", fontWeight: 700 }}>
                              Locked Record
                            </span>
                          ) : inspection.supplier_id ? (
                            <Link
                              href={`/suppliers/${inspection.supplier_id}/receiving-inspections/${inspection.id}`}
                            >
                              Open Inspection
                            </Link>
                          ) : null}

                          {shouldCreateNcmr && !inspection.linked_ncmr_id && !inspection.is_locked ? (
                            <button
                              type="button"
                              onClick={() => createLinkedNcmr(inspection)}
                            >
                              Create Linked NCMR
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => printInspectionRecord(inspection)}
                          >
                            {inspection.is_locked ? "Print Locked Record" : "Print Record"}
                          </button>

                          {!isApproved ? (
                            <button
                              type="button"
                              onClick={() => approveInspection(inspection)}
                              disabled={!canApproveInspection(inspection)}
                              style={{
                                opacity: canApproveInspection(inspection) ? 1 : 0.55,
                                cursor: canApproveInspection(inspection) ? "pointer" : "not-allowed",
                              }}
                            >
                              Approve / Lock
                            </button>
                          ) : (
                            <span style={{ color: "#15803d", fontWeight: 700 }}>
                              Locked
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function escapeHtml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function KpiCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string | number;
  color: string;
}) {
  return (
    <div
      style={{
        borderRadius: "14px",
        padding: "18px",
        background: "white",
        border: "1px solid #e5e7eb",
        borderLeft: `6px solid ${color}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          color: "#6b7280",
          fontSize: "13px",
          fontWeight: 700,
          marginBottom: "8px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "30px",
          fontWeight: 800,
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
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

const sectionStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "18px",
  marginBottom: "20px",
  background: "white",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
};

const alertGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "12px",
};

const alertCardStyle: React.CSSProperties = {
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  fontWeight: 700,
};

const createCardStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "14px",
  background: "#f9fafb",
  marginTop: "12px",
};

const supplierInfoCardStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  padding: "10px",
  background: "white",
  marginBottom: "12px",
};

const warningCardStyle: React.CSSProperties = {
  border: "1px solid #facc15",
  background: "#fefce8",
  borderRadius: "8px",
  padding: "10px",
  marginBottom: "12px",
};

const searchInputStyle: React.CSSProperties = {
  padding: "10px",
  width: "360px",
  maxWidth: "100%",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
};

const searchSummaryStyle: React.CSSProperties = {
  marginLeft: "10px",
  color: "#6b7280",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1650px",
};

const thStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px",
  background: "#f3f4f6",
  textAlign: "left",
  fontSize: "13px",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px",
  fontSize: "13px",
  verticalAlign: "top",
};

const stripedRowStyle = (index: number): React.CSSProperties => ({
  background: index % 2 === 0 ? "#ffffff" : "#f9fafb",
});
