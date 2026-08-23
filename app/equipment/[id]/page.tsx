"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type EquipmentRecord = {
  id: string;
  tenant_id: string;
  equipment_number: string;
  number_source: string;
  equipment_name: string;
  equipment_type: string | null;
  manufacturer: string | null;
  model_number: string | null;
  serial_number: string | null;
  asset_number: string | null;
  department: string | null;
  site_location: string | null;
  owner_email: string | null;
  description: string | null;
  specification_document_number: string | null;
  specification_document_id: string | null;
  specification_revision: string | null;
  calibration_required: boolean;
  preventive_maintenance_required: boolean;
  qualification_required: boolean;
  post_unplanned_maintenance_assessment: string;
  lifecycle_phase: string;
  equipment_status: string;
  lifecycle_status: string;
  use_status: string;
  use_status_reason: string | null;
  released_at: string | null;
  released_by: string | null;
  retired_at: string | null;
  retired_by: string | null;
  retirement_reason: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type Schedule = {
  id: string;
  activity_type: string;
  is_active: boolean;
  frequency_value: number;
  frequency_unit: string;
  schedule_mode: string;
  nominal_due_date: string | null;
  scheduled_service_date: string | null;
  hard_due_date: string | null;
  provider_type: string | null;
  provider_name: string | null;
  procedure_document_number: string | null;
  procedure_revision: string | null;
  overdue_use_action: string;
};

type Calibration = {
  id: string;
  calibration_number: string;
  scheduled_date: string | null;
  hard_due_date: string | null;
  performed_date: string | null;
  result: string | null;
  certificate_number: string | null;
  provider_name: string | null;
  status: string;
  created_at: string;
};

type Maintenance = {
  id: string;
  maintenance_number: string;
  maintenance_type: string;
  scheduled_date: string | null;
  hard_due_date: string | null;
  performed_date: string | null;
  result: string | null;
  provider_name: string | null;
  status: string;
  created_at: string;
};

type Qualification = {
  id: string;
  qualification_number: string;
  qualification_type: string;
  reason: string | null;
  protocol_number: string | null;
  protocol_revision: string | null;
  qualification_result: string | null;
  approval_status: string;
  status: string;
  released_for_use_at: string | null;
  created_at: string;
};

type DocumentLink = {
  id: string;
  document_id: string;
  relationship_type: string;
  is_active: boolean;
  linked_at: string;
};

type ChangeLink = {
  id: string;
  change_control_id: string;
  relationship_note: string | null;
  linked_at: string;
};

type OosLink = {
  id: string;
  oos_oot_id: string;
  source_type: string;
  source_record_id: string | null;
  linked_at: string;
};

type AuditRow = {
  id: string;
  action: string;
  details: string | null;
  user_email: string | null;
  created_at: string | null;
};

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe3ee",
  borderRadius: "14px",
  padding: "18px",
};

const fieldLabel: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 900,
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: "5px",
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "9px 10px",
  fontSize: "14px",
  background: "#ffffff",
};

const primaryButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #315ee8",
  background: "#315ee8",
  color: "#ffffff",
  borderRadius: "8px",
  padding: "9px 13px",
  fontWeight: 800,
  textDecoration: "none",
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  color: "#0f172a",
};

const disabledButton: React.CSSProperties = {
  ...secondaryButton,
  color: "#94a3b8",
  background: "#f8fafc",
  cursor: "not-allowed",
};

