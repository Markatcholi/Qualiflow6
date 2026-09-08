from pathlib import Path
import re

BRANCH = "fix/management-review-report-approval-package-20260907"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# Management Review owner workflow
# -----------------------------------------------------------------------------
path = Path("app/management-review/page.tsx")
text = path.read_text()

text = replace_once(
    text,
    '  const [approverRole, setApproverRole] = useState("");\n',
    '  const [approverRole, setApproverRole] = useState("");\n  const [approverDueDate, setApproverDueDate] = useState("");\n',
    "approver due-date state",
)

text = replace_once(
    text,
    '  const selectedReviewLocked = selectedReview?.is_locked === true;\n',
    '  const selectedReviewLocked = selectedReview?.is_locked === true;\n  const selectedReviewApprovalStatus = String(selectedReview?.approval_status || "draft").trim().toLowerCase();\n  const selectedReviewPendingApproval = selectedReviewApprovalStatus === "pending_approval";\n  const selectedReviewRejected = selectedReviewApprovalStatus === "rejected";\n',
    "selected review approval state",
)

pattern = re.compile(
    r"  const addApprover = async \(\) => \{.*?\n  \};\n\n  const approveReviewApprover = async \(approver: any\) => \{",
    re.S,
)

new_block = r'''  const addApprover = async () => {
    if (!selectedReviewId) {
      alert("Select a management review record first.");
      return;
    }

    if (selectedReviewLocked || selectedReviewPendingApproval) {
      alert("Approvers cannot be changed while this Management Review is locked or pending approval.");
      return;
    }

    if (selectedReviewRejected) {
      alert("This submitted report was rejected. Generate a revised Management Review report snapshot before configuring a new approval cycle.");
      return;
    }

    if (!approverName.trim()) {
      alert("Approver name is required.");
      return;
    }

    if (!approverEmail.trim()) {
      alert("Approver email is required.");
      return;
    }

    if (!approverDueDate) {
      alert("Approver due date is required.");
      return;
    }

    const normalizedApproverEmail = approverEmail.trim().toLowerCase();
    const duplicateApprover = selectedApprovers.some(
      (item: any) =>
        String(item.approver_email || "").trim().toLowerCase() === normalizedApproverEmail &&
        String(item.approval_status || "configured").toLowerCase() !== "cancelled"
    );

    if (duplicateApprover) {
      alert("This user is already configured as an approver for the selected Management Review.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const configuredByEmail = String(userData?.user?.email || "").trim().toLowerCase();

    if (!configuredByEmail) {
      alert("An authenticated user is required to configure a Management Review approver.");
      return;
    }

    const { data: insertedApprover, error: approverError } = await supabase
      .from("management_review_approvers")
      .insert({
        management_review_id: selectedReviewId,
        approver_name: approverName.trim(),
        approver_email: normalizedApproverEmail,
        approver_role: approverRole || null,
        approver_due_date: approverDueDate,
        approval_status: "configured",
        signature_meaning: signatureMeaning || null,
      })
      .select()
      .single();

    if (approverError || !insertedApprover) {
      alert(approverError?.message || "Unable to configure Management Review approver.");
      return;
    }

    const { error: auditError } = await supabase.rpc("qualisphere_add_audit_log", {
      p_entity_type: "management_review",
      p_entity_id: selectedReviewId,
      p_action: "management_review_approver_configured",
      p_details: `Approver configured: ${normalizedApproverEmail} (${approverRole || "Management Review Approver"}), due ${approverDueDate}. No approval task was sent yet.`,
    });

    if (auditError) {
      console.warn("Management Review approver configuration audit failed:", auditError.message);
    }

    alert("Approver configured. No approval task has been sent yet. Use Submit for Approval when the report is ready.");
    setApproverName("");
    setApproverEmail("");
    setApproverRole("");
    setApproverDueDate("");
    fetchManagementReviews();
  };

  const submitManagementReviewForApproval = async () => {
    if (!selectedReviewId || !selectedReview) {
      alert("Select a Management Review report first.");
      return;
    }

    if (selectedReviewLocked) {
      alert("This Management Review is already locked.");
      return;
    }

    if (selectedReviewPendingApproval) {
      alert("This Management Review report is already pending approval.");
      return;
    }

    if (selectedReviewRejected) {
      alert("This report snapshot was rejected. Generate a revised Management Review report snapshot before starting a new approval cycle.");
      return;
    }

    if (!selectedReview.report_snapshot_json) {
      alert("A generated Management Review report snapshot is required before submission.");
      return;
    }

    if (selectedApprovers.length === 0) {
      alert("Add at least one approver before submitting the report for approval.");
      return;
    }

    const missingDueDate = selectedApprovers.find((item: any) => !item.approver_due_date);
    if (missingDueDate) {
      alert(`A due date is required for ${missingDueDate.approver_name || missingDueDate.approver_email}.`);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const submittedByEmail = String(userData?.user?.email || "").trim().toLowerCase();

    if (!submittedByEmail) {
      alert("An authenticated user is required to submit this Management Review for approval.");
      return;
    }

    const reviewNumber = selectedReview.review_number || "Management Review";

    const { data: existingTasks, error: existingTaskError } = await supabase
      .from("approval_tasks")
      .select("id, comments, status")
      .eq("entity_type", "management_review")
      .eq("entity_id", selectedReviewId)
      .eq("task_type", "management_review_approval");

    if (existingTaskError) {
      alert(existingTaskError.message);
      return;
    }

    const createdTaskIds: string[] = [];

    for (const approver of selectedApprovers) {
      const approverMarker = `management_review_approver_id=${approver.id}`;
      const duplicateTask = (existingTasks || []).some((task: any) =>
        String(task.comments || "").includes(approverMarker) &&
        !["cancelled", "canceled"].includes(String(task.status || "").toLowerCase())
      );

      if (duplicateTask) {
        alert(`An approval task already exists for ${approver.approver_email}. Submission stopped to prevent duplicates.`);
        return;
      }

      const { data: insertedTask, error: taskError } = await supabase
        .from("approval_tasks")
        .insert({
          entity_type: "management_review",
          entity_id: selectedReviewId,
          task_type: "management_review_approval",
          task_title: `${approver.approver_role || "Approver"} — ${reviewNumber} Management Review Report Approval`,
          required_function: approver.approver_role || "Management Review Approver",
          approver_job_title: approver.approver_role || null,
          assigned_to_email: String(approver.approver_email || "").trim().toLowerCase(),
          assigned_by_email: submittedByEmail,
          due_date: approver.approver_due_date,
          approver_due_date: approver.approver_due_date,
          status: "pending",
          required: true,
          comments: `${approverMarker}\n\nReview and approve only the generated read-only Management Review report snapshot for ${reviewNumber}. The underlying Management Review builder is not part of this approval package.`,
          assignment_attachments: [],
        })
        .select("id")
        .single();

      if (taskError || !insertedTask) {
        if (createdTaskIds.length > 0) {
          await supabase
            .from("approval_tasks")
            .update({ status: "cancelled" })
            .in("id", createdTaskIds)
            .eq("status", "pending");
        }
        alert(taskError?.message || `Unable to create approval task for ${approver.approver_email}.`);
        return;
      }

      createdTaskIds.push(insertedTask.id);

      const taskUrl = `/management-review/${selectedReviewId}/approval-review?taskId=${insertedTask.id}`;
      const { error: notificationError } = await supabase.from("notifications").insert({
        user_email: String(approver.approver_email || "").trim().toLowerCase(),
        assigned_role: approver.approver_role || "Management Review Approver",
        notification_type: "management_review_approval",
        title: `Management Review report approval assigned: ${reviewNumber}`,
        message: `You have been assigned approval of the read-only generated report for ${reviewNumber}.`,
        related_module: "management_review",
        related_record_id: selectedReviewId,
        related_url: taskUrl,
        severity: "info",
        read_status: false,
      });

      if (notificationError) {
        console.warn("Management Review approval notification failed:", notificationError.message);
      }
    }

    const approverIds = selectedApprovers.map((item: any) => item.id).filter(Boolean);
    if (approverIds.length > 0) {
      const { error: approverStatusError } = await supabase
        .from("management_review_approvers")
        .update({ approval_status: "pending" })
        .in("id", approverIds)
        .eq("management_review_id", selectedReviewId);

      if (approverStatusError) {
        await supabase
          .from("approval_tasks")
          .update({ status: "cancelled" })
          .in("id", createdTaskIds)
          .eq("status", "pending");
        alert(approverStatusError.message);
        return;
      }
    }

    const { error: reviewUpdateError } = await supabase
      .from("management_reviews")
      .update({
        approval_status: "pending_approval",
        status: "pending_approval",
      })
      .eq("id", selectedReviewId);

    if (reviewUpdateError) {
      await supabase
        .from("approval_tasks")
        .update({ status: "cancelled" })
        .in("id", createdTaskIds)
        .eq("status", "pending");
      alert(reviewUpdateError.message);
      return;
    }

    const { error: auditError } = await supabase.rpc("qualisphere_add_audit_log", {
      p_entity_type: "management_review",
      p_entity_id: selectedReviewId,
      p_action: "management_review_report_submitted_for_approval",
      p_details: `Generated Management Review report snapshot ${reviewNumber} submitted for approval to ${selectedApprovers.length} approver(s).`,
    });

    if (auditError) {
      console.warn("Management Review submission audit failed:", auditError.message);
    }

    alert("Management Review report submitted for approval. Approval tasks were sent to My Workspace.");
    fetchManagementReviews();
  };

  const approveReviewApprover = async (approver: any) => {'''

