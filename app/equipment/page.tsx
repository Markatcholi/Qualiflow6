"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type EquipmentRow = {
  id: string;
  equipment_number: string;
  equipment_name: string;
  equipment_type: string | null;
  manufacturer: string | null;
  model_number: string | null;
  serial_number: string | null;
  department: string | null;
  site_location: string | null;
  owner_email: string | null;
  lifecycle_status: string | null;
  use_status: string | null;
  calibration_required: boolean | null;
  preventive_maintenance_required: boolean | null;
  qualification_required: boolean | null;
  created_at: string | null;
};

type ScheduleRow = {
  equipment_id: string;
  activity_type: string;
  schedule_mode: string | null;
  nominal_due_date: string | null;
  scheduled_service_date: string | null;
  hard_due_date: string | null;
  schedule_status: string | null;
};

export default function EquipmentRegistryPage() {
  const [equipment, setEquipment] = useState<EquipmentRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [searchText, setSearchText] = useState("");
  const [useStatusFilter, setUseStatusFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [scheduleFilter, setScheduleFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    setLoadError("");

    try {
      const [equipmentResult, scheduleResult] = await Promise.all([
        supabase
          .from("equipment")
          .select(
            "id,equipment_number,equipment_name,equipment_type,manufacturer,model_number,serial_number,department,site_location,owner_email,lifecycle_status,use_status,calibration_required,preventive_maintenance_required,qualification_required,created_at"
          )
          .order("equipment_number", { ascending: true }),

        supabase
          .from("equipment_current_schedule_status")
          .select(
            "equipment_id,activity_type,schedule_mode,nominal_due_date,scheduled_service_date,hard_due_date,schedule_status"
          ),
      ]);

      if (equipmentResult.error) throw new Error(equipmentResult.error.message);

      setEquipment((equipmentResult.data || []) as EquipmentRow[]);

      // The registry remains usable even if the helper view is unavailable.
      if (scheduleResult.error) {
        console.warn(
          "Unable to load equipment schedule summary:",
          scheduleResult.error.message
        );
        setSchedules([]);
      } else {
        setSchedules((scheduleResult.data || []) as ScheduleRow[]);
      }
    } catch (error: any) {
      setLoadError(error?.message || "Unable to load the Equipment Registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const scheduleByEquipment = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>();

    schedules.forEach((schedule) => {
      const current = map.get(schedule.equipment_id) || [];
      current.push(schedule);
      map.set(schedule.equipment_id, current);
    });

    return map;
  }, [schedules]);

  const filteredEquipment = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return equipment.filter((row) => {
      const rowSchedules = scheduleByEquipment.get(row.id) || [];

      const searchMatch =
        !query ||
        [
          row.equipment_number,
          row.equipment_name,
          row.equipment_type,
          row.manufacturer,
          row.model_number,
          row.serial_number,
          row.department,
          row.site_location,
          row.owner_email,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const useStatusMatch =
        useStatusFilter === "all" || row.use_status === useStatusFilter;

      const lifecycleMatch =
        lifecycleFilter === "all" || row.lifecycle_status === lifecycleFilter;

      const scheduleMatch =
        scheduleFilter === "all" ||
        rowSchedules.some(
          (schedule) => String(schedule.schedule_status || "") === scheduleFilter
        );

      return searchMatch && useStatusMatch && lifecycleMatch && scheduleMatch;
    });
  }, [
    equipment,
    scheduleByEquipment,
    searchText,
    useStatusFilter,
    lifecycleFilter,
    scheduleFilter,
  ]);

  const counts = useMemo(() => {
    const dueSoonEquipment = new Set(
      schedules
        .filter((row) =>
          ["due_soon", "due_today"].includes(String(row.schedule_status || ""))
        )
        .map((row) => row.equipment_id)
    );

    const overdueEquipment = new Set(
      schedules
        .filter((row) => row.schedule_status === "overdue")
        .map((row) => row.equipment_id)
    );

    return {
      total: equipment.length,
      available: equipment.filter((row) => row.use_status === "available_for_use")
        .length,
      restricted: equipment.filter((row) => row.use_status === "restricted")
        .length,
      outOfService: equipment.filter((row) => row.use_status === "out_of_service")
        .length,
      dueSoon: dueSoonEquipment.size,
      overdue: overdueEquipment.size,
    };
  }, [equipment, schedules]);

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={loadingStyle}>Loading Equipment Registry...</div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE EQUIPMENT MANAGEMENT</div>
          <h1 style={titleStyle}>Equipment Registry</h1>
          <p style={subtitleStyle}>
            Controlled equipment lifecycle, calibration, preventive maintenance,
            qualification, and equipment-status management.
          </p>
        </div>

        <div style={headerActionsStyle}>
          <Link href="/" style={secondaryButtonStyle}>
            Home
          </Link>
          <Link href="/equipment/new" style={primaryButtonStyle}>
            Register Equipment
          </Link>
        </div>
      </header>

      {loadError ? (
        <section style={errorStyle}>
          <strong>Unable to load Equipment Registry.</strong>
          <div style={{ marginTop: 6 }}>{loadError}</div>
          <button type="button" onClick={load} style={retryButtonStyle}>
            Retry
          </button>
        </section>
      ) : null}

      <section style={kpiGridStyle}>
        <KpiCard label="Total Equipment" value={counts.total} />
        <KpiCard label="Available for Use" value={counts.available} tone="success" />
        <KpiCard label="Restricted" value={counts.restricted} tone="warning" />
        <KpiCard label="Out of Service" value={counts.outOfService} tone="danger" />
        <KpiCard label="Due Soon" value={counts.dueSoon} tone="info" />
        <KpiCard label="Overdue" value={counts.overdue} tone="danger" />
      </section>

      <section style={filterCardStyle}>
        <div style={filterHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Equipment</h2>
            <p style={mutedStyle}>
              Search the registry or filter by lifecycle, availability, and
              scheduled-service status.
            </p>
          </div>

          <div style={recordCountStyle}>
            {filteredEquipment.length} of {equipment.length} records
          </div>
        </div>

        <div style={filterGridStyle}>
          <div>
            <label style={labelStyle}>Search</label>
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Equipment #, name, serial #, owner, location..."
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Use Status</label>
            <select
              value={useStatusFilter}
              onChange={(event) => setUseStatusFilter(event.target.value)}
              style={selectStyle}
            >
              <option value="all">All Use Statuses</option>
              <option value="available_for_use">Available for Use</option>
              <option value="restricted">Restricted</option>
              <option value="out_of_service">Out of Service</option>
              <option value="retired">Retired</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Lifecycle</label>
            <select
              value={lifecycleFilter}
              onChange={(event) => setLifecycleFilter(event.target.value)}
              style={selectStyle}
            >
              <option value="all">All Lifecycle Statuses</option>
              <option value="draft">Draft</option>
              <option value="specification_reference">Specification Reference</option>
              <option value="initial_calibration">Initial Calibration</option>
              <option value="qualification">Qualification</option>
              <option value="released">Released</option>
              <option value="retired">Retired</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Schedule Status</label>
            <select
              value={scheduleFilter}
              onChange={(event) => setScheduleFilter(event.target.value)}
              style={selectStyle}
            >
              <option value="all">All Schedule Statuses</option>
              <option value="upcoming">Upcoming</option>
              <option value="due_soon">Due Soon</option>
              <option value="due_today">Due Today</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>
      </section>

      <section style={registryCardStyle}>
        {filteredEquipment.length === 0 ? (
          <div style={emptyStateStyle}>
            <h3 style={{ marginTop: 0 }}>
              {equipment.length === 0
                ? "No equipment registered yet"
                : "No equipment matches the selected filters"}
            </h3>
            <p style={mutedStyle}>
              {equipment.length === 0
                ? "Register the first equipment record to begin the controlled equipment lifecycle."
                : "Adjust the search or filters to display additional records."}
            </p>
            {equipment.length === 0 ? (
              <Link href="/equipment/new" style={primaryButtonStyle}>
                Register Equipment
              </Link>
            ) : null}
          </div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Equipment #</th>
                  <th style={thStyle}>Equipment</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Department / Location</th>
                  <th style={thStyle}>Lifecycle</th>
                  <th style={thStyle}>Use Status</th>
                  <th style={thStyle}>Calibration</th>
                  <th style={thStyle}>PM</th>
                  <th style={thStyle}>Next Scheduled Activity</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredEquipment.map((row) => {
                  const rowSchedules = scheduleByEquipment.get(row.id) || [];
                  const nextSchedule = getNextSchedule(rowSchedules);

                  return (
                    <tr key={row.id}>
                      <td style={tdStyle}>
                        <strong>{row.equipment_number}</strong>
                      </td>

                      <td style={tdStyle}>
                        <div style={{ fontWeight: 800 }}>
                          {row.equipment_name || "Unnamed Equipment"}
                        </div>
                        <div style={smallMutedStyle}>
                          {[row.manufacturer, row.model_number]
                            .filter(Boolean)
                            .join(" · ") || "Manufacturer / model not recorded"}
                        </div>
                        {row.serial_number ? (
                          <div style={smallMutedStyle}>
                            Serial: {row.serial_number}
                          </div>
                        ) : null}
                      </td>

                      <td style={tdStyle}>{formatLabel(row.equipment_type)}</td>

                      <td style={tdStyle}>
                        <div>{formatLabel(row.department)}</div>
                        <div style={smallMutedStyle}>
                          {row.site_location || "Location not recorded"}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <StatusPill value={row.lifecycle_status} />
                      </td>

                      <td style={tdStyle}>
                        <UseStatusPill value={row.use_status} />
                      </td>

                      <td style={tdStyle}>
                        {row.calibration_required ? "Required" : "Not Required"}
                      </td>

                      <td style={tdStyle}>
                        {row.preventive_maintenance_required
                          ? "Required"
                          : "Not Required"}
                      </td>

                      <td style={tdStyle}>
                        {nextSchedule ? (
                          <>
                            <div style={{ fontWeight: 700 }}>
                              {formatActivity(nextSchedule.activity_type)}
                            </div>
                            <div>{formatDate(nextSchedule.scheduled_service_date)}</div>
                            <div style={{ marginTop: 4 }}>
                              <ScheduleStatusPill
                                value={nextSchedule.schedule_status}
                              />
                            </div>
                          </>
                        ) : (
                          <span style={smallMutedStyle}>No active schedule</span>
                        )}
                      </td>

                      <td style={tdStyle}>
                        <Link
                          href={`/equipment/${row.id}`}
                          style={openRecordStyle}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const toneStyles: Record<string, React.CSSProperties> = {
    default: { borderColor: "#dbe3ee" },
    success: { borderColor: "#86efac", background: "#f0fdf4" },
    warning: { borderColor: "#fde68a", background: "#fffbeb" },
    danger: { borderColor: "#fecaca", background: "#fef2f2" },
    info: { borderColor: "#bfdbfe", background: "#eff6ff" },
  };

  return (
    <div style={{ ...kpiCardStyle, ...(toneStyles[tone] || {}) }}>
      <div style={kpiLabelStyle}>{label}</div>
      <div style={kpiValueStyle}>{value}</div>
    </div>
  );
}

function StatusPill({ value }: { value?: string | null }) {
  return <span style={neutralPillStyle}>{formatLabel(value)}</span>;
}

function UseStatusPill({ value }: { value?: string | null }) {
  const normalized = String(value || "").toLowerCase();

  const style =
    normalized === "available_for_use"
      ? successPillStyle
      : normalized === "restricted"
        ? warningPillStyle
        : normalized === "out_of_service"
          ? dangerPillStyle
          : neutralPillStyle;

  return <span style={style}>{formatLabel(value)}</span>;
}

function ScheduleStatusPill({ value }: { value?: string | null }) {
  const normalized = String(value || "").toLowerCase();

  const style =
    normalized === "overdue"
      ? dangerPillStyle
      : normalized === "due_today"
        ? dangerPillStyle
        : normalized === "due_soon"
          ? warningPillStyle
          : normalized === "upcoming"
            ? infoPillStyle
            : neutralPillStyle;

  return <span style={style}>{formatLabel(value)}</span>;
}

function getNextSchedule(rows: ScheduleRow[]) {
  const active = rows.filter((row) => row.scheduled_service_date);

  if (active.length === 0) return null;

  return [...active].sort((a, b) => {
    const aTime = new Date(a.scheduled_service_date || "9999-12-31").getTime();
    const bTime = new Date(b.scheduled_service_date || "9999-12-31").getTime();
    return aTime - bTime;
  })[0];
}

function formatActivity(value?: string | null) {
  if (value === "calibration") return "Calibration";
  if (value === "preventive_maintenance") return "Preventive Maintenance";
  return formatLabel(value);
}

function formatLabel(value?: string | null) {
  if (!value) return "Not Recorded";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "Not scheduled";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  const day = String(date.getDate()).padStart(2, "0");
  const month = date
    .toLocaleString("en-US", { month: "short" })
    .replace(".", "");
  const year = date.getFullYear();

  return `${day}-${month}-${year}`;
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  color: "#0f172a",
  fontFamily: "Arial, sans-serif",
  padding: "24px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "18px",
  flexWrap: "wrap",
  marginBottom: "22px",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.12em",
};

const titleStyle: React.CSSProperties = {
  fontSize: "34px",
  margin: "7px 0 5px",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: "800px",
  color: "#475569",
  lineHeight: 1.5,
};

const headerActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "8px",
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#ffffff",
  padding: "10px 14px",
  textDecoration: "none",
  fontWeight: 800,
};

const secondaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))",
  gap: "12px",
  marginBottom: "18px",
};

const kpiCardStyle: React.CSSProperties = {
  border: "1px solid #dbe3ee",
  background: "#ffffff",
  borderRadius: "12px",
  padding: "15px",
};

const kpiLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 900,
  marginTop: "7px",
};

const filterCardStyle: React.CSSProperties = {
  border: "1px solid #dbe3ee",
  background: "#ffffff",
  borderRadius: "14px",
  padding: "16px",
  marginBottom: "18px",
};

const filterHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "14px",
};

const mutedStyle: React.CSSProperties = {
  color: "#64748b",
  margin: "5px 0 0",
  lineHeight: 1.45,
};

const smallMutedStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "12px",
  marginTop: "3px",
};