export default function EquipmentMasterPage() {
  const params = useParams();
  const equipmentId = String(params?.id || "");

  const [record, setRecord] = useState<EquipmentRecord | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [documents, setDocuments] = useState<DocumentLink[]>([]);
  const [changes, setChanges] = useState<ChangeLink[]>([]);
  const [oosLinks, setOosLinks] = useState<OosLink[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [form, setForm] = useState({
    equipment_name: "",
    equipment_type: "",
    manufacturer: "",
    model_number: "",
    serial_number: "",
    asset_number: "",
    department: "",
    site_location: "",
    owner_email: "",
    description: "",
    specification_document_number: "",
    specification_revision: "",
    calibration_required: false,
    preventive_maintenance_required: false,
    qualification_required: false,
    lifecycle_phase: "acquisition",
    equipment_status: "pending_installation",
    use_status: "out_of_service",
    use_status_reason: "",
    post_unplanned_maintenance_assessment: "optional",
  });

  const load = async () => {
    if (!equipmentId) return;

    setLoading(true);
    setLoadError("");

    try {
      const [
        equipmentRes,
        schedulesRes,
        calibrationRes,
        maintenanceRes,
        qualificationRes,
        documentsRes,
        changesRes,
        oosRes,
        auditRes,
      ] = await Promise.all([
        supabase.from("equipment").select("*").eq("id", equipmentId).single(),
        supabase
          .from("equipment_schedule_configurations")
          .select("*")
          .eq("equipment_id", equipmentId)
          .order("activity_type"),
        supabase
          .from("equipment_calibration_events")
          .select("id,calibration_number,scheduled_date,hard_due_date,performed_date,result,certificate_number,provider_name,status,created_at")
          .eq("equipment_id", equipmentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("equipment_maintenance_events")
          .select("id,maintenance_number,maintenance_type,scheduled_date,hard_due_date,performed_date,result,provider_name,status,created_at")
          .eq("equipment_id", equipmentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("equipment_qualification_events")
          .select("id,qualification_number,qualification_type,reason,protocol_number,protocol_revision,qualification_result,approval_status,status,released_for_use_at,created_at")
          .eq("equipment_id", equipmentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("equipment_document_links")
          .select("id,document_id,relationship_type,is_active,linked_at")
          .eq("equipment_id", equipmentId)
          .order("linked_at", { ascending: false }),
        supabase
          .from("equipment_change_control_links")
          .select("id,change_control_id,relationship_note,linked_at")
          .eq("equipment_id", equipmentId)
          .order("linked_at", { ascending: false }),
        supabase
          .from("equipment_oos_oot_links")
          .select("id,oos_oot_id,source_type,source_record_id,linked_at")
          .eq("equipment_id", equipmentId)
          .order("linked_at", { ascending: false }),
        supabase
          .from("audit_logs")
          .select("id,action,details,user_email,created_at")
          .eq("entity_type", "equipment")
          .eq("entity_id", equipmentId)
          .order("created_at", { ascending: false }),
      ]);

      if (equipmentRes.error) throw new Error(equipmentRes.error.message);

      const eq = equipmentRes.data as EquipmentRecord;
      setRecord(eq);
      setForm({
        equipment_name: eq.equipment_name || "",
        equipment_type: eq.equipment_type || "",
        manufacturer: eq.manufacturer || "",
        model_number: eq.model_number || "",
        serial_number: eq.serial_number || "",
        asset_number: eq.asset_number || "",
        department: eq.department || "",
        site_location: eq.site_location || "",
        owner_email: eq.owner_email || "",
        description: eq.description || "",
        specification_document_number: eq.specification_document_number || "",
        specification_revision: eq.specification_revision || "",
        calibration_required: !!eq.calibration_required,
        preventive_maintenance_required: !!eq.preventive_maintenance_required,
        qualification_required: !!eq.qualification_required,
        lifecycle_phase: eq.lifecycle_phase || "acquisition",
        equipment_status: eq.equipment_status || "pending_installation",
        use_status: eq.use_status || "out_of_service",
        use_status_reason: eq.use_status_reason || "",
        post_unplanned_maintenance_assessment:
          eq.post_unplanned_maintenance_assessment || "optional",
      });

      setSchedules((schedulesRes.data || []) as Schedule[]);
      setCalibrations((calibrationRes.data || []) as Calibration[]);
      setMaintenance((maintenanceRes.data || []) as Maintenance[]);
      setQualifications((qualificationRes.data || []) as Qualification[]);
      setDocuments((documentsRes.data || []) as DocumentLink[]);
      setChanges((changesRes.data || []) as ChangeLink[]);
      setOosLinks((oosRes.data || []) as OosLink[]);
      setAuditRows((auditRes.data || []) as AuditRow[]);

      [
        schedulesRes,
        calibrationRes,
        maintenanceRes,
        qualificationRes,
        documentsRes,
        changesRes,
        oosRes,
        auditRes,
      ].forEach((result: any) => {
        if (result.error) console.warn(result.error.message);
      });
    } catch (error: any) {
      setLoadError(error?.message || "Unable to load the Equipment Master record.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [equipmentId]);

  const addAudit = async (action: string, details: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "unknown";

    const { error } = await supabase.from("audit_logs").insert({
      entity_type: "equipment",
      entity_id: equipmentId,
      action,
      details,
      user_email: email,
    });

    if (error) console.warn("Equipment audit log failed:", error.message);
  };

  const saveMaster = async () => {
    if (!record) return;

    if (!form.equipment_name.trim()) {
      setSaveMessage("Equipment Name is required.");
      return;
    }

    if (
      form.owner_email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.owner_email.trim())
    ) {
      setSaveMessage("Enter a valid Equipment Owner email address.");
      return;
    }

    setSaving(true);
    setSaveMessage("");

    const updatePayload = {
      equipment_name: form.equipment_name.trim(),
      equipment_type: form.equipment_type.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
      model_number: form.model_number.trim() || null,
      serial_number: form.serial_number.trim() || null,
      asset_number: form.asset_number.trim() || null,
      department: form.department.trim() || null,
      site_location: form.site_location.trim() || null,
      owner_email: form.owner_email.trim().toLowerCase() || null,
      description: form.description.trim() || null,
      specification_document_number:
        form.specification_document_number.trim() || null,
      specification_revision: form.specification_revision.trim() || null,
      calibration_required: form.calibration_required,
      preventive_maintenance_required: form.preventive_maintenance_required,
      qualification_required: form.qualification_required,
      lifecycle_phase: form.lifecycle_phase,
      equipment_status: form.equipment_status,
      lifecycle_status:
        form.lifecycle_phase === "retirement" ? "retired" :
        form.equipment_status === "pending_calibration" ? "initial_calibration" :
        form.equipment_status === "pending_qualification" ? "qualification" :
        form.equipment_status === "pending_production_release" ? "pending_production_release" :
        form.equipment_status === "active" ? "released" : "draft",
      use_status: form.use_status,
      use_status_reason: form.use_status_reason.trim() || null,
      post_unplanned_maintenance_assessment:
        form.post_unplanned_maintenance_assessment,
    };

    const { error } = await supabase
      .from("equipment")
      .update(updatePayload)
      .eq("id", equipmentId);

    if (error) {
      setSaveMessage(error.message);
      setSaving(false);
      return;
    }

    await addAudit(
      "master_record_updated",
      `Equipment Master updated for ${record.equipment_number}.`
    );

    setEditing(false);
    setSaveMessage("Equipment Master updated.");
    setSaving(false);
    await load();
  };

  const lifecycleReadiness = useMemo(() => {
    if (!record) return [];

    return [
      {
        label: "Specification Reference",
        required: true,
        complete: !!record.specification_document_number,
      },
      {
        label: "Calibration",
        required: record.calibration_required,
        complete:
          !record.calibration_required ||
          calibrations.some((item) => item.status === "completed" && item.result === "pass"),
      },
      {
        label: "Preventive Maintenance",
        required: record.preventive_maintenance_required,
        complete:
          !record.preventive_maintenance_required ||
          schedules.some(
            (item) =>
              item.activity_type === "preventive_maintenance" && item.is_active
          ),
      },
      {
        label: "Qualification",
        required: record.qualification_required,
        complete:
          !record.qualification_required ||
          qualifications.some((item) => item.status === "released"),
      },
    ];
  }, [record, calibrations, schedules, qualifications]);

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={card}>Loading Equipment Master Record...</div>
      </main>
    );
  }

  if (loadError || !record) {
    return (
      <main style={pageStyle}>
        <div style={{ ...card, borderColor: "#fecaca", color: "#991b1b" }}>
          <strong>Unable to load equipment.</strong>
          <div style={{ marginTop: 6 }}>{loadError || "Equipment record not found."}</div>
          <div style={{ marginTop: 14 }}>
            <Link href="/equipment" style={secondaryButton}>
              Return to Equipment Registry
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const calibrationSchedule = schedules.find(
    (row) => row.activity_type === "calibration" && row.is_active
  );
  const pmSchedule = schedules.find(
    (row) => row.activity_type === "preventive_maintenance" && row.is_active
  );

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE CONTROLLED EQUIPMENT RECORD</div>
          <h1 style={{ margin: "7px 0 3px", fontSize: "34px" }}>
            {record.equipment_number}
          </h1>
          <div style={{ color: "#475569", fontSize: "17px" }}>
            {record.equipment_name}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/equipment" style={secondaryButton}>
            Equipment Registry
          </Link>
          {!editing ? (
            <button style={primaryButton} onClick={() => setEditing(true)}>
              Edit Master Record
            </button>
          ) : (
            <>
              <button
                style={secondaryButton}
                onClick={() => {
                  setEditing(false);
                  setSaveMessage("");
                  load();
                }}
              >
                Cancel
              </button>
              <button
                style={{ ...primaryButton, opacity: saving ? 0.6 : 1 }}
                onClick={saveMaster}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </>
          )}
        </div>
      </header>

      {saveMessage ? (
        <div
          style={{
            ...card,
            marginBottom: 16,
            padding: "12px 14px",
            background: saveMessage.includes("updated") ? "#f0fdf4" : "#fef2f2",
            borderColor: saveMessage.includes("updated") ? "#86efac" : "#fecaca",
            color: saveMessage.includes("updated") ? "#166534" : "#991b1b",
          }}
        >
          {saveMessage}
        </div>
      ) : null}

      <section style={summaryGridStyle}>
        <Summary label="Lifecycle Phase" value={formatLifecyclePhase(record.lifecycle_phase)} />
        <Summary label="Equipment Status" value={formatEquipmentStatus(record.equipment_status)} />
        <Summary
          label="Use Status"
          value={formatEquipmentUseStatus(record.use_status)}
          tone={
            record.use_status === "available_for_use"
              ? "success"
              : record.use_status === "restricted"
              ? "warning"
              : "danger"
          }
        />
        <Summary label="Equipment Owner" value={record.owner_email || "Not Recorded"} />
        <Summary label="Department" value={record.department || "Not Recorded"} />
        <Summary label="Site / Location" value={record.site_location || "Not Recorded"} />
        <Summary label="Last Updated" value={formatDateTime(record.updated_at)} />
      </section>

      {record.use_status_reason ? (
        <section
          style={{
            ...card,
            marginBottom: 16,
            background: "#fff7ed",
            borderColor: "#fed7aa",
          }}
        >
          <strong>Equipment Use Status Rationale:</strong>{" "}
          {record.use_status_reason}
        </section>
      ) : null}

      <section style={{ ...card, marginBottom: 16 }}>
        <SectionHeader
          title="Lifecycle Readiness"
          subtitle="Readiness indicators summarize the activities currently required by this Equipment Master configuration."
        />
        <div style={readinessGridStyle}>
          {lifecycleReadiness.map((item) => (
            <div
              key={item.label}
              style={{
                border: item.complete ? "1px solid #86efac" : "1px solid #fde68a",
                background: item.complete ? "#f0fdf4" : "#fffbeb",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 800 }}>{item.label}</div>
              <div style={{ marginTop: 5, fontSize: 13 }}>
                {!item.required
                  ? "Not Required"
                  : item.complete
                  ? "Ready / Completed"
                  : "Required / Pending"}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, color: "#64748b", fontSize: 13 }}>
          Final Release for Use will be implemented as its own controlled gate.
          This page does not automatically release equipment.
        </div>
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <SectionHeader
          title="1. Equipment Identification"
          subtitle="Permanent equipment identity, ownership, and intended use."
        />

        {editing ? (
          <>
            <div style={formGridStyle}>
              <EditField label="Equipment Number">
                <input value={record.equipment_number} disabled style={disabledInputStyle} />
              </EditField>
              <EditField label="Number Source">
                <input value={formatLabel(record.number_source)} disabled style={disabledInputStyle} />
              </EditField>
              <EditField label="Equipment Name">
                <input value={form.equipment_name} onChange={(e) => setForm({ ...form, equipment_name: e.target.value })} style={input} />
              </EditField>
              <EditField label="Equipment Type">
                <input value={form.equipment_type} onChange={(e) => setForm({ ...form, equipment_type: e.target.value })} style={input} />
              </EditField>
              <EditField label="Manufacturer">
                <input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} style={input} />
              </EditField>
              <EditField label="Model Number">
                <input value={form.model_number} onChange={(e) => setForm({ ...form, model_number: e.target.value })} style={input} />
              </EditField>
              <EditField label="Serial Number">
                <input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} style={input} />
              </EditField>
              <EditField label="Asset Number">
                <input value={form.asset_number} onChange={(e) => setForm({ ...form, asset_number: e.target.value })} style={input} />
              </EditField>
              <EditField label="Department">
                <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} style={input} />
              </EditField>
              <EditField label="Site / Location">
                <input value={form.site_location} onChange={(e) => setForm({ ...form, site_location: e.target.value })} style={input} />
              </EditField>
              <EditField label="Equipment Owner">
                <input value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} style={input} />
              </EditField>
            </div>
            <div style={{ marginTop: 14 }}>
              <EditField label="Description / Intended Use">
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ ...input, resize: "vertical" }}
                />
              </EditField>
            </div>
          </>
        ) : (
          <div style={detailGridStyle}>
            <Detail label="Equipment Number" value={record.equipment_number} />
            <Detail label="Number Source" value={formatLabel(record.number_source)} />
            <Detail label="Equipment Name" value={record.equipment_name} />
            <Detail label="Equipment Type" value={record.equipment_type} />
            <Detail label="Manufacturer" value={record.manufacturer} />
            <Detail label="Model Number" value={record.model_number} />
            <Detail label="Serial Number" value={record.serial_number} />
            <Detail label="Asset Number" value={record.asset_number} />
            <Detail label="Department" value={record.department} />
            <Detail label="Site / Location" value={record.site_location} />
            <Detail label="Equipment Owner" value={record.owner_email} />
            <Detail label="Description / Intended Use" value={record.description} wide />
          </div>
        )}
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <SectionHeader
          title="2. Equipment Specification Reference"
          subtitle="The Equipment Master references the governing specification rather than recreating specification requirements."
        />
        {editing ? (
          <div style={formGridStyle}>
            <EditField label="Specification Document Number">
              <input
                value={form.specification_document_number}
                onChange={(e) =>
                  setForm({ ...form, specification_document_number: e.target.value })
                }
                style={input}
              />
            </EditField>
            <EditField label="Specification Revision">
              <input
                value={form.specification_revision}
                onChange={(e) =>
                  setForm({ ...form, specification_revision: e.target.value })
                }
                style={input}
              />
            </EditField>
          </div>
        ) : (
          <div style={detailGridStyle}>
            <Detail
              label="Specification Document Number"
              value={record.specification_document_number}
            />
            <Detail label="Specification Revision" value={record.specification_revision} />
            <Detail
              label="Controlled Document Link"
              value={
                record.specification_document_id
                  ? "Controlled document linked"
                  : "Not Linked"
              }
            />
          </div>
        )}
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <SectionHeader
          title="3. Lifecycle Requirements"
          subtitle="Customer-controlled applicability of calibration, preventive maintenance, qualification, and post-maintenance assessment."
        />
        {editing ? (
          <div style={formGridStyle}>
            <CheckboxField
              label="Calibration Required"
              checked={form.calibration_required}
              onChange={(value) => setForm({ ...form, calibration_required: value })}
            />
            <CheckboxField
              label="Preventive Maintenance Required"
              checked={form.preventive_maintenance_required}
              onChange={(value) =>
                setForm({ ...form, preventive_maintenance_required: value })
              }
            />
            <CheckboxField
              label="Qualification Required"
              checked={form.qualification_required}
              onChange={(value) => setForm({ ...form, qualification_required: value })}
            />
            <EditField label="Post-Unplanned-Maintenance Assessment">
              <select
                value={form.post_unplanned_maintenance_assessment}
                onChange={(e) =>
                  setForm({
                    ...form,
                    post_unplanned_maintenance_assessment: e.target.value,
                  })
                }
                style={input}
              >
                <option value="optional">Optional</option>
                <option value="required">Required</option>
                <option value="disabled">Disabled</option>
              </select>
            </EditField>
          </div>
        ) : (
          <div style={detailGridStyle}>
            <Detail label="Calibration Required" value={yesNo(record.calibration_required)} />
            <Detail
              label="Preventive Maintenance Required"
              value={yesNo(record.preventive_maintenance_required)}
            />
            <Detail label="Qualification Required" value={yesNo(record.qualification_required)} />
            <Detail
              label="Post-Unplanned-Maintenance Assessment"
              value={formatLabel(record.post_unplanned_maintenance_assessment)}
            />
          </div>
        )}
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <SectionHeader
          title="4. Calibration Program"
          subtitle="Calibration scheduling and permanent calibration-event history."
          action={<button disabled style={disabledButton}>Configure Calibration — Next Phase</button>}
        />

        <ScheduleSummary
          required={record.calibration_required}
          schedule={calibrationSchedule}
          emptyText="No calibration schedule configured."
        />

        <HistoryTable
          title="Calibration History"
          emptyText="No calibration events recorded."
          headers={["Event", "Scheduled", "Performed", "Result", "Certificate", "Provider", "Status"]}
          rows={calibrations.map((row) => [
            row.calibration_number,
            formatDate(row.scheduled_date),
            formatDate(row.performed_date),
            formatLabel(row.result),
            row.certificate_number || "Not Recorded",
            row.provider_name || "Not Recorded",
            formatLabel(row.status),
          ])}
        />
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <SectionHeader
          title="5. Preventive / Unplanned Maintenance"
          subtitle="Planned preventive maintenance and unplanned repair history share one controlled event architecture."
          action={<button disabled style={disabledButton}>Create Maintenance Event — Next Phase</button>}
        />

        <ScheduleSummary
          required={record.preventive_maintenance_required}
          schedule={pmSchedule}
          emptyText="No preventive-maintenance schedule configured."
        />

        <HistoryTable
          title="Maintenance History"
          emptyText="No maintenance events recorded."
          headers={["Event", "Type", "Scheduled", "Performed", "Result", "Provider", "Status"]}
          rows={maintenance.map((row) => [
            row.maintenance_number,
            formatLabel(row.maintenance_type),
            formatDate(row.scheduled_date),
            formatDate(row.performed_date),
            formatLabel(row.result),
            row.provider_name || "Not Recorded",
            formatLabel(row.status),
          ])}
        />
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <SectionHeader
          title="6. Qualification / Requalification"
          subtitle="Controlled lifecycle: Qualification Initiated → Released Protocol → Execution → Draft Report → Review/Approval → Release for Use."
          action={<button disabled style={disabledButton}>Initiate Qualification — Next Phase</button>}
        />

        <HistoryTable
          title="Qualification History"
          emptyText="No qualification or requalification events recorded."
          headers={["Event", "Type", "Reason", "Protocol", "Result", "Approval", "Status"]}
          rows={qualifications.map((row) => [
            row.qualification_number,
            formatLabel(row.qualification_type),
            row.reason || "Not Recorded",
            [row.protocol_number, row.protocol_revision].filter(Boolean).join(" / ") || "Not Recorded",
            formatLabel(row.qualification_result),
            formatLabel(row.approval_status),
            formatLabel(row.status),
          ])}
        />
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <SectionHeader
          title="7. Related Controlled Documents"
          subtitle="Direct links between Equipment and Document Control."
          action={<button disabled style={disabledButton}>Link Document — Next Phase</button>}
        />
        <HistoryTable
          emptyText="No controlled documents linked."
          headers={["Relationship", "Document ID", "Active", "Linked At"]}
          rows={documents.map((row) => [
            formatLabel(row.relationship_type),
            row.document_id,
            row.is_active ? "Yes" : "No",
            formatDateTime(row.linked_at),
          ])}
        />
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <SectionHeader
          title="8. Change Control"
          subtitle="Equipment may reference applicable Change Control records without QualiSphere dictating when a change is required."
          action={<button disabled style={disabledButton}>Link Change Control — Next Phase</button>}
        />
        <HistoryTable
          emptyText="No Change Control records linked."
          headers={["Change Control ID", "Relationship Note", "Linked At"]}
          rows={changes.map((row) => [
            row.change_control_id,
            row.relationship_note || "Not Recorded",
            formatDateTime(row.linked_at),
          ])}
        />
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <SectionHeader
          title="9. OOS / OOT"
          subtitle="Equipment-related quality exceptions link directly to the existing OOS/OOT module."
          action={<button disabled style={disabledButton}>Link OOS/OOT — Next Phase</button>}
        />
        <HistoryTable
          emptyText="No OOS/OOT records linked."
          headers={["OOS/OOT ID", "Source", "Source Record", "Linked At"]}
          rows={oosLinks.map((row) => [
            row.oos_oot_id,
            formatLabel(row.source_type),
            row.source_record_id || "Not Recorded",
            formatDateTime(row.linked_at),
          ])}
        />
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <SectionHeader
          title="10. Equipment Lifecycle / Status / Release"
          subtitle="Lifecycle Phase, Equipment Status, and Use Status are separate controls. Formal Release for Use remains a controlled workflow gate."
        />

        {editing ? (
          <>
            <div style={formGridStyle}>
              <EditField label="Lifecycle Phase">
                <select value={form.lifecycle_phase} onChange={(e) => {
                  const next=e.target.value;
                  setForm({...form,lifecycle_phase:next,equipment_status:next==="retirement"?"retired":form.equipment_status,use_status:next==="retirement"?"retired":form.use_status});
                }} style={input}>
                  <option value="planning">Planning</option>
                  <option value="acquisition">Acquisition</option>
                  <option value="operation_maintenance">Operation & Maintenance</option>
                  <option value="retirement">Retirement</option>
                </select>
              </EditField>

              <EditField label="Equipment Status">
                <select value={form.equipment_status} onChange={(e) => {
                  const next=e.target.value;
                  setForm({...form,equipment_status:next,lifecycle_phase:next==="active"?"operation_maintenance":next==="retired"?"retirement":form.lifecycle_phase,use_status:next==="retired"?"retired":form.use_status});
                }} style={input}>
                  <option value="pending_installation">Pending Installation</option>
                  <option value="pending_calibration">Pending Calibration</option>
                  <option value="pending_qualification">Pending Qualification</option>
                  <option value="pending_maintenance">Pending Maintenance</option>
                  <option value="pending_production_release">Pending Production Release</option>
                  <option value="active">Active</option>
                  <option value="retired">Retired</option>
                </select>
              </EditField>

              <EditField label="Use Status">
                <select value={form.use_status} onChange={(e) => {
                  const next=e.target.value;
                  setForm({...form,use_status:next,lifecycle_phase:next==="retired"?"retirement":form.lifecycle_phase,equipment_status:next==="retired"?"retired":form.equipment_status});
                }} style={input}>
                  <option value="available_for_use">Available for Use</option>
                  <option value="restricted">Restricted</option>
                  <option value="out_of_service">Out of Service</option>
                  <option value="retired">Retired</option>
                </select>
              </EditField>
            </div>
            <div style={{ marginTop: 14 }}>
              <EditField label="Status Rationale / Notes">
                <textarea rows={3} value={form.use_status_reason} onChange={(e)=>setForm({...form,use_status_reason:e.target.value})} style={{...input,resize:"vertical"}} />
              </EditField>
            </div>
            <div style={{ ...detailGridStyle, marginTop: 14 }}>
              <Detail label="Released By" value={record.released_by} />
              <Detail label="Released At" value={formatDateTime(record.released_at)} />
              <Detail label="Retired By" value={record.retired_by} />
              <Detail label="Retired At" value={formatDateTime(record.retired_at)} />
              <Detail label="Retirement Reason" value={record.retirement_reason} wide />
            </div>
          </>
        ) : (
          <div style={detailGridStyle}>
            <Detail label="Lifecycle Phase" value={formatLifecyclePhase(record.lifecycle_phase)} />
            <Detail label="Equipment Status" value={formatEquipmentStatus(record.equipment_status)} />
            <Detail label="Use Status" value={formatEquipmentUseStatus(record.use_status)} />
            <Detail label="Status Rationale / Notes" value={record.use_status_reason} wide />
            <Detail label="Released By" value={record.released_by} />
            <Detail label="Released At" value={formatDateTime(record.released_at)} />
            <Detail label="Retired By" value={record.retired_by} />
            <Detail label="Retired At" value={formatDateTime(record.retired_at)} />
            <Detail label="Retirement Reason" value={record.retirement_reason} wide />
          </div>
        )}
        <div style={{ marginTop: 14 }}><button disabled style={disabledButton}>Release for Use — Controlled Gate Coming Next</button></div>
      </section>

      <section style={card}>
        <SectionHeader
          title="Equipment Timeline / Activity Feed"
          subtitle="Permanent audit history for the Equipment Master record."
        />
        <HistoryTable
          emptyText="No equipment audit events recorded."
          headers={["Date / Time", "Action", "User", "Details"]}
          rows={auditRows.map((row) => [
            formatDateTime(row.created_at),
            formatLabel(row.action),
            row.user_email || "Unknown",
            row.details || "No details recorded.",
          ])}
        />
      </section>
    </main>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 16,
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2>
        <p style={{ margin: "5px 0 0", color: "#64748b", lineHeight: 1.4 }}>
          {subtitle}
        </p>
      </div>
      {action}
    </div>
  );
}

