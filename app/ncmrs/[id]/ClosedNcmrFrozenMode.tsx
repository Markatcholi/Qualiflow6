"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Props = { ncmrId: string };

type FreezeRow = {
  structure_json: any;
  frozen_values: any;
  frozen_at: string;
};

export default function ClosedNcmrFrozenMode({ ncmrId }: Props) {
  const [record, setRecord] = useState<any>(null);
  const [freeze, setFreeze] = useState<FreezeRow | null>(null);
  const [affectedItems, setAffectedItems] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, [ncmrId]);

  async function load() {
    setLoading(true);
    setError("");

    const [recordResult, freezeResult, itemsResult, tasksResult, auditResult] =
      await Promise.all([
        supabase.from("ncmrs").select("*").eq("id", ncmrId).maybeSingle(),
        supabase
          .from("qms_record_structure_freezes")
          .select("structure_json,frozen_values,frozen_at")
          .eq("module_code", "NCMR")
          .eq("record_id", ncmrId)
          .maybeSingle(),
        supabase
          .from("ncmr_affected_items")
          .select("*")
          .eq("ncmr_id", ncmrId)
          .order("created_at", { ascending: true }),
        supabase
          .from("approval_tasks")
          .select("*")
          .eq("entity_type", "ncmr")
          .eq("entity_id", ncmrId)
          .order("created_at", { ascending: true }),
        supabase
          .from("audit_logs")
          .select("*")
          .eq("entity_type", "ncmr")
          .eq("entity_id", ncmrId)
          .order("created_at", { ascending: true }),
      ]);

    const firstError =
      recordResult.error ||
      freezeResult.error ||
      itemsResult.error ||
      tasksResult.error ||
      auditResult.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    if (!recordResult.data) {
      setError("NCMR record not found.");
      setLoading(false);
      return;
    }

    if (!freezeResult.data) {
      setError(
        "This closed NCMR does not have a frozen record structure. Closed record presentation is blocked to prevent accidental rendering through the current live workflow."
      );
      setLoading(false);
      return;
    }

    setRecord(recordResult.data);
    setFreeze(freezeResult.data as FreezeRow);
    setAffectedItems(itemsResult.data || []);
    setTasks(tasksResult.data || []);
    setAudit(auditResult.data || []);
    setLoading(false);
  }

  const sections = useMemo(() => {
    const raw = freeze?.structure_json?.sections;
    return Array.isArray(raw) ? raw : [];
  }, [freeze]);

  if (loading) {
    return <main style={page}>Loading frozen NCMR record...</main>;
  }

  if (error || !record || !freeze) {
    return (
      <main style={page}>
        <h1>Closed NCMR Record</h1>
        <div style={errorBox}>{error || "Unable to load frozen record."}</div>
        <Link href="/ncmrs" style={buttonLink}>Return to NCMR</Link>
      </main>
    );
  }

  return (
    <main style={page}>
      <header style={header}>
        <div>
          <div style={eyebrow}>QUALISPHERE CONTROLLED QUALITY RECORD</div>
          <h1 style={{ margin: "6px 0" }}>{record.ncmr_number || "NCMR"}</h1>
          <div style={muted}>
            Closed record · Frozen in place · Original NCMR database record
          </div>
        </div>
        <div style={actions}>
          <button
            type="button"
            onClick={() => window.open(`/ncmrs/${ncmrId}/report`, "_blank")}
            style={reportButton}
          >
            NCMR Report
          </button>
          <Link href="/ncmrs" style={buttonLink}>Return to NCMR</Link>
        </div>
      </header>

      <div style={protectionBox}>
        <strong>Closed Record Mode.</strong> This is the original NCMR record.
        Its database content is locked, and its presentation is controlled by
        the structure frozen for this record at closure. The current live NCMR
        workflow is not used to determine which sections or fields appear here.
      </div>

      <div style={summaryGrid}>
        <Summary label="NCMR Number" value={record.ncmr_number} />
        <Summary label="Status" value={formatLabel(record.status)} />
        <Summary label="Owner" value={record.owner} />
        <Summary label="Closed By" value={record.ncmr_closed_by || record.closed_by} />
        <Summary label="Closed At" value={formatDateTime(record.closed_at || record.closure_date)} />
        <Summary label="Structure Frozen At" value={formatDateTime(freeze.frozen_at)} />
      </div>

      {sections.map((section: any, sectionIndex: number) => (
        <section key={section.key || sectionIndex} style={sectionCard}>
          <h2 style={{ marginTop: 0 }}>{section.title || section.key}</h2>

          <div style={fieldGrid}>
            {(Array.isArray(section.elements) ? section.elements : []).map(
              (element: any, elementIndex: number) => (
                <FrozenElement
                  key={`${section.key || sectionIndex}-${element.key || element.view || elementIndex}`}
                  element={element}
                  record={record}
                  frozenValues={freeze.frozen_values || {}}
                  affectedItems={affectedItems}
                  tasks={tasks}
                  audit={audit}
                />
              )
            )}
          </div>
        </section>
      ))}

      <div style={footerBox}>
        <strong>Record Integrity:</strong> This closed record renderer performs
        no CAPA, SCAR, risk, MRB, disposition, or workflow recalculation. Future
        workflow changes do not add fields to this record unless those fields
        were part of its frozen structure.
      </div>
    </main>
  );
}

