"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Complaint = {
  id: string;
  complaint_number: string | null;
  complaint_title: string;
  complaint_description: string | null;
  date_received: string | null;
  source: string | null;
  customer_name: string | null;
  customer_organization: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  country: string | null;
  product_family: string | null;
  product_name: string | null;
  part_number: string | null;
  lot_number: string | null;
  serial_number: string | null;
  returned_product_available: boolean | null;
  severity: string | null;
  potential_patient_impact: boolean | null;
  potential_safety_issue: boolean | null;
  status: string | null;
  investigator: string | null;
  investigation_summary: string | null;
  complaint_confirmed: boolean | null;
  root_cause_category: string | null;
  root_cause_summary: string | null;
  mdr_assessment_required: boolean | null;
  regulatory_assessment: string | null;
  regulatory_assessment_rationale: string | null;
  complaint_valid: boolean | null;
  ncmr_required: boolean | null;
  capa_required: boolean | null;
  scar_required: boolean | null;
  change_control_required: boolean | null;
  customer_response_required: boolean | null;
  customer_response_sent: boolean | null;
  customer_response_date: string | null;
  closure_summary: string | null;
  closed_by: string | null;
  closed_at: string | null;
};

const workflowSteps = [
  "intake",
  "investigation",
  "risk_assessment",
  "reportability_assessment",
  "disposition",
  "closure",
  "closed",
];

