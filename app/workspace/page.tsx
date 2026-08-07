"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type ModuleGroupKey = "myWork" | "quality" | "analytics" | "administration";
type WorkspaceFilter =
  | "all"
  | "tasks"
  | "approvals"
  | "owned"
  | "overdue"
  | "today"
  | "week";

type WorkspaceItemType =
  | "assigned_task"
  | "owned_capa"
  | "owned_ncmr"
  | "owned_change_control"
  | "owned_scar"
  | "owned_document"
  | "owned_complaint"
  | "owned_audit";

const CLOSED_STATUSES = new Set([
  "closed",
  "cancelled",
  "canceled",
  "completed",
  "obsolete",
  "superseded",
]);

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [workItems, setWorkItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<string[]>([]);
  const [reassignTask, setReassignTask] = useState<any>(null);
  const [reassignEmail, setReassignEmail] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [activeFilter, setActiveFilter] = useState<WorkspaceFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<ModuleGroupKey, boolean>>({
    myWork: true,
    quality: true,
    analytics: true,
    administration: true,
  });

  const normalizedRole = normalizeRole(role);
  const canAccessAdmin = [
    "admin",
    "administrator",
    "coordinator",
    "approver",
    "vp quality",
    "quality manager",
  ].includes(normalizedRole);

  const fetchHomeData = async (showFullLoader = true) => {
    if (showFullLoader) setLoading(true);
    else setRefreshing(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = String(userData?.user?.email || "").trim().toLowerCase();
      setEmail(userEmail);

      if (!userEmail) {
        setWorkItems([]);
        return;
      }

      const [roleResponse, taskResponse, usersResponse, notificationResponse] =
        await Promise.all([
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_email", userEmail)
            .maybeSingle(),
          supabase
            .from("approval_tasks")
            .select("*")
            .eq("assigned_to_email", userEmail)
            .eq("status", "pending")
            .order("created_at", { ascending: true }),
          supabase
            .from("user_roles")
            .select("user_email")
            .order("user_email", { ascending: true }),
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_email", userEmail)
            .eq("read_status", false),
        ]);

      setRole(roleResponse.data?.role || "user");

      if (taskResponse.error) {
        throw new Error(taskResponse.error.message);
      }

      const assignedTaskItems = (taskResponse.data || []).map((task: any) => ({
        ...task,
        workspace_item_type: "assigned_task" as WorkspaceItemType,
      }));

      const ownedRecordItems = await fetchOwnedRecordItems(userEmail);

      setWorkItems(
        [...assignedTaskItems, ...ownedRecordItems].sort(compareWorkspaceItems)
      );

      setAvailableUsers(
        (usersResponse.data || [])
          .map((user: any) => String(user.user_email || "").trim().toLowerCase())
          .filter(Boolean)
      );

      setNotificationCount(notificationResponse.count || 0);
      setLastUpdatedAt(new Date().toISOString());
    } catch (error: any) {
      alert(error?.message || "Unable to load My Workspace.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHomeData(true);

    const refreshOnFocus = () => fetchHomeData(false);
    window.addEventListener("focus", refreshOnFocus);

    const intervalId = window.setInterval(() => {
      fetchHomeData(false);
    }, 60000);

    const channel = supabase
      .channel("qualisphere-workspace-refresh")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "approval_tasks" },
        () => fetchHomeData(false)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => fetchHomeData(false)
      )
      .subscribe();

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredWorkItems = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return workItems
      .filter((item) => matchesWorkspaceFilter(item, activeFilter))
      .filter((item) => {
        if (!normalizedSearch) return true;

        const searchableText = [
          getRecordDisplay(item),
          getTaskName(item),
          getModuleLabel(item),
          item.assigned_to_email,
          item.owner_email,
          item.owner,
          item.product_part_number,
          item.part_number,
          item.lot_number,
          item.document_number,
          item.title,
          item.description,
          item.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedSearch);
      })
      .sort(compareWorkspaceItems);
  }, [workItems, activeFilter, searchText]);

  const workspaceCounts = useMemo(
    () => ({
      all: workItems.length,
      tasks: workItems.filter((item) => item.workspace_item_type === "assigned_task").length,
      approvals: workItems.filter(isApprovalTask).length,
      owned: workItems.filter((item) => item.workspace_item_type !== "assigned_task").length,
      overdue: workItems.filter((item) => getDueStatus(item).category === "overdue").length,
      today: workItems.filter((item) => getDueStatus(item).category === "today").length,
      week: workItems.filter((item) =>
        ["today", "soon"].includes(getDueStatus(item).category)
      ).length,
    }),
    [workItems]
  );

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

    try {
      if (reassignTask.workspace_item_type === "owned_capa") {
        const currentOwner = String(
          reassignTask.owner_email || reassignTask.owner || email
        )
          .trim()
          .toLowerCase();

        if (newAssignee === currentOwner) {
          alert("The new owner must be different from the current owner.");
          return;
        }

        const { error } = await supabase
          .from("capas")
          .update({ owner_email: newAssignee, owner: newAssignee })
          .eq("id", reassignTask.id);

        if (error) throw new Error(error.message);

        await Promise.all([
          supabase.from("audit_logs").insert({
            entity_type: "capa",
            entity_id: reassignTask.id,
            action: "workflow_owner_reassigned",
            details: `CAPA ownership reassigned from ${currentOwner} to ${newAssignee}.`,
            user_email: email,
          }),
          createWorkspaceNotification(
            newAssignee,
            "CAPA ownership assigned",
            `You are now the owner of ${getRecordDisplay(reassignTask)}.`,
            "capa",
            reassignTask.id
          ),
        ]);

        alert("CAPA ownership reassigned.");
        closeReassignDialog();
        await fetchHomeData(false);
        return;
      }

      const currentAssignee = String(reassignTask.assigned_to_email || "")
        .trim()
        .toLowerCase();

      if (newAssignee === currentAssignee) {
        alert("The new assignee must be different from the current assignee.");
        return;
      }

      const { data: updatedRows, error } = await supabase
        .from("approval_tasks")
        .update({
          assigned_to_email: newAssignee,
          reassigned_from_email: currentAssignee,
          reassigned_by_email: email,
          reassigned_at: new Date().toISOString(),
        })
        .eq("id", reassignTask.id)
        .eq("assigned_to_email", email.toLowerCase())
        .select("id");

      if (error) throw new Error(error.message);
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(
          "The task was not reassigned. It may have already been completed or reassigned by another user."
        );
      }

      await Promise.all([
        supabase.from("audit_logs").insert({
          entity_type: reassignTask.entity_type,
          entity_id: reassignTask.entity_id,
          action: "task_reassigned",
          details: `Task reassigned from ${currentAssignee} to ${newAssignee}.`,
          user_email: email,
        }),
        createWorkspaceNotification(
          newAssignee,
          "Task assigned",
          `${getTaskName(reassignTask)} for ${getRecordDisplay(reassignTask)} was reassigned to you.`,
          reassignTask.entity_type,
          reassignTask.entity_id
        ),
      ]);

      alert("Task reassigned.");
      closeReassignDialog();
      await fetchHomeData(false);
    } catch (error: any) {
      alert(error?.message || "Unable to reassign this work item.");
    } finally {
      setReassigning(false);
    }
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
          <div style={publicActionRowStyle}>
            <a href="/login" style={loginButtonStyle}>Login</a>
            <a href="/signup" style={signupButtonStyle}>Sign Up</a>
          </div>
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
          <p style={lastUpdatedStyle}>
            {lastUpdatedAt ? `Last updated ${formatDateTime(lastUpdatedAt)}` : ""}
          </p>
        </div>

        <div style={headerActionRowStyle}>
          <a href="/notifications" style={notificationButtonStyle}>
            Notifications
            {notificationCount > 0 ? (
              <span style={notificationBadgeStyle}>{notificationCount}</span>
            ) : null}
          </a>
          <button
            type="button"
            onClick={() => fetchHomeData(false)}
            disabled={refreshing}
            style={refreshButtonStyle}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      <section style={workspaceGridStyle}>
        <aside style={leftPanelStyle}>
          <h2 style={panelTitleStyle}>Modules</h2>

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
              <h2 style={panelTitleStyle}>My Work Queue</h2>
              <p style={panelSubtitleStyle}>
                Assigned tasks and active quality records that currently require your action.
              </p>
            </div>
            <span style={taskCountStyle}>{filteredWorkItems.length}</span>
          </div>

          <div style={filterToolbarStyle}>
            <div style={filterButtonWrapStyle}>
              <WorkspaceFilterButton label="All" count={workspaceCounts.all} active={activeFilter === "all"} onClick={() => setActiveFilter("all")} />
              <WorkspaceFilterButton label="My Tasks" count={workspaceCounts.tasks} active={activeFilter === "tasks"} onClick={() => setActiveFilter("tasks")} />
              <WorkspaceFilterButton label="Approvals" count={workspaceCounts.approvals} active={activeFilter === "approvals"} onClick={() => setActiveFilter("approvals")} />
              <WorkspaceFilterButton label="Owned Records" count={workspaceCounts.owned} active={activeFilter === "owned"} onClick={() => setActiveFilter("owned")} />
              <WorkspaceFilterButton label="Overdue" count={workspaceCounts.overdue} active={activeFilter === "overdue"} onClick={() => setActiveFilter("overdue")} />
              <WorkspaceFilterButton label="Due Today" count={workspaceCounts.today} active={activeFilter === "today"} onClick={() => setActiveFilter("today")} />
              <WorkspaceFilterButton label="Due This Week" count={workspaceCounts.week} active={activeFilter === "week"} onClick={() => setActiveFilter("week")} />
            </div>

            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search record, task, part, lot, owner..."
              style={searchInputStyle}
            />
          </div>

          {filteredWorkItems.length === 0 ? (
            <div style={emptyTaskStyle}>
              {workItems.length === 0
                ? "No pending work assigned to you."
                : "No work items match the current filter or search."}
            </div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={taskTableStyle}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>Module</th>
                    <th style={tableHeaderStyle}>Record</th>
                    <th style={tableHeaderStyle}>Task</th>
                    <th style={tableHeaderStyle}>Priority</th>
                    <th style={tableHeaderStyle}>Age</th>
                    <th style={tableHeaderStyle}>Due Date</th>
                    <th style={tableHeaderStyle}>SLA Status</th>
                    <th style={tableHeaderStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkItems.map((task) => {
                    const dueStatus = getDueStatus(task);
                    const priority = getPriority(task);
                    const taskUrl = getTaskUrl(task);

                    return (
                      <tr key={`${task.workspace_item_type}-${task.id}`}>
                        <td style={tableCellStyle}>
                          <span style={modulePillStyle}>
                            {getModuleIcon(task)} {getModuleLabel(task)}
                          </span>
                        </td>
                        <td style={tableCellStyle}>
                          <strong>{getRecordDisplay(task)}</strong>
                        </td>
                        <td style={tableCellStyle}>{getTaskName(task)}</td>
                        <td style={tableCellStyle}>
                          <span style={{ ...priorityBadgeStyle, ...priority.style }}>
                            {priority.icon} {priority.label}
                          </span>
                        </td>
                        <td style={tableCellStyle}>{getAgeLabel(task)}</td>
                        <td style={tableCellStyle}>{formatDueDate(getDueDateValue(task))}</td>
                        <td style={tableCellStyle}>
                          <span style={{
                            ...statusBadgeStyle,
                            background: dueStatus.background,
                            borderColor: dueStatus.border,
                            color: dueStatus.text,
                          }}>
                            {dueStatus.icon} {dueStatus.label}
                          </span>
                        </td>
                        <td style={tableCellStyle}>
                          <div style={actionButtonGroupStyle}>
                            <a href={taskUrl} style={tableOpenLinkStyle}>Open</a>
                            {canReassignItem(task) ? (
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
            <h2 style={{ marginTop: 0 }}>Reassign {getRecordDisplay(reassignTask)}</h2>

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
                    <option key={user} value={user}>{user}</option>
                  ))}
              </select>
            </div>

            <div style={modalActionsStyle}>
              <button type="button" onClick={closeReassignDialog} disabled={reassigning} style={modalSecondaryButtonStyle}>Cancel</button>
              <button type="button" onClick={completeReassignment} disabled={reassigning} style={modalPrimaryButtonStyle}>
                {reassigning ? "Reassigning..." : "Reassign"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

async function fetchOwnedRecordItems(userEmail: string) {
  const configurations: Array<{
    table: string;
    workspaceItemType: WorkspaceItemType;
    entityType: string;
  }> = [
    { table: "capas", workspaceItemType: "owned_capa", entityType: "capa" },
    { table: "ncmrs", workspaceItemType: "owned_ncmr", entityType: "ncmr" },
    { table: "change_controls", workspaceItemType: "owned_change_control", entityType: "change_control" },
    { table: "scars", workspaceItemType: "owned_scar", entityType: "scar" },
    { table: "controlled_documents", workspaceItemType: "owned_document", entityType: "document" },
    { table: "complaints", workspaceItemType: "owned_complaint", entityType: "complaint" },
    { table: "audits", workspaceItemType: "owned_audit", entityType: "audit" },
  ];

  const results = await Promise.all(
    configurations.map(async (configuration) => {
      const { data, error } = await supabase
        .from(configuration.table)
        .select("*")
        .limit(500);

      if (error) {
        console.warn(`Workspace skipped ${configuration.table}:`, error.message);
        return [];
      }

      return (data || [])
        .filter((record: any) => isRecordOwnedByUser(record, userEmail))
        .filter((record: any) =>
          requiresUserAction(record, configuration.workspaceItemType)
        )
        .map((record: any) => ({
          ...record,
          entity_type: configuration.entityType,
          workspace_item_type: configuration.workspaceItemType,
        }));
    })
  );

  return results.flat();
}

async function createWorkspaceNotification(
  recipientEmail: string,
  title: string,
  message: string,
  relatedModule: string,
  relatedRecordId: string
) {
  const { error } = await supabase.from("notifications").insert({
    user_email: recipientEmail,
    notification_type: "assignment",
    title,
    message,
    related_module: relatedModule,
    related_record_id: relatedRecordId,
    read_status: false,
  });

  if (error) {
    console.warn("Unable to create in-app notification:", error.message);
  }
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
              <a href={item.href} style={moduleLinkStyle}>{item.label}</a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function WorkspaceFilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...filterButtonStyle,
        ...(active ? activeFilterButtonStyle : {}),
      }}
    >
      {label} <span style={filterCountStyle}>{count}</span>
    </button>
  );
}

function isRecordOwnedByUser(record: any, userEmail: string) {
  const ownerCandidates = [
    record.owner_email,
    record.owner,
    record.change_owner_email,
    record.change_owner,
    record.document_owner_email,
    record.document_owner,
    record.assigned_to_email,
    record.assigned_owner_email,
    record.initiated_by,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  return ownerCandidates.includes(userEmail.toLowerCase());
}

function normalizeWorkflowStatus(record: any) {
  return String(
    record.status ||
      record.workflow_status ||
      record.review_status ||
      record.document_status ||
      ""
  )
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function requiresUserAction(record: any, itemType: WorkspaceItemType) {
  const status = normalizeWorkflowStatus(record);

  if (itemType === "owned_capa") {
    return shouldShowOwnedCapaWork(record);
  }

  /*
   * Controlled Documents use "release" as the completed released state in
   * the current workflow. Release metadata is also checked because older
   * records may not have a normalized terminal status value.
   */
  if (itemType === "owned_document") {
    const hasReleaseEvidence = Boolean(
      record.released_at ||
        record.release_date ||
        record.effective_at ||
        record.effective_date ||
        record.released_by ||
        record.is_released === true
    );

    if (hasReleaseEvidence) {
      return false;
    }
  }

  const terminalByModule: Partial<Record<WorkspaceItemType, Set<string>>> = {
    owned_ncmr: new Set([
      "closed",
      "cancelled",
      "canceled",
      "completed",
      "obsolete",
    ]),
    owned_change_control: new Set([
      "closed",
      "cancelled",
      "canceled",
      "completed",
      "implemented",
      "obsolete",
    ]),
    owned_scar: new Set([
      "closed",
      "cancelled",
      "canceled",
      "completed",
      "obsolete",
    ]),
    owned_document: new Set([
      "release",
      "released",
      "effective",
      "approved",
      "superseded",
      "obsolete",
      "archived",
      "cancelled",
      "canceled",
      "closed",
      "completed",
    ]),
    owned_complaint: new Set([
      "closed",
      "cancelled",
      "canceled",
      "completed",
      "obsolete",
    ]),
    owned_audit: new Set([
      "closed",
      "cancelled",
      "canceled",
      "completed",
      "finalized",
      "obsolete",
    ]),
  };

  const terminalStatuses = terminalByModule[itemType] || CLOSED_STATUSES;

  if (terminalStatuses.has(status)) {
    return false;
  }

  /*
   * A blank status is kept visible because it usually represents a newly
   * created record that still requires the owner's attention.
   */
  return true;
}

function canReassignItem(item: any) {
  return (
    item.workspace_item_type === "assigned_task" ||
    item.workspace_item_type === "owned_capa"
  );
}

function matchesWorkspaceFilter(item: any, filter: WorkspaceFilter) {
  const dueStatus = getDueStatus(item);

  if (filter === "tasks") return item.workspace_item_type === "assigned_task";
  if (filter === "approvals") return isApprovalTask(item);
  if (filter === "owned") return item.workspace_item_type !== "assigned_task";
  if (filter === "overdue") return dueStatus.category === "overdue";
  if (filter === "today") return dueStatus.category === "today";
  if (filter === "week") return ["today", "soon"].includes(dueStatus.category);
  return true;
}

function isApprovalTask(task: any) {
  if (task.workspace_item_type !== "assigned_task") return false;

  if (isCapaApprovalTask(task) || isNcmrMrbApprovalTask(task)) {
    return true;
  }

  return String(task.task_type || "")
    .trim()
    .toLowerCase()
    .includes("approval");
}

function compareWorkspaceItems(a: any, b: any) {
  const priorityDifference = getSortScore(a) - getSortScore(b);
  if (priorityDifference !== 0) return priorityDifference;

  const dueA = getDueDateValue(a);
  const dueB = getDueDateValue(b);

  if (dueA && dueB) return String(dueA).localeCompare(String(dueB));
  if (dueA) return -1;
  if (dueB) return 1;

  return String(a.created_at || "").localeCompare(String(b.created_at || ""));
}

function getSortScore(item: any) {
  const due = getDueStatus(item);
  const priority = getPriority(item).rank;

  const dueRank: Record<string, number> = {
    overdue: 0,
    today: 10,
    soon: 20,
    future: 30,
    none: 40,
  };

  return (dueRank[due.category] ?? 40) + priority;
}

function getTaskUrl(task: any) {
  if (task.workspace_item_type === "owned_capa") return `/capa/${task.id}`;
  if (task.workspace_item_type === "owned_ncmr") return `/ncmrs/${task.id}`;
  if (task.workspace_item_type === "owned_change_control") return `/change-control/${task.id}`;
  if (task.workspace_item_type === "owned_scar") return `/supplier-quality/scars/${task.id}`;
  if (task.workspace_item_type === "owned_document") return `/documents/${task.id}`;
  if (task.workspace_item_type === "owned_complaint") return `/complaints/${task.id}`;
  if (task.workspace_item_type === "owned_audit") return `/audits/${task.id}`;

  /*
   * Collaboration assignments must open the Collaboration Workspace directly.
   * This check must remain above the normal entity routes so an NCMR
   * collaboration task does not first open the parent NCMR workflow.
   */
  if (isCollaborationTask(task)) {
    return getCollaborationTaskUrl(task);
  }

  if (isCapaApprovalTask(task)) {
    const gate = getCapaGateFromTask(task);
    return `/capa/${task.entity_id}/approval-review?gate=${gate}&taskId=${task.id}`;
  }

  if (isNcmrMrbApprovalTask(task)) {
    return `/ncmrs/${task.entity_id}/approval-review?taskId=${task.id}`;
  }

  if (isNcmrImplementationTask(task)) {
    return `/ncmrs/${task.entity_id}/implementation?taskId=${task.id}`;
  }

  if (isNcmrReworkTask(task)) {
    return `/ncmrs/${task.entity_id}/rework?taskId=${task.id}`;
  }

  if (task.entity_type === "ncmr") return `/ncmrs/${task.entity_id}`;
  if (task.entity_type === "capa") return `/capa/${task.entity_id}`;
  if (task.entity_type === "change_control") return `/change-control/${task.entity_id}`;
  if (task.entity_type === "document") return `/documents/${task.entity_id}`;
  if (task.entity_type === "scar") return `/supplier-quality/scars/${task.entity_id}`;
  if (task.entity_type === "complaint") return `/complaints/${task.entity_id}`;
  if (task.entity_type === "audit") return `/audits/${task.entity_id}`;
  if (task.entity_type === "training") return `/training`;

  return "/";
}

function isCollaborationTask(task: any) {
  return (
    task.workspace_item_type === "assigned_task" &&
    String(task.task_type || "").trim().toLowerCase() === "collaboration_task"
  );
}

function getCollaborationTaskUrl(task: any) {
  const entityId = String(task.entity_id || "").trim();
  const entityType = String(task.entity_type || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (!entityId) return "/";

  if (entityType === "ncmr") return `/ncmrs/${entityId}/collaboration`;
  if (entityType === "capa") return `/capa/${entityId}/collaboration`;
  if (entityType === "change_control") return `/change-control/${entityId}/collaboration`;
  if (entityType === "document" || entityType === "controlled_document") {
    return `/documents/${entityId}/collaboration`;
  }
  if (entityType === "scar") return `/supplier-quality/scars/${entityId}/collaboration`;
  if (entityType === "complaint") return `/complaints/${entityId}/collaboration`;
  if (entityType === "audit") return `/audits/${entityId}/collaboration`;
  if (entityType === "oos_oot" || entityType === "oos" || entityType === "oot") {
    return `/oos-oot/${entityId}/collaboration`;
  }

  return "/";
}

function getRecordDisplay(task: any) {
  const directRecord =
    task.capa_number ||
    task.ncmr_number ||
    task.change_number ||
    task.change_control_number ||
    task.scar_number ||
    task.document_number ||
    task.complaint_number ||
    task.audit_number ||
    task.record_number ||
    task.entity_number;

  if (directRecord) return directRecord;

  const title = String(task.task_title || task.title || "");
  const recordMatch = title.match(
    /\b(CAPA[-\s]?\d+|NCMR[-\s]?\d+|CC[-\s]?\d+|SCAR[-\s]?\d+|AUD[-\s]?\d+|DOC[-\s]?\d+|CMP[-\s]?\d+)\b/i
  );

  if (recordMatch?.[1]) return recordMatch[1].toUpperCase();
  return task.entity_id || task.id || "Record";
}

function getTaskName(task: any) {
  if (task.workspace_item_type === "owned_capa") {
    return getOwnedCapaWorkLabel(task);
  }

  if (task.workspace_item_type !== "assigned_task") {
    return getGenericOwnedWorkLabel(task);
  }

  if (isCapaApprovalTask(task)) {
    return getCapaApprovalLabel(task);
  }

  if (isNcmrMrbApprovalTask(task)) {
    return "MRB Approval";
  }

  if (isNcmrImplementationTask(task)) {
    return String(task.task_type || "").toLowerCase() === "corrective_action_task"
      ? "Corrective Action Implementation"
      : "Correction Implementation";
  }

  if (isNcmrReworkTask(task)) {
    return "Rework Implementation";
  }

  if (task.task_title) {
    return cleanTaskTitle(task.task_title);
  }

  return formatTaskType(task.task_type);
}

function getGenericOwnedWorkLabel(record: any) {
  const module = getModuleLabel(record);
  const status = normalizeWorkflowStatus(record);

  const labelsByModule: Record<string, Record<string, string>> = {
    NCMR: {
      draft: "Complete Initiation",
      open: "Continue NCMR",
      initiated: "Complete Containment",
      containment: "Complete Containment",
      risk_assessment: "Complete Risk Assessment",
      investigation: "Complete Investigation / Root Cause",
      mrb: "Prepare MRB Review",
      pending_mrb_approval: "Awaiting MRB Approval",
      implementation: "Complete Disposition Implementation",
      verification: "Complete Verification",
      closure: "Complete Closure",
    },
    Change: {
      draft: "Complete Change Request",
      open: "Continue Change Control",
      impact_assessment: "Complete Impact Assessment",
      pending_approval: "Awaiting Approval",
      implementation: "Complete Implementation",
      verification: "Complete Verification",
      closure: "Complete Closure",
    },
    SCAR: {
      draft: "Complete SCAR Initiation",
      open: "Continue SCAR",
      supplier_response: "Review Supplier Response",
      corrective_action: "Review Corrective Action",
      effectiveness: "Complete Effectiveness Verification",
      closure: "Complete Closure",
    },
    Document: {
      draft: "Complete Draft",
      collaboration: "Continue Collaboration",
      formal_review: "Prepare Formal Review",
      pending_review: "Awaiting Formal Review",
      rejected: "Revise Document",
      pending_release: "Complete Release",
    },
    Complaint: {
      draft: "Complete Complaint Intake",
      open: "Continue Complaint",
      evaluation: "Complete Evaluation",
      investigation: "Complete Investigation",
      reportability: "Complete Reportability Assessment",
      closure: "Complete Closure",
    },
    Audit: {
      draft: "Complete Audit Plan",
      planned: "Prepare Audit",
      scheduled: "Prepare Audit",
      in_progress: "Continue Audit Execution",
      findings: "Complete Findings",
      corrective_action: "Track Corrective Actions",
      closure: "Complete Audit Closure",
    },
  };

  const mappedLabel = labelsByModule[module]?.[status];
  if (mappedLabel) return mappedLabel;

  const formattedStatus = formatTaskType(status || "active");
  return formattedStatus === "Active"
    ? `Continue ${module} Record`
    : `Continue ${module} — ${formattedStatus}`;
}

function cleanTaskTitle(value: any) {
  return String(value || "Task")
    .replace(/\s+for\s+(CAPA[-\s]?\d+|NCMR[-\s]?\d+|CC[-\s]?\d+|SCAR[-\s]?\d+|AUD[-\s]?\d+|DOC[-\s]?\d+)\b/gi, "")
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

function isNcmrMrbApprovalTask(task: any) {
  return (
    task.workspace_item_type === "assigned_task" &&
    String(task.entity_type || "").trim().toLowerCase() === "ncmr" &&
    ["mrb_approval", "ncmr_mrb_approval", "ncmr_mrb_review"].includes(
      String(task.task_type || "").trim().toLowerCase()
    )
  );
}

function isNcmrImplementationTask(task: any) {
  return (
    task.workspace_item_type === "assigned_task" &&
    String(task.entity_type || "").trim().toLowerCase() === "ncmr" &&
    ["correction_task", "corrective_action_task"].includes(
      String(task.task_type || "").trim().toLowerCase()
    )
  );
}

function isNcmrReworkTask(task: any) {
  return (
    task.workspace_item_type === "assigned_task" &&
    String(task.entity_type || "").trim().toLowerCase() === "ncmr" &&
    String(task.task_type || "").trim().toLowerCase() === "rework_task"
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

function shouldShowOwnedCapaWork(capa: any) {
  const status = String(capa.status || "").toLowerCase();
  if (status === "closed" || status === "cancelled") return false;

  const approvalPending = status.includes("pending") && status.includes("approval");
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
  if (!capa.initiation_approval_status || capa.initiation_approval_status === "not_submitted") return "Complete Initiation";
  if (capa.initiation_approval_status === "rejected") return "Revise Initiation";
  if (capa.initiation_approval_status === "approved" && !capa.investigation_approval_status) return "Complete Evaluation / Investigation";
  if (capa.investigation_approval_status === "rejected") return "Revise Investigation";
  if (capa.investigation_approval_status === "approved" && !capa.action_plan_approval_status) return "Complete Action Plan Proposal";
  if (capa.action_plan_approval_status === "rejected") return "Revise Action Plan";

  if (capa.action_plan_approval_status === "approved" && !capa.implemented_by) {
    const status = String(capa.status || "").toLowerCase();
    if (status === "implementation") return "Complete Implementation";
    return "Continue CAPA";
  }

  if (capa.implemented_by && capa.effectiveness_plan_approval_status !== "approved") return "Complete / Submit Effectiveness Plan";
  if (capa.implemented_by && capa.effectiveness_plan_approval_status === "approved" && !capa.effectiveness_verified_by && !capa.effectiveness_rating) return "Complete Effectiveness Verification";
  if (capa.effectiveness_rating && !capa.closure_approval_status) return "Submit Closure";
  if (capa.closure_approval_status === "rejected") return "Revise Closure";
  return "Continue CAPA";
}

function getModuleLabel(task: any) {
  const type = String(task.entity_type || task.workspace_item_type || "").toLowerCase();
  if (type.includes("ncmr")) return "NCMR";
  if (type.includes("capa")) return "CAPA";
  if (type.includes("change")) return "Change";
  if (type.includes("scar")) return "SCAR";
  if (type.includes("document")) return "Document";
  if (type.includes("training")) return "Training";
  if (type.includes("complaint")) return "Complaint";
  if (type.includes("audit")) return "Audit";
  return "Quality";
}

function getModuleIcon(task: any) {
  const label = getModuleLabel(task);
  if (label === "NCMR") return "⚠️";
  if (label === "CAPA") return "🛠️";
  if (label === "Change") return "🔄";
  if (label === "SCAR") return "🏭";
  if (label === "Document") return "📄";
  if (label === "Training") return "🎓";
  if (label === "Complaint") return "📣";
  if (label === "Audit") return "🔎";
  return "📌";
}

function getPriority(task: any) {
  const rawPriority = String(task.priority || task.task_priority || "").toLowerCase();
  const severity = String(task.severity || task.risk_level || "").toLowerCase();
  const dueStatus = getDueStatus(task);

  let label = "Medium";
  let icon = "🟡";
  let rank = 2;
  let style: React.CSSProperties = {
    background: "#fffbeb",
    borderColor: "#fde68a",
    color: "#92400e",
  };

  if (rawPriority.includes("critical") || severity.includes("critical")) {
    label = "Critical";
    icon = "🔴";
    rank = 0;
    style = { background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" };
  } else if (rawPriority.includes("high") || severity.includes("major") || dueStatus.category === "overdue") {
    label = "High";
    icon = "🟠";
    rank = 1;
    style = { background: "#fff7ed", borderColor: "#fed7aa", color: "#9a3412" };
  } else if (rawPriority.includes("low") || severity.includes("minor")) {
    label = "Low";
    icon = "🟢";
    rank = 3;
    style = { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" };
  }

  return { label, icon, rank, style };
}

function getDueDateValue(task: any) {
  return (
    task.due_date ||
    task.action_due_date ||
    task.effectiveness_due_date ||
    task.response_due_date ||
    task.target_completion_date ||
    task.required_completion_date ||
    null
  );
}

function getDueStatus(task: any) {
  const dueDateValue = getDueDateValue(task);

  if (!dueDateValue) {
    return {
      category: "none",
      label: "No due date",
      icon: "⚪",
      background: "#f8fafc",
      border: "#cbd5e1",
      text: "#475569",
    };
  }

  const today = new Date();
  const dueDate = new Date(`${String(dueDateValue).slice(0, 10)}T23:59:59`);
  today.setHours(0, 0, 0, 0);

  const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);

  if (daysRemaining < 0) {
    return { category: "overdue", label: `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} overdue`, icon: "🔴", background: "#fef2f2", border: "#fecaca", text: "#991b1b" };
  }

  if (daysRemaining === 0) {
    return { category: "today", label: "Due today", icon: "🟡", background: "#fffbeb", border: "#fde68a", text: "#92400e" };
  }

  if (daysRemaining <= 7) {
    return { category: "soon", label: `Due in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`, icon: "🟡", background: "#fffbeb", border: "#fde68a", text: "#92400e" };
  }

  return { category: "future", label: `Due in ${daysRemaining} days`, icon: "🟢", background: "#f0fdf4", border: "#bbf7d0", text: "#166534" };
}

function getAgeLabel(task: any) {
  const createdAt = task.created_at || task.initiated_at || task.opened_at;
  if (!createdAt) return "N/A";

  const createdDate = new Date(createdAt);
  const today = new Date();
  createdDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const ageDays = Math.max(0, Math.floor((today.getTime() - createdDate.getTime()) / 86400000));
  return `${ageDays} day${ageDays === 1 ? "" : "s"}`;
}

function normalizeRole(value: any) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function formatTaskType(value: any) {
  return String(value || "task")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDueDate(value: any) {
  if (!value) return "N/A";
  return String(value).slice(0, 10);
}

function formatDateTime(value: any) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

const pageStyle: React.CSSProperties = { minHeight: "100vh", padding: "24px", fontFamily: "Arial, sans-serif", background: "#f8fafc", color: "#0f172a" };
const publicPageStyle: React.CSSProperties = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "Arial, sans-serif", background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f8fafc 100%)" };
const publicCardStyle: React.CSSProperties = { maxWidth: "780px", background: "rgba(255,255,255,0.86)", border: "1px solid #dbeafe", borderRadius: "28px", padding: "44px", textAlign: "center", boxShadow: "0 24px 70px rgba(15, 23, 42, 0.12)" };
const publicTitleStyle: React.CSSProperties = { fontSize: "64px", lineHeight: 1, margin: "12px 0", letterSpacing: "-0.05em" };
const publicSubtitleStyle: React.CSSProperties = { color: "#334155", fontSize: "21px", lineHeight: "32px" };
const publicActionRowStyle: React.CSSProperties = { display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap", marginTop: "18px" };
const loginButtonStyle: React.CSSProperties = { display: "inline-block", background: "#111827", color: "white", padding: "12px 24px", borderRadius: "999px", textDecoration: "none", fontWeight: 900 };
const signupButtonStyle: React.CSSProperties = { display: "inline-block", background: "#ffffff", color: "#111827", border: "1px solid #cbd5e1", padding: "12px 24px", borderRadius: "999px", textDecoration: "none", fontWeight: 900 };
const homeHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "22px" };
const headerActionRowStyle: React.CSSProperties = { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" };
const eyebrowStyle: React.CSSProperties = { color: "#2563eb", fontSize: "12px", fontWeight: 900, letterSpacing: "0.14em" };
const lastUpdatedStyle: React.CSSProperties = { margin: "6px 0 0", color: "#94a3b8", fontSize: "12px" };
const notificationButtonStyle: React.CSSProperties = { position: "relative", display: "inline-flex", alignItems: "center", gap: "8px", background: "#ffffff", color: "#1e3a8a", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "10px 14px", textDecoration: "none", fontWeight: 900 };
const notificationBadgeStyle: React.CSSProperties = { minWidth: "22px", height: "22px", borderRadius: "999px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#dc2626", color: "#ffffff", fontSize: "12px", padding: "0 5px" };
const refreshButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", border: "none", borderRadius: "10px", padding: "10px 14px", fontWeight: 900, cursor: "pointer" };
const workspaceGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)", gap: "22px", alignItems: "start" };
const leftPanelStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "18px", padding: "18px", boxShadow: "0 10px 28px rgba(15,23,42,0.06)" };
const rightPanelStyle: React.CSSProperties = { minWidth: 0, background: "white", border: "1px solid #d1d5db", borderRadius: "18px", padding: "18px", boxShadow: "0 10px 28px rgba(15,23,42,0.06)" };
const rightPanelHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "center", marginBottom: "12px" };
const panelTitleStyle: React.CSSProperties = { margin: "0 0 8px 0" };
const panelSubtitleStyle: React.CSSProperties = { margin: 0, color: "#64748b", fontSize: "14px" };
const taskCountStyle: React.CSSProperties = { background: "#2563eb", color: "white", borderRadius: "999px", minWidth: "34px", height: "34px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900 };
const moduleGroupStyle: React.CSSProperties = { borderTop: "1px solid #e5e7eb", paddingTop: "12px", marginTop: "12px" };
const moduleHeaderButtonStyle: React.CSSProperties = { width: "100%", background: "transparent", border: "none", padding: 0, textAlign: "left", fontSize: "16px", fontWeight: 900, cursor: "pointer", color: "#111827" };
const moduleListStyle: React.CSSProperties = { margin: "10px 0 0 22px", padding: 0, display: "grid", gap: "8px" };
const moduleListItemStyle: React.CSSProperties = { paddingLeft: "4px" };
const moduleLinkStyle: React.CSSProperties = { color: "#1f2937", textDecoration: "none", fontWeight: 700 };
const filterToolbarStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "14px" };
const filterButtonWrapStyle: React.CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap" };
const filterButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", background: "#ffffff", color: "#334155", borderRadius: "999px", padding: "7px 11px", fontWeight: 800, cursor: "pointer" };
const activeFilterButtonStyle: React.CSSProperties = { background: "#eff6ff", color: "#1d4ed8", borderColor: "#93c5fd" };
const filterCountStyle: React.CSSProperties = { marginLeft: "4px", fontSize: "12px", opacity: 0.8 };
const searchInputStyle: React.CSSProperties = { flex: "1 1 280px", maxWidth: "420px", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "9px 11px" };
const emptyTaskStyle: React.CSSProperties = { border: "1px dashed #cbd5e1", borderRadius: "12px", padding: "18px", color: "#64748b" };
const tableWrapStyle: React.CSSProperties = { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "14px" };
const taskTableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", background: "#ffffff", fontSize: "14px", minWidth: "1120px" };
const tableHeaderStyle: React.CSSProperties = { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #d1d5db", background: "#f8fafc", fontWeight: 900, color: "#111827", whiteSpace: "nowrap" };
const tableCellStyle: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #e5e7eb", verticalAlign: "middle" };
const modulePillStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: "5px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "999px", padding: "5px 8px", fontWeight: 800, whiteSpace: "nowrap" };
const priorityBadgeStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", border: "1px solid", borderRadius: "999px", padding: "5px 9px", fontWeight: 900, whiteSpace: "nowrap" };
const statusBadgeStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", border: "1px solid", borderRadius: "999px", padding: "5px 9px", fontWeight: 900, whiteSpace: "nowrap" };
const tableOpenLinkStyle: React.CSSProperties = { display: "inline-block", background: "#2563eb", color: "#ffffff", borderRadius: "8px", padding: "6px 10px", textDecoration: "none", fontWeight: 900 };
const actionButtonGroupStyle: React.CSSProperties = { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" };
const tableReassignButtonStyle: React.CSSProperties = { background: "#ffffff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "6px 10px", fontWeight: 900, cursor: "pointer" };
const modalOverlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 50 };
const modalCardStyle: React.CSSProperties = { width: "100%", maxWidth: "520px", background: "#ffffff", borderRadius: "18px", border: "1px solid #d1d5db", padding: "22px", boxShadow: "0 24px 80px rgba(15, 23, 42, 0.25)" };
const modalFieldStyle: React.CSSProperties = { marginBottom: "14px" };
const modalLabelStyle: React.CSSProperties = { display: "block", fontWeight: 900, marginBottom: "6px" };
const readOnlyValueStyle: React.CSSProperties = { border: "1px solid #e5e7eb", background: "#f8fafc", borderRadius: "10px", padding: "10px", fontWeight: 800 };
const modalInputStyle: React.CSSProperties = { width: "100%", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "10px", boxSizing: "border-box" };
const modalActionsStyle: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" };
const modalSecondaryButtonStyle: React.CSSProperties = { border: "1px solid #d1d5db", background: "#ffffff", borderRadius: "10px", padding: "9px 14px", fontWeight: 900, cursor: "pointer" };
const modalPrimaryButtonStyle: React.CSSProperties = { border: "none", background: "#2563eb", color: "#ffffff", borderRadius: "10px", padding: "9px 14px", fontWeight: 900, cursor: "pointer" };