text, count = pattern.subn(new_block, text, count=1)
if count != 1:
    raise RuntimeError(f"addApprover block: expected 1 replacement, found {count}")

# Add due-date input directly after role/title.
role_input = '''                  <label>
                    <strong>Role / Title</strong>
                    <input
                      value={approverRole}
                      onChange={(e) => setApproverRole(e.target.value)}
                      placeholder="Example: VP Quality, Operations Leader"
                      style={inputStyle}
                    />
                  </label>
'''
role_with_due = role_input + '''
                  <label>
                    <strong>Due Date</strong>
                    <input
                      type="date"
                      value={approverDueDate}
                      onChange={(e) => setApproverDueDate(e.target.value)}
                      style={inputStyle}
                      required
                    />
                  </label>
'''
text = replace_once(text, role_input, role_with_due, "due-date input")

# Add explanatory text and restrict configuration to draft only.
text = replace_once(
    text,
    '            {!selectedReviewLocked ? (\n              <>\n                <h3>Add Approver</h3>\n',
    '            {!selectedReviewLocked && !selectedReviewPendingApproval && !selectedReviewRejected ? (\n              <>\n                <h3>Add Approver</h3>\n                <p style={{ color: "#475569" }}>Add Approver only configures the approval plan. No Workspace task is sent until you click Submit for Approval.</p>\n',
    "approval configuration visibility",
)