function Summary({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const tones: Record<string, React.CSSProperties> = {
    default: {},
    success: { background: "#f0fdf4", borderColor: "#86efac" },
    warning: { background: "#fffbeb", borderColor: "#fde68a" },
    danger: { background: "#fef2f2", borderColor: "#fecaca" },
  };

  return (
    <div style={{ ...card, padding: 14, ...(tones[tone] || {}) }}>
      <div style={fieldLabel}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 16 }}>{value}</div>
    </div>
  );
}

function Detail({
  label,
  value,
  wide,
}: {
  label: string;
  value?: any;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        borderRadius: 10,
        padding: 12,
        gridColumn: wide ? "1 / -1" : undefined,
      }}
    >
      <div style={fieldLabel}>{label}</div>
      <div style={{ whiteSpace: "pre-wrap" }}>
        {value === null || value === undefined || value === ""
          ? "Not Recorded"
          : String(value)}
      </div>
    </div>
  );
}

function EditField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      style={{
        border: checked ? "1px solid #86efac" : "1px solid #dbe3ee",
        background: checked ? "#f0fdf4" : "#ffffff",
        borderRadius: 10,
        padding: 12,
        display: "flex",
        gap: 10,
        alignItems: "center",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <strong>{label}</strong>
    </label>
  );
}

