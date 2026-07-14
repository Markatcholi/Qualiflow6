"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type ModuleGroupKey = "myWork" | "quality" | "analytics" | "administration";

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [workItems, setWorkItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableUsers, setAvailableUsers] = useState<string[]>([]);
  const [reassignTask, setReassignTask] = useState<any>(null);
  const [reassignEmail, setReassignEmail] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<ModuleGroupKey, boolean>>({
    myWork: true,
    quality: true,
    analytics: true,
    administration: true,
  });

  const canAccessAdmin =
    role === "admin" ||
    role === "administrator" ||
    role === "coordinator" ||
    role === "approver" ||
    role === "vp_quality";

  const fetchHomeData = async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "";
    setEmail(userEmail);

    if (!userEmail) {
      setWorkItems([]);
      setLoading(false);
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", userEmail)
      .maybeSingle();

    const resolvedRole = roleData?.role || "user";
    setRole(resolvedRole);

    const { data: taskData, error: taskError } = await supabase
      .from("approval_tasks")
      .select("*")
      .eq("assigned_to_email", userEmail.toLowerCase())
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (taskError) {
      alert(taskError.message);
      setLoading(false);
      return;
    }

    const normalizedEmail = userEmail.toLowerCase();

    const { data: ownedCapaData, error: ownedCapaError } = await supabase
      .from("capas")
      .select("*")
      .or(
        `owner_email.eq.${normalizedEmail},owner.eq.${normalizedEmail}`
      )
      .not("status", "in", '("closed","cancelled")')
      .order("created_at", { ascending: true });

    if (ownedCapaError) {
      alert(ownedCapaError.message);
      setLoading(false);
      return;
    }

    const assignedTaskItems = (taskData || []).map((task: any) => ({
      ...task,
      workspace_item_type: "assigned_task",
    }));

    const ownedCapaItems = (ownedCapaData || [])
      .filter((capa: any) => shouldShowOwnedCapaWork(capa))
      .map((capa: any) => ({
        ...capa,
        workspace_item_type: "owned_capa",
      }));

    setWorkItems(
      [...assignedTaskItems, ...ownedCapaItems].sort((a: any, b: any) =>
        String(a.created_at || "").localeCompare(String(b.created_at || ""))
      )
    );

    const { data: usersData } = await supabase
      .from("user_roles")
      .select("user_email")
      .order("user_email", { ascending: true });

    setAvailableUsers(
      (usersData || [])
        .map((user: any) => String(user.user_email || "").toLowerCase())
        .filter(Boolean)
    );

    setLoading(false);
  };

  useEffect(() => {
    fetchHomeData();
  }, []);

  const toggleGroup = (group: ModuleGroupKey) => {
    setOpenGroups((current) => ({
      ...current,
      [group]: !current[group],
    }));
  };

  const openReassignDialog = (task: any) => {
    setReassignTask(task);
    setReassignEmail("");
  };

  const closeReassignDialog = () => {
    if (reassigning) return;
    setReassignTask(null);
    setReassignEmail("");
  };

  const completeReassignment = async () => {
    if (!reassignTask?.id) return;

    const newAssignee = String(reassignEmail || "").trim().toLowerCase();

    if (!newAssignee) {
      alert("New assignee email is required.");
      return;
    }

    setReassigning(true);

    if (reassignTask.workspace_item_type === "owned_capa") {
      const currentOwner = String(
        reassignTask.owner_email || reassignTask.owner || email
      )
        .trim()
        .toLowerCase();

      if (newAssignee === currentOwner) {
        alert("The new owner must be different from the current owner.");
        setReassigning(false);
        return;
      }

      const { error } = await supabase
        .from("capas")
        .update({
          owner_email: newAssignee,
          owner: newAssignee,
        })
        .eq("id", reassignTask.id);

      setReassigning(false);

      if (error) {
        alert(error.message);
        return;
      }

      await supabase.from("audit_logs").insert({
        entity_type: "capa",
        entity_id: reassignTask.id,
        action: "workflow_owner_reassigned",
        details: `CAPA ownership reassigned from ${currentOwner} to ${newAssignee}.`,
        user_email: email,
      });

      alert("CAPA ownership reassigned.");
      closeReassignDialog();
      fetchHomeData();
      return;
    }

    const currentAssignee = String(reassignTask.assigned_to_email || "")
      .trim()
      .toLowerCase();

    if (newAssignee === currentAssignee) {
      alert("The new assignee must be different from the current assignee.");
      setReassigning(false);
      return;
    }

    const { error } = await supabase
      .from("approval_tasks")
      .update({
        assigned_to_email: newAssignee,
        reassigned_from_email: currentAssignee,
        reassigned_by_email: email,
        reassigned_at: new Date().toISOString(),
      })
      .eq("id", reassignTask.id)
      .eq("assigned_to_email", email.toLowerCase());

    setReassigning(false);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: reassignTask.entity_type,
      entity_id: reassignTask.entity_id,
      action: "task_reassigned",
      details: `Task reassigned from ${currentAssignee} to ${newAssignee}.`,
      user_email: email,
    });

    alert("Task reassigned.");
    closeReassignDialog();
    fetchHomeData();
  };

  if (loading) {
    return <main style={pageStyle}>Loading QualiSphere home...</main>;
  }

  if (!email) {
    return (
      <main style={publicPageStyle}>
        <section style={publicCardStyle}>
          <div style={eyebrowStyle}>ENTERPRISE QUALITY MANAGEMENT SYSTEM</div>
          <h1 style={publicTitleStyle}>QualiSphere</h1>
          <p style={publicSubtitleStyle}>
            Connected quality workflows, configurable governance, audit-ready records,
            and management-review visibility for regulated industries.
          </p>
          <a href="/login" style={loginButtonStyle}>
            Login
          </a>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={homeHeaderStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE HOME</div>
          <h1 style={{ margin: "4px 0" }}>My Workspace</h1>
          <p style={{ margin: 0, color: "#475569" }}>
            Logged in as <strong>{email}</strong> ({role || "user"})
          </p>
        </div>


      </header>

      <section style={workspaceGridStyle}>
        <aside style={leftPanelStyle}>
          <h2 style={panelTitleStyle}>Modules</h2>

          <ModuleGroup
            title="My Work"
            isOpen={openGroups.myWork}
            onToggle={() => toggleGroup("myWork")}
            items={[
              { label: "My Tasks", href: "/my-approval-tasks" },
            ]}
          />

          <ModuleGroup
            title="Quality Management"
            isOpen={openGroups.quality}
            onToggle={() => toggleGroup("quality")}
            items={[
              { label: "CAPA", href: "/capa" },
              { label: "NCMR", href: "/ncmrs" },
              { label: "Change Control", href: "/change-control" },
              { label: "Controlled Documents", href: "/documents" },
              { label: "Training", href: "/training" },
              { label: "SCAR", href: "/supplier-quality/scars" },
              { label: "Complaints", href: "/complaints" },
              { label: "Audit Management", href: "/audits" },
              { label: "OOS / OOT", href: "/oos-oot" },
              { label: "Suppliers", href: "/suppliers" },
              { label: "Equipment", href: "/equipment" },
            ]}
          />

          <ModuleGroup
            title="Analytics"
            isOpen={openGroups.analytics}
            onToggle={() => toggleGroup("analytics")}
            items={[
              { label: "Executive Dashboard", href: "/dashboard" },
              { label: "Management Review", href: "/management-review" },
              { label: "KPI Reports", href: "/kpi-reports" },
              { label: "Audit Trail", href: "/audit" },
            ]}
          />

          {canAccessAdmin ? (
            <ModuleGroup
              title="Administration"
              isOpen={openGroups.administration}
              onToggle={() => toggleGroup("administration")}
              items={[
                { label: "Master Data", href: "/admin/master-data" },
                { label: "Approval Matrix", href: "/approval-matrix" },
                { label: "Company Settings", href: "/admin/company-settings" },
              ]}
            />
          ) : null}
        </aside>

        <section style={rightPanelStyle}>
          <div style={rightPanelHeaderStyle}>
            <div>
              <h2 style={panelTitleStyle}>My Tasks</h2>

            </div>

            <span style={taskCountStyle}>{workItems.length}</span>
          </div>

          {workItems.length === 0 ? (
            <div style={emptyTaskStyle}>
              No pending work assigned to you.
            </div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={taskTableStyle}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>Record</th>
                    <th style={tableHeaderStyle}>Task</th>
                    <th style={tableHeaderStyle}>Assigned</th>
                    <th style={tableHeaderStyle}>Due Date</th>
                    <th style={tableHeaderStyle}>Status</th>
                    <th style={tableHeaderStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {workItems.map((task) => {
                    const dueStatus = getDueStatus(task);
                    const taskUrl = getTaskUrl(task);

                    return (
                      <tr key={task.id}>
                        <td style={tableCellStyle}>{getRecordDisplay(task)}</td>
                        <td style={tableCellStyle}>{getTaskName(task)}</td>
                        <td style={tableCellStyle}>{formatDate(task.created_at)}</td>
                        <td style={tableCellStyle}>
                          {task.workspace_item_type === "owned_capa"
                            ? task.due_date || task.action_due_date || task.effectiveness_due_date || "N/A"
                            : task.due_date || "N/A"}
                        </td>
                        <td style={tableCellStyle}>
                          <span
                            style={{
                              ...statusBadgeStyle,
                              background: dueStatus.background,
                              borderColor: dueStatus.border,
                              color: dueStatus.text,
                            }}
                          >
                            {dueStatus.icon} {dueStatus.label}
                          </span>
                        </td>
                        <td style={tableCellStyle}>
                          <div style={actionButtonGroupStyle}>
                            <a href={taskUrl} style={tableOpenLinkStyle}>
                              Open
                            </a>
                            {task.workspace_item_type === "assigned_task" ||
                            task.workspace_item_type === "owned_capa" ? (
                              <button
                                type="button"
                                onClick={() => openReassignDialog(task)}
                                style={tableReassignButtonStyle}
                              >
                                Reassign
                              </button>
                            ) : null}
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
      </section>

      {reassignTask ? (
        <div style={modalOverlayStyle}>
          <section style={modalCardStyle}>
            <h2 style={{ marginTop: 0 }}>
              Reassign {getRecordDisplay(reassignTask)}
            </h2>

            <div style={modalFieldStyle}>
              <label style={modalLabelStyle}>
                {reassignTask.workspace_item_type === "owned_capa"
                  ? "Current Owner"
                  : "Current Assignee"}
              </label>
              <div style={readOnlyValueStyle}>
                {reassignTask.workspace_item_type === "owned_capa"
                  ? reassignTask.owner_email || reassignTask.owner || "N/A"
                  : reassignTask.assigned_to_email || "N/A"}
              </div>
            </div>

            <div style={modalFieldStyle}>
              <label style={modalLabelStyle}>New Assignee</label>
              <select
                value={reassignEmail}
                onChange={(event) => setReassignEmail(event.target.value)}
                style={modalInputStyle}
              >
                <option value="">Select user</option>
                {availableUsers
                  .filter((user) =>
                    user !==
                    String(
                      reassignTask.workspace_item_type === "owned_capa"
                        ? reassignTask.owner_email || reassignTask.owner || ""
                        : reassignTask.assigned_to_email || ""
                    ).toLowerCase()
                  )
                  .map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
              </select>
            </div>

            <div style={modalActionsStyle}>
              <button
                type="button"
                onClick={closeReassignDialog}
                disabled={reassigning}
                style={modalSecondaryButtonStyle}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={completeReassignment}
                disabled={reassigning}
                style={modalPrimaryButtonStyle}
              >
                {reassigning ? "Reassigning..." : "Reassign"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function ModuleGroup({
  title,
  isOpen,
  onToggle,
  items,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  items: Array<{ label: string; href: string }>;
}) {
  return (
    <div style={moduleGroupStyle}>
      <button type="button" onClick={onToggle} style={moduleHeaderButtonStyle}>
        <span>{isOpen ? "▼" : "▶"} {title}</span>
      </button>

      {isOpen ? (
        <ul style={moduleListStyle}>
          {items.map((item) => (
            <li key={item.href} style={moduleListItemStyle}>
              <a href={item.href} style={moduleLinkStyle}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function getTaskUrl(task: any) {
  if (task.workspace_item_type === "owned_capa") {
    return `/capa/${task.id}`;
  }

  if (isCapaApprovalTask(task)) {
    const gate = getCapaGateFromTask(task);
    return `/capa/${task.entity_id}/approval-review?gate=${gate}&taskId=${task.id}`;
  }

  if (task.entity_type === "ncmr") return `/ncmrs/${task.entity_id}`;
  if (task.entity_type === "change_control") return `/change-control/${task.entity_id}`;
  if (task.entity_type === "document") return `/documents/${task.entity_id}`;

  return "/my-approval-tasks";
}

function getRecordDisplay(task: any) {
  if (task.workspace_item_type === "owned_capa") {
    return task.capa_number || task.id || "CAPA";
  }

  const directRecord =
    task.record_number ||
    task.capa_number ||
    task.entity_number ||
    task.ncmr_number ||
    task.change_number ||
    task.document_number;

  if (directRecord) return directRecord;

  const title = String(task.task_title || "");
  const recordMatch = title.match(/\b(CAPA\d+|NCMR\d+|CC\d+|SCAR\d+|AUD\d+|DOC\d+)\b/i);

  if (recordMatch?.[1]) {
    return recordMatch[1].toUpperCase();
  }

  return task.entity_id || "Record";
}

function getTaskName(task: any) {
  if (task.workspace_item_type === "owned_capa") {
    return getOwnedCapaWorkLabel(task);
  }

  if (isCapaApprovalTask(task)) {
    return getCapaApprovalLabel(task);
  }

  if (task.task_title) {
    return cleanTaskTitle(task.task_title);
  }

  return formatTaskType(task.task_type);
}

function cleanTaskTitle(value: any) {
  return String(value || "Task")
    .replace(/\s+for\s+(CAPA\d+|NCMR\d+|CC\d+|SCAR\d+|AUD\d+|DOC\d+)\b/gi, "")
    .trim();
}

function getCapaApprovalLabel(task: any) {
  const gate = getCapaGateFromTask(task);

  if (gate === "initiation") return "Initiation Approval";
  if (gate === "investigation") return "Investigation Approval";
  if (gate === "action_plan") return "Action Plan Approval";
  if (gate === "implementation") return "Implementation Approval";
  if (gate === "effectiveness_plan") return "Effectiveness Plan Approval";
  if (gate === "closure") return "Closure Approval";

  return "CAPA Approval";
}

function isCapaApprovalTask(task: any) {
  return (
    task.entity_type === "capa" &&
    [
      "capa_initiation_approval",
      "capa_investigation_approval",
      "capa_action_plan_approval",
      "capa_implementation_approval",
      "capa_effectiveness_plan_approval",
      "capa_closure_approval",
    ].includes(task.task_type)
  );
}

function getCapaGateFromTask(task: any) {
  const taskType = String(task.task_type || "");

  if (taskType === "capa_initiation_approval") return "initiation";
  if (taskType === "capa_investigation_approval") return "investigation";
  if (taskType === "capa_action_plan_approval") return "action_plan";
  if (taskType === "capa_implementation_approval") return "implementation";
  if (taskType === "capa_effectiveness_plan_approval") return "effectiveness_plan";
  if (taskType === "capa_closure_approval") return "closure";

  return "initiation";
}

function getTaskTitle(task: any) {
  if (task.task_title) return task.task_title;

  const record =
    task.record_number ||
    task.capa_number ||
    task.entity_number ||
    String(task.entity_type || "Record").toUpperCase();

  const taskType = formatTaskType(task.task_type);
  const jobTitle = task.approver_job_title || task.required_function || "";

  return jobTitle ? `${jobTitle} — ${record} ${taskType}` : `${record} ${taskType}`;
}

function shouldShowOwnedCapaWork(capa: any) {
  const status = String(capa.status || "").toLowerCase();

  if (status === "closed" || status === "cancelled") return false;

  const approvalPending =
    status.includes("pending") &&
    status.includes("approval");

  const pendingGateApproved =
    (status.includes("initiation") && capa.initiation_approval_status === "approved") ||
    (status.includes("investigation") && capa.investigation_approval_status === "approved") ||
    (status.includes("action_plan") && capa.action_plan_approval_status === "approved") ||
    (status.includes("effectiveness_plan") && capa.effectiveness_plan_approval_status === "approved") ||
    (status.includes("closure") && capa.closure_approval_status === "approved");

  if (approvalPending && !pendingGateApproved) return false;

  return true;
}

function getOwnedCapaWorkLabel(capa: any) {
  if (!capa.initiation_approval_status || capa.initiation_approval_status === "not_submitted") {
    return "Complete Initiation";
  }

  if (capa.initiation_approval_status === "rejected") return "Revise Initiation";

  if (capa.initiation_approval_status === "approved" && !capa.investigation_approval_status) {
    return "Complete Evaluation / Investigation";
  }

  if (capa.investigation_approval_status === "rejected") return "Revise Investigation";

  if (capa.investigation_approval_status === "approved" && !capa.action_plan_approval_status) {
    return "Complete Action Plan Proposal";
  }

  if (capa.action_plan_approval_status === "rejected") return "Revise Action Plan";

  if (capa.action_plan_approval_status === "approved" && !capa.implemented_by) {
    return "Complete Implementation";
  }

  if (capa.implemented_by && capa.effectiveness_plan_approval_status !== "approved") {
    return "Complete / Submit Effectiveness Plan";
  }

  if (
    capa.implemented_by &&
    capa.effectiveness_plan_approval_status === "approved" &&
    !capa.effectiveness_verified_by &&
    !capa.effectiveness_rating
  ) {
    return "Complete Effectiveness Verification";
  }

  if (capa.effectiveness_rating && !capa.closure_approval_status) return "Submit Closure";
  if (capa.closure_approval_status === "rejected") return "Revise Closure";

  return "Continue CAPA";
}

function getDueStatus(task: any) {
  const dueDateValue =
    task.workspace_item_type === "owned_capa"
      ? task.due_date || task.action_due_date || task.effectiveness_due_date
      : task.due_date;

  if (!dueDateValue) {
    return {
      label: "No due date",
      icon: "⚪",
      background: "#f8fafc",
      border: "#cbd5e1",
      text: "#475569",
    };
  }

  const today = new Date();
  const dueDate = new Date(`${dueDateValue}T23:59:59`);
  today.setHours(0, 0, 0, 0);

  const daysRemaining = Math.ceil(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysRemaining < 0) {
    return {
      label: "Overdue",
      icon: "🔴",
      background: "#fef2f2",
      border: "#fecaca",
      text: "#991b1b",
    };
  }

  if (daysRemaining <= 3) {
    return {
      label: daysRemaining === 0 ? "Due today" : `Due in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
      icon: "🟡",
      background: "#fffbeb",
      border: "#fde68a",
      text: "#92400e",
    };
  }

  return {
    label: `Due in ${daysRemaining} days`,
    icon: "🟢",
    background: "#f0fdf4",
    border: "#bbf7d0",
    text: "#166534",
  };
}

function formatTaskType(value: any) {
  return String(value || "task")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: any) {
  if (!value) return "N/A";
  return String(value).slice(0, 10);
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "24px",
  fontFamily: "Arial, sans-serif",
  background: "#f8fafc",
  color: "#0f172a",
};

const publicPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  fontFamily: "Arial, sans-serif",
  background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f8fafc 100%)",
};

const publicCardStyle: React.CSSProperties = {
  maxWidth: "780px",
  background: "rgba(255,255,255,0.86)",
  border: "1px solid #dbeafe",
  borderRadius: "28px",
  padding: "44px",
  textAlign: "center",
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.12)",
};

const publicTitleStyle: React.CSSProperties = {
  fontSize: "64px",
  lineHeight: 1,
  margin: "12px 0",
  letterSpacing: "-0.05em",
};

const publicSubtitleStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: "21px",
  lineHeight: "32px",
};

const loginButtonStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: "18px",
  background: "#111827",
  color: "white",
  padding: "12px 24px",
  borderRadius: "999px",
  textDecoration: "none",
  fontWeight: 900,
};

const homeHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
  marginBottom: "22px",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#2563eb",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.14em",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  borderRadius: "10px",
  padding: "10px 14px",
  textDecoration: "none",
  fontWeight: 900,
};

const workspaceGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 360px) 1fr",
  gap: "22px",
  alignItems: "start",
};

const leftPanelStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "18px",
  padding: "18px",
  boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
};

const rightPanelStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "18px",
  padding: "18px",
  boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
};

const rightPanelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  alignItems: "center",
  marginBottom: "8px",
};

const panelTitleStyle: React.CSSProperties = {
  margin: "0 0 12px 0",
};

const taskCountStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  borderRadius: "999px",
  minWidth: "34px",
  height: "34px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
};

const moduleGroupStyle: React.CSSProperties = {
  borderTop: "1px solid #e5e7eb",
  paddingTop: "12px",
  marginTop: "12px",
};

const moduleHeaderButtonStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  padding: "0",
  textAlign: "left",
  fontSize: "16px",
  fontWeight: 900,
  cursor: "pointer",
  color: "#111827",
};

const moduleListStyle: React.CSSProperties = {
  margin: "10px 0 0 22px",
  padding: 0,
  display: "grid",
  gap: "8px",
};

const moduleListItemStyle: React.CSSProperties = {
  paddingLeft: "4px",
};

const moduleLinkStyle: React.CSSProperties = {
  color: "#1f2937",
  textDecoration: "none",
  fontWeight: 700,
};

const emptyTaskStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: "12px",
  padding: "18px",
  color: "#64748b",
};

const taskListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "grid",
  gap: "12px",
};

const taskItemStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px 1fr",
  gap: "10px",
  alignItems: "start",
};

const taskNumberStyle: React.CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "999px",
  background: "#eff6ff",
  color: "#1d4ed8",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
};

const taskCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  padding: "14px",
  background: "#ffffff",
};

const taskCardTopRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
};

const taskMetaStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  color: "#64748b",
  marginTop: "8px",
  fontSize: "14px",
};

const dueBadgeStyle: React.CSSProperties = {
  border: "1px solid",
  borderRadius: "999px",
  padding: "6px 10px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const taskLinkStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: "10px",
  background: "#2563eb",
  color: "white",
  borderRadius: "9px",
  padding: "8px 12px",
  textDecoration: "none",
  fontWeight: 900,
};


const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
};

const taskTableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#ffffff",
  fontSize: "14px",
};

const tableHeaderStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #d1d5db",
  background: "#f8fafc",
  fontWeight: 900,
  color: "#111827",
};

const tableCellStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e5e7eb",
  verticalAlign: "middle",
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid",
  borderRadius: "999px",
  padding: "5px 9px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const tableOpenLinkStyle: React.CSSProperties = {
  display: "inline-block",
  background: "#2563eb",
  color: "#ffffff",
  borderRadius: "8px",
  padding: "6px 10px",
  textDecoration: "none",
  fontWeight: 900,
};

const actionButtonGroupStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  flexWrap: "wrap",
};

const tableReassignButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  borderRadius: "8px",
  padding: "6px 10px",
  fontWeight: 900,
  cursor: "pointer",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 50,
};

const modalCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "520px",
  background: "#ffffff",
  borderRadius: "18px",
  border: "1px solid #d1d5db",
  padding: "22px",
  boxShadow: "0 24px 80px rgba(15, 23, 42, 0.25)",
};

const modalFieldStyle: React.CSSProperties = {
  marginBottom: "14px",
};

const modalLabelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 900,
  marginBottom: "6px",
};

const readOnlyValueStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  borderRadius: "10px",
  padding: "10px",
  fontWeight: 800,
};

const modalInputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "10px",
  boxSizing: "border-box",
};

const modalActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "16px",
};

const modalSecondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#ffffff",
  borderRadius: "10px",
  padding: "9px 14px",
  fontWeight: 900,
  cursor: "pointer",
};

const modalPrimaryButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "9px 14px",
  fontWeight: 900,
  cursor: "pointer",
};
