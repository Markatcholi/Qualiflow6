"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type WorkflowVersion = {
  id: string;
  module_code: string;
  version_code: string;
  version_name: string | null;
  status: string | null;
  effective_at: string | null;
  activated_at: string | null;
  created_at: string | null;
  change_description: string | null;
  change_justification: string | null;
  planned_release_date: string | null;
  released_by: string | null;
  released_at: string | null;
  release_notes: string | null;
  migration_required: boolean | null;
  legacy_protection_required: boolean | null;
};

type NcmrImpactRow = {
  workflow_version_code: string | null;
  status: string | null;
};

type ReleaseEvent = {
  id: string;
  module_code: string;
  version_code: string;
  event_type: string;
  event_status: string;
  previous_version_code: string | null;
  open_record_count: number | null;
  migrated_record_count: number | null;
  legacy_record_count: number | null;
  blocked_record_count: number | null;
  performed_by: string | null;
  performed_at: string | null;
};

export default function ModuleReleaseManagementPage() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [ncmrRows, setNcmrRows] = useState<NcmrImpactRow[]>([]);
  const [events, setEvents] = useState<ReleaseEvent[]>([]);
  const [moduleFilter, setModuleFilter] = useState("NCMR");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw new Error(userError.message);

      const email = userData?.user?.email || "";
      setUserEmail(email);

      const [roleRes, versionRes, ncmrRes, eventsRes] = await Promise.all([
        email
          ? supabase
              .from("user_roles")
              .select("role")
              .eq("user_email", email)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        supabase
          .from("qms_workflow_versions")
          .select(
            "id,module_code,version_code,version_name,status,effective_at,activated_at,created_at,change_description,change_justification,planned_release_date,released_by,released_at,release_notes,migration_required,legacy_protection_required"
          )
          .order("module_code")
          .order("created_at", { ascending: false }),
        supabase
          .from("ncmrs")
          .select("workflow_version_code,status"),
        supabase
          .from("qms_module_release_events")
          .select(
            "id,module_code,version_code,event_type,event_status,previous_version_code,open_record_count,migrated_record_count,legacy_record_count,blocked_record_count,performed_by,performed_at"
          )
          .order("performed_at", { ascending: false })
          .limit(50),
      ]);

      if (roleRes.error) throw new Error(roleRes.error.message);
      if (versionRes.error) throw new Error(versionRes.error.message);
      if (ncmrRes.error) throw new Error(ncmrRes.error.message);
      if (eventsRes.error) throw new Error(eventsRes.error.message);

      setUserRole(roleRes.data?.role || "");
      setVersions((versionRes.data as WorkflowVersion[]) || []);
      setNcmrRows((ncmrRes.data as NcmrImpactRow[]) || []);
      setEvents((eventsRes.data as ReleaseEvent[]) || []);
    } catch (error: any) {
      alert(error?.message || "Unable to load Module Release Management.");
    } finally {
      setLoading(false);
    }
  };

  const canView =
    userRole?.includes("approver") ||
    userRole?.includes("vp_quality") ||
    userRole === "admin" ||
    userRole === "administrator";

  const modules = useMemo(() => {
    const values = Array.from(
      new Set(versions.map((item) => item.module_code).filter(Boolean))
    );
    return values.length > 0 ? values : ["NCMR"];
  }, [versions]);

  const filteredVersions = versions.filter(
    (item) => item.module_code === moduleFilter
  );

  const activeVersion =
    filteredVersions.find(
      (item) => String(item.status || "").toLowerCase() === "active"
    ) || null;

  const ncmrImpact = useMemo(() => {
    if (moduleFilter !== "NCMR") {
      return {
        onboarded: false,
        total: 0,
        open: 0,
        closed: 0,
        openByVersion: {} as Record<string, number>,
        closedByVersion: {} as Record<string, number>,
      };
    }

    const openByVersion: Record<string, number> = {};
    const closedByVersion: Record<string, number> = {};
    let open = 0;
    let closed = 0;

    ncmrRows.forEach((row) => {
      const version = row.workflow_version_code || "UNSTAMPED";
      const isClosed = String(row.status || "").toLowerCase() === "closed";

      if (isClosed) {
        closed += 1;
        closedByVersion[version] = (closedByVersion[version] || 0) + 1;
      } else {
        open += 1;
        openByVersion[version] = (openByVersion[version] || 0) + 1;
      }
    });

    return {
      onboarded: true,
      total: open + closed,
      open,
      closed,
      openByVersion,
      closedByVersion,
    };
  }, [moduleFilter, ncmrRows]);

  const moduleEvents = events.filter((item) => item.module_code === moduleFilter);

  if (loading) {
    return <main style={pageStyle}>Loading Module Release Management...</main>;
  }

  if (!canView) {
    return (
      <main style={pageStyle}>
        <h1>Access Denied</h1>
        <p>
          Only authorized Quality or System Administration roles can access
          Module Release Management.
        </p>
        <p><strong>Logged-in Email:</strong> {userEmail || "none"}</p>
        <p><strong>Your Role:</strong> {userRole || "none"}</p>
        <Link href="/admin/master-data">Return to Admin Master Data</Link>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE ENTERPRISE RELEASE GOVERNANCE</div>
          <h1 style={{ margin: "6px 0" }}>Module Release Management</h1>
          <p style={subtleText}>
            Phase 2 visibility layer. Review controlled module releases,
            migration impact, and legacy-record populations. Release activation
            and automatic migration are intentionally disabled in this phase.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <Link href="/admin/master-data" style={secondaryLinkStyle}>
            Admin Master Data
          </Link>
          <Link href="/dashboard" style={darkLinkStyle}>
            Dashboard
          </Link>
        </div>
      </header>

      <section style={noticeStyle}>
        <strong>Design-freeze protection:</strong> This page does not modify the
        NCMR workflow or NCMR landing page. It is currently read-only and cannot
        activate releases or migrate records.
      </section>

      <section style={cardStyle}>
        <div style={fieldRowStyle}>
          <div>
            <label style={labelStyle}>Module</label>
            <select
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value)}
              style={selectStyle}
            >
              {modules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={labelStyle}>Current Active Release</div>
            <div style={valueStyle}>
              {activeVersion?.version_code || "No active release"}
            </div>
          </div>

          <div>
            <div style={labelStyle}>Release Status</div>
            <StatusPill value={activeVersion?.status || "none"} />
          </div>
        </div>
      </section>

      <section style={kpiGridStyle}>
        <KpiCard title="Total Records" value={ncmrImpact.onboarded ? ncmrImpact.total : "—"} />
        <KpiCard title="Open / Migration Eligible" value={ncmrImpact.onboarded ? ncmrImpact.open : "—"} />
        <KpiCard title="Closed / Legacy Protected" value={ncmrImpact.onboarded ? ncmrImpact.closed : "—"} />
        <KpiCard title="Release Events" value={moduleEvents.length} />
      </section>

      {!ncmrImpact.onboarded ? (
        <section style={noticeStyle}>
          <strong>{moduleFilter}</strong> is present in the release registry but
          has not yet been onboarded to record-impact analysis. NCMR is the
          first adopter.
        </section>
      ) : (
        <section style={twoColumnStyle}>
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Open Records by Version</h2>
            <p style={subtleText}>
              These records would be candidates for controlled migration when a
              future module release is activated.
            </p>
            <ImpactTable rows={ncmrImpact.openByVersion} emptyLabel="No open records." />
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Closed Legacy Records by Version</h2>
            <p style={subtleText}>
              These records must remain permanently associated with the release
              under which they closed.
            </p>
            <ImpactTable rows={ncmrImpact.closedByVersion} emptyLabel="No closed records." />
          </div>
        </section>
      )}

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>{moduleFilter} Release Registry</h2>

        {filteredVersions.length === 0 ? (
          <p>No release records found for this module.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Version</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Effective</th>
                  <th style={thStyle}>Activated</th>
                  <th style={thStyle}>Migration</th>
                  <th style={thStyle}>Legacy Protection</th>
                  <th style={thStyle}>Change Description</th>
                  <th style={thStyle}>Justification</th>
                </tr>
              </thead>
              <tbody>
                {filteredVersions.map((version) => (
                  <tr key={version.id}>
                    <td style={tdStyle}><strong>{version.version_code}</strong></td>
                    <td style={tdStyle}>{version.version_name || "N/A"}</td>
                    <td style={tdStyle}><StatusPill value={version.status || "unknown"} /></td>
                    <td style={tdStyle}>{formatDate(version.effective_at)}</td>
                    <td style={tdStyle}>{formatDateTime(version.activated_at)}</td>
                    <td style={tdStyle}>{version.migration_required ? "Required" : "Not Required"}</td>
                    <td style={tdStyle}>{version.legacy_protection_required === false ? "No" : "Yes"}</td>
                    <td style={tdStyle}>{version.change_description || "Not documented"}</td>
                    <td style={tdStyle}>{version.change_justification || "Not documented"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Release Event History</h2>

        {moduleEvents.length === 0 ? (
          <p style={subtleText}>
            No Module Release Management events have been recorded yet. This is
            expected before controlled activation is implemented.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>When</th>
                  <th style={thStyle}>Version</th>
                  <th style={thStyle}>Event</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Open</th>
                  <th style={thStyle}>Migrated</th>
                  <th style={thStyle}>Legacy</th>
                  <th style={thStyle}>Blocked</th>
                  <th style={thStyle}>Performed By</th>
                </tr>
              </thead>
              <tbody>
                {moduleEvents.map((event) => (
                  <tr key={event.id}>
                    <td style={tdStyle}>{formatDateTime(event.performed_at)}</td>
                    <td style={tdStyle}>{event.version_code}</td>
                    <td style={tdStyle}>{formatLabel(event.event_type)}</td>
                    <td style={tdStyle}>{formatLabel(event.event_status)}</td>
                    <td style={tdStyle}>{event.open_record_count ?? 0}</td>
                    <td style={tdStyle}>{event.migrated_record_count ?? 0}</td>
                    <td style={tdStyle}>{event.legacy_record_count ?? 0}</td>
                    <td style={tdStyle}>{event.blocked_record_count ?? 0}</td>
                    <td style={tdStyle}>{event.performed_by || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function ImpactTable({
  rows,
  emptyLabel,
}: {
  rows: Record<string, number>;
  emptyLabel: string;
}) {
  const entries = Object.entries(rows).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    return <p style={subtleText}>{emptyLabel}</p>;
  }

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Module Version</th>
          <th style={thStyle}>Record Count</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([version, count]) => (
          <tr key={version}>
            <td style={tdStyle}>{version}</td>
            <td style={tdStyle}>{count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KpiCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div style={kpiCardStyle}>
      <div style={kpiLabelStyle}>{title}</div>
      <div style={kpiValueStyle}>{value}</div>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const normalized = String(value || "").toLowerCase();
  const background =
    normalized === "active"
      ? "#dcfce7"
      : normalized === "draft"
        ? "#fef3c7"
        : normalized === "retired"
          ? "#e5e7eb"
          : "#dbeafe";

  return (
    <span style={{ ...statusPillStyle, background }}>
      {formatLabel(value)}
    </span>
  );
}

function formatLabel(value: any) {
  const text = String(value || "N/A").trim();
  if (!text) return "N/A";
  return text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: any) {
  if (!value) return "N/A";
  const raw = String(value).trim();
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const monthLabel = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    ).toLocaleString("en-US", { month: "short" });
    return `${day}-${monthLabel}-${year}`;
  }

  return formatDateTime(value);
}

function formatDateTime(value: any) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

const pageStyle: React.CSSProperties = {
  padding: "24px",
  fontFamily: "Arial, sans-serif",
  background: "#f8fafc",
  minHeight: "100vh",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: "18px",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  color: "#6b7280",
};

const subtleText: React.CSSProperties = {
  color: "#4b5563",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const secondaryLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  background: "#2563eb",
  color: "white",
  padding: "10px 14px",
  borderRadius: "8px",
  fontWeight: 700,
};

const darkLinkStyle: React.CSSProperties = {
  ...secondaryLinkStyle,
  background: "#111827",
};

const noticeStyle: React.CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  padding: "14px",
  borderRadius: "10px",
  marginBottom: "16px",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  padding: "18px",
  marginBottom: "16px",
};

const fieldRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
  alignItems: "end",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 700,
  marginBottom: "6px",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  background: "white",
};

const valueStyle: React.CSSProperties = {
  padding: "9px 0",
  fontWeight: 700,
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "14px",
  marginBottom: "16px",
};

const kpiCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  padding: "16px",
};

const kpiLabelStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "13px",
  fontWeight: 700,
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 800,
  marginTop: "6px",
};

const twoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px",
  borderBottom: "1px solid #cbd5e1",
  background: "#f8fafc",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px",
  borderBottom: "1px solid #e5e7eb",
  verticalAlign: "top",
};

const statusPillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "5px 9px",
  borderRadius: "999px",
  fontWeight: 800,
  fontSize: "12px",
};