function ScheduleSummary({
  required,
  schedule,
  emptyText,
}: {
  required: boolean;
  schedule?: Schedule;
  emptyText: string;
}) {
  if (!required) {
    return (
      <div style={{ ...emptyPanelStyle, marginBottom: 18 }}>
        This activity is currently configured as <strong>Not Required</strong>.
      </div>
    );
  }

  if (!schedule) {
    return (
      <div style={{ ...emptyPanelStyle, marginBottom: 18 }}>{emptyText}</div>
    );
  }

  return (
    <div style={{ ...detailGridStyle, marginBottom: 20 }}>
      <Detail
        label="Frequency"
        value={`${schedule.frequency_value} ${formatLabel(schedule.frequency_unit)}`}
      />
      <Detail label="Schedule Mode" value={formatLabel(schedule.schedule_mode)} />
      <Detail label="Nominal Due Date" value={formatDate(schedule.nominal_due_date)} />
      <Detail
        label="Scheduled Service Date"
        value={formatDate(schedule.scheduled_service_date)}
      />
      <Detail label="Hard Due Date" value={formatDate(schedule.hard_due_date)} />
      <Detail
        label="Provider"
        value={
          [formatLabel(schedule.provider_type), schedule.provider_name]
            .filter((x) => x && x !== "Not Recorded")
            .join(" — ") || "Not Recorded"
        }
      />
      <Detail
        label="Procedure"
        value={
          [schedule.procedure_document_number, schedule.procedure_revision]
            .filter(Boolean)
            .join(" / ") || "Not Recorded"
        }
      />
      <Detail
        label="Overdue Use Action"
        value={formatLabel(schedule.overdue_use_action)}
      />
    </div>
  );
}

