from pathlib import Path
import re

MR = Path('app/management-review/page.tsx')
WS = Path('app/workspace/page.tsx')
MAT = Path('app/my-approval-tasks/page.tsx')

mr = MR.read_text()
ws = WS.read_text()
mat = MAT.read_text()

# -----------------------------------------------------------------------------
# Management Review: current user + deep-link selection
# -----------------------------------------------------------------------------
needle = '  const [selectedReviewId, setSelectedReviewId] = useState("");\n'
replacement = needle + '  const [currentUserEmail, setCurrentUserEmail] = useState("");\n'
if replacement not in mr:
    if needle not in mr:
        raise SystemExit('Unable to locate selectedReviewId state')
    mr = mr.replace(needle, replacement, 1)

old_effect = '''  useEffect(() => {\n    fetchConfiguredChangeKpis();\n    fetchData();\n    fetchManagementReviews();\n    fetchManagementReviewActions();\n  }, []);'''
new_effect = '''  useEffect(() => {\n    fetchConfiguredChangeKpis();\n    fetchData();\n    fetchManagementReviews();\n    fetchManagementReviewActions();\n\n    supabase.auth.getUser().then(({ data }) => {\n      setCurrentUserEmail(String(data?.user?.email || "").trim().toLowerCase());\n    });\n\n    const params = new URLSearchParams(window.location.search);\n    const requestedReviewId = params.get("reviewId");\n    if (requestedReviewId) {\n      setSelectedReviewId(requestedReviewId);\n    }\n  }, []);'''
if new_effect not in mr:
    if old_effect not in mr:
        raise SystemExit('Unable to locate Management Review initial useEffect')
    mr = mr.replace(old_effect, new_effect, 1)

# -----------------------------------------------------------------------------
# Management Review: create approver + centralized approval task
# -----------------------------------------------------------------------------
new_add = r'''  const addApprover = async () => {
    if (!selectedReviewId) {
      alert("Select a management review record first.");
      return;
    }

    if (selectedReviewLocked) {
      alert("This management review is locked and cannot be changed.");
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

    const normalizedApproverEmail = approverEmail.trim().toLowerCase();
    const duplicateApprover = selectedApprovers.some(
      (item: any) =>
        String(item.approver_email || "").trim().toLowerCase() === normalizedApproverEmail &&
        String(item.approval_status || "pending").toLowerCase() !== "cancelled"
    );

    if (duplicateApprover) {
      alert("This user is already configured as an approver for the selected Management Review.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const assignedByEmail = String(userData?.user?.email || "").trim().toLowerCase();

    if (!assignedByEmail) {
      alert("An authenticated user is required to assign a Management Review approver.");
      return;
    }

    const { data: insertedApprover, error: approverError } = await supabase
      .from("management_review_approvers")
      .insert({
        management_review_id: selectedReviewId,
        approver_name: approverName.trim(),
        approver_email: normalizedApproverEmail,
        approver_role: approverRole || null,
        approval_status: "pending",
        signature_meaning: signatureMeaning || null,
      })
      .select()
      .single();

    if (approverError || !insertedApprover) {
      alert(approverError?.message || "Unable to add Management Review approver.");
      return;
    }

    const reviewNumber = selectedReview?.review_number || "Management Review";
    const approverMarker = `management_review_approver_id=${insertedApprover.id}`;

    const { data: insertedTask, error: taskError } = await supabase
      .from("approval_tasks")
      .insert({
        entity_type: "management_review",
        entity_id: selectedReviewId,
        task_type: "management_review_approval",
        task_title: `${approverRole || "Approver"} — ${reviewNumber} Management Review Approval`,
        required_function: approverRole || "Management Review Approver",
        approver_job_title: approverRole || null,
        assigned_to_email: normalizedApproverEmail,
        assigned_by_email: assignedByEmail,
        status: "pending",
        required: true,
        comments: `${approverMarker}\n\nPlease review ${reviewNumber} and approve only if the Management Review record, quality-system performance, risks, actions, and conclusions are acceptable. This approval becomes part of the official electronic quality record.`,
        assignment_attachments: [],
      })
      .select()
      .single();

    if (taskError || !insertedTask) {
      await supabase
        .from("management_review_approvers")
        .delete()
        .eq("id", insertedApprover.id)
        .eq("management_review_id", selectedReviewId);

      alert(taskError?.message || "Unable to create the Management Review approval task.");
      return;
    }

    const { error: reviewUpdateError } = await supabase
      .from("management_reviews")
      .update({
        approval_status: "pending_approval",
        status: "pending_approval",
      })
      .eq("id", selectedReviewId);

    if (reviewUpdateError) {
      console.warn("Unable to update Management Review approval status:", reviewUpdateError.message);
    }

    const taskUrl = `/management-review?reviewId=${selectedReviewId}&taskId=${insertedTask.id}`;
    const { error: notificationError } = await supabase.from("notifications").insert({
      user_email: normalizedApproverEmail,
      assigned_role: approverRole || "Management Review Approver",
      notification_type: "management_review_approval",
      title: `Management Review approval assigned: ${reviewNumber}`,
      message: `You have been assigned approval for ${reviewNumber}. Open My Workspace to review and sign.`,
      related_module: "management_review",
      related_record_id: selectedReviewId,
      related_url: taskUrl,
      severity: "info",
      read_status: false,
    });

    if (notificationError) {
      console.warn("Management Review approval notification failed:", notificationError.message);
    }

    const { error: auditError } = await supabase.rpc("qualisphere_add_audit_log", {
      p_entity_type: "management_review",
      p_entity_id: selectedReviewId,
      p_action: "management_review_approver_assigned",
      p_details: `Approval assigned to ${normalizedApproverEmail} (${approverRole || "Management Review Approver"}).`,
    });

    if (auditError) {
      console.warn("Management Review approver assignment audit failed:", auditError.message);
    }

    alert("Approver added and approval task sent to My Workspace.");
    setApproverName("");
    setApproverEmail("");
    setApproverRole("");
    fetchManagementReviews();
  };
'''
pattern_add = re.compile(r'  const addApprover = async \(\) => \{.*?\n  \};\n\n  const approveReviewApprover = async', re.S)
match = pattern_add.search(mr)
if not match:
    raise SystemExit('Unable to locate addApprover block')