function FrozenElement({
  element,
  record,
  frozenValues,
  affectedItems,
  tasks,
  audit,
}: any) {
  const label = element.label || element.key || element.view || "Record Data";

  if (element.type === "field") {
    let value = record?.[element.key];
    if (!hasValue(value) && element.fallback_key) {
      value = record?.[element.fallback_key];
    }
    return (
      <Field
        label={label}
        value={formatByType(value, element.format)}
        wide={element.wide !== false}
      />
    );
  }

  if (element.type === "frozen_value") {
    return (
      <Field
        label={label}
        value={frozenValues?.[element.key]}
        wide={element.wide !== false}
      />
    );
  }

  if (element.type === "table" && element.source === "affected_items") {
    return (
      <div style={wide}>
        <h3>{label}</h3>
        <AffectedItemsTable items={affectedItems} view={element.view} />
      </div>
    );
  }

  if (element.type === "task_table") {
    const allowed = Array.isArray(element.task_types) ? element.task_types : [];
    const filtered = tasks.filter((task: any) =>
      allowed.includes(String(task.task_type || "").toLowerCase())
    );
    return (
      <div style={wide}>
        <h3>{label}</h3>
        <TaskTable tasks={filtered} detailed={Boolean(element.detailed)} />
      </div>
    );
  }

  if (element.type === "audit_table") {
    return (
      <div style={wide}>
        <h3>{label}</h3>
        <AuditTable rows={audit} />
      </div>
    );
  }

  return null;
}