# Add due-date table column/value.
text = replace_once(
    text,
    '                    <th style={thStyle}>Role</th>\n                    <th style={thStyle}>Status</th>\n',
    '                    <th style={thStyle}>Role</th>\n                    <th style={thStyle}>Due Date</th>\n                    <th style={thStyle}>Status</th>\n',
    "approver due-date header",
)
text = replace_once(
    text,
    '                      <td style={tdStyle}>{approver.approver_role || "N/A"}</td>\n                      <td style={tdStyle}>{approver.approval_status || "pending"}</td>\n',
    '                      <td style={tdStyle}>{approver.approver_role || "N/A"}</td>\n                      <td style={tdStyle}>{approver.approver_due_date || "N/A"}</td>\n                      <td style={tdStyle}>{approver.approval_status || "configured"}</td>\n',
    "approver due-date value",
)

# Replace Actions cell so the raw workflow never signs approvals.
actions_pattern = re.compile(
    r'''                      <td style=\{tdStyle\}>\n                        \{approver\.approval_status !== "approved" &&\n                        !selectedReviewLocked &&\n                        String\(approver\.approver_email \|\| ""\)\.trim\(\)\.toLowerCase\(\) ===\n                          currentUserEmail \? \(\n                          <button type="button" onClick=\{\(\) => approveReviewApprover\(approver\)\}>\n                            Approve / Sign\n                          </button>\n                        \) : null\}\n                        \{approver\.approval_status !== "approved" && !selectedReviewLocked \? \(\n                          <button\n                            type="button"\n                            onClick=\{\(\) => removeApprover\(approver\)\}\n                            style=\{\{ marginLeft: "8px" \}\}\n                          >\n                            Remove\n                          </button>\n                        \) : null\}\n                      </td>''',
    re.S,
)
new_actions = '''                      <td style={tdStyle}>
                        {!selectedReviewLocked && !selectedReviewPendingApproval && !selectedReviewRejected ? (
                          <button
                            type="button"
                            onClick={() => removeApprover(approver)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>'''