function HistoryTable({
  title,
  headers,
  rows,
  emptyText,
}: {
  title?: string;
  headers: string[];
  rows: string[][];
  emptyText: string;
}) {
  return (
    <div>
      {title ? <h3 style={{ margin: "6px 0 10px" }}>{title}</h3> : null}
      {rows.length === 0 ? (
        <div style={emptyPanelStyle}>{emptyText}</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header} style={thStyle}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} style={tdStyle}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatLifecyclePhase(value?: string | null) {
  const labels: Record<string,string> = {planning:"Planning",acquisition:"Acquisition",operation_maintenance:"Operation & Maintenance",retirement:"Retirement"};
  return value ? labels[value] || formatLabel(value) : "Not Recorded";
}


function formatEquipmentStatus(value?: string | null) {
  const labels: Record<string,string> = {pending_installation:"Pending Installation",pending_calibration:"Pending Calibration",pending_qualification:"Pending Qualification",pending_maintenance:"Pending Maintenance",pending_production_release:"Pending Production Release",active:"Active",retired:"Retired"};
  return value ? labels[value] || formatLabel(value) : "Not Recorded";
}

function formatEquipmentUseStatus(value?: string | null) {
  const labels: Record<string, string> = {
    available_for_use: "Active / Available for Use",
    restricted: "Restricted",
    out_of_service: "Out of Service",
    retired: "Retired",
  };
  return value ? labels[value] || formatLabel(value) : "Not Recorded";
}

function formatLabel(value?: string | null) {
  if (!value) return "Not Recorded";
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function formatDate(value?: string | null) {
  if (!value) return "Not Recorded";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replace(/ /g, "-");
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not Recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  color: "#0f172a",
  fontFamily: "Arial, sans-serif",
  padding: 24,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 18,
};

const eyebrowStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.1em",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const detailGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 10,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
};

const readinessGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 10,
};

const disabledInputStyle: React.CSSProperties = {
  ...input,
  background: "#f1f5f9",
  color: "#64748b",
};

const emptyPanelStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  background: "#f8fafc",
  color: "#64748b",
  borderRadius: 10,
  padding: 14,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  background: "#f8fafc",
  color: "#334155",
  borderBottom: "1px solid #cbd5e1",
  padding: "10px 12px",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e2e8f0",
  padding: "10px 12px",
  verticalAlign: "top",
};
