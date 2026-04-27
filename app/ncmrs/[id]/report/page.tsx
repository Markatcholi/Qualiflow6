"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function NcmrReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [record, setRecord] = useState<any>(null);

  useEffect(() => {
    const fetchRecord = async () => {
      const { data, error } = await supabase
        .from("ncmrs")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) alert(error.message);
      setRecord(data);
    };

    if (id) fetchRecord();
  }, [id]);

  if (!record) return <main style={{ padding: 20 }}>Loading report...</main>;

  return (
    <main style={{ padding: 30, fontFamily: "Arial, sans-serif" }}>
      <button onClick={() => window.print()} className="no-print">
        Print / Save as PDF
      </button>

      <h1>NCMR Report</h1>

      <h2>Record Summary</h2>
      <p><strong>Title:</strong> {record.title}</p>
      <p><strong>Status:</strong> {record.status}</p>
      <p><strong>Severity:</strong> {record.severity}</p>
      <p><strong>Part Number:</strong> {record.product_part_number}</p>
      <p><strong>Lot Number:</strong> {record.lot_number}</p>
      <p><strong>Work Order:</strong> {record.workorder_number}</p>
      <p><strong>Supplier:</strong> {record.supplier_name}</p>
      <p><strong>Date Detected:</strong> {record.date_detected}</p>

      <h2>Issue / Containment</h2>
      <p><strong>Issue Description:</strong> {record.issue_description}</p>
      <p><strong>Quantity Affected:</strong> {record.quantity_affected}</p>
      <p><strong>Containment Action:</strong> {record.containment_action}</p>
      <p><strong>Containment Owner:</strong> {record.containment_owner}</p>
      <p><strong>Material Status:</strong> {record.material_status}</p>

      <h2>Investigation</h2>
      <p><strong>Investigator:</strong> {record.investigator}</p>
      <p><strong>Problem Description:</strong> {record.problem_description}</p>
      <p><strong>Investigation Summary:</strong> {record.investigation_summary}</p>
      <p><strong>Root Cause:</strong> {record.root_cause}</p>

      <h2>Risk / Disposition / MRB</h2>
      <p><strong>Risk Assessment:</strong> {record.risk_assessment}</p>
      <p><strong>Product Disposition:</strong> {record.product_disposition || record.disposition}</p>
      <p><strong>Disposition Justification:</strong> {record.disposition_justification}</p>
      <p><strong>MRB Approved By:</strong> {record.mrb_approved_by}</p>
      <p><strong>MRB Approved At:</strong> {record.mrb_approved_at}</p>
      <p><strong>MRB Signature Meaning:</strong> {record.mrb_signature_meaning}</p>

      <h2>Correction / Closure</h2>
      <p><strong>Correction Proposal:</strong> {record.correction_action_proposal}</p>
      <p><strong>Corrective Action Recommendation:</strong> {record.corrective_action}</p>
      <p><strong>Correction Implementation:</strong> {record.correction_implementation}</p>
      <p><strong>Implemented By:</strong> {record.correction_implemented_by}</p>
      <p><strong>Closed By:</strong> {record.ncmr_closed_by}</p>
      <p><strong>Closed At:</strong> {record.closed_at}</p>
      <p><strong>Closure Signature Meaning:</strong> {record.ncmr_signature_meaning}</p>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none;
          }
          body {
            color: black;
          }
        }
      `}</style>
    </main>
  );
}