const recordCountStyle: React.CSSProperties = {
  borderRadius: "999px",
  padding: "6px 10px",
  background: "#f1f5f9",
  color: "#475569",
  fontWeight: 700,
  fontSize: "12px",
};

const filterGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 2fr) repeat(3, minmax(175px, 1fr))",
  gap: "12px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 900,
  color: "#475569",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "10px",
  background: "#ffffff",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
};

const registryCardStyle: React.CSSProperties = {
  border: "1px solid #dbe3ee",
  background: "#ffffff",
  borderRadius: "14px",
  overflow: "hidden",
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1250px",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  background: "#f8fafc",
  color: "#334155",
  borderBottom: "1px solid #cbd5e1",
  padding: "12px",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e2e8f0",
  padding: "12px",
  verticalAlign: "top",
};

const pillBaseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "4px 9px",
  fontSize: "12px",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const neutralPillStyle: React.CSSProperties = {
  ...pillBaseStyle,
  background: "#f1f5f9",
  color: "#475569",
  border: "1px solid #cbd5e1",
};

const successPillStyle: React.CSSProperties = {
  ...pillBaseStyle,
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #86efac",
};

const warningPillStyle: React.CSSProperties = {
  ...pillBaseStyle,
  background: "#fef3c7",
  color: "#92400e",
  border: "1px solid #fde68a",
};

const dangerPillStyle: React.CSSProperties = {
  ...pillBaseStyle,
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
};

const infoPillStyle: React.CSSProperties = {
  ...pillBaseStyle,
  background: "#dbeafe",
  color: "#1e40af",
  border: "1px solid #bfdbfe",
};

const openRecordStyle: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: "7px",
  padding: "7px 10px",
  background: "#0f172a",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: "13px",
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "55px 20px",
};

const errorStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  borderRadius: "10px",
  padding: "12px",
  marginBottom: "18px",
};

const retryButtonStyle: React.CSSProperties = {
  marginTop: "10px",
  border: "1px solid #991b1b",
  background: "#ffffff",
  color: "#991b1b",
  borderRadius: "7px",
  padding: "7px 10px",
  fontWeight: 800,
  cursor: "pointer",
};

const loadingStyle: React.CSSProperties = {
  border: "1px solid #dbe3ee",
  background: "#ffffff",
  borderRadius: "12px",
  padding: "20px",
  color: "#475569",
  fontWeight: 700,
};