mr = mr[:match.start()] + new_add + '\n  const approveReviewApprover = async' + mr[match.end():]

# -----------------------------------------------------------------------------
# Management Review: assigned-user-only approval + task completion
# -----------------------------------------------------------------------------
new_approve = r'''  const approveReviewApprover = async (approver: any) => {
    if (selectedReviewLocked) {
      alert("This management review is already locked.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = String(userData?.user?.email || "").trim().toLowerCase();
    const assignedApproverEmail = String(approver.approver_email || "").trim().toLowerCase();

    if (!userEmail) {
      alert("An authenticated user is required to approve this Management Review.");
      return;
    }

    if (userEmail !== assignedApproverEmail) {
      alert(`This approval is assigned to ${approver.approver_email}. Sign in as the assigned approver to complete it.`);
      return;
    }

    const taskIdFromUrl = new URLSearchParams(window.location.search).get("taskId");
    let taskQuery = supabase
      .from("approval_tasks")
      .select("*")
      .eq("entity_type", "management_review")
      .eq("entity_id", approver.management_review_id)
      .eq("task_type", "management_review_approval")
      .eq("assigned_to_email", userEmail)
      .eq("status", "pending");

    if (taskIdFromUrl) {
      taskQuery = taskQuery.eq("id", taskIdFromUrl);
    }

    const { data: pendingTasks, error: taskFetchError } = await taskQuery;

    if (taskFetchError) {
      alert(taskFetchError.message);
      return;
    }

    const approverMarker = `management_review_approver_id=${approver.id}`;
    const matchingTask = (pendingTasks || []).find((task: any) =>
      String(task.comments || "").includes(approverMarker)
    );

    if (!matchingTask) {
      alert("No pending Management Review approval task assigned to this account was found for this approver.");
      return;
    }

    const enteredEmail = window.prompt(
      `Electronic Signature Required\n\nApprover: ${approver.approver_name}\n\nRe-enter your email to approve:`
    );

    if (!enteredEmail) return;

    if (enteredEmail.trim().toLowerCase() !== userEmail) {
      alert("Electronic signature email does not match the logged-in user.");
      return;
    }

    const confirmed = window.confirm(
      `Electronic Signature\n\n${approver.signature_meaning || signatureMeaning}\n\nBy clicking OK, your authenticated identity will be recorded as the signer.`
    );

    if (!confirmed) return;

    const now = new Date().toISOString();
    const meaning = approver.signature_meaning || signatureMeaning;

    const { data: updatedApprovers, error: approverUpdateError } = await supabase
      .from("management_review_approvers")
      .update({
        approval_status: "approved",
        signed_by: userEmail,
        signed_at: now,
        signature_meaning: meaning,
      })
      .eq("id", approver.id)
      .eq("management_review_id", approver.management_review_id)
      .eq("approver_email", approver.approver_email)
      .eq("approval_status", "pending")
      .select("id");

    if (approverUpdateError) {
      alert(approverUpdateError.message);
      return;
    }

    if (!updatedApprovers || updatedApprovers.length === 0) {
      alert("This approval is no longer pending or has already been completed.");
      return;
    }

    const { data: completedTasks, error: taskUpdateError } = await supabase
      .from("approval_tasks")
      .update({
        status: "approved",
        approver_comment: "Management Review approved.",
        signature_meaning: meaning,
        completed_by: userEmail,
        completed_at: now,
        signed_by: userEmail,
        signed_at: now,
      })
      .eq("id", matchingTask.id)
      .eq("assigned_to_email", userEmail)
      .eq("status", "pending")
      .select("id");

    if (taskUpdateError || !completedTasks || completedTasks.length === 0) {
      await supabase
        .from("management_review_approvers")
        .update({
          approval_status: "pending",
          signed_by: null,
          signed_at: null,
        })
        .eq("id", approver.id)
        .eq("management_review_id", approver.management_review_id)
        .eq("signed_by", userEmail);

      alert(taskUpdateError?.message || "The approval task could not be completed. No approval was finalized.");
      return;
    }

    const { data: approvers, error: approverFetchError } = await supabase
      .from("management_review_approvers")
      .select("*")
      .eq("management_review_id", approver.management_review_id);

    if (approverFetchError) {
      alert(approverFetchError.message);
      return;
    }

    const allApproved =
      (approvers || []).length > 0 &&
      (approvers || []).every((item: any) => item.approval_status === "approved");

    if (allApproved) {
      const { error: lockError } = await supabase
        .from("management_reviews")
        .update({
          approval_status: "approved",
          status: "approved",
          is_locked: true,
          locked_at: now,
          locked_by: userEmail,
          fully_approved_at: now,
        })
        .eq("id", approver.management_review_id);

      if (lockError) {
        alert(lockError.message);
        return;
      }

      const { error: auditError } = await supabase.rpc("qualisphere_add_audit_log", {
        p_entity_type: "management_review",
        p_entity_id: approver.management_review_id,
        p_action: "management_review_fully_approved_locked",
        p_details: "All required approvers signed through assigned approval tasks. Management review record locked.",
      });

      if (auditError) {
        console.warn("Management Review audit log failed:", auditError.message);
      }

      alert("Approval saved. All required approvers have signed, and the Management Review is now locked.");
    } else {
      await supabase
        .from("management_reviews")
        .update({
          approval_status: "pending_approval",
          status: "pending_approval",
        })
        .eq("id", approver.management_review_id);

      alert("Approval saved. Remaining approvers are still pending.");
    }

    const { error: approverAuditError } = await supabase.rpc("qualisphere_add_audit_log", {
      p_entity_type: "management_review_approver",
      p_entity_id: approver.id,
      p_action: "management_review_approver_signed",
      p_details: `Assigned approver ${approver.approver_name} (${userEmail}) signed Management Review approval task ${matchingTask.id}.`,
    });

    if (approverAuditError) {
      console.warn("Management Review approver audit log failed:", approverAuditError.message);
    }

    fetchManagementReviews();
  };
'''
pattern_approve = re.compile(r'  const approveReviewApprover = async \(approver: any\) => \{.*?\n  \};\n\n  const removeApprover = async', re.S)
match = pattern_approve.search(mr)
if not match:
    raise SystemExit('Unable to locate approveReviewApprover block')
