"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function CapaReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [record, setRecord] = useState<any>(null);

  useEffect(() => {
    const fetchRecord = async () => {
      const { data, error } = await supabase
        .from("capas")
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

      <h1>CAPA Report</h1>

      <h2>Record Summary</h2>
      <p><strong>Title:</strong> {record.title}</p>
      <p><strong>Status:</strong> {record.status}</p>
      <p><strong>CAPA Type:</strong> {record.capa_type}</p>
      <p><strong>Supplier:</strong> {record.supplier_name}</p>
      <p><strong>Linked NCMR:</strong> {record.linked_ncmr_title}</p>
      <p><strong>Owner:</strong> {record.owner}</p>
      <p><strong>Due Date:</strong> {record.due_date}</p>

      <h2>Investigation / Root Cause</h2>
      <p><strong>Problem Description:</strong> {record.problem_description}</p>
      <p><strong>Investigation Summary:</strong> {record.investigation_summary}</p>
      <p><strong>Root Cause:</strong> {record.root_cause}</p>

      <h2>Action / Implementation</h2>
      <p><strong>Corrective Action Plan:</strong> {record.corrective_action_plan || record.action_plan}</p>
      <p><strong>Implementation Details:</strong> {record.implementation_details}</p>
      <p><strong>Implemented By:</strong> {record.implemented_by}</p>
      <p><strong>Implemented At:</strong> {record.implemented_at}</p>

      <h2>Effectiveness</h2>
      <p><strong>Effectiveness Due Date:</strong> {record.effectiveness_due_date}</p>
      <p><strong>Effectiveness Check:</strong> {record.effectiveness_check}</p>
      <p><strong>Effectiveness Rating:</strong> {record.effectiveness_rating}</p>
      <p><strong>Follow-up Action:</strong> {record.effectiveness_followup_action}</p>

      <h2>Approval / Closure</h2>
      <p><strong>Signed By:</strong> {record.signed_by}</p>
      <p><strong>Signed At:</strong> {record.signed_at}</p>
      <p><strong>Signature Meaning:</strong> {record.signature_meaning}</p>
      <p><strong>Closed At:</strong> {record.closed_at}</p>

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
