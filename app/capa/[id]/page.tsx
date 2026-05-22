“use client”;
import Link from “next/link”; import { useEffect, useMemo, useState } from “react”; import { useParams } from “next/navigation”; import { supabase } from “../../../lib/supabaseClient”;
export default function EnterpriseCapaWorkflow() { const params = useParams<{ id: string }>(); const id = params.id;
const [record, setRecord] = useState(null); const [loading, setLoading] = useState(true);
const [userEmail, setUserEmail] = useState(““); const [userRole, setUserRole] = useState(”“);
const [activeSection, setActiveSection] = useState(“intake”);
// ========================= // EXECUTIVE WORKFLOW STATE // =========================
const isLocked = record?.status === “closed” || record?.is_locked === true;
const investigationApproved = record?.investigation_approval_status === “approved”;
const closureApproved = record?.closure_approval_status === “approved”;
const implementationLocked = !investigationApproved || isLocked;
// ========================= // FETCH USER ROLE // =========================
const fetchUserRole = async () => { const { data: userData } = await supabase.auth.getUser();
const email = userData?.user?.email || "";

setUserEmail(email);

if (!email) return;

const { data } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_email", email)
  .maybeSingle();

setUserRole(data?.role || "");
};
// ========================= // FETCH RECORD // =========================
const fetchRecord = async () => { setLoading(true);
const { data, error } = await supabase
  .from("capas")
  .select("*")
  .eq("id", id)
  .maybeSingle();

if (error) {
  alert(error.message);
  setLoading(false);
  return;
}

setRecord(data || null);
setLoading(false);
};
useEffect(() => { if (id) { fetchUserRole(); fetchRecord(); } }, [id]);
// ========================= // SAVE FIELD // =========================
const saveField = async ( field: string, value: any ) => { if (isLocked) { alert(“This CAPA record is locked.”); return; }
const { error } = await supabase
  .from("capas")
  .update({
    [field]: value,
  })
  .eq("id", id);

if (error) {
  alert(error.message);
  return;
}

setRecord((prev: any) => ({
  ...prev,
  [field]: value,
}));
};
// ========================= // APPROVALS // =========================
const submitInvestigationApproval = async () => { if (isLocked) return;
const now = new Date().toISOString();

const { error } = await supabase
  .from("capas")
  .update({
    investigation_approval_status:
      "pending",
    investigation_submitted_by:
      userEmail,
    investigation_submitted_at:
      now,
    status:
      "pending_investigation_approval",
  })
  .eq("id", id);

if (error) {
  alert(error.message);
  return;
}

fetchRecord();
};
const approveInvestigation = async () => { if ( userRole !== “approver” && userRole !== “vp_quality” ) { alert( “Only approvers can approve investigation.” ); return; }
const now = new Date().toISOString();

const { error } = await supabase
  .from("capas")
  .update({
    investigation_approval_status:
      "approved",
    investigation_approved_by:
      userEmail,
    investigation_approved_at:
      now,
    status: "implementation",
  })
  .eq("id", id);

if (error) {
  alert(error.message);
  return;
}

fetchRecord();
};
const submitClosureApproval = async () => { if (isLocked) return;
const now = new Date().toISOString();

const { error } = await supabase
  .from("capas")
  .update({
    closure_approval_status:
      "pending",
    closure_submitted_by:
      userEmail,
    closure_submitted_at:
      now,
    status:
      "pending_closure_approval",
  })
  .eq("id", id);

if (error) {
  alert(error.message);
  return;
}

fetchRecord();
};
const approveClosure = async () => { if ( userRole !== “approver” && userRole !== “vp_quality” ) { alert( “Only approvers can approve closure.” ); return; }
const confirmed = window.confirm(
  "Approve and electronically sign CAPA closure?"
);

if (!confirmed) return;

const now = new Date().toISOString();

const signatureMeaning =
  "I approve final CAPA closure and confirm all workflow phases are complete.";

const { error } = await supabase
  .from("capas")
  .update({
    closure_approval_status:
      "approved",
    closure_approved_by:
      userEmail,
    closure_approved_at:
      now,
    approved_by: userEmail,
    approved_at: now,
    signed_by: userEmail,
    signed_at: now,
    signature_meaning:
      signatureMeaning,
    closed_at: now,
    status: "closed",
    is_locked: true,
    locked_at: now,
    locked_by: userEmail,
  })
  .eq("id", id);

if (error) {
  alert(error.message);
  return;
}

fetchRecord();
};
// ========================= // WORKFLOW STAGES // =========================
const workflowStages = useMemo( () => [ { key: “intake”, label: “Intake”, completed: !!record?.problem_description, }, { key: “investigation”, label: “Investigation”, completed: !!record?.investigation_summary, }, { key: “rootcause”, label: “Root Cause”, completed: !!record?.root_cause, }, { key: “investigationapproval”, label: “Investigation Approval”, completed: investigationApproved, }, { key: “containment”, label: “Containment”, completed: !!record?.containment_correction, locked: implementationLocked, }, { key: “correctiveaction”, label: “Corrective Action”, completed: !!record?.corrective_action_plan, locked: implementationLocked, }, { key: “implementation”, label: “Implementation”, completed: !!record?.implementation_details, locked: implementationLocked, }, { key: “effectiveness”, label: “Effectiveness”, completed: !!record?.effectiveness_rating, locked: implementationLocked, }, { key: “closureapproval”, label: “Closure Approval”, completed: closureApproved, }, ], [ record, investigationApproved, closureApproved, implementationLocked, ] );
if (loading) { return (
Loading CAPA workflow…
);
}
if (!record) { return (
CAPA not found.
);
}
return (
{/* ========================= /} {/ EXECUTIVE HEADER /} {/ ========================= */}
      <div style={eyebrowStyle}>
        ENTERPRISE CAPA EXECUTION
        WORKSPACE
      </div>

      <h1 style={{ marginBottom: 6 }}>
        {record.capa_number ||
          "CAPA-PENDING"}
      </h1>

      <p style={subtleText}>
        Guided corrective and
        preventive action workflow.
      </p>
    </div>

    <div style={headerButtonRowStyle}>
      <button
        onClick={() =>
          window.print()
        }
        style={secondaryButtonStyle}
      >
        Print Workflow
      </button>

      <Link
        href="/capa"
        style={darkButtonStyle}
      >
        Back
      </Link>
    </div>
  </section>

  {/* ========================= */}
  {/* EXECUTIVE SUMMARY */}
  {/* ========================= */}

  <section style={summaryGridStyle}>
    <SummaryCard
      label="Status"
      value={record.status}
    />

    <SummaryCard
      label="Owner"
      value={record.owner}
    />

    <SummaryCard
      label="Due Date"
      value={record.due_date}
    />

    <SummaryCard
      label="Supplier"
      value={
        record.supplier_name
      }
    />

    <SummaryCard
      label="Linked NCMR"
      value={
        record.linked_ncmr_title
      }
    />

    <SummaryCard
      label="Effectiveness"
      value={
        record.effectiveness_rating
      }
    />
  </section>

  {isLocked ? (
    <section
      style={lockedBannerStyle}
    >
      🔒 CAPA RECORD LOCKED
    </section>
  ) : null}

  {/* ========================= */}
  {/* WORKSPACE GRID */}
  {/* ========================= */}

  <div style={workspaceStyle}>
    {/* ========================= */}
    {/* LEFT WORKFLOW RAIL */}
    {/* ========================= */}

    <aside style={railStyle}>
      <h3>
        Workflow Progress
      </h3>

      {workflowStages.map(
        (stage: any) => (
          <button
            key={stage.key}
            onClick={() =>
              setActiveSection(
                stage.key
              )
            }
            style={{
              ...railItemStyle,
              borderLeft: `6px solid ${
                stage.completed
                  ? "#15803d"
                  : stage.locked
                  ? "#9ca3af"
                  : "#d97706"
              }`,
            }}
          >
            <div>
              {stage.completed
                ? "✓"
                : stage.locked
                ? "🔒"
                : "•"}{" "}
              {stage.label}
            </div>
          </button>
        )
      )}
    </aside>

    {/* ========================= */}
    {/* CENTER WORKFLOW */}
    {/* ========================= */}

    <div>
      {/* ========================= */}
      {/* INTAKE */}
      {/* ========================= */}

      <WorkflowCard
        title="1. Intake"
        subtitle="Define issue scope and impact."
      >
        <FormGrid>
          <Field
            label="Issue Summary"
          >
            <textarea
              value={
                record.problem_description ||
                ""
              }
              disabled={isLocked}
              onChange={(e) =>
                saveField(
                  "problem_description",
                  e.target.value
                )
              }
              style={textareaStyle(
                isLocked
              )}
            />
          </Field>

          <Field
            label="Detection Source"
          >
            <input
              value={
                record.detection_source ||
                ""
              }
              disabled={isLocked}
              onChange={(e) =>
                saveField(
                  "detection_source",
                  e.target.value
                )
              }
              style={inputStyle(
                isLocked
              )}
            />
          </Field>
        </FormGrid>
      </WorkflowCard>

      {/* ========================= */}
      {/* INVESTIGATION */}
      {/* ========================= */}

      <WorkflowCard
        title="2. Investigation"
        subtitle="Document evidence and findings."
      >
        <FormGrid>
          <Field
            label="Investigation Objective"
          >
            <textarea
              value={
                record.investigation_objective ||
                ""
              }
              disabled={isLocked}
              onChange={(e) =>
                saveField(
                  "investigation_objective",
                  e.target.value
                )
              }
              style={textareaStyle(
                isLocked
              )}
            />
          </Field>

          <Field
            label="Evidence Reviewed"
          >
            <textarea
              value={
                record.evidence_reviewed ||
                ""
              }
              disabled={isLocked}
              onChange={(e) =>
                saveField(
                  "evidence_reviewed",
                  e.target.value
                )
              }
              style={textareaStyle(
                isLocked
              )}
            />
          </Field>

          <Field
            label="Findings"
          >
            <textarea
              value={
                record.investigation_findings ||
                ""
              }
              disabled={isLocked}
              onChange={(e) =>
                saveField(
                  "investigation_findings",
                  e.target.value
                )
              }
              style={textareaStyle(
                isLocked
              )}
            />
          </Field>
        </FormGrid>
      </WorkflowCard>

      {/* ========================= */}
      {/* ROOT CAUSE */}
      {/* ========================= */}

      <WorkflowCard
        title="3. Root Cause"
        subtitle="Document root cause logic and verification."
      >
        <FormGrid>
          <Field
            label="Root Cause Method"
          >
            <select
              value={
                record.root_cause_method ||
                ""
              }
              disabled={isLocked}
              onChange={(e) =>
                saveField(
                  "root_cause_method",
                  e.target.value
                )
              }
              style={inputStyle(
                isLocked
              )}
            >
              <option value="">
                Select
              </option>

              <option value="5why">
                5 Why
              </option>

              <option value="fishbone">
                Fishbone
              </option>

              <option value="faulttree">
                Fault Tree
              </option>
            </select>
          </Field>

          <Field
            label="Primary Root Cause"
          >
            <textarea
              value={
                record.root_cause ||
                ""
              }
              disabled={isLocked}
              onChange={(e) =>
                saveField(
                  "root_cause",
                  e.target.value
                )
              }
              style={textareaStyle(
                isLocked
              )}
            />
          </Field>
        </FormGrid>
      </WorkflowCard>

      {/* ========================= */}
      {/* INVESTIGATION APPROVAL */}
      {/* ========================= */}

      <ApprovalCard
        title="Gate 1 — Investigation Approval"
        status={
          record.investigation_approval_status
        }
      >
        <div style={buttonRowStyle}>
          <button
            onClick={
              submitInvestigationApproval
            }
            disabled={isLocked}
            style={buttonStyle(
              isLocked
            )}
          >
            Submit
          </button>

          {record.investigation_approval_status ===
          "pending" ? (
            <button
              onClick={
                approveInvestigation
              }
              style={primaryButtonStyle}
            >
              Approve
            </button>
          ) : null}
        </div>
      </ApprovalCard>

      {/* ========================= */}
      {/* CONTAINMENT */}
      {/* ========================= */}

      <WorkflowCard
        title="4. Containment"
        subtitle="Immediate correction and containment activities."
        locked={implementationLocked}
      >
        <Field
          label="Containment Action"
        >
          <textarea
            value={
              record.containment_correction ||
              ""
            }
            disabled={
              implementationLocked
            }
            onChange={(e) =>
              saveField(
                "containment_correction",
                e.target.value
              )
            }
            style={textareaStyle(
              implementationLocked
            )}
          />
        </Field>
      </WorkflowCard>

      {/* ========================= */}
      {/* CORRECTIVE ACTION */}
      {/* ========================= */}

      <WorkflowCard
        title="5. Corrective Action"
        subtitle="Actions to eliminate or reduce root cause."
        locked={implementationLocked}
      >
        <FormGrid>
          <Field
            label="Corrective Action"
          >
            <textarea
              value={
                record.corrective_action_plan ||
                ""
              }
              disabled={
                implementationLocked
              }
              onChange={(e) =>
                saveField(
                  "corrective_action_plan",
                  e.target.value
                )
              }
              style={textareaStyle(
                implementationLocked
              )}
            />
          </Field>

          <Field
            label="Verification Method"
          >
            <textarea
              value={
                record.verification_method ||
                ""
              }
              disabled={
                implementationLocked
              }
              onChange={(e) =>
                saveField(
                  "verification_method",
                  e.target.value
                )
              }
              style={textareaStyle(
                implementationLocked
              )}
            />
          </Field>
        </FormGrid>
      </WorkflowCard>

      {/* ========================= */}
      {/* IMPLEMENTATION */}
      {/* ========================= */}

      <WorkflowCard
        title="6. Implementation"
        subtitle="Implementation evidence and validation."
        locked={implementationLocked}
      >
        <FormGrid>
          <Field
            label="Procedure Updated"
          >
            <select
              value={
                record.procedure_updated ||
                ""
              }
              disabled={
                implementationLocked
              }
              onChange={(e) =>
                saveField(
                  "procedure_updated",
                  e.target.value
                )
              }
              style={inputStyle(
                implementationLocked
              )}
            >
              <option value="">
                Select
              </option>

              <option value="yes">
                Yes
              </option>

              <option value="no">
                No
              </option>
            </select>
          </Field>

          <Field
            label="Implementation Evidence"
          >
            <textarea
              value={
                record.implementation_details ||
                ""
              }
              disabled={
                implementationLocked
              }
              onChange={(e) =>
                saveField(
                  "implementation_details",
                  e.target.value
                )
              }
              style={textareaStyle(
                implementationLocked
              )}
            />
          </Field>
        </FormGrid>
      </WorkflowCard>

      {/* ========================= */}
      {/* EFFECTIVENESS */}
      {/* ========================= */}

      <WorkflowCard
        title="7. Effectiveness"
        subtitle="Effectiveness monitoring and verification."
        locked={implementationLocked}
      >
        <FormGrid>
          <Field
            label="Monitoring Method"
          >
            <textarea
              value={
                record.effectiveness_plan ||
                ""
              }
              disabled={
                implementationLocked
              }
              onChange={(e) =>
                saveField(
                  "effectiveness_plan",
                  e.target.value
                )
              }
              style={textareaStyle(
                implementationLocked
              )}
            />
          </Field>

          <Field
            label="Results"
          >
            <textarea
              value={
                record.effectiveness_check ||
                ""
              }
              disabled={
                implementationLocked
              }
              onChange={(e) =>
                saveField(
                  "effectiveness_check",
                  e.target.value
                )
              }
              style={textareaStyle(
                implementationLocked
              )}
            />
          </Field>

          <Field
            label="Effectiveness Rating"
          >
            <select
              value={
                record.effectiveness_rating ||
                ""
              }
              disabled={
                implementationLocked
              }
              onChange={(e) =>
                saveField(
                  "effectiveness_rating",
                  e.target.value
                )
              }
              style={inputStyle(
                implementationLocked
              )}
            >
              <option value="">
                Select
              </option>

              <option value="effective">
                Effective
              </option>

              <option value="partially_effective">
                Partially Effective
              </option>

              <option value="not_effective">
                Not Effective
              </option>
            </select>
          </Field>
        </FormGrid>
      </WorkflowCard>

      {/* ========================= */}
      {/* CLOSURE APPROVAL */}
      {/* ========================= */}

      <ApprovalCard
        title="Gate 2 — Closure Approval"
        status={
          record.closure_approval_status
        }
      >
        <div style={buttonRowStyle}>
          <button
            onClick={
              submitClosureApproval
            }
            disabled={isLocked}
            style={buttonStyle(
              isLocked
            )}
          >
            Submit Closure
          </button>

          {record.closure_approval_status ===
          "pending" ? (
            <button
              onClick={approveClosure}
              style={primaryButtonStyle}
            >
              Approve & Lock
            </button>
          ) : null}
        </div>
      </ApprovalCard>
    </div>

    {/* ========================= */}
    {/* RIGHT SIDEBAR */}
    {/* ========================= */}

    <aside style={sidebarStyle}>
      <SidebarCard title="Governance Intelligence">
        <SidebarItem
          label="Risk"
          value={
            record.severity ||
            "Medium"
          }
        />

        <SidebarItem
          label="Recurrence"
          value={
            record.recurrence_count ||
            0
          }
        />

        <SidebarItem
          label="Supplier Risk"
          value={
            record.supplier_risk ||
            "N/A"
          }
        />
      </SidebarCard>

      <SidebarCard title="Approval Status">
        <SidebarItem
          label="Investigation"
          value={
            record.investigation_approval_status ||
            "Not Submitted"
          }
        />

        <SidebarItem
          label="Closure"
          value={
            record.closure_approval_status ||
            "Not Submitted"
          }
        />
      </SidebarCard>
    </aside>
  </div>
</main>
); }
// ========================= // COMPONENTS // =========================
function WorkflowCard({ title, subtitle, children, locked, }: any) { return ( <section style={{ …workflowCardStyle, opacity: locked ? 0.75 : 1, borderLeft: 8px solid ${           locked             ? "#9ca3af"             : "#2563eb"         }, }} >
{title}
  <p style={subtleText}>
    {subtitle}
  </p>

  {locked ? (
    <div style={lockedNoticeStyle}>
      This phase is locked until
      investigation approval is
      complete.
    </div>
  ) : null}

  {children}
</section>
); }
function ApprovalCard({ title, status, children, }: any) { return ( <section style={{ …workflowCardStyle, borderLeft: “8px solid #15803d”, }} >
{title}
  <div style={{ marginBottom: 16 }}>
    <strong>Status:</strong>{" "}
    {status || "Not Submitted"}
  </div>

  {children}
</section>
); }
function SummaryCard({ label, value, }: any) { return (
  <div style={summaryLabelStyle}>
    {label}
  </div>

  <div style={summaryValueStyle}>
    {value || "N/A"}
  </div>
</div>
); }
function SidebarCard({ title, children, }: any) { return (
  <h3>{title}</h3>
  {children}
</div>
); }
function SidebarItem({ label, value, }: any) { return (
  <strong>{label}</strong>
  <div>{value}</div>
</div>
); }
function Field({ label, children, }: any) { return ( <div style={{ marginBottom: 18 }}>  {label} 
  <div style={{ marginTop: 6 }}>
    {children}
  </div>
</div>
); }
function FormGrid({ children }: any) { return (
  {children}
</div>
); }
// ========================= // STYLES // =========================
const pageStyle: React.CSSProperties = { padding: “24px”, background: “#f8fafc”, minHeight: “100vh”, fontFamily: “Arial, sans-serif”, };
const workspaceStyle: React.CSSProperties = { display: “grid”, gridTemplateColumns: “260px minmax(0, 1fr) 280px”, gap: “20px”, alignItems: “start”, };
const railStyle: React.CSSProperties = { position: “sticky”, top: “16px”, };
const railItemStyle: React.CSSProperties = { width: “100%”, textAlign: “left”, padding: “12px”, marginBottom: “10px”, border: “1px solid #d1d5db”, borderRadius: “12px”, background: “white”, cursor: “pointer”, };
const sidebarStyle: React.CSSProperties = { position: “sticky”, top: “16px”, };
const sidebarCardStyle: React.CSSProperties = { border: “1px solid #d1d5db”, borderRadius: “14px”, background: “white”, padding: “16px”, marginBottom: “16px”, };
const sidebarItemStyle: React.CSSProperties = { marginBottom: “12px”, };
const headerCardStyle: React.CSSProperties = { border: “1px solid #d1d5db”, borderRadius: “16px”, background: “white”, padding: “22px”, display: “flex”, justifyContent: “space-between”, alignItems: “center”, gap: “12px”, flexWrap: “wrap”, marginBottom: “20px”, };
const workflowCardStyle: React.CSSProperties = { border: “1px solid #d1d5db”, borderRadius: “16px”, background: “white”, padding: “22px”, marginBottom: “20px”, };
const summaryGridStyle: React.CSSProperties = { display: “grid”, gridTemplateColumns: “repeat(auto-fit, minmax(180px, 1fr))”, gap: “14px”, marginBottom: “20px”, };
const summaryCardStyle: React.CSSProperties = { border: “1px solid #d1d5db”, borderRadius: “12px”, background: “white”, padding: “16px”, };
const summaryLabelStyle: React.CSSProperties = { fontSize: “12px”, fontWeight: 700, color: “#6b7280”, marginBottom: “6px”, };
const summaryValueStyle: React.CSSProperties = { fontWeight: 700, };
const formGridStyle: React.CSSProperties = { display: “grid”, gridTemplateColumns: “repeat(auto-fit, minmax(320px, 1fr))”, gap: “18px”, };
const textareaStyle = ( locked: boolean ): React.CSSProperties => ({ width: “100%”, minHeight: “120px”, padding: “12px”, borderRadius: “10px”, border: “1px solid #d1d5db”, background: locked ? “#f3f4f6” : “white”, });
const inputStyle = ( locked: boolean ): React.CSSProperties => ({ width: “100%”, padding: “10px”, borderRadius: “10px”, border: “1px solid #d1d5db”, background: locked ? “#f3f4f6” : “white”, });
const fieldLabelStyle: React.CSSProperties = { fontWeight: 700, };
const eyebrowStyle: React.CSSProperties = { fontSize: “12px”, letterSpacing: “0.08em”, color: “#6b7280”, fontWeight: 800, };
const subtleText: React.CSSProperties = { color: “#6b7280”, };
const loadingStyle: React.CSSProperties = { padding: “24px”, fontFamily: “Arial”, };
const buttonRowStyle: React.CSSProperties = { display: “flex”, gap: “10px”, flexWrap: “wrap”, };
const headerButtonRowStyle: React.CSSProperties = { display: “flex”, gap: “10px”, flexWrap: “wrap”, };
const primaryButtonStyle: React.CSSProperties = { background: “#2563eb”, color: “white”, border: “none”, borderRadius: “8px”, padding: “10px 14px”, cursor: “pointer”, fontWeight: 700, };
const secondaryButtonStyle: React.CSSProperties = { background: “#15803d”, color: “white”, border: “none”, borderRadius: “8px”, padding: “10px 14px”, cursor: “pointer”, fontWeight: 700, };
const darkButtonStyle: React.CSSProperties = { background: “#111827”, color: “white”, borderRadius: “8px”, padding: “10px 14px”, textDecoration: “none”, fontWeight: 700, };
const buttonStyle = ( disabled: boolean ): React.CSSProperties => ({ background: disabled ? “#9ca3af” : “#2563eb”, color: “white”, border: “none”, borderRadius: “8px”, padding: “10px 14px”, cursor: disabled ? “not-allowed” : “pointer”, fontWeight: 700, });
const lockedBannerStyle: React.CSSProperties = { background: “#111827”, color: “white”, padding: “14px”, borderRadius: “12px”, fontWeight: 700, marginBottom: “20px”, };
const lockedNoticeStyle: React.CSSProperties = { padding: “10px”, background: “#fefce8”, border: “1px solid #facc15”, borderRadius: “10px”, marginBottom: “14px”, color: “#92400e”, fontWeight: 700, };