mr = mr[:match.start()] + new_approve + '\n  const removeApprover = async' + mr[match.end():]

# -----------------------------------------------------------------------------
# Management Review: removing approver cancels matching pending approval task
# -----------------------------------------------------------------------------
new_remove = r'''  const removeApprover = async (approver: any) => {
    if (selectedReviewLocked) {
      alert("This management review is locked and cannot be changed.");
      return;
    }

    const confirmed = window.confirm(`Remove approver ${approver.approver_name}?`);
    if (!confirmed) return;

    const approverMarker = `management_review_approver_id=${approver.id}`;
    const { data: pendingTasks, error: taskFetchError } = await supabase
      .from("approval_tasks")
      .select("id, comments")
      .eq("entity_type", "management_review")
      .eq("entity_id", approver.management_review_id)
      .eq("task_type", "management_review_approval")
      .eq("status", "pending");

    if (taskFetchError) {
      alert(taskFetchError.message);
      return;
    }

    const matchingTaskIds = (pendingTasks || [])
      .filter((task: any) => String(task.comments || "").includes(approverMarker))
      .map((task: any) => task.id);

    if (matchingTaskIds.length > 0) {
      const { error: taskCancelError } = await supabase
        .from("approval_tasks")
        .update({ status: "cancelled" })
        .in("id", matchingTaskIds)
        .eq("status", "pending");

      if (taskCancelError) {
        alert(taskCancelError.message);
        return;
      }
    }

    const { error } = await supabase
      .from("management_review_approvers")
      .delete()
      .eq("id", approver.id)
      .eq("management_review_id", approver.management_review_id);

    if (error) {
      alert(error.message);
      return;
    }

    const { error: auditError } = await supabase.rpc("qualisphere_add_audit_log", {
      p_entity_type: "management_review",
      p_entity_id: approver.management_review_id,
      p_action: "management_review_approver_removed",
      p_details: `Approver ${approver.approver_name} (${approver.approver_email}) removed and pending approval task cancelled.`,
    });

    if (auditError) {
      console.warn("Management Review approver removal audit failed:", auditError.message);
    }

    alert("Approver removed and pending approval task cancelled.");
    fetchManagementReviews();
  };
'''
pattern_remove = re.compile(r'  const removeApprover = async \(approver: any\) => \{.*?\n  \};\n\n  const createManagementReviewAction = async', re.S)
match = pattern_remove.search(mr)
if not match:
    raise SystemExit('Unable to locate removeApprover block')
