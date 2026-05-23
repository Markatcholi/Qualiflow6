"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function EnterpriseCapaReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [linkedNcmr, setLinkedNcmr] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      const capaRes = await supabase
        .from("capas")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (capaRes.error) {
        alert(capaRes.error.message);
        setLoading(false);
        return;
      }

      const capa = capaRes.data;
      setRecord(capa);

      const taskRes = await supabase
        .from("capa_tasks")
        .select("*")
        .eq("capa_id", id)
        .order("created_at", { ascending: true });

      if (!taskRes.error) {
        setTasks(taskRes.data || []);
      }

      if (capa?.ncmr_id) {
        const ncmrRes = await supabase
          .from("ncmrs")
          .select("*")
          .eq("id", capa.ncmr_id)
          .maybeSingle();

        if (!ncmrRes.error) {
          setLinkedNcmr(ncmrRes.data || null);
        }
      }

      setLoading(false);
    };

    if (id) fetchReport();
  }, [id]);

  if (loading) {
    return (
      <main style={{ padding: "24px" }}>
        Loading enterprise CAPA report...
      </main>
    );
  }

  if (!record) {
    return (
      <main style={{ padding: "24px" }}>
        CAPA record not found.
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div className="no-print" style={{ marginBottom: "20px" }}>
        <button
          onClick={() => window.print()}
          style={buttonStyle}
        >
          Print / Save PDF
        </button>

        <a
          href={`/capa/${id}`}
          style={{ marginLeft: "14px" }}
        >
          Back to Workflow
        </a>
      </div>

      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0 }}>
            Enterprise CAPA Controlled Record
          </h1>

          <div>
            <strong>CAPA Number:</strong>{" "}
            {displayValue(record.capa_number)}
          </div>

          <div>
            <strong>Status:</strong>{" "}
            {displayValue(record.status)}
          </div>

          <div>
            <strong>Risk Level:</strong>{" "}
            {displayValue(record.risk_level)}
          </div>

          <div>
            <strong>Severity:</strong>{" "}
            {displayValue(record.severity)}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div>
            <strong>Generated:</strong>{" "}
            {new Date().toISOString()}
          </div>

          <div>
            <strong>QMS Record:</strong> CAPA
          </div>

          <div>
            <strong>Workflow Health:</strong>{" "}
            {record.status === "closed"
              ? "Closed"
              : "Active"}
          </div>
        </div>
      </header>

      <Section title="1. Intake">
        <Field label="Title" value={record.title} />
        <Field label="Problem Description" value={record.problem_description} />
        <Field label="Detection Source" value={record.detection_source} />
        <Field label="CAPA Classification" value={record.capa_classification} />
        <Field label="Owner" value={record.owner} />
        <Field label="Due Date" value={record.due_date} />
      </Section>

      <Section title="2. Scope">
        <Field label="Scope Summary" value={record.scope_summary} />
        <Field label="Affected Product" value={record.affected_product} />
        <Field label="Affected Lot" value={record.affected_lot} />
        <Field label="Affected Process" value={record.affected_process} />
        <Field label="Affected Supplier" value={record.affected_supplier} />
        <Field label="Potential Impact" value={record.potential_impact} />
      </Section>

      <Section title="3. Containment">
        <Field label="Containment Action" value={record.containment_action} />
        <Field label="Containment Owner" value={record.containment_owner} />
        <Field
          label="Containment Complete"
          value={record.containment_complete}
        />
        <Field
          label="Residual Risk"
          value={record.containment_residual_risk}
        />
      </Section>

      <Section title="4. Investigation">
        <Field
          label="Investigation Objective"
          value={record.investigation_objective}
        />

        <Field
          label="Evidence Reviewed"
          value={record.evidence_reviewed}
        />

        <Field
          label="Investigation Findings"
          value={
            record.investigation_findings ||
            record.investigation_summary
          }
        />

        <Field
          label="Investigation Conclusion"
          value={record.investigation_conclusion}
        />
      </Section>

      <Section title="5. Root Cause">
        <Field
          label="Root Cause Method"
          value={record.root_cause_method}
        />

        <Field
          label="Root Cause Summary"
          value={record.root_cause}
        />

        <Field
          label="Contributing Factors"
          value={record.contributing_factors}
        />

        <Field
          label="Root Cause Verification"
          value={record.root_cause_verification}
        />

        <Field
          label="Systemic Impact"
          value={record.systemic_impact}
        />
      </Section>

      <Section title="6. Risk Assessment / Severity">
        <Field label="Severity" value={record.severity} />
        <Field
          label="Occurrence Rating"
          value={record.occurrence_rating}
        />

        <Field
          label="Detection Rating"
          value={record.detection_rating}
        />

        <Field
          label="Risk Level"
          value={record.risk_level}
        />

        <Field
          label="Patient Safety Impact"
          value={record.patient_safety_impact}
        />

        <Field
          label="Product Quality Impact"
          value={record.product_quality_impact}
        />

        <Field
          label="Regulatory Impact"
          value={record.regulatory_impact}
        />

        <Field
          label="Risk Rationale"
          value={
            record.risk_rationale ||
            record.risk_assessment
          }
        />
      </Section>

      <Section title="7. Corrective Action">
        <Field
          label="Corrective Action"
          value={
            record.corrective_action_plan ||
            record.corrective_action ||
            record.action_plan
          }
        />

        <Field
          label="Action Owner"
          value={record.action_owner}
        />

        <Field
          label="Action Due Date"
          value={record.action_due_date}
        />

        <Field
          label="Verification Method"
          value={record.verification_method}
        />
      </Section>

      <Section title="8. CAPA Execution Tasks">
        {tasks.length === 0 ? (
          <p>No execution tasks.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Task</th>
                <th style={thStyle}>Owner</th>
                <th style={thStyle}>Due Date</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Evidence</th>
                <th style={thStyle}>Completed By</th>
              </tr>
            </thead>

            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td style={tdStyle}>
                    <strong>{displayValue(task.task_title)}</strong>
                    <div style={{ fontSize: "12px" }}>
                      {displayValue(task.task_description)}
                    </div>
                  </td>

                  <td style={tdStyle}>
                    {displayValue(task.owner)}
                  </td>

                  <td style={tdStyle}>
                    {displayValue(task.due_date)}
                  </td>

                  <td style={tdStyle}>
                    {displayValue(task.status)}
                  </td>

                  <td style={tdStyle}>
                    {displayValue(task.completion_evidence)}
                  </td>

                  <td style={tdStyle}>
                    {displayValue(task.completed_by)}

                    {task.completed_at ? (
                      <div style={{ fontSize: "11px" }}>
                        {task.completed_at}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="9. Implementation">
        <Field
          label="Procedure Updated"
          value={record.procedure_updated}
        />

        <Field
          label="Training Required"
          value={record.training_required}
        />

        <Field
          label="Validation Required"
          value={record.validation_required}
        />

        <Field
          label="Implementation Evidence"
          value={
            record.implementation_details ||
            record.implementation_evidence
          }
        />

        <Field
          label="Implemented By"
          value={record.implemented_by}
        />

        <Field
          label="Implemented At"
          value={record.implemented_at}
        />
      </Section>

      <Section title="10. Effectiveness Verification">
        <Field
          label="Monitoring Method"
          value={record.monitoring_method}
        />

        <Field
          label="Monitoring Period"
          value={record.monitoring_period}
        />

        <Field
          label="Effectiveness Results"
          value={record.effectiveness_check}
        />

        <Field
          label="Effectiveness Rating"
          value={record.effectiveness_rating}
        />

        <Field
          label="Recurrence Detected"
          value={record.recurrence_detected}
        />

        <Field
          label="Follow-up CAPA Required"
          value={record.followup_capa_required}
        />

        <Field
          label="Follow-up Action"
          value={record.effectiveness_followup_action}
        />
      </Section>

      <Section title="11. Approval Governance">
        <Field
          label="Investigation Approval Status"
          value={record.investigation_approval_status}
        />

        <Field
          label="Investigation Approved By"
          value={record.investigation_approved_by}
        />

        <Field
          label="Investigation Approved At"
          value={record.investigation_approved_at}
        />

        <Field
          label="Closure Approval Status"
          value={record.closure_approval_status}
        />

        <Field
          label="Closure Approved By"
          value={record.closure_approved_by}
        />

        <Field
          label="Closure Approved At"
          value={record.closure_approved_at}
        />
      </Section>

      <Section title="12. Linked Records">
        <Field
          label="Linked NCMR"
          value={linkedNcmr?.title}
        />

        <Field
          label="Linked NCMR ID"
          value={record.ncmr_id}
        />
      </Section>

      <Section title="13. Electronic Signature / Lock Evidence">
        <Field
          label="Signed By"
          value={record.signed_by}
        />

        <Field
          label="Signed At"
          value={record.signed_at}
        />

        <Field
          label="Signature Meaning"
          value={record.signature_meaning}
        />

        <Field
          label="Locked By"
          value={record.locked_by}
        />

        <Field
          label="Locked At"
          value={record.locked_at}
        />

        <Field
          label="Closed At"
          value={record.closed_at}
        />
      </Section>

      {record.status === "cancelled" ? (
        <Section title="14. Cancellation Evidence">
          <Field
            label="Cancel Reason"
            value={record.cancel_reason}
          />

          <Field
            label="Cancellation Justification"
            value={record.cancellation_justification}
          />

          <Field
            label="Cancelled By"
            value={record.cancelled_by}
          />

          <Field
            label="Cancelled At"
            value={record.cancelled_at}
          />
        </Section>
      ) : null}

      <footer className="print-footer">
        CAPA Controlled Record |{" "}
        {record.capa_number || record.id}
      </footer>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none;
          }

          .print-footer {
            position: fixed;
            bottom: 0;
            width: 100%;
            font-size: 10px;
          }

          table {
            page-break-inside: avoid;
          }

          section {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: any;
}) {
  return (
    <section style={sectionStyle}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: any;
}) {
  return (
    <p>
      <strong>{label}:</strong>{" "}
      {displayValue(value)}
    </p>
  );
}

function displayValue(v: any) {
  return v === null ||
    v === undefined ||
    v === ""
    ? "N/A"
    : String(v);
}

const pageStyle = {
  padding: "36px",
  fontFamily: "Arial, sans-serif",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "20px",
};

const sectionStyle = {
  border: "1px solid #ccc",
  padding: "14px",
  marginTop: "14px",
  borderRadius: "8px",
};

const buttonStyle = {
  padding: "8px 12px",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

const thStyle = {
  border: "1px solid #ccc",
  padding: "8px",
  background: "#f3f4f6",
  textAlign: "left" as const,
};

const tdStyle = {
  border: "1px solid #ccc",
  padding: "8px",
};