export default function ComplaintDetailPage() {
  const params = useParams();
  const complaintId = String(params?.id || "");
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [investigator, setInvestigator] = useState("");
  const [investigationSummary, setInvestigationSummary] = useState("");
  const [complaintConfirmed, setComplaintConfirmed] = useState("");
  const [rootCauseCategory, setRootCauseCategory] = useState("");
  const [rootCauseSummary, setRootCauseSummary] = useState("");

  const [severity, setSeverity] = useState("minor");
  const [potentialPatientImpact, setPotentialPatientImpact] = useState(false);
  const [potentialSafetyIssue, setPotentialSafetyIssue] = useState(false);

  const [mdrAssessmentRequired, setMdrAssessmentRequired] = useState(false);
  const [regulatoryAssessment, setRegulatoryAssessment] = useState("pending");
  const [regulatoryRationale, setRegulatoryRationale] = useState("");

  const [complaintValid, setComplaintValid] = useState("");
  const [ncmrRequired, setNcmrRequired] = useState(false);
  const [capaRequired, setCapaRequired] = useState(false);
  const [scarRequired, setScarRequired] = useState(false);
  const [changeControlRequired, setChangeControlRequired] = useState(false);

  const [customerResponseRequired, setCustomerResponseRequired] = useState(false);
  const [customerResponseSent, setCustomerResponseSent] = useState(false);
  const [customerResponseDate, setCustomerResponseDate] = useState("");
  const [closureSummary, setClosureSummary] = useState("");

  const fetchComplaint = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .eq("id", complaintId)
      .maybeSingle();

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    if (!data) {
      setComplaint(null);
      return;
    }

    const record = data as Complaint;
    setComplaint(record);

    setInvestigator(record.investigator || "");
    setInvestigationSummary(record.investigation_summary || "");
    setComplaintConfirmed(record.complaint_confirmed === true ? "yes" : record.complaint_confirmed === false ? "no" : "");
    setRootCauseCategory(record.root_cause_category || "");
    setRootCauseSummary(record.root_cause_summary || "");

    setSeverity(record.severity || "minor");
    setPotentialPatientImpact(Boolean(record.potential_patient_impact));
    setPotentialSafetyIssue(Boolean(record.potential_safety_issue));

    setMdrAssessmentRequired(Boolean(record.mdr_assessment_required));
    setRegulatoryAssessment(record.regulatory_assessment || "pending");
    setRegulatoryRationale(record.regulatory_assessment_rationale || "");

    setComplaintValid(record.complaint_valid === true ? "yes" : record.complaint_valid === false ? "no" : "");
    setNcmrRequired(Boolean(record.ncmr_required));
    setCapaRequired(Boolean(record.capa_required));
    setScarRequired(Boolean(record.scar_required));
    setChangeControlRequired(Boolean(record.change_control_required));

    setCustomerResponseRequired(Boolean(record.customer_response_required));
    setCustomerResponseSent(Boolean(record.customer_response_sent));
    setCustomerResponseDate(record.customer_response_date || "");
    setClosureSummary(record.closure_summary || "");

    fetchActivityLog(record.id);
  };

  const fetchActivityLog = async (complaintId: string) => {
    const { data, error } = await supabase
      .from("complaint_activity_log")
      .select("*")
      .eq("complaint_id", complaintId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn(error.message);
      return;
    }

    setActivityLog(data || []);
  };

  useEffect(() => {
    if (complaintId) {
      fetchComplaint();
    }
  }, [complaintId]);

  const addActivityLog = async (action: string, details: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    await supabase.from("complaint_activity_log").insert({
      complaint_id: complaintId,
      action,
      details,
      user_email: userEmail,
    });
  };

  const updateComplaint = async (payload: any, action: string, details: string) => {
    setSaving(true);

    const { error } = await supabase
      .from("complaints")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", complaintId);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    await addActivityLog(action, details);
    await fetchComplaint();
  };

  const saveInvestigation = async () => {
    await updateComplaint(
      {
        status: "investigation",
        investigator: investigator || null,
        investigation_summary: investigationSummary || null,
        complaint_confirmed: complaintConfirmed === "yes" ? true : complaintConfirmed === "no" ? false : null,
        root_cause_category: rootCauseCategory || null,
        root_cause_summary: rootCauseSummary || null,
      },
      "investigation_saved",
      "Complaint investigation information saved.",
    );
  };

  const saveRiskAssessment = async () => {
    await updateComplaint(
      {
        status: "risk_assessment",
        severity,
        potential_patient_impact: potentialPatientImpact,
        potential_safety_issue: potentialSafetyIssue,
      },
      "risk_assessment_saved",
      "Complaint risk assessment saved.",
    );
  };

  const saveReportability = async () => {
    await updateComplaint(
      {
        status: "reportability_assessment",
        mdr_assessment_required: mdrAssessmentRequired,
        regulatory_assessment: regulatoryAssessment,
        regulatory_assessment_rationale: regulatoryRationale || null,
      },
      "reportability_assessment_saved",
      "Complaint reportability assessment saved.",
    );
  };

  const saveDisposition = async () => {
    await updateComplaint(
      {
        status: "disposition",
        complaint_valid: complaintValid === "yes" ? true : complaintValid === "no" ? false : null,
        ncmr_required: ncmrRequired,
        capa_required: capaRequired,
        scar_required: scarRequired,
        change_control_required: changeControlRequired,
      },
      "disposition_saved",
      "Complaint disposition and linked action requirements saved.",
    );
  };

  const moveToClosure = async () => {
    await updateComplaint(
      { status: "closure" },
      "closure_review_started",
      "Complaint moved to closure review.",
    );
  };

  const closeComplaint = async () => {
    if (!closureSummary.trim()) {
      alert("Closure summary is required.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    await updateComplaint(
      {
        status: "closed",
        customer_response_required: customerResponseRequired,
        customer_response_sent: customerResponseSent,
        customer_response_date: customerResponseDate || null,
        closure_summary: closureSummary,
        closed_by: userEmail,
        closed_at: new Date().toISOString(),
      },
      "complaint_closed",
      "Complaint closed with closure summary.",
    );
  };

  if (loading) return <main style={pageStyle}>Loading complaint...</main>;

  if (!complaint) {
    return (
      <main style={pageStyle}>
        <h1>Complaint not found</h1>
        <Link href="/complaints">Back to Complaints</Link>
      </main>
    );
  }

  const currentStepIndex = workflowSteps.indexOf(complaint.status || "intake");

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>COMPLAINT WORKFLOW EXECUTION</div>
          <h1 style={{ margin: "6px 0" }}>{complaint.complaint_number} — {complaint.complaint_title}</h1>
          <p style={subtleText}>{complaint.complaint_description}</p>
        </div>

        <div style={buttonRowStyle}>
          <Link href="/complaints" style={secondaryLinkStyle}>Back to Complaints</Link>
          <Link href="/dashboard" style={darkLinkStyle}>Dashboard</Link>
        </div>
      </header>

      <section style={workflowCardStyle}>
        <h2 style={{ marginTop: 0 }}>Complaint Workflow Progress</h2>
        <p style={subtleText}>Real-time completion status for complaint intake, investigation, assessment, disposition, and closure.</p>

        <div style={workflowGridStyle}>
          {workflowSteps.map((step, index) => {
            const isComplete = index < currentStepIndex || complaint.status === "closed";
            const isCurrent = index === currentStepIndex && complaint.status !== "closed";

            return (
              <div key={step} style={{ ...workflowStepStyle, borderLeft: `6px solid ${isComplete ? "#15803d" : isCurrent ? "#2563eb" : "#6b7280"}` }}>
                <div style={{ fontSize: "22px" }}>{isComplete ? "✓" : isCurrent ? "●" : "○"}</div>
                <div>
                  <strong>{formatLabel(step)}</strong>
                  <div style={{ color: isComplete ? "#15803d" : isCurrent ? "#2563eb" : "#6b7280", fontWeight: 800 }}>
                    {isComplete ? "Complete" : isCurrent ? "In Progress" : "Not Started"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={summaryGridStyle}>
        <SummaryCard label="Status" value={formatLabel(complaint.status || "intake")} />
        <SummaryCard label="Severity" value={formatLabel(complaint.severity || "minor")} />
        <SummaryCard label="Patient Impact" value={complaint.potential_patient_impact ? "Yes" : "No"} />
        <SummaryCard label="Safety Issue" value={complaint.potential_safety_issue ? "Yes" : "No"} />
        <SummaryCard label="Regulatory Assessment" value={formatLabel(complaint.regulatory_assessment || "pending")} />
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>1. Intake Summary</h2>
        <div style={gridStyle}>
          <ReadOnly label="Date Received" value={complaint.date_received || "N/A"} />
          <ReadOnly label="Source" value={formatLabel(complaint.source || "N/A")} />
          <ReadOnly label="Customer" value={complaint.customer_name || "N/A"} />
          <ReadOnly label="Organization" value={complaint.customer_organization || "N/A"} />
          <ReadOnly label="Product" value={complaint.product_name || "N/A"} />
          <ReadOnly label="Part Number" value={complaint.part_number || "N/A"} />
          <ReadOnly label="Lot Number" value={complaint.lot_number || "N/A"} />
          <ReadOnly label="Serial Number" value={complaint.serial_number || "N/A"} />
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={{ margin: 0 }}>2. Investigation</h2>
          <button onClick={saveInvestigation} disabled={saving} style={saving ? disabledButtonStyle : primaryButtonStyle}>Save Investigation</button>
        </div>

        <div style={gridStyle}>
          <Field label="Investigator"><input value={investigator} onChange={(e) => setInvestigator(e.target.value)} style={inputStyle} /></Field>
          <Field label="Complaint Confirmed">
            <select value={complaintConfirmed} onChange={(e) => setComplaintConfirmed(e.target.value)} style={inputStyle}>
              <option value="">Select</option><option value="yes">Yes</option><option value="no">No</option>
            </select>
          </Field>
          <Field label="Root Cause Category">
            <select value={rootCauseCategory} onChange={(e) => setRootCauseCategory(e.target.value)} style={inputStyle}>
              <option value="">Select</option><option value="material">Material</option><option value="method">Method</option><option value="equipment">Equipment</option><option value="measurement">Measurement</option><option value="environment">Environment</option><option value="human">Human</option><option value="unknown">Unknown</option>
            </select>
          </Field>
        </div>

        <Field label="Investigation Summary"><textarea value={investigationSummary} onChange={(e) => setInvestigationSummary(e.target.value)} rows={4} style={textareaStyle} /></Field>
        <Field label="Root Cause Summary"><textarea value={rootCauseSummary} onChange={(e) => setRootCauseSummary(e.target.value)} rows={3} style={textareaStyle} /></Field>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={{ margin: 0 }}>3. Risk Assessment</h2>
          <button onClick={saveRiskAssessment} disabled={saving} style={saving ? disabledButtonStyle : primaryButtonStyle}>Save Risk Assessment</button>
        </div>

        <Field label="Severity">
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={inputStyle}>
            <option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option>
          </select>
        </Field>

        <div style={toggleRowStyle}>
          <label style={toggleLabelStyle}><input type="checkbox" checked={potentialPatientImpact} onChange={(e) => setPotentialPatientImpact(e.target.checked)} />Potential Patient Impact</label>
          <label style={toggleLabelStyle}><input type="checkbox" checked={potentialSafetyIssue} onChange={(e) => setPotentialSafetyIssue(e.target.checked)} />Potential Safety Issue</label>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={{ margin: 0 }}>4. Reportability Assessment</h2>
          <button onClick={saveReportability} disabled={saving} style={saving ? disabledButtonStyle : primaryButtonStyle}>Save Reportability</button>
        </div>

        <Field label="Regulatory Assessment">
          <select value={regulatoryAssessment} onChange={(e) => setRegulatoryAssessment(e.target.value)} style={inputStyle}>
            <option value="pending">Pending</option><option value="reportable">Reportable</option><option value="not_reportable">Not Reportable</option>
          </select>
        </Field>

        <label style={toggleLabelStyle}><input type="checkbox" checked={mdrAssessmentRequired} onChange={(e) => setMdrAssessmentRequired(e.target.checked)} />MDR / Regulatory Assessment Required</label>
        <Field label="Assessment Rationale"><textarea value={regulatoryRationale} onChange={(e) => setRegulatoryRationale(e.target.value)} rows={4} style={textareaStyle} /></Field>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={{ margin: 0 }}>5. Disposition & Linked Actions</h2>
          <button onClick={saveDisposition} disabled={saving} style={saving ? disabledButtonStyle : primaryButtonStyle}>Save Disposition</button>
        </div>

        <Field label="Complaint Valid">
          <select value={complaintValid} onChange={(e) => setComplaintValid(e.target.value)} style={inputStyle}>
            <option value="">Select</option><option value="yes">Yes</option><option value="no">No</option>
          </select>
        </Field>

        <div style={toggleRowStyle}>
          <label style={toggleLabelStyle}><input type="checkbox" checked={ncmrRequired} onChange={(e) => setNcmrRequired(e.target.checked)} />NCMR Required</label>
          <label style={toggleLabelStyle}><input type="checkbox" checked={capaRequired} onChange={(e) => setCapaRequired(e.target.checked)} />CAPA Required</label>
          <label style={toggleLabelStyle}><input type="checkbox" checked={scarRequired} onChange={(e) => setScarRequired(e.target.checked)} />SCAR Required</label>
          <label style={toggleLabelStyle}><input type="checkbox" checked={changeControlRequired} onChange={(e) => setChangeControlRequired(e.target.checked)} />Change Control Required</label>
        </div>

        <div style={infoBoxStyle}>Phase 1 captures linked action requirements. Phase 2 will add one-click creation/linking to NCMR, CAPA, SCAR, and Change Control records.</div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={{ margin: 0 }}>6. Closure</h2>
          <div style={buttonRowStyle}>
            <button onClick={moveToClosure} disabled={saving || complaint.status === "closed"} style={saving || complaint.status === "closed" ? disabledButtonStyle : secondaryButtonStyle}>Move to Closure</button>
            <button onClick={closeComplaint} disabled={saving || complaint.status === "closed"} style={saving || complaint.status === "closed" ? disabledButtonStyle : primaryButtonStyle}>{complaint.status === "closed" ? "Complaint Closed" : "Close Complaint"}</button>
          </div>
        </div>

        <div style={toggleRowStyle}>
          <label style={toggleLabelStyle}><input type="checkbox" checked={customerResponseRequired} onChange={(e) => setCustomerResponseRequired(e.target.checked)} />Customer Response Required</label>
          <label style={toggleLabelStyle}><input type="checkbox" checked={customerResponseSent} onChange={(e) => setCustomerResponseSent(e.target.checked)} />Customer Response Sent</label>
        </div>

        <Field label="Customer Response Date"><input type="date" value={customerResponseDate} onChange={(e) => setCustomerResponseDate(e.target.value)} style={inputStyle} /></Field>
        <Field label="Closure Summary"><textarea value={closureSummary} onChange={(e) => setClosureSummary(e.target.value)} rows={4} style={textareaStyle} /></Field>

        {complaint.closed_at ? <div style={infoBoxStyle}>Closed by {complaint.closed_by || "unknown"} on {new Date(complaint.closed_at).toLocaleString()}.</div> : null}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Activity Log</h2>
        {activityLog.length === 0 ? <div style={infoBoxStyle}>No activity has been recorded yet.</div> : (
          <ul>
            {activityLog.map((item) => (
              <li key={item.id} style={{ marginBottom: "10px" }}>
                <strong>{formatLabel(item.action)}</strong> — {item.details}
                <div style={smallTextStyle}>{item.user_email || "unknown"} | {new Date(item.created_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: "14px" }}><label style={labelStyle}>{label}</label><div style={{ marginTop: "6px" }}>{children}</div></div>;
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div style={readOnlyStyle}><div style={smallTextStyle}>{label}</div><strong>{value}</strong></div>;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div style={summaryCardStyle}><div style={smallTextStyle}>{label}</div><strong>{value}</strong></div>;
}

const formatLabel = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "18px" };
const workflowCardStyle: React.CSSProperties = { ...cardStyle };
const workflowGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" };
const workflowStepStyle: React.CSSProperties = { display: "flex", gap: "12px", alignItems: "center", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px" };
const summaryGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "18px" };
const summaryCardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "14px", padding: "14px" };
const readOnlyStyle: React.CSSProperties = { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "12px" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" };
const sectionHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "16px" };
const labelStyle: React.CSSProperties = { fontWeight: 700 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db" };
const textareaStyle: React.CSSProperties = { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", fontFamily: "Arial, sans-serif" };
const toggleRowStyle: React.CSSProperties = { display: "flex", gap: "24px", flexWrap: "wrap", marginTop: "16px", marginBottom: "16px" };
const toggleLabelStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "8px", fontWeight: 700 };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap" };
const primaryButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", border: "none", borderRadius: "8px", padding: "10px 14px", fontWeight: 700, cursor: "pointer" };
const disabledButtonStyle: React.CSSProperties = { background: "#9ca3af", color: "white", border: "none", borderRadius: "8px", padding: "10px 14px", fontWeight: 700, cursor: "not-allowed" };
const secondaryButtonStyle: React.CSSProperties = { background: "#15803d", color: "white", border: "none", borderRadius: "8px", padding: "10px 14px", fontWeight: 700, cursor: "pointer" };
const secondaryLinkStyle: React.CSSProperties = { background: "#15803d", color: "white", borderRadius: "8px", padding: "10px 14px", textDecoration: "none", fontWeight: 700 };
const darkLinkStyle: React.CSSProperties = { background: "#111827", color: "white", borderRadius: "8px", padding: "10px 14px", textDecoration: "none", fontWeight: 700 };
const infoBoxStyle: React.CSSProperties = { marginTop: "16px", background: "#eff6ff", color: "#1e3a8a", border: "1px solid #bfdbfe", borderRadius: "12px", padding: "14px" };
const smallTextStyle: React.CSSProperties = { color: "#6b7280", fontSize: "12px", marginTop: "4px" };