mr = mr[:match.start()] + new_remove + '\n  const createManagementReviewAction = async' + mr[match.end():]

# Restrict the in-record Approve / Sign button to the configured approver.
old_button = '''                        {approver.approval_status !== "approved" && !selectedReviewLocked ? (\n                          <button type="button" onClick={() => approveReviewApprover(approver)}>\n                            Approve / Sign\n                          </button>\n                        ) : null}'''
new_button = '''                        {approver.approval_status !== "approved" &&\n                        !selectedReviewLocked &&\n                        String(approver.approver_email || "").trim().toLowerCase() ===\n                          currentUserEmail ? (\n                          <button type="button" onClick={() => approveReviewApprover(approver)}>\n                            Approve / Sign\n                          </button>\n                        ) : null}'''
if new_button not in mr:
    if old_button not in mr:
        raise SystemExit('Unable to locate Approve / Sign button')
    mr = mr.replace(old_button, new_button, 1)

# -----------------------------------------------------------------------------
# Workspace: Management Review task routing and presentation
# -----------------------------------------------------------------------------
old_ws_route = '  if (task.entity_type === "training") return `/training`;\n\n  return "/";'
new_ws_route = '  if (task.entity_type === "training") return `/training`;\n  if (task.entity_type === "management_review") return `/management-review?reviewId=${task.entity_id}&taskId=${task.id}`;\n\n  return "/";'
if new_ws_route not in ws:
    if old_ws_route not in ws:
        raise SystemExit('Unable to locate Workspace generic routes')
    ws = ws.replace(old_ws_route, new_ws_route, 1)

old_direct = '''    task.complaint_number ||\n    task.audit_number ||\n    task.record_number ||'''
new_direct = '''    task.complaint_number ||\n    task.audit_number ||\n    task.review_number ||\n    task.record_number ||'''
if new_direct not in ws:
    if old_direct not in ws:
        raise SystemExit('Unable to locate Workspace record display fields')
    ws = ws.replace(old_direct, new_direct, 1)

old_regex = r'/\b(CAPA[-\s]?\d+|NCMR[-\s]?\d+|CC[-\s]?\d+|SCAR[-\s]?\d+|AUD[-\s]?\d+|DOC[-\s]?\d+|CMP[-\s]?\d+)\b/i'
new_regex = r'/\b(CAPA[-\s]?\d+|NCMR[-\s]?\d+|CC[-\s]?\d+|SCAR[-\s]?\d+|AUD[-\s]?\d+|DOC[-\s]?\d+|CMP[-\s]?\d+|MR[-\s]?\d+(?:[-\s]?\d+)?)\b/i'
if new_regex not in ws:
    if old_regex not in ws:
        raise SystemExit('Unable to locate Workspace record title regex')
    ws = ws.replace(old_regex, new_regex, 1)