function AffectedItemsTable({ items, view }: { items: any[]; view: string }) {
  if (!items.length) return <div style={muted}>No affected items recorded.</div>;

  const columns =
    view === "disposition"
      ? [
          ["product_part_number", "Part Number"],
          ["lot_number", "Lot Number"],
          ["product_disposition", "Disposition"],
          ["quantity_accepted", "MRB Qty Accepted"],
          ["quantity_rejected", "MRB Qty Rejected"],
          ["disposition_justification", "Justification"],
        ]
      : view === "disposition_implementation"
        ? [
            ["product_part_number", "Part Number"],
            ["lot_number", "Lot Number"],
            ["disposition_implementation_status", "Implementation Status"],
            ["final_quantity_accepted", "Final Qty Accepted"],
            ["final_quantity_rejected", "Final Qty Rejected"],
            ["discrepancy_quantity", "Discrepancy Qty"],
            ["discrepancy_rationale", "Discrepancy Rationale"],
            ["disposition_implemented_by", "Implemented By"],
            ["disposition_implemented_at", "Implemented At"],
          ]
        : [
            ["product_part_number", "Part Number"],
            ["part_description", "Part Description"],
            ["part_revision", "Revision"],
            ["lot_number", "Lot Number"],
            ["workorder_number", "Work Order"],
            ["quantity_affected", "Quantity Affected"],
            ["quarantined_quantity", "Quantity Quarantined"],
            ["defect_category", "Defect Category"],
            ["defect_subcategory", "Defect Subcategory"],
          ];

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={table}>
        <thead>
          <tr>{columns.map(([, label]) => <th key={label} style={th}>{label}</th>)}</tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id || index}>
              {columns.map(([key]) => (
                <td key={key} style={td}>
                  {key.endsWith("_at")
                    ? formatDateTime(item[key])
                    : key.includes("disposition") || key.includes("category")
                      ? display(formatLabel(item[key]))
                      : display(item[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskTable({ tasks, detailed }: { tasks: any[]; detailed: boolean }) {
  if (!tasks.length) return <div style={muted}>No matching task records.</div>;

  return (
    <div style={{ display: "grid", gap: "10px" }}>
      {tasks.map((task, index) => (
        <div key={task.id || index} style={nested}>
          <strong>{display(task.task_title || formatLabel(task.task_type))}</strong>
          <div style={taskGrid}>
            <Mini label="Assigned To" value={task.assigned_to_email || task.approver_email} />
            <Mini label="Status" value={formatLabel(task.status)} />
            <Mini label="Due Date" value={formatDate(task.due_date)} />
            <Mini label="Completed By" value={task.completed_by_email || task.completed_by || task.approved_by} />
            <Mini label="Completed At" value={formatDateTime(task.completed_at || task.approved_at)} />
            {detailed ? <Mini label="Instructions" value={task.task_instructions || task.comments} /> : null}
            {detailed ? <Mini label="Completion Comment" value={task.completion_comment || task.completion_notes} /> : null}
            {detailed ? <Mini label="Verification Status" value={formatLabel(task.implementation_verification_status)} /> : null}
            {detailed ? <Mini label="Verification Comment" value={task.implementation_verification_comment} /> : null}
            {detailed ? <Mini label="Verified By" value={task.implementation_verified_by} /> : null}
            {detailed ? <Mini label="Verified At" value={formatDateTime(task.implementation_verified_at)} /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <div style={muted}>No audit history recorded.</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Date / Time</th>
            <th style={th}>Action</th>
            <th style={th}>User</th>
            <th style={th}>Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index}>
              <td style={td}>{formatDateTime(row.created_at)}</td>
              <td style={td}>{display(formatLabel(row.action))}</td>
              <td style={td}>{display(row.user_email)}</td>
              <td style={td}>{display(row.details)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, value, wide: isWide }: any) {
  return (
    <div style={{ ...fieldBox, ...(isWide ? wide : {}) }}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{display(value)}</div>
    </div>
  );
}

function Summary({ label, value }: any) {
  return (
    <div style={summaryCard}>
      <div style={labelStyle}>{label}</div>
      <div style={{ marginTop: 5, fontWeight: 800 }}>{display(value)}</div>
    </div>
  );
}

function Mini({ label, value }: any) {
  return (
    <div>
      <span style={{ fontWeight: 700 }}>{label}: </span>
      {display(value)}
    </div>
  );
}

function hasValue(value: any) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function display(value: any) {
  return hasValue(value) ? String(value) : "Not recorded";
}

function formatLabel(value: any) {
  if (!hasValue(value)) return "";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatByType(value: any, type?: string) {
  if (type === "label") return formatLabel(value);
  if (type === "date") return formatDate(value);
  if (type === "datetime") return formatDateTime(value);
  if (type === "boolean") {
    if (value === true) return "Yes";
    if (value === false) return "No";
  }
  return value;
}

function formatDate(value: any) {
  if (!hasValue(value)) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

function formatDateTime(value: any) {
  if (!hasValue(value)) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  background: "#f8fafc",
  fontFamily: "Arial, sans-serif",
};
const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 16,
};
const eyebrow: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: ".08em",
};
const muted: React.CSSProperties = { color: "#64748b" };
const actions: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };
const buttonLink: React.CSSProperties = {
  textDecoration: "none",
  padding: "10px 14px",
  background: "#111827",
  color: "white",
  borderRadius: 8,
  fontWeight: 700,
};
const reportButton: React.CSSProperties = {
  border: 0,
  padding: "10px 14px",
  background: "#2563eb",
  color: "white",
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
};
const protectionBox: React.CSSProperties = {
  padding: 14,
  border: "1px solid #86efac",
  background: "#f0fdf4",
  borderRadius: 10,
  marginBottom: 16,
};
const errorBox: React.CSSProperties = {
  padding: 14,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  borderRadius: 10,
  marginBottom: 16,
};
const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 10,
  marginBottom: 16,
};
const summaryCard: React.CSSProperties = {
  padding: 12,
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 9,
};
const sectionCard: React.CSSProperties = {
  padding: 18,
  background: "white",
  border: "1px solid #dbe3ec",
  borderRadius: 12,
  marginBottom: 14,
};
const fieldGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 10,
};
const fieldBox: React.CSSProperties = {
  padding: 11,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
};
const wide: React.CSSProperties = { gridColumn: "1 / -1" };
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  fontWeight: 800,
  textTransform: "uppercase",
};
const valueStyle: React.CSSProperties = {
  marginTop: 5,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
};
const nested: React.CSSProperties = {
  padding: 12,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
};
const taskGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 8,
  marginTop: 8,
};
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const th: React.CSSProperties = {
  textAlign: "left",
  padding: 9,
  borderBottom: "1px solid #cbd5e1",
  background: "#f8fafc",
};
const td: React.CSSProperties = {
  padding: 9,
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top",
};
const footerBox: React.CSSProperties = {
  ...protectionBox,
  marginTop: 18,
};
