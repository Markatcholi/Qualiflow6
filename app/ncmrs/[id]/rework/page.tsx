"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function NcmrReworkWorkPackagePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const id = params.id;
  const taskId = searchParams.get("taskId") || "";

  const [userEmail, setUserEmail] = useState("");
  const [record, setRecord] = useState<any>(null);
  const [task, setTask] = useState<any>(null);
  const [reworkItems, setReworkItems] = useState<any[]>([]);
  const [completionComment, setCompletionComment] = useState("");
  const [signatureEmail, setSignatureEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const normalizeEmail = (value: any) =>
    String(value || "").trim().toLowerCase();

  const normalizeDisposition = (value: any) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

  const isValidReworkTask = useMemo(() => {
    return (
      task?.entity_type === "ncmr" &&
      String(task?.entity_id || "") === String(id || "") &&
      String(task?.task_type || "").toLowerCase() === "rework_task"
    );
  }, [task, id]);

  const isAssignedUser = useMemo(() => {
    return (
      !!userEmail &&
      normalizeEmail(task?.assigned_to_email) === normalizeEmail(userEmail)
    );
  }, [task, userEmail]);

  const isPending = String(task?.status || "").toLowerCase() === "pending";

  const fetchPackage = async () => {
    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentEmail = normalizeEmail(authData?.user?.email);
      setUserEmail(currentEmail);

      if (!currentEmail) {
        throw new Error("You must be logged in to open this Rework task.");
      }

      if (!taskId) {
        throw new Error("The Rework task link is missing a taskId.");
      }

      const { data: taskData, error: taskError } = await supabase
        .from("approval_tasks")
        .select("*")
        .eq("id", taskId)
        .maybeSingle();

      if (taskError) throw new Error(taskError.message);
      if (!taskData) throw new Error("Rework task not found.");

      setTask(taskData);
      setCompletionComment(
        taskData.completion_comment || taskData.approver_comment || ""
      );

      const { data: recordData, error: recordError } = await supabase
        .from("ncmrs")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (recordError) throw new Error(recordError.message);
      if (!recordData) throw new Error("NCMR record not found.");

      setRecord(recordData);

      const { data: affectedData, error: affectedError } = await supabase
        .from("ncmr_affected_items")
        .select("*")
        .eq("ncmr_id", id)
        .order("created_at", { ascending: true });

      if (affectedError) throw new Error(affectedError.message);

      setReworkItems(
        (affectedData || []).filter(
          (item: any) =>
            normalizeDisposition(item?.product_disposition) === "rework"
        )
      );
    } catch (error: any) {
      alert(error?.message || "Unable to load Rework work package.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackage();
  }, [id, taskId]);

  const completeTask = async () => {
    if (!task || !record) return;

    if (!isValidReworkTask) {
      alert("This task does not belong to this NCMR Rework package.");
      return;
    }

    if (!isAssignedUser) {
      alert("Only the assigned Rework Owner can complete this task.");
      return;
    }

    if (!isPending) {
      alert("This Rework task has already been completed or is no longer active.");
      return;
    }

    if (!completionComment.trim()) {
      alert("Completion notes are required.");
      return;
    }

    if (!signatureEmail.trim()) {
      alert("Enter your email for electronic signature.");
      return;
    }

    if (normalizeEmail(signatureEmail) !== normalizeEmail(userEmail)) {
      alert("Electronic signature email does not match the logged-in user.");
      return;
    }

    const confirmed = window.confirm(
      "Electronic Signature\n\nI confirm that the assigned Rework has been completed as documented. My identity, timestamp, and completion notes will become part of the quality record."
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const now = new Date().toISOString();
      const signatureMeaning =
        "NCMR Rework Implementation: I confirm that the assigned Rework has been completed as documented.";

      const { data: updatedRows, error: taskError } = await supabase
        .from("approval_tasks")
        .update({
          status: "completed",
          completion_comment: completionComment.trim(),
          approver_comment: completionComment.trim(),
          signature_meaning: signatureMeaning,
          completed_by: userEmail,
          completed_at: now,
          signed_by: userEmail,
          signed_at: now,
        })
        .eq("id", task.id)
        .eq("entity_type", "ncmr")
        .eq("entity_id", id)
        .eq("task_type", "rework_task")
        .eq("assigned_to_email", normalizeEmail(userEmail))
        .eq("status", "pending")
        .select("*");

      if (taskError) throw new Error(taskError.message);

      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(
          "The Rework task was not completed. It may have already been completed, reassigned, or changed by another user."
        );
      }

      setTask(updatedRows[0]);

      await supabase.from("audit_logs").insert({
        entity_type: "ncmr",
        entity_id: id,
        action: "rework_task_completed",
        details: `Rework task completed by ${userEmail}. Completion notes: ${completionComment.trim()}`,
        user_email: userEmail,
      });

      const ownerEmail = normalizeEmail(record?.owner || record?.owner_email);
      if (ownerEmail && ownerEmail !== normalizeEmail(userEmail)) {
        await supabase.from("notifications").insert({
          user_email: ownerEmail,
          assigned_role: "NCMR Owner",
          notification_type: "ncmr_rework_completed",
          title: `Rework completed: ${record?.ncmr_number || "NCMR"}`,
          message:
            `${userEmail} completed the assigned Rework task. ` +
            "Open the NCMR to review Rework Verification & Final Disposition.",
          related_module: "ncmr",
          related_record_id: id,
          related_url: `/ncmrs/${id}`,
          severity: "info",
          read_status: false,
        });
      }

      alert(
        "Rework task completed. The NCMR owner can now document Rework Verification & Final Disposition."
      );

      window.location.href = "/workspace";
    } catch (error: any) {
      alert(error?.message || "Unable to complete Rework task.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main style={pageStyle}>Loading Rework work package...</main>;
  }

  if (!task || !record) {
    return (
      <main style={pageStyle}>
        <div style={errorPanelStyle}>Unable to load the Rework work package.</div>
        <Link href="/workspace">Return to My Workspace</Link>
      </main>
    );
  }

  if (!isValidReworkTask) {
    return (
      <main style={pageStyle}>
        <div style={errorPanelStyle}>
          This task is not a valid Rework task for this NCMR.
        </div>
        <Link href="/workspace">Return to My Workspace</Link>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={topBarStyle}>
        <div>
          <div style={eyebrowStyle}>NCMR REWORK WORK PACKAGE</div>
          <h1 style={{ margin: "5px 0" }}>Rework Implementation</h1>
          <p style={{ margin: 0, color: "#475569" }}>
            {record?.ncmr_number || "NCMR"} · Assigned Rework package
          </p>
        </div>

        <Link href="/workspace" style={workspaceLinkStyle}>
          Return to My Workspace
        </Link>
      </div>

      {!isAssignedUser ? (
        <div style={errorPanelStyle}>
          This task is assigned to <strong>{task.assigned_to_email}</strong>.
          You may review the package, but only the assigned Rework Owner can
          complete it.
        </div>
      ) : null}

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>1. NCMR Context</h2>

        <div style={gridStyle}>
          <ReadOnlyField label="NCMR Number" value={record.ncmr_number} />
          <ReadOnlyField label="Severity" value={record.severity} />
          <ReadOnlyField label="NCMR Owner" value={record.owner || record.owner_email} />
          <ReadOnlyField
            label="MRB Approved By"
            value={record.mrb_approved_by}
          />
        </div>

        <ReadOnlyField
          label="Issue Description"
          value={record.issue_description || record.problem_description}
          multiline
        />

        <ReadOnlyField
          label="Disposition Justification"
          value={record.disposition_justification}
          multiline
        />
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>2. Rework Material</h2>

        {reworkItems.length === 0 ? (
          <div style={warningPanelStyle}>
            No affected material rows with a Rework disposition were found.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {reworkItems.map((item: any, index: number) => (
              <div key={item.id || index} style={materialCardStyle}>
                <div style={{ fontWeight: 900, marginBottom: "10px" }}>
                  Rework Item {index + 1}
                </div>
                <div style={gridStyle}>
                  <ReadOnlyField label="Part Number" value={item.product_part_number} />
                  <ReadOnlyField label="Part Description" value={item.part_description} />
                  <ReadOnlyField label="Revision" value={item.part_revision} />
                  <ReadOnlyField label="Lot Number" value={item.lot_number} />
                  <ReadOnlyField label="Work Order" value={item.workorder_number} />
                  <ReadOnlyField label="Quantity Affected" value={item.quantity_affected} />
                  <ReadOnlyField label="Quantity Rejected" value={item.quantity_rejected} />
                  <ReadOnlyField label="Disposition" value={item.product_disposition} />
                </div>
                <ReadOnlyField
                  label="Disposition Justification"
                  value={item.disposition_justification}
                  multiline
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>3. Assigned Rework</h2>

        <div style={gridStyle}>
          <ReadOnlyField label="Assigned To" value={task.assigned_to_email} />
          <ReadOnlyField label="Assigned By" value={task.assigned_by_email} />
          <ReadOnlyField label="Due Date" value={task.due_date} />
          <ReadOnlyField label="Task Status" value={task.status} />
        </div>

        <ReadOnlyField
          label="Rework Instructions"
          value={task.task_instructions || task.comments}
          multiline
        />
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>4. Completion</h2>

        {isPending ? (
          <>
            <label style={labelStyle}>Completion Notes</label>
            <textarea
              value={completionComment}
              onChange={(event) => setCompletionComment(event.target.value)}
              rows={6}
              placeholder="Document the Rework performed, results, and any relevant evidence references."
              disabled={!isAssignedUser || submitting}
              style={textareaStyle}
            />

            <label style={labelStyle}>Electronic Signature Email</label>
            <input
              type="email"
              value={signatureEmail}
              onChange={(event) => setSignatureEmail(event.target.value)}
              placeholder={userEmail || "your.email@company.com"}
              disabled={!isAssignedUser || submitting}
              style={inputStyle}
            />

            <div style={signatureHelpStyle}>
              Completing this task records your identity, timestamp, completion
              notes, and electronic signature. Final Rework verification,
              accepted/rejected quantities, and final disposition remain the
              responsibility of the NCMR owner.
            </div>

            <button
              type="button"
              onClick={completeTask}
              disabled={!isAssignedUser || submitting}
              style={{
                ...completeButtonStyle,
                opacity: !isAssignedUser || submitting ? 0.55 : 1,
                cursor:
                  !isAssignedUser || submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Completing..." : "Complete Rework Task"}
            </button>
          </>
        ) : (
          <div style={completedPanelStyle}>
            <strong>Rework task completed</strong>
            <div style={{ marginTop: "8px" }}>
              <strong>Completed By:</strong>{" "}
              {task.completed_by || task.signed_by || "N/A"}
            </div>
            <div>
              <strong>Completed At:</strong>{" "}
              {formatDateTime(task.completed_at || task.signed_at)}
            </div>
            <div style={{ marginTop: "8px" }}>
              <strong>Completion Notes:</strong>{" "}
              {task.completion_comment || task.approver_comment || "N/A"}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function ReadOnlyField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: any;
  multiline?: boolean;
}) {
  const displayValue =
    value === null || value === undefined || value === "" ? "N/A" : String(value);

  return (
    <div style={fieldWrapStyle}>
      <div style={labelStyle}>{label}</div>
      <div
        style={{
          ...readOnlyValueStyle,
          whiteSpace: multiline ? "pre-wrap" : "normal",
          minHeight: multiline ? "72px" : undefined,
        }}
      >
        {displayValue}
      </div>
    </div>
  );
}

function formatDateTime(value: any) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "24px",
  fontFamily: "Arial, sans-serif",
  background: "#f8fafc",
  color: "#111827",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
  marginBottom: "18px",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#2563eb",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.12em",
};

const workspaceLinkStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "9px 12px",
  border: "1px solid #bfdbfe",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#1d4ed8",
  textDecoration: "none",
  fontWeight: 800,
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "18px",
  marginBottom: "16px",
  boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 14px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const materialCardStyle: React.CSSProperties = {
  border: "1px solid #dbeafe",
  background: "#f8fbff",
  borderRadius: "10px",
  padding: "14px",
};

const fieldWrapStyle: React.CSSProperties = {
  marginBottom: "12px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 800,
  marginBottom: "6px",
};

const readOnlyValueStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  background: "#f9fafb",
  padding: "10px",
  color: "#374151",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "900px",
  padding: "10px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  marginBottom: "14px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "520px",
  padding: "10px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  marginBottom: "12px",
};

const signatureHelpStyle: React.CSSProperties = {
  maxWidth: "900px",
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: "8px",
  padding: "10px",
  marginBottom: "14px",
  fontSize: "14px",
};

const completeButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: "9px",
  padding: "11px 16px",
  fontWeight: 900,
};

const completedPanelStyle: React.CSSProperties = {
  border: "1px solid #86efac",
  background: "#f0fdf4",
  color: "#166534",
  borderRadius: "10px",
  padding: "14px",
};

const warningPanelStyle: React.CSSProperties = {
  border: "1px solid #facc15",
  background: "#fefce8",
  color: "#854d0e",
  borderRadius: "10px",
  padding: "14px",
};

const errorPanelStyle: React.CSSProperties = {
  border: "1px solid #fca5a5",
  background: "#fef2f2",
  color: "#991b1b",
  borderRadius: "10px",
  padding: "14px",
  marginBottom: "16px",
};