old_module = '  if (type.includes("audit")) return "Audit";\n  return "Quality";'
new_module = '  if (type.includes("audit")) return "Audit";\n  if (type.includes("management_review")) return "Management Review";\n  return "Quality";'
if new_module not in ws:
    if old_module not in ws:
        raise SystemExit('Unable to locate Workspace module label map')
    ws = ws.replace(old_module, new_module, 1)

old_icon = '  if (label === "Audit") return "🔎";\n  return "📌";'
new_icon = '  if (label === "Audit") return "🔎";\n  if (label === "Management Review") return "📊";\n  return "📌";'
if new_icon not in ws:
    if old_icon not in ws:
        raise SystemExit('Unable to locate Workspace module icon map')
    ws = ws.replace(old_icon, new_icon, 1)

# -----------------------------------------------------------------------------
# My Approval Tasks: centralize Management Review approval package routing
# -----------------------------------------------------------------------------
anchor = '''  const isNcmrMrbApprovalTask = (task: any) => {\n    return (\n      task.entity_type === "ncmr" &&\n      ["mrb_approval", "ncmr_mrb_approval", "ncmr_mrb_review"].includes(\n        String(task.task_type || "")\n      )\n    );\n  };\n\n'''
insert = anchor + '''  const isManagementReviewApprovalTask = (task: any) => {\n    return (\n      String(task.entity_type || "").trim().toLowerCase() === "management_review" &&\n      String(task.task_type || "").trim().toLowerCase() === "management_review_approval"\n    );\n  };\n\n  const getManagementReviewUrl = (task: any) =>\n    `/management-review?reviewId=${task.entity_id}&taskId=${task.id}`;\n\n'''
if insert not in mat:
    if anchor not in mat:
        raise SystemExit('Unable to locate My Approval Tasks NCMR helper')
    mat = mat.replace(anchor, insert, 1)

old_sign_redirect = '''    if (isNcmrMrbApprovalTask(task)) {\n      window.location.href = getNcmrReviewUrl(task);\n      return;\n    }\n\n    if (!signatureEmail) {'''
new_sign_redirect = '''    if (isNcmrMrbApprovalTask(task)) {\n      window.location.href = getNcmrReviewUrl(task);\n      return;\n    }\n\n    if (isManagementReviewApprovalTask(task)) {\n      window.location.href = getManagementReviewUrl(task);\n      return;\n    }\n\n    if (!signatureEmail) {'''
if new_sign_redirect not in mat:
    if old_sign_redirect not in mat:
        raise SystemExit('Unable to locate My Approval Tasks signTask redirects')
    mat = mat.replace(old_sign_redirect, new_sign_redirect, 1)

old_flags = '''            const capaApproval = isCapaApprovalTask(task);\n            const ncmrMrbApproval = isNcmrMrbApprovalTask(task);\n            const centralizedApproval = capaApproval || ncmrMrbApproval;'''
new_flags = '''            const capaApproval = isCapaApprovalTask(task);\n            const ncmrMrbApproval = isNcmrMrbApprovalTask(task);\n            const managementReviewApproval = isManagementReviewApprovalTask(task);\n            const centralizedApproval =\n              capaApproval || ncmrMrbApproval || managementReviewApproval;'''
if new_flags not in mat:
    if old_flags not in mat:
        raise SystemExit('Unable to locate My Approval Tasks centralized flags')
    mat = mat.replace(old_flags, new_flags, 1)

old_link = '''                  ) : ncmrMrbApproval ? (\n                    <a href={getNcmrReviewUrl(task)} style={primaryLinkStyle}>\n                      Open MRB Review Package\n                    </a>\n                  ) : null}'''
new_link = '''                  ) : ncmrMrbApproval ? (\n                    <a href={getNcmrReviewUrl(task)} style={primaryLinkStyle}>\n                      Open MRB Review Package\n                    </a>\n                  ) : managementReviewApproval ? (\n                    <a href={getManagementReviewUrl(task)} style={primaryLinkStyle}>\n                      Open Management Review Approval\n                    </a>\n                  ) : null}'''
if new_link not in mat:
    if old_link not in mat:
        raise SystemExit('Unable to locate My Approval Tasks centralized links')
    mat = mat.replace(old_link, new_link, 1)

MR.write_text(mr)
WS.write_text(ws)
MAT.write_text(mat)

print('Updated:')
print(f'  {MR}')
print(f'  {WS}')
print(f'  {MAT}')