text, count = actions_pattern.subn(new_actions, text, count=1)
if count != 1:
    raise RuntimeError(f"approver actions: expected 1 replacement, found {count}")

# Insert explicit submission control beneath approver table.
marker = '''              </table>
            )}
          </div>
        ) : (
          <p>Select a management review record to manage approvals.</p>
        )}
'''
replacement = '''              </table>
            )}

            {!selectedReviewLocked && !selectedReviewPendingApproval && !selectedReviewRejected && selectedApprovers.length > 0 ? (
              <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #e5e7eb" }}>
                <button type="button" onClick={submitManagementReviewForApproval} style={buttonStyle}>
                  Submit for Approval
                </button>
                <p style={{ marginBottom: 0, color: "#475569" }}>
                  This sends only the generated read-only Management Review report snapshot to the configured approvers.
                </p>
              </div>
            ) : null}

            {selectedReviewPendingApproval ? (
              <p style={{ marginTop: "16px", color: "#1d4ed8", fontWeight: 600 }}>
                This generated report snapshot is pending approval. Approvers receive only the read-only report package in My Workspace.
              </p>
            ) : null}

            {selectedReviewRejected ? (
              <p style={{ marginTop: "16px", color: "#991b1b", fontWeight: 600 }}>
                This report snapshot was rejected and remains preserved as submitted evidence. Generate a revised Management Review report snapshot for the next approval cycle.
              </p>
            ) : null}
          </div>
        ) : (
          <p>Select a management review record to manage approvals.</p>
        )}
'''
text = replace_once(text, marker, replacement, "submit-for-approval UI")

path.write_text(text)


# -----------------------------------------------------------------------------
# Workspace routing — approval task opens read-only report package.
# -----------------------------------------------------------------------------
path = Path("app/workspace/page.tsx")
text = path.read_text()
text = replace_once(
    text,
    '  if (task.entity_type === "management_review") return `/management-review?reviewId=${task.entity_id}&taskId=${task.id}`;\n',
    '  if (task.entity_type === "management_review") return `/management-review/${task.entity_id}/approval-review?taskId=${task.id}`;\n',
    "workspace Management Review route",
)
path.write_text(text)


# -----------------------------------------------------------------------------
# My Approval Tasks routing — same read-only package.
# -----------------------------------------------------------------------------
path = Path("app/my-approval-tasks/page.tsx")
text = path.read_text()
text = replace_once(
    text,
    '  const getManagementReviewUrl = (task: any) =>\n    `/management-review?reviewId=${task.entity_id}&taskId=${task.id}`;\n',
    '  const getManagementReviewUrl = (task: any) =>\n    `/management-review/${task.entity_id}/approval-review?taskId=${task.id}`;\n',
    "My Approval Tasks Management Review route",
)
text = replace_once(
    text,
    '                      Open Management Review Approval\n',
    '                      Open Management Review Report Package\n',
    "My Approval Tasks link label",
)
path.write_text(text)

print("Updated:")
print("  app/management-review/page.tsx")
print("  app/workspace/page.tsx")
print("  app/my-approval-tasks/page.tsx")
