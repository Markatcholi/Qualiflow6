"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function CapaFullRecordReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [linkedNcmr, setLinkedNcmr] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      const recordRes = await supabase
        .from("capas")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (recordRes.error) {
        alert(recordRes.error.message);
        setLoading(false);
        return;
      }

      const capa = recordRes.data;
      setRecord(capa);

      if (capa?.ncmr_id) {
        const ncmrRes = await supabase
          .from("ncmrs")
          .select("*")
          .eq("id", capa.ncmr_id)
          .maybeSingle();

        if (!ncmrRes.error) setLinkedNcmr(ncmrRes.data || null);
      }

      setLoading(false);
    };

    if (id) fetchReport();
  }, [id]);

  if (loading) return <main style={{ padding: "20px" }}>Loading CAPA full record...</main>;
  if (!record) return <main style={{ padding: "20px" }}>CAPA record not found.</main>;

  return (
    <main style={pageStyle}>
      <div className="no-print" style={{ marginBottom: "18px" }}>
        <button onClick={() => window.print()} style={{ padding: "8px 12px", marginRight: "10px" }}>
          Print / Save as PDF
        </button>
        <a href={`/capa/${id}`}>Back to CAPA Workflow</a>
      </div>

      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>CAPA Full Controlled Record</h1>
          <div><strong>CAPA Number:</strong> {displayValue(record.capa_number || "CAPA-PENDING")}</div>
          <div><strong>Status:</strong> {displayValue(record.status)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div><strong>Generated:</strong> {new Date().toISOString()}</div>
          <div><strong>QMS Record Type:</strong> CAPA</div>
        </div>
      </header>

      <section style={sectionStyle}>
        <h2>1. Initiation / Identification</h2>
        <Field label="Title" value={record.title} />
        <Field label="CAPA Type" value={record.capa_type} />
        <Field label="Source Type" value={record.source_type} />
        <Field label="CAPA Source" value={record.capa_source} />
        <Field label="Owner" value={record.owner} />
        <Field label="Due Date" value={record.due_date} />
        <Field label="Supplier" value={record.supplier_name} />
      </section>

      <section style={sectionStyle}>
        <h2>2. Problem / Root Cause</h2>
        <Field label="Problem Description" value={record.problem_description} />
        <Field label="Investigation Summary" value={record.investigation_summary} />
        <Field label="Root Cause" value={record.root_cause} />
      </section>

      <section style={sectionStyle}>
        <h2>3. Action / Implementation</h2>
        <Field label="Corrective Action Plan" value={record.corrective_action_plan || record.action_plan} />
        <Field label="Implementation Details" value={record.implementation_details} />
        <Field label="Implemented By" value={record.implemented_by} />
        <Field label="Implemented At" value={record.implemented_at} />
      </section>

      <section style={sectionStyle}>
        <h2>4. Effectiveness</h2>
        <Field label="Effectiveness Due Date" value={record.effectiveness_due_date} />
        <Field label="Effectiveness Check" value={record.effectiveness_check} />
        <Field label="Effectiveness Rating" value={record.effectiveness_rating} />
        <Field label="Follow-up Action" value={record.effectiveness_followup_action} />
      </section>

      <section style={sectionStyle}>
        <h2>5. Linked Records</h2>
        <Field label="Linked NCMR ID" value={record.ncmr_id} />
        <Field label="Linked NCMR Title" value={linkedNcmr?.title} />
      </section>

      <section style={sectionStyle}>
        <h2>6. Closure / Signature</h2>
        <Field label="Signed By" value={record.signed_by} />
        <Field label="Signed At" value={record.signed_at} />
        <Field label="Signature Meaning" value={record.signature_meaning} />
        <Field label="Closed At" value={record.closed_at} />
      </section>

      <footer className="print-footer">
        CAPA Controlled Record | {record.capa_number || record.id}
      </footer>

      <style jsx global>{`
        @media print {
          .no-print { display: none; }
          .print-footer {
            position: fixed;
            bottom: 0;
            width: 100%;
            font-size: 10px;
          }
        }
      `}</style>
    </main>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return <p><strong>{label}:</strong> {displayValue(value)}</p>;
}

function displayValue(v: any) {
  return v === null || v === undefined || v === "" ? "N/A" : String(v);
}

const pageStyle = { padding: "36px", fontFamily: "Arial, sans-serif" };
const headerStyle = { display: "flex", justifyContent: "space-between" };
const sectionStyle = { border: "1px solid #ccc", padding: "12px", marginTop: "12px" };
