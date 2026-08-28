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
  early_window_days: number;
  late_window_days: number;
  equipment_family: string | null;
  max_events_per_day: number | null;
  max_events_per_week: number | null;
  provider_type: string | null;
  provider_name: string | null;
  procedure_document_number: string | null;
  procedure_revision: string | null;
  overdue_use_action: string;
};

type Calibration = {
  id: string;
  calibration_number: string;
  event_source: string;
  scheduled_date: string | null;
  hard_due_date: string | null;
  performed_date: string | null;
  result: string | null;
  certificate_number: string | null;
  certificate_attachments: any[];
  provider_type: string | null;
  provider_name: string | null;
  performed_by: string | null;
  comments: string | null;
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
  provider_type: string | null;
  provider_name: string | null;
  performed_by: string | null;
  procedure_document_number: string | null;
  procedure_revision: string | null;
  issue_description: string | null;
  maintenance_activities: string | null;
  service_report_attachments: any[];
  comments: string | null;
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

const tdMini: React.CSSProperties={padding:"10px",borderBottom:"1px solid #e2e8f0"};
const attachmentButton: React.CSSProperties={border:"1px solid #cbd5e1",background:"#fff",borderRadius:7,padding:"5px 8px",fontSize:12,fontWeight:700,cursor:"pointer"};

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

  const [showCalibrationConfig, setShowCalibrationConfig] = useState(false);
  const [savingCalibrationConfig, setSavingCalibrationConfig] = useState(false);
  const [calibrationConfigMessage, setCalibrationConfigMessage] = useState("");
  const [calibrationConfig, setCalibrationConfig] = useState({
    frequency_value: "12",
    frequency_unit: "months",
    schedule_mode: "fixed",
    nominal_due_date: "",
    hard_due_date: "",
    early_window_days: "0",
    late_window_days: "0",
    equipment_family: "",
    max_events_per_day: "",
    max_events_per_week: "",
    provider_type: "",
    provider_name: "",
    procedure_document_number: "",
    procedure_revision: "",
    overdue_use_action: "notification_only",
  });
  const [calibrationReminderDays, setCalibrationReminderDays] = useState<number[]>([30, 14, 7, 3, 1, 0]);

  const [showCalibrationEvent,setShowCalibrationEvent]=useState(false);
  const [savingCalibrationEvent,setSavingCalibrationEvent]=useState(false);
  const [calibrationEventMessage,setCalibrationEventMessage]=useState("");
  const [calibrationFiles,setCalibrationFiles]=useState<File[]>([]);
  const [calibrationEvent,setCalibrationEvent]=useState({
    event_source:"manual",
    performed_date:"",
    result:"pass",
    certificate_number:"",
    provider_type:"",
    provider_name:"",
    performed_by:"",
    comments:""
  });
  const [editingCalibrationEventId,setEditingCalibrationEventId]=useState<string | null>(null);
  const [existingCalibrationAttachments,setExistingCalibrationAttachments]=useState<any[]>([]);
  const [removedCalibrationAttachments,setRemovedCalibrationAttachments]=useState<any[]>([]);

  const [showPmConfig,setShowPmConfig]=useState(false);
  const [savingPmConfig,setSavingPmConfig]=useState(false);
  const [pmConfigMessage,setPmConfigMessage]=useState("");
  const [pmConfig,setPmConfig]=useState({
    frequency_value:"12",
    frequency_unit:"months",
    schedule_mode:"fixed",
    nominal_due_date:"",
    hard_due_date:"",
    early_window_days:"0",
    late_window_days:"0",
    equipment_family:"",
    max_events_per_day:"",
    max_events_per_week:"",
    provider_type:"",
    provider_name:"",
    procedure_document_number:"",
    procedure_revision:"",
    overdue_use_action:"notification_only"
  });
  const [pmReminderDays,setPmReminderDays]=useState<number[]>([30,14,7,3,1,0]);

  const [showMaintenanceEvent,setShowMaintenanceEvent]=useState(false);
  const [savingMaintenanceEvent,setSavingMaintenanceEvent]=useState(false);
  const [maintenanceEventMessage,setMaintenanceEventMessage]=useState("");
  const [maintenanceFiles,setMaintenanceFiles]=useState<File[]>([]);
  const [editingMaintenanceEventId,setEditingMaintenanceEventId]=useState<string | null>(null);
  const [existingMaintenanceAttachments,setExistingMaintenanceAttachments]=useState<any[]>([]);
  const [removedMaintenanceAttachments,setRemovedMaintenanceAttachments]=useState<any[]>([]);
  const [maintenanceEvent,setMaintenanceEvent]=useState({
    maintenance_type:"preventive",
    performed_date:"",
    result:"acceptable",
    provider_type:"",
    provider_name:"",
    performed_by:"",
    issue_description:"",
    maintenance_activities:"",
    comments:""
  });

  const [maintenanceComponents,setMaintenanceComponents]=useState<Array<{
    component_description:string;
    part_number:string;
    serial_or_lot_number:string;
    quantity:string;
    notes:string;
  }>>([]);

  const [postMaintenanceAssessment,setPostMaintenanceAssessment]=useState({
    calibration_required:false,
    calibration_rationale:"",
    requalification_required:false,
    requalification_rationale:""
  });
  const [existingPostMaintenanceAssessmentId,setExistingPostMaintenanceAssessmentId]=useState<string | null>(null);

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

  const loadCalibrationConfiguration = async (scheduleRows: Schedule[]) => {
    const existing = scheduleRows.find((item) => item.activity_type === "calibration" && item.is_active);
    if (!existing) {
      setCalibrationReminderDays([30,14,7,3,1,0]);
      return;
    }

    setCalibrationConfig({
      frequency_value: String(existing.frequency_value || 12),
      frequency_unit: existing.frequency_unit || "months",
      schedule_mode: existing.schedule_mode || "fixed",
      nominal_due_date: existing.nominal_due_date || "",
      hard_due_date: existing.hard_due_date || "",
      early_window_days: String(existing.early_window_days ?? 0),
      late_window_days: String(existing.late_window_days ?? 0),
      equipment_family: existing.equipment_family || "",
      max_events_per_day: existing.max_events_per_day == null ? "" : String(existing.max_events_per_day),
      max_events_per_week: existing.max_events_per_week == null ? "" : String(existing.max_events_per_week),
      provider_type: existing.provider_type || "",
      provider_name: existing.provider_name || "",
      procedure_document_number: existing.procedure_document_number || "",
      procedure_revision: existing.procedure_revision || "",
      overdue_use_action: existing.overdue_use_action || "notification_only",
    });

    const { data } = await supabase
      .from("equipment_schedule_notifications")
      .select("days_before_due,is_enabled")
      .eq("schedule_configuration_id", existing.id)
      .eq("is_enabled", true);

    const days = (data || []).map((row:any)=>Number(row.days_before_due)).filter(Number.isFinite).sort((a:number,b:number)=>b-a);
    setCalibrationReminderDays(days.length ? days : [30,14,7,3,1,0]);
  };


  const loadPmConfiguration = async (scheduleRows: Schedule[]) => {
    const existing = scheduleRows.find(
      (item) => item.activity_type === "preventive_maintenance" && item.is_active
    );

    if (!existing) {
      setPmReminderDays([30,14,7,3,1,0]);
      return;
    }

    setPmConfig({
      frequency_value:String(existing.frequency_value||12),
      frequency_unit:existing.frequency_unit||"months",
      schedule_mode:existing.schedule_mode||"fixed",
      nominal_due_date:existing.nominal_due_date||"",
      hard_due_date:existing.hard_due_date||"",
      early_window_days:String(existing.early_window_days??0),
      late_window_days:String(existing.late_window_days??0),
      equipment_family:existing.equipment_family||"",
      max_events_per_day:existing.max_events_per_day==null?"":String(existing.max_events_per_day),
      max_events_per_week:existing.max_events_per_week==null?"":String(existing.max_events_per_week),
      provider_type:existing.provider_type||"",
      provider_name:existing.provider_name||"",
      procedure_document_number:existing.procedure_document_number||"",
      procedure_revision:existing.procedure_revision||"",
      overdue_use_action:existing.overdue_use_action||"notification_only"
    });

    const {data}=await supabase
      .from("equipment_schedule_notifications")
      .select("days_before_due,is_enabled")
      .eq("schedule_configuration_id",existing.id)
      .eq("is_enabled",true);

    const days=(data||[])
      .map((row:any)=>Number(row.days_before_due))
      .filter(Number.isFinite)
      .sort((a:number,b:number)=>b-a);

    setPmReminderDays(days.length?days:[30,14,7,3,1,0]);
  };

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
          .select("id,calibration_number,event_source,scheduled_date,hard_due_date,performed_date,result,certificate_number,certificate_attachments,provider_type,provider_name,performed_by,comments,status,created_at")
          .eq("equipment_id", equipmentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("equipment_maintenance_events")
          .select("id,maintenance_number,maintenance_type,scheduled_date,hard_due_date,performed_date,result,provider_type,provider_name,performed_by,procedure_document_number,procedure_revision,issue_description,maintenance_activities,service_report_attachments,comments,status,created_at")
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

      const loadedSchedules = (schedulesRes.data || []) as Schedule[];
      setSchedules(loadedSchedules);
      await loadCalibrationConfiguration(loadedSchedules);
      await loadPmConfiguration(loadedSchedules);
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

  const toggleCalibrationReminder = (day:number) => {
    setCalibrationReminderDays((current) => current.includes(day) ? current.filter((d)=>d!==day) : [...current,day].sort((a,b)=>b-a));
  };

  const saveCalibrationConfiguration = async () => {
    if (!record) return;
    setCalibrationConfigMessage("");
    if (!record.calibration_required) { setCalibrationConfigMessage("Calibration is currently marked Not Required on the Equipment Master."); return; }

    const frequencyValue = Number(calibrationConfig.frequency_value);
    if (!Number.isFinite(frequencyValue) || frequencyValue <= 0) { setCalibrationConfigMessage("Calibration Frequency must be greater than zero."); return; }
    if (!calibrationConfig.nominal_due_date) { setCalibrationConfigMessage("Nominal Due Date is required."); return; }
    if (calibrationConfig.schedule_mode === "flexible" && !calibrationConfig.hard_due_date) { setCalibrationConfigMessage("Hard Due Date is required for Flexible scheduling."); return; }

    const hardDueDate = calibrationConfig.schedule_mode === "fixed" ? (calibrationConfig.hard_due_date || calibrationConfig.nominal_due_date) : calibrationConfig.hard_due_date;

    setSavingCalibrationConfig(true);
    try {
      const { data:userData } = await supabase.auth.getUser();
      const email = userData?.user?.email || "unknown";
      const payload = {
        tenant_id: record.tenant_id, equipment_id: record.id, activity_type: "calibration", is_active: true,
        frequency_value: frequencyValue, frequency_unit: calibrationConfig.frequency_unit, schedule_mode: calibrationConfig.schedule_mode,
        nominal_due_date: calibrationConfig.nominal_due_date, scheduled_service_date: null, hard_due_date: hardDueDate,
        early_window_days: Math.max(0,Number(calibrationConfig.early_window_days)||0),
        late_window_days: Math.max(0,Number(calibrationConfig.late_window_days)||0),
        equipment_family: calibrationConfig.equipment_family.trim() || null,
        max_events_per_day: calibrationConfig.max_events_per_day ? Number(calibrationConfig.max_events_per_day) : null,
        max_events_per_week: calibrationConfig.max_events_per_week ? Number(calibrationConfig.max_events_per_week) : null,
        provider_type: calibrationConfig.provider_type || null, provider_name: calibrationConfig.provider_name.trim() || null,
        procedure_document_number: calibrationConfig.procedure_document_number.trim() || null,
        procedure_revision: calibrationConfig.procedure_revision.trim() || null, overdue_use_action: calibrationConfig.overdue_use_action,
        created_by: email,
      };

      let scheduleId = calibrationSchedule?.id || "";
      if (scheduleId) {
        const { error } = await supabase.from("equipment_schedule_configurations").update(payload).eq("id",scheduleId);
        if (error) throw new Error(error.message);
      } else {
        const { data,error } = await supabase.from("equipment_schedule_configurations").insert(payload).select("id").single();
        if (error) throw new Error(error.message);
        scheduleId = data.id;
      }

      const { error:delError } = await supabase.from("equipment_schedule_notifications").delete().eq("schedule_configuration_id",scheduleId);
      if (delError) throw new Error(delError.message);
      if (calibrationReminderDays.length) {
        const rows = calibrationReminderDays.map((day)=>({tenant_id:record.tenant_id,schedule_configuration_id:scheduleId,days_before_due:day,is_enabled:true,recipient_type:"owner",recipient_email:null,notification_type:"both",created_by:email}));
        const { error } = await supabase.from("equipment_schedule_notifications").insert(rows);
        if (error) throw new Error(error.message);
      }

      await addAudit(calibrationSchedule ? "calibration_schedule_updated" : "calibration_schedule_configured", `${calibrationSchedule ? "Updated" : "Configured"} calibration: every ${frequencyValue} ${calibrationConfig.frequency_unit}; ${calibrationConfig.schedule_mode}; nominal ${calibrationConfig.nominal_due_date}; hard due ${hardDueDate}; reminders ${calibrationReminderDays.join(", ")}.`);
      setCalibrationConfigMessage("Calibration configuration saved.");
      setShowCalibrationConfig(false);
      await load();
    } catch (e:any) { setCalibrationConfigMessage(e?.message || "Unable to save calibration configuration."); }
    finally { setSavingCalibrationConfig(false); }
  };

  const resetCalibrationEventForm=()=>{
    setCalibrationEvent({event_source:"manual",performed_date:"",result:"pass",certificate_number:"",provider_type:"",provider_name:"",performed_by:"",comments:""});
    setCalibrationFiles([]);
    setExistingCalibrationAttachments([]);
    setRemovedCalibrationAttachments([]);
    setEditingCalibrationEventId(null);
    setCalibrationEventMessage("");
  };

  const editCalibrationEvent=(row:Calibration)=>{
    setEditingCalibrationEventId(row.id);
    setCalibrationEvent({
      event_source:row.event_source||"manual",
      performed_date:row.performed_date||"",
      result:row.result||"pass",
      certificate_number:row.certificate_number||"",
      provider_type:row.provider_type||"",
      provider_name:row.provider_name||"",
      performed_by:row.performed_by||"",
      comments:row.comments||""
    });
    setExistingCalibrationAttachments(Array.isArray(row.certificate_attachments)?row.certificate_attachments:[]);
    setRemovedCalibrationAttachments([]);
    setCalibrationFiles([]);
    setCalibrationEventMessage("");
    setShowCalibrationEvent(true);
    setShowCalibrationConfig(false);
  };

  const removeExistingCalibrationAttachment=(index:number)=>{
    setExistingCalibrationAttachments(current=>{
      const target=current[index];
      if(target)setRemovedCalibrationAttachments(removed=>[...removed,target]);
      return current.filter((_,i)=>i!==index);
    });
  };

  const openCalibrationAttachment=async(a:any)=>{
    const path=a?.path||a?.storage_path;
    if(!path)return;
    const {data,error}=await supabase.storage.from("controlled-documents").createSignedUrl(path,600);
    if(error||!data?.signedUrl){alert(error?.message||"Unable to open calibration attachment.");return;}
    window.open(data.signedUrl,"_blank","noopener,noreferrer");
  };

  const saveCalibrationEvent=async()=>{
    if(!record)return;
    setCalibrationEventMessage("");
    if(!calibrationEvent.performed_date){setCalibrationEventMessage("Performed Date is required.");return;}
    setSavingCalibrationEvent(true);
    try{
      const {data:userData}=await supabase.auth.getUser();
      const email=userData?.user?.email||"unknown";
      const folder=editingCalibrationEventId||crypto.randomUUID();
      const newAttachments:any[]=[];

      for(const file of calibrationFiles){
        const safe=file.name.trim().replace(/[^a-zA-Z0-9._-]+/g,"_").replace(/_+/g,"_");
        const path=`equipment/${record.id}/calibration/${folder}/${Date.now()}-${safe}`;
        const {error}=await supabase.storage.from("controlled-documents").upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type||undefined});
        if(error)throw new Error(error.message);
        newAttachments.push({name:file.name,path,size:file.size,type:file.type||null,uploaded_by:email,uploaded_at:new Date().toISOString()});
      }

      const attachments=[...existingCalibrationAttachments,...newAttachments];
      const payload={
        event_source:calibrationEvent.event_source,
        performed_date:calibrationEvent.performed_date,
        provider_type:calibrationEvent.provider_type||null,
        provider_name:calibrationEvent.provider_name.trim()||null,
        performed_by:calibrationEvent.performed_by.trim()||email,
        certificate_number:calibrationEvent.certificate_number.trim()||null,
        certificate_attachments:attachments,
        comments:calibrationEvent.comments.trim()||null,
        result:calibrationEvent.result,
        status:"completed"
      };

      let calibrationNumber="";
      if(editingCalibrationEventId){
        const {data,error}=await supabase.from("equipment_calibration_events")
          .update(payload)
          .eq("id",editingCalibrationEventId)
          .eq("equipment_id",record.id)
          .select("calibration_number")
          .single();
        if(error)throw new Error(error.message);
        calibrationNumber=data.calibration_number;
      }else{
        const createPayload={
          ...payload,
          tenant_id:record.tenant_id,
          calibration_number:"",
          equipment_id:record.id,
          schedule_configuration_id:calibrationSchedule?.id||null,
          nominal_due_date:calibrationSchedule?.nominal_due_date||null,
          scheduled_date:null,
          hard_due_date:calibrationSchedule?.hard_due_date||null,
          procedure_document_number:calibrationSchedule?.procedure_document_number||null,
          procedure_revision:calibrationSchedule?.procedure_revision||null,
          review_requirement:"optional",
          review_status:"not_required",
          created_by:email
        };
        const {data,error}=await supabase.from("equipment_calibration_events")
          .insert(createPayload)
          .select("calibration_number")
          .single();
        if(error)throw new Error(error.message);
        calibrationNumber=data.calibration_number;
      }

      const removedPaths=removedCalibrationAttachments
        .map((a:any)=>a?.path||a?.storage_path)
        .filter(Boolean);

      if(removedPaths.length){
        const {error:removeError}=await supabase.storage
          .from("controlled-documents")
          .remove(removedPaths);
        if(removeError)console.warn("Unable to remove one or more old calibration attachments:",removeError.message);
      }

      await addAudit(
        editingCalibrationEventId?"calibration_event_updated":"calibration_event_recorded",
        `Calibration ${calibrationNumber} ${editingCalibrationEventId?"updated":"recorded"}. Result: ${calibrationEvent.result}. Attachments: ${attachments.length}.`
      );

      setShowCalibrationEvent(false);
      resetCalibrationEventForm();
      await load();
    }catch(e:any){
      setCalibrationEventMessage(e?.message||"Unable to save calibration record.");
    }finally{
      setSavingCalibrationEvent(false);
    }
  };


  const togglePmReminder=(day:number)=>{
    setPmReminderDays(current=>
      current.includes(day)
        ? current.filter(item=>item!==day)
        : [...current,day].sort((a,b)=>b-a)
    );
  };

  const savePmConfiguration=async()=>{
    if(!record)return;
    setPmConfigMessage("");

    if(!record.preventive_maintenance_required){
      setPmConfigMessage("Preventive Maintenance is currently marked Not Required on the Equipment Master.");
      return;
    }

    const frequencyValue=Number(pmConfig.frequency_value);
    if(!Number.isFinite(frequencyValue)||frequencyValue<=0){
      setPmConfigMessage("Preventive Maintenance Frequency must be greater than zero.");
      return;
    }
    if(!pmConfig.nominal_due_date){
      setPmConfigMessage("Nominal Due Date is required.");
      return;
    }
    if(pmConfig.schedule_mode==="flexible"&&!pmConfig.hard_due_date){
      setPmConfigMessage("Hard Due Date is required for Flexible scheduling.");
      return;
    }

    setSavingPmConfig(true);
    try{
      const {data:userData}=await supabase.auth.getUser();
      const email=userData?.user?.email||"unknown";

      const hardDueDate=
        pmConfig.schedule_mode==="fixed"
          ? (pmConfig.hard_due_date||pmConfig.nominal_due_date)
          : pmConfig.hard_due_date;

      const payload={
        tenant_id:record.tenant_id,
        equipment_id:record.id,
        activity_type:"preventive_maintenance",
        is_active:true,
        frequency_value:frequencyValue,
        frequency_unit:pmConfig.frequency_unit,
        schedule_mode:pmConfig.schedule_mode,
        nominal_due_date:pmConfig.nominal_due_date,
        scheduled_service_date:null,
        hard_due_date:hardDueDate,
        early_window_days:Math.max(0,Number(pmConfig.early_window_days)||0),
        late_window_days:Math.max(0,Number(pmConfig.late_window_days)||0),
        equipment_family:pmConfig.equipment_family.trim()||null,
        max_events_per_day:pmConfig.max_events_per_day?Number(pmConfig.max_events_per_day):null,
        max_events_per_week:pmConfig.max_events_per_week?Number(pmConfig.max_events_per_week):null,
        provider_type:pmConfig.provider_type||null,
        provider_name:pmConfig.provider_name.trim()||null,
        procedure_document_number:pmConfig.procedure_document_number.trim()||null,
        procedure_revision:pmConfig.procedure_revision.trim()||null,
        overdue_use_action:pmConfig.overdue_use_action,
        created_by:email
      };

      let scheduleId=pmSchedule?.id||"";
      if(scheduleId){
        const {error}=await supabase
          .from("equipment_schedule_configurations")
          .update(payload)
          .eq("id",scheduleId);
        if(error)throw new Error(error.message);
      }else{
        const {data,error}=await supabase
          .from("equipment_schedule_configurations")
          .insert(payload)
          .select("id")
          .single();
        if(error)throw new Error(error.message);
        scheduleId=data.id;
      }

      const {error:deleteError}=await supabase
        .from("equipment_schedule_notifications")
        .delete()
        .eq("schedule_configuration_id",scheduleId);
      if(deleteError)throw new Error(deleteError.message);

      if(pmReminderDays.length){
        const rows=pmReminderDays.map(day=>({
          tenant_id:record.tenant_id,
          schedule_configuration_id:scheduleId,
          days_before_due:day,
          is_enabled:true,
          recipient_type:"owner",
          recipient_email:null,
          notification_type:"both",
          created_by:email
        }));

        const {error}=await supabase
          .from("equipment_schedule_notifications")
          .insert(rows);
        if(error)throw new Error(error.message);
      }

      await addAudit(
        pmSchedule?"preventive_maintenance_schedule_updated":"preventive_maintenance_schedule_configured",
        `${pmSchedule?"Updated":"Configured"} preventive maintenance schedule: every ${frequencyValue} ${pmConfig.frequency_unit}; ${pmConfig.schedule_mode}; nominal ${pmConfig.nominal_due_date}; hard due ${hardDueDate}; reminders ${pmReminderDays.join(", ")}.`
      );

      setPmConfigMessage("Preventive Maintenance configuration saved.");
      setShowPmConfig(false);
      await load();
    }catch(e:any){
      setPmConfigMessage(e?.message||"Unable to save Preventive Maintenance configuration.");
    }finally{
      setSavingPmConfig(false);
    }
  };

  const resetMaintenanceEventForm=()=>{
    setMaintenanceEvent({
      maintenance_type:"preventive",
      performed_date:"",
      result:"acceptable",
      provider_type:"",
      provider_name:"",
      performed_by:"",
      issue_description:"",
      maintenance_activities:"",
      comments:""
    });
    setMaintenanceFiles([]);
    setExistingMaintenanceAttachments([]);
    setRemovedMaintenanceAttachments([]);
    setEditingMaintenanceEventId(null);
    setMaintenanceComponents([]);
    setPostMaintenanceAssessment({
      calibration_required:false,
      calibration_rationale:"",
      requalification_required:false,
      requalification_rationale:""
    });
    setExistingPostMaintenanceAssessmentId(null);
    setMaintenanceEventMessage("");
  };

  const addMaintenanceComponent=()=>{
    setMaintenanceComponents(current=>[
      ...current,
      {
        component_description:"",
        part_number:"",
        serial_or_lot_number:"",
        quantity:"1",
        notes:""
      }
    ]);
  };

  const updateMaintenanceComponent=(index:number,key:string,value:string)=>{
    setMaintenanceComponents(current=>
      current.map((row,i)=>i===index?{...row,[key]:value}:row)
    );
  };

  const removeMaintenanceComponent=(index:number)=>{
    setMaintenanceComponents(current=>current.filter((_,i)=>i!==index));
  };

  const openMaintenanceAttachment=async(attachment:any)=>{
    const path=attachment?.path||attachment?.storage_path;
    if(!path)return;

    const {data,error}=await supabase.storage
      .from("controlled-documents")
      .createSignedUrl(path,600);

    if(error||!data?.signedUrl){
      alert(error?.message||"Unable to open maintenance attachment.");
      return;
    }
    window.open(data.signedUrl,"_blank","noopener,noreferrer");
  };

  const editMaintenanceEvent=async(row:Maintenance)=>{
    setEditingMaintenanceEventId(row.id);
    setMaintenanceEvent({
      maintenance_type:row.maintenance_type||"preventive",
      performed_date:row.performed_date||"",
      result:row.result||"acceptable",
      provider_type:row.provider_type||"",
      provider_name:row.provider_name||"",
      performed_by:row.performed_by||"",
      issue_description:row.issue_description||"",
      maintenance_activities:row.maintenance_activities||"",
      comments:row.comments||""
    });
    setExistingMaintenanceAttachments(
      Array.isArray(row.service_report_attachments)
        ? row.service_report_attachments
        : []
    );
    setRemovedMaintenanceAttachments([]);
    setMaintenanceFiles([]);
    setMaintenanceEventMessage("");

    const [componentsRes,assessmentRes]=await Promise.all([
      supabase
        .from("equipment_maintenance_components")
        .select("component_description,part_number,serial_or_lot_number,quantity,notes")
        .eq("maintenance_event_id",row.id)
        .order("created_at",{ascending:true}),
      supabase
        .from("equipment_post_maintenance_assessments")
        .select("id,calibration_required,calibration_rationale,requalification_required,requalification_rationale")
        .eq("maintenance_event_id",row.id)
        .maybeSingle()
    ]);

    setMaintenanceComponents(
      (componentsRes.data||[]).map((component:any)=>({
        component_description:component.component_description||"",
        part_number:component.part_number||"",
        serial_or_lot_number:component.serial_or_lot_number||"",
        quantity:component.quantity==null?"":String(component.quantity),
        notes:component.notes||""
      }))
    );

    if(assessmentRes.data){
      setExistingPostMaintenanceAssessmentId(assessmentRes.data.id);
      setPostMaintenanceAssessment({
        calibration_required:!!assessmentRes.data.calibration_required,
        calibration_rationale:assessmentRes.data.calibration_rationale||"",
        requalification_required:!!assessmentRes.data.requalification_required,
        requalification_rationale:assessmentRes.data.requalification_rationale||""
      });
    }else{
      setExistingPostMaintenanceAssessmentId(null);
      setPostMaintenanceAssessment({
        calibration_required:false,
        calibration_rationale:"",
        requalification_required:false,
        requalification_rationale:""
      });
    }

    setShowMaintenanceEvent(true);
    setShowPmConfig(false);
  };

  const removeExistingMaintenanceAttachment=(index:number)=>{
    setExistingMaintenanceAttachments(current=>{
      const target=current[index];
      if(target)setRemovedMaintenanceAttachments(removed=>[...removed,target]);
      return current.filter((_,i)=>i!==index);
    });
  };

  const saveMaintenanceEvent=async()=>{
    if(!record)return;
    setMaintenanceEventMessage("");

    if(!maintenanceEvent.performed_date){
      setMaintenanceEventMessage("Performed Date is required.");
      return;
    }

    if(!maintenanceEvent.maintenance_activities.trim()){
      setMaintenanceEventMessage(
        maintenanceEvent.maintenance_type==="unplanned"
          ? "Repair Activities are required."
          : "Maintenance Activities are required."
      );
      return;
    }

    if(
      maintenanceEvent.maintenance_type==="unplanned" &&
      !maintenanceEvent.issue_description.trim()
    ){
      setMaintenanceEventMessage("Issue Description is required for Unplanned Maintenance.");
      return;
    }

    const assessmentEnabled=
      maintenanceEvent.maintenance_type==="unplanned" &&
      record.post_unplanned_maintenance_assessment!=="disabled";

    if(
      assessmentEnabled &&
      postMaintenanceAssessment.calibration_required &&
      !postMaintenanceAssessment.calibration_rationale.trim()
    ){
      setMaintenanceEventMessage(
        "Calibration rationale is required when post-maintenance calibration is required."
      );
      return;
    }

    if(
      assessmentEnabled &&
      postMaintenanceAssessment.requalification_required &&
      !postMaintenanceAssessment.requalification_rationale.trim()
    ){
      setMaintenanceEventMessage(
        "Requalification rationale is required when requalification is required."
      );
      return;
    }

    setSavingMaintenanceEvent(true);

    try{
      const {data:userData}=await supabase.auth.getUser();
      const email=userData?.user?.email||"unknown";
      const folder=editingMaintenanceEventId||crypto.randomUUID();
      const newAttachments:any[]=[];

      for(const file of maintenanceFiles){
        const safe=file.name
          .trim()
          .replace(/[^a-zA-Z0-9._-]+/g,"_")
          .replace(/_+/g,"_");

        const path=`equipment/${record.id}/maintenance/${folder}/${Date.now()}-${safe}`;

        const {error}=await supabase.storage
          .from("controlled-documents")
          .upload(path,file,{
            cacheControl:"3600",
            upsert:false,
            contentType:file.type||undefined
          });

        if(error)throw new Error(error.message);

        newAttachments.push({
          name:file.name,
          path,
          size:file.size,
          type:file.type||null,
          uploaded_by:email,
          uploaded_at:new Date().toISOString()
        });
      }

      const attachments=[
        ...existingMaintenanceAttachments,
        ...newAttachments
      ];

      const basePayload={
        maintenance_type:maintenanceEvent.maintenance_type,
        performed_date:maintenanceEvent.performed_date,
        performed_by:maintenanceEvent.performed_by.trim()||email,
        provider_type:maintenanceEvent.provider_type||null,
        provider_name:maintenanceEvent.provider_name.trim()||null,
        issue_description:
          maintenanceEvent.maintenance_type==="unplanned"
            ? maintenanceEvent.issue_description.trim()
            : (maintenanceEvent.issue_description.trim()||null),
        maintenance_activities:maintenanceEvent.maintenance_activities.trim(),
        result:maintenanceEvent.result,
        service_report_attachments:attachments,
        comments:maintenanceEvent.comments.trim()||null,
        status:
          maintenanceEvent.maintenance_type==="unplanned" && assessmentEnabled
            ? "assessment"
            : "completed"
      };

      let eventId=editingMaintenanceEventId||"";
      let maintenanceNumber="";

      if(editingMaintenanceEventId){
        const {data,error}=await supabase
          .from("equipment_maintenance_events")
          .update(basePayload)
          .eq("id",editingMaintenanceEventId)
          .eq("equipment_id",record.id)
          .select("id,maintenance_number")
          .single();

        if(error)throw new Error(error.message);
        eventId=data.id;
        maintenanceNumber=data.maintenance_number;

        const {error:componentDeleteError}=await supabase
          .from("equipment_maintenance_components")
          .delete()
          .eq("maintenance_event_id",eventId);
        if(componentDeleteError)throw new Error(componentDeleteError.message);
      }else{
        const createPayload={
          ...basePayload,
          tenant_id:record.tenant_id,
          maintenance_number:"",
          equipment_id:record.id,
          schedule_configuration_id:
            maintenanceEvent.maintenance_type==="preventive"
              ? (pmSchedule?.id||null)
              : null,
          nominal_due_date:
            maintenanceEvent.maintenance_type==="preventive"
              ? (pmSchedule?.nominal_due_date||null)
              : null,
          scheduled_date:null,
          hard_due_date:
            maintenanceEvent.maintenance_type==="preventive"
              ? (pmSchedule?.hard_due_date||null)
              : null,
          procedure_document_number:
            maintenanceEvent.maintenance_type==="preventive"
              ? (pmSchedule?.procedure_document_number||null)
              : null,
          procedure_revision:
            maintenanceEvent.maintenance_type==="preventive"
              ? (pmSchedule?.procedure_revision||null)
              : null,
          review_requirement:"optional",
          review_status:"not_required",
          created_by:email
        };

        const {data,error}=await supabase
          .from("equipment_maintenance_events")
          .insert(createPayload)
          .select("id,maintenance_number")
          .single();

        if(error)throw new Error(error.message);
        eventId=data.id;
        maintenanceNumber=data.maintenance_number;
      }

      const validComponents=maintenanceComponents.filter(
        component=>component.component_description.trim()
      );

      if(validComponents.length){
        const componentRows=validComponents.map(component=>({
          tenant_id:record.tenant_id,
          maintenance_event_id:eventId,
          component_description:component.component_description.trim(),
          part_number:component.part_number.trim()||null,
          serial_or_lot_number:component.serial_or_lot_number.trim()||null,
          quantity:component.quantity?Number(component.quantity):null,
          notes:component.notes.trim()||null,
          created_by:email
        }));

        const {error}=await supabase
          .from("equipment_maintenance_components")
          .insert(componentRows);
        if(error)throw new Error(error.message);
      }

      if(assessmentEnabled){
        const assessmentPayload={
          tenant_id:record.tenant_id,
          maintenance_event_id:eventId,
          equipment_id:record.id,
          calibration_required:postMaintenanceAssessment.calibration_required,
          calibration_rationale:
            postMaintenanceAssessment.calibration_rationale.trim()||null,
          requalification_required:postMaintenanceAssessment.requalification_required,
          requalification_rationale:
            postMaintenanceAssessment.requalification_rationale.trim()||null,
          completed_by:email,
          completed_at:new Date().toISOString(),
          created_by:email
        };

        if(existingPostMaintenanceAssessmentId){
          const {error}=await supabase
            .from("equipment_post_maintenance_assessments")
            .update(assessmentPayload)
            .eq("id",existingPostMaintenanceAssessmentId);
          if(error)throw new Error(error.message);
        }else{
          const {error}=await supabase
            .from("equipment_post_maintenance_assessments")
            .insert(assessmentPayload);
          if(error)throw new Error(error.message);
        }

        const {error:eventStatusError}=await supabase
          .from("equipment_maintenance_events")
          .update({status:"completed"})
          .eq("id",eventId);

        if(eventStatusError)throw new Error(eventStatusError.message);
      }else if(existingPostMaintenanceAssessmentId){
        const {error}=await supabase
          .from("equipment_post_maintenance_assessments")
          .delete()
          .eq("id",existingPostMaintenanceAssessmentId);
        if(error)throw new Error(error.message);
      }

      const removedPaths=removedMaintenanceAttachments
        .map((attachment:any)=>attachment?.path||attachment?.storage_path)
        .filter(Boolean);

      if(removedPaths.length){
        const {error}=await supabase.storage
          .from("controlled-documents")
          .remove(removedPaths);

        if(error){
          console.warn(
            "Unable to remove one or more old maintenance attachments:",
            error.message
          );
        }
      }

      await addAudit(
        editingMaintenanceEventId
          ? "maintenance_event_updated"
          : "maintenance_event_recorded",
        `Maintenance ${maintenanceNumber} ${editingMaintenanceEventId?"updated":"recorded"}. Type: ${maintenanceEvent.maintenance_type}. Result: ${maintenanceEvent.result}. Attachments: ${attachments.length}. Components: ${validComponents.length}.`
      );

      setShowMaintenanceEvent(false);
      resetMaintenanceEventForm();
      await load();
    }catch(e:any){
      setMaintenanceEventMessage(e?.message||"Unable to save maintenance record.");
    }finally{
      setSavingMaintenanceEvent(false);
    }
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
          action={
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {record.calibration_required ? (
                <>
                  <button
                    type="button"
                    style={secondaryButton}
                    onClick={()=>{
                      resetCalibrationEventForm();
                      setShowCalibrationEvent(v=>!v);
                    }}
                  >
                    {showCalibrationEvent ? "Close Calibration Record" : "Add Calibration Record"}
                  </button>
                  <button
                    type="button"
                    style={primaryButton}
                    onClick={()=>{
                      setCalibrationConfigMessage("");
                      setShowCalibrationConfig(v=>!v);
                    }}
                  >
                    {showCalibrationConfig
                      ? "Close Calibration Configuration"
                      : calibrationSchedule
                      ? "Edit Calibration Configuration"
                      : "Configure Calibration"}
                  </button>
                </>
              ) : (
                <button disabled style={disabledButton}>Calibration Not Required</button>
              )}
            </div>
          }
        />

        {showCalibrationConfig && record.calibration_required ? (
          <div style={{border:"1px solid #bfdbfe",background:"#f8fbff",borderRadius:12,padding:16,marginBottom:20}}>
            <h3 style={{margin:"0 0 5px"}}>Calibration Configuration</h3>
            <p style={{margin:"0 0 14px",color:"#64748b",fontSize:13}}>Configure the recurring calibration requirement and scheduling rules. The customer's calibration procedure remains the controlling instruction.</p>

            <div style={formGridStyle}>
              <EditField label="Frequency"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><input type="number" min="1" value={calibrationConfig.frequency_value} onChange={e=>setCalibrationConfig({...calibrationConfig,frequency_value:e.target.value})} style={input}/><select value={calibrationConfig.frequency_unit} onChange={e=>setCalibrationConfig({...calibrationConfig,frequency_unit:e.target.value})} style={input}><option value="days">Days</option><option value="weeks">Weeks</option><option value="months">Months</option><option value="years">Years</option></select></div></EditField>
              <EditField label="Schedule Type"><select value={calibrationConfig.schedule_mode} onChange={e=>setCalibrationConfig({...calibrationConfig,schedule_mode:e.target.value})} style={input}><option value="fixed">Fixed</option><option value="flexible">Flexible</option></select></EditField>
              <EditField label="Nominal Due Date"><input type="date" value={calibrationConfig.nominal_due_date} onChange={e=>setCalibrationConfig({...calibrationConfig,nominal_due_date:e.target.value})} style={input}/></EditField>
              
              <EditField label="Hard Due Date"><input type="date" value={calibrationConfig.hard_due_date} onChange={e=>setCalibrationConfig({...calibrationConfig,hard_due_date:e.target.value})} style={input}/></EditField>
              <EditField label="Overdue Use Action"><select value={calibrationConfig.overdue_use_action} onChange={e=>setCalibrationConfig({...calibrationConfig,overdue_use_action:e.target.value})} style={input}><option value="notification_only">Notification Only</option><option value="restricted">Restricted</option><option value="out_of_service">Out of Service</option></select></EditField>

              {calibrationConfig.schedule_mode==="flexible" ? <>
                <EditField label="Early Window (Days)"><input type="number" min="0" value={calibrationConfig.early_window_days} onChange={e=>setCalibrationConfig({...calibrationConfig,early_window_days:e.target.value})} style={input}/></EditField>
                <EditField label="Late Window (Days)"><input type="number" min="0" value={calibrationConfig.late_window_days} onChange={e=>setCalibrationConfig({...calibrationConfig,late_window_days:e.target.value})} style={input}/></EditField>
                <EditField label="Equipment Family / Scheduling Group"><input value={calibrationConfig.equipment_family} onChange={e=>setCalibrationConfig({...calibrationConfig,equipment_family:e.target.value})} placeholder="e.g., Torque Testers" style={input}/></EditField>
                <EditField label="Maximum Events Per Day"><input type="number" min="1" value={calibrationConfig.max_events_per_day} onChange={e=>setCalibrationConfig({...calibrationConfig,max_events_per_day:e.target.value})} placeholder="Optional" style={input}/></EditField>
                <EditField label="Maximum Events Per Week"><input type="number" min="1" value={calibrationConfig.max_events_per_week} onChange={e=>setCalibrationConfig({...calibrationConfig,max_events_per_week:e.target.value})} placeholder="Optional" style={input}/></EditField>
              </> : null}

              <EditField label="Provider Type"><select value={calibrationConfig.provider_type} onChange={e=>setCalibrationConfig({...calibrationConfig,provider_type:e.target.value})} style={input}><option value="">Not Specified</option><option value="internal">Internal</option><option value="external">External</option></select></EditField>
              <EditField label="Calibration Provider"><input value={calibrationConfig.provider_name} onChange={e=>setCalibrationConfig({...calibrationConfig,provider_name:e.target.value})} placeholder="Internal group or external provider" style={input}/></EditField>
              <EditField label="Calibration Procedure Number"><input value={calibrationConfig.procedure_document_number} onChange={e=>setCalibrationConfig({...calibrationConfig,procedure_document_number:e.target.value})} placeholder="Controlled document number" style={input}/></EditField>
              <EditField label="Procedure Revision"><input value={calibrationConfig.procedure_revision} onChange={e=>setCalibrationConfig({...calibrationConfig,procedure_revision:e.target.value})} placeholder="Revision" style={input}/></EditField>
            </div>

            {calibrationConfig.schedule_mode==="flexible" ? <div style={{marginTop:14,border:"1px solid #bfdbfe",background:"#eff6ff",borderRadius:10,padding:12,color:"#1e3a8a",fontSize:13,lineHeight:1.5}}><strong>Flexible Scheduling:</strong> QualiSphere stores the allowable window, equipment family, and capacity rules so future fleet-balancing logic can distribute equivalent equipment without exceeding the Hard Due Date.</div> : null}

            <div style={{marginTop:18}}><div style={fieldLabel}>Calibration Notifications</div><div style={{color:"#64748b",fontSize:13,marginBottom:8}}>Progressive reminders to the equipment owner.</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[30,14,7,3,1,0].map(day=>{const selected=calibrationReminderDays.includes(day);return <label key={day} style={{display:"inline-flex",alignItems:"center",gap:6,border:selected?"1px solid #86efac":"1px solid #cbd5e1",background:selected?"#f0fdf4":"#fff",borderRadius:999,padding:"6px 10px",cursor:"pointer",fontSize:13,fontWeight:700}}><input type="checkbox" checked={selected} onChange={()=>toggleCalibrationReminder(day)}/>{day===0?"Due Date":`${day} Days`}</label>})}</div></div>

            {calibrationConfigMessage ? <div style={{marginTop:14,border:calibrationConfigMessage.includes("saved")?"1px solid #86efac":"1px solid #fecaca",background:calibrationConfigMessage.includes("saved")?"#f0fdf4":"#fef2f2",color:calibrationConfigMessage.includes("saved")?"#166534":"#991b1b",borderRadius:10,padding:10}}>{calibrationConfigMessage}</div> : null}

            <div style={{display:"flex",justifyContent:"flex-end",gap:10,flexWrap:"wrap",marginTop:16}}><button type="button" style={secondaryButton} onClick={()=>{setShowCalibrationConfig(false);setCalibrationConfigMessage("");load();}}>Cancel</button><button type="button" style={{...primaryButton,opacity:savingCalibrationConfig?0.6:1}} disabled={savingCalibrationConfig} onClick={saveCalibrationConfiguration}>{savingCalibrationConfig?"Saving...":calibrationSchedule?"Save Calibration Changes":"Save Calibration Configuration"}</button></div>
          </div>
        ) : null}

        {showCalibrationEvent&&record.calibration_required?(
          <div style={{border:"1px solid #cbd5e1",background:"#fff",borderRadius:12,padding:16,marginBottom:20}}>
            <h3 style={{margin:"0 0 5px"}}>{editingCalibrationEventId?"Update Calibration Record":"Add Calibration Record"}</h3>
            <p style={{margin:"0 0 14px",color:"#64748b",fontSize:13}}>{editingCalibrationEventId?"Update the calibration event, comments, and supporting records.":"Record a calibration event and attach one or more supporting calibration records."}</p>
            <div style={formGridStyle}>
              <EditField label="Event Source"><select value={calibrationEvent.event_source} onChange={e=>setCalibrationEvent({...calibrationEvent,event_source:e.target.value})} style={input}><option value="manual">Manual / Historical</option><option value="scheduled">Scheduled</option><option value="post_maintenance">Post Maintenance</option><option value="other">Other</option></select></EditField>
              <EditField label="Performed Date"><input type="date" value={calibrationEvent.performed_date} onChange={e=>setCalibrationEvent({...calibrationEvent,performed_date:e.target.value})} style={input}/></EditField>
              <EditField label="Result"><select value={calibrationEvent.result} onChange={e=>setCalibrationEvent({...calibrationEvent,result:e.target.value})} style={input}><option value="pass">Pass</option><option value="oot">OOT</option><option value="oos">OOS</option></select></EditField>
              <EditField label="Certificate / Record Number"><input value={calibrationEvent.certificate_number} onChange={e=>setCalibrationEvent({...calibrationEvent,certificate_number:e.target.value})} style={input}/></EditField>
              <EditField label="Provider Type"><select value={calibrationEvent.provider_type} onChange={e=>setCalibrationEvent({...calibrationEvent,provider_type:e.target.value})} style={input}><option value="">Not Specified</option><option value="internal">Internal</option><option value="external">External</option></select></EditField>
              <EditField label="Calibration Provider"><input value={calibrationEvent.provider_name} onChange={e=>setCalibrationEvent({...calibrationEvent,provider_name:e.target.value})} style={input}/></EditField>
              <EditField label="Performed By"><input value={calibrationEvent.performed_by} onChange={e=>setCalibrationEvent({...calibrationEvent,performed_by:e.target.value})} style={input}/></EditField>
            </div>
            <div style={{marginTop:14}}><EditField label="Comments"><textarea rows={3} value={calibrationEvent.comments} onChange={e=>setCalibrationEvent({...calibrationEvent,comments:e.target.value})} style={{...input,resize:"vertical"}}/></EditField></div>
            <div style={{marginTop:18}}>
              <div style={fieldLabel}>Calibration Record Attachments</div>
              <div style={{color:"#64748b",fontSize:13,marginBottom:8}}>Attach multiple certificates, as-found/as-left data, vendor reports, worksheets, or traceability records.</div>
              {existingCalibrationAttachments.length? <div style={{display:"grid",gap:8,marginBottom:10}}>{existingCalibrationAttachments.map((a:any,i:number)=><div key={`${a?.path||a?.name||"attachment"}-${i}`} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,border:"1px solid #bfdbfe",background:"#eff6ff",borderRadius:9,padding:"8px 10px"}}><button type="button" style={attachmentButton} onClick={()=>openCalibrationAttachment(a)}>{a?.name||`Attachment ${i+1}`}</button><button type="button" style={secondaryButton} onClick={()=>removeExistingCalibrationAttachment(i)}>Remove</button></div>)}</div>:null}
              <input type="file" multiple onChange={e=>{const f=Array.from(e.target.files||[]);setCalibrationFiles(c=>[...c,...f]);e.currentTarget.value="";}} style={input}/>
              {calibrationFiles.length? <div style={{display:"grid",gap:8,marginTop:10}}>{calibrationFiles.map((f,i)=><div key={`${f.name}-${i}`} style={{display:"flex",justifyContent:"space-between",alignItems:"center",border:"1px solid #e2e8f0",borderRadius:9,padding:"8px 10px"}}><span><strong>{f.name}</strong> · {Math.max(1,Math.round(f.size/1024))} KB</span><button type="button" style={secondaryButton} onClick={()=>setCalibrationFiles(c=>c.filter((_,x)=>x!==i))}>Remove</button></div>)}</div>:null}
            </div>
            {calibrationEventMessage?<div style={{marginTop:14,border:"1px solid #fecaca",background:"#fef2f2",color:"#991b1b",borderRadius:10,padding:10}}>{calibrationEventMessage}</div>:null}
            <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:16}}><button type="button" style={secondaryButton} onClick={()=>{setShowCalibrationEvent(false);resetCalibrationEventForm();}}>Cancel</button><button type="button" style={{...primaryButton,opacity:savingCalibrationEvent?0.6:1}} disabled={savingCalibrationEvent} onClick={saveCalibrationEvent}>{savingCalibrationEvent?"Saving...":editingCalibrationEventId?"Update Calibration Record":"Save Calibration Record"}</button></div>
          </div>
        ):null}

        <ScheduleSummary
          required={record.calibration_required}
          schedule={calibrationSchedule}
          emptyText="No calibration schedule configured."
        />

        <div style={{marginTop:18}}>
          <h3 style={{margin:"0 0 10px"}}>Calibration History</h3>
          {calibrations.length===0?<div style={emptyPanelStyle}>No calibration events recorded.</div>:<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:1100}}>
              <thead><tr>{["Event","Performed","Result","Certificate / Record","Provider","Comments","Attachments","Status","Action"].map(h=><th key={h} style={{textAlign:"left",padding:"9px 10px",borderBottom:"1px solid #cbd5e1"}}>{h}</th>)}</tr></thead>
              <tbody>{calibrations.map(row=>{
                const a=Array.isArray(row.certificate_attachments)?row.certificate_attachments:[];
                return <tr key={row.id}>
                  <td style={tdMini}><strong>{row.calibration_number}</strong></td>
                  <td style={tdMini}>{formatDate(row.performed_date)}</td>
                  <td style={tdMini}>{formatLabel(row.result)}</td>
                  <td style={tdMini}>{row.certificate_number||"Not Recorded"}</td>
                  <td style={tdMini}>{row.provider_name||"Not Recorded"}</td>
                  <td style={{...tdMini,maxWidth:260,whiteSpace:"pre-wrap"}}>{row.comments||"Not Recorded"}</td>
                  <td style={tdMini}>{a.length===0?"None":<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{a.map((x:any,i:number)=><button key={`${x?.path||x?.name||i}`} type="button" style={attachmentButton} onClick={()=>openCalibrationAttachment(x)}>{x?.name||`Attachment ${i+1}`}</button>)}</div>}</td>
                  <td style={tdMini}>{formatLabel(row.status)}</td>
                  <td style={tdMini}><button type="button" style={secondaryButton} onClick={()=>editCalibrationEvent(row)}>Edit</button></td>
                </tr>
              })}</tbody>
            </table>
          </div>}
        </div>
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <SectionHeader
          title="5. Preventive / Unplanned Maintenance"
          subtitle="Preventive Maintenance uses controlled Fixed/Flexible scheduling. Unplanned Maintenance captures the issue, repair, major components replaced, and the optional post-maintenance calibration/requalification assessment."
          action={
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button
                type="button"
                style={secondaryButton}
                onClick={()=>{
                  resetMaintenanceEventForm();
                  setShowMaintenanceEvent(current=>!current);
                }}
              >
                {showMaintenanceEvent?"Close Maintenance Record":"Add Maintenance Record"}
              </button>

              {record.preventive_maintenance_required ? (
                <button
                  type="button"
                  style={primaryButton}
                  onClick={()=>{
                    setPmConfigMessage("");
                    setShowPmConfig(current=>!current);
                  }}
                >
                  {showPmConfig
                    ? "Close PM Configuration"
                    : pmSchedule
                    ? "Edit PM Configuration"
                    : "Configure Preventive Maintenance"}
                </button>
              ) : null}
            </div>
          }
        />

        {showPmConfig && record.preventive_maintenance_required ? (
          <div style={{border:"1px solid #bfdbfe",background:"#f8fbff",borderRadius:12,padding:16,marginBottom:20}}>
            <h3 style={{margin:"0 0 5px"}}>Preventive Maintenance Configuration</h3>
            <p style={{margin:"0 0 14px",color:"#64748b",fontSize:13}}>
              Configure the recurring PM requirement and scheduling rules. The maintenance procedure remains the controlling instruction.
            </p>

            <div style={formGridStyle}>
              <EditField label="Frequency">
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <input type="number" min="1" value={pmConfig.frequency_value} onChange={e=>setPmConfig({...pmConfig,frequency_value:e.target.value})} style={input}/>
                  <select value={pmConfig.frequency_unit} onChange={e=>setPmConfig({...pmConfig,frequency_unit:e.target.value})} style={input}>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </div>
              </EditField>

              <EditField label="Schedule Type">
                <select value={pmConfig.schedule_mode} onChange={e=>setPmConfig({...pmConfig,schedule_mode:e.target.value})} style={input}>
                  <option value="fixed">Fixed</option>
                  <option value="flexible">Flexible</option>
                </select>
              </EditField>

              <EditField label="Nominal Due Date">
                <input type="date" value={pmConfig.nominal_due_date} onChange={e=>setPmConfig({...pmConfig,nominal_due_date:e.target.value})} style={input}/>
              </EditField>

              <EditField label="Hard Due Date">
                <input type="date" value={pmConfig.hard_due_date} onChange={e=>setPmConfig({...pmConfig,hard_due_date:e.target.value})} style={input}/>
              </EditField>

              <EditField label="Overdue Use Action">
                <select value={pmConfig.overdue_use_action} onChange={e=>setPmConfig({...pmConfig,overdue_use_action:e.target.value})} style={input}>
                  <option value="notification_only">Notification Only</option>
                  <option value="restricted">Restricted</option>
                  <option value="out_of_service">Out of Service</option>
                </select>
              </EditField>

              {pmConfig.schedule_mode==="flexible" ? (
                <>
                  <EditField label="Early Window (Days)">
                    <input type="number" min="0" value={pmConfig.early_window_days} onChange={e=>setPmConfig({...pmConfig,early_window_days:e.target.value})} style={input}/>
                  </EditField>
                  <EditField label="Late Window (Days)">
                    <input type="number" min="0" value={pmConfig.late_window_days} onChange={e=>setPmConfig({...pmConfig,late_window_days:e.target.value})} style={input}/>
                  </EditField>
                  <EditField label="Equipment Family / Scheduling Group">
                    <input value={pmConfig.equipment_family} onChange={e=>setPmConfig({...pmConfig,equipment_family:e.target.value})} placeholder="e.g., Torque Testers" style={input}/>
                  </EditField>
                  <EditField label="Maximum Events Per Day">
                    <input type="number" min="1" value={pmConfig.max_events_per_day} onChange={e=>setPmConfig({...pmConfig,max_events_per_day:e.target.value})} placeholder="Optional" style={input}/>
                  </EditField>
                  <EditField label="Maximum Events Per Week">
                    <input type="number" min="1" value={pmConfig.max_events_per_week} onChange={e=>setPmConfig({...pmConfig,max_events_per_week:e.target.value})} placeholder="Optional" style={input}/>
                  </EditField>
                </>
              ) : null}

              <EditField label="Provider Type">
                <select value={pmConfig.provider_type} onChange={e=>setPmConfig({...pmConfig,provider_type:e.target.value})} style={input}>
                  <option value="">Not Specified</option>
                  <option value="internal">Internal</option>
                  <option value="external">External</option>
                </select>
              </EditField>

              <EditField label="Maintenance Provider">
                <input value={pmConfig.provider_name} onChange={e=>setPmConfig({...pmConfig,provider_name:e.target.value})} placeholder="Internal group or external provider" style={input}/>
              </EditField>

              <EditField label="Maintenance Procedure Number">
                <input value={pmConfig.procedure_document_number} onChange={e=>setPmConfig({...pmConfig,procedure_document_number:e.target.value})} placeholder="Controlled document number" style={input}/>
              </EditField>

              <EditField label="Procedure Revision">
                <input value={pmConfig.procedure_revision} onChange={e=>setPmConfig({...pmConfig,procedure_revision:e.target.value})} placeholder="Revision" style={input}/>
              </EditField>
            </div>

            {pmConfig.schedule_mode==="flexible" ? (
              <div style={{marginTop:14,border:"1px solid #bfdbfe",background:"#eff6ff",borderRadius:10,padding:12,color:"#1e3a8a",fontSize:13,lineHeight:1.5}}>
                <strong>Flexible Scheduling:</strong> QualiSphere stores the allowable window, equipment family, and capacity rules so future fleet-balancing logic can distribute equivalent PM activities without exceeding the Hard Due Date.
              </div>
            ) : null}

            <div style={{marginTop:18}}>
              <div style={fieldLabel}>Preventive Maintenance Notifications</div>
              <div style={{color:"#64748b",fontSize:13,marginBottom:8}}>Progressive reminders to the equipment owner.</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[30,14,7,3,1,0].map(day=>{
                  const selected=pmReminderDays.includes(day);
                  return (
                    <label key={day} style={{display:"inline-flex",alignItems:"center",gap:6,border:selected?"1px solid #86efac":"1px solid #cbd5e1",background:selected?"#f0fdf4":"#fff",borderRadius:999,padding:"6px 10px",cursor:"pointer",fontSize:13,fontWeight:700}}>
                      <input type="checkbox" checked={selected} onChange={()=>togglePmReminder(day)}/>
                      {day===0?"Due Date":`${day} Days`}
                    </label>
                  );
                })}
              </div>
            </div>

            {pmConfigMessage ? (
              <div style={{marginTop:14,border:pmConfigMessage.includes("saved")?"1px solid #86efac":"1px solid #fecaca",background:pmConfigMessage.includes("saved")?"#f0fdf4":"#fef2f2",color:pmConfigMessage.includes("saved")?"#166534":"#991b1b",borderRadius:10,padding:10}}>
                {pmConfigMessage}
              </div>
            ) : null}

            <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:16}}>
              <button type="button" style={secondaryButton} onClick={()=>{setShowPmConfig(false);setPmConfigMessage("");load();}}>Cancel</button>
              <button type="button" style={{...primaryButton,opacity:savingPmConfig?0.6:1}} disabled={savingPmConfig} onClick={savePmConfiguration}>
                {savingPmConfig?"Saving...":pmSchedule?"Save PM Changes":"Save PM Configuration"}
              </button>
            </div>
          </div>
        ) : null}

        {showMaintenanceEvent ? (
          <div style={{border:"1px solid #cbd5e1",background:"#fff",borderRadius:12,padding:16,marginBottom:20}}>
            <h3 style={{margin:"0 0 5px"}}>
              {editingMaintenanceEventId?"Update Maintenance Record":"Add Maintenance Record"}
            </h3>
            <p style={{margin:"0 0 14px",color:"#64748b",fontSize:13}}>
              Preventive and unplanned maintenance are retained as permanent equipment history.
            </p>

            <div style={formGridStyle}>
              <EditField label="Maintenance Type">
                <select
                  value={maintenanceEvent.maintenance_type}
                  onChange={e=>{
                    const next=e.target.value;
                    setMaintenanceEvent({...maintenanceEvent,maintenance_type:next});
                    if(next==="preventive"){
                      setPostMaintenanceAssessment({
                        calibration_required:false,
                        calibration_rationale:"",
                        requalification_required:false,
                        requalification_rationale:""
                      });
                    }
                  }}
                  style={input}
                >
                  <option value="preventive">Preventive Maintenance</option>
                  <option value="unplanned">Unplanned Maintenance / Repair</option>
                </select>
              </EditField>

              <EditField label="Performed Date">
                <input type="date" value={maintenanceEvent.performed_date} onChange={e=>setMaintenanceEvent({...maintenanceEvent,performed_date:e.target.value})} style={input}/>
              </EditField>

              <EditField label="Result">
                <select value={maintenanceEvent.result} onChange={e=>setMaintenanceEvent({...maintenanceEvent,result:e.target.value})} style={input}>
                  <option value="acceptable">Acceptable</option>
                  <option value="issue_identified">Issue Identified</option>
                  <option value="unable_to_complete">Unable to Complete</option>
                </select>
              </EditField>

              <EditField label="Provider Type">
                <select value={maintenanceEvent.provider_type} onChange={e=>setMaintenanceEvent({...maintenanceEvent,provider_type:e.target.value})} style={input}>
                  <option value="">Not Specified</option>
                  <option value="internal">Internal</option>
                  <option value="external">External</option>
                </select>
              </EditField>

              <EditField label="Maintenance Provider">
                <input value={maintenanceEvent.provider_name} onChange={e=>setMaintenanceEvent({...maintenanceEvent,provider_name:e.target.value})} style={input}/>
              </EditField>

              <EditField label="Performed By">
                <input value={maintenanceEvent.performed_by} onChange={e=>setMaintenanceEvent({...maintenanceEvent,performed_by:e.target.value})} style={input}/>
              </EditField>
            </div>

            {maintenanceEvent.maintenance_type==="unplanned" ? (
              <div style={{marginTop:14}}>
                <EditField label="Issue Description">
                  <textarea rows={3} value={maintenanceEvent.issue_description} onChange={e=>setMaintenanceEvent({...maintenanceEvent,issue_description:e.target.value})} placeholder="Describe the equipment issue that required unplanned maintenance." style={{...input,resize:"vertical"}}/>
                </EditField>
              </div>
            ) : null}

            <div style={{marginTop:14}}>
              <EditField label={maintenanceEvent.maintenance_type==="unplanned"?"Repair Activities":"Maintenance Activities"}>
                <textarea rows={4} value={maintenanceEvent.maintenance_activities} onChange={e=>setMaintenanceEvent({...maintenanceEvent,maintenance_activities:e.target.value})} placeholder={maintenanceEvent.maintenance_type==="unplanned"?"Document the repair activities performed.":"Document the preventive maintenance activities performed."} style={{...input,resize:"vertical"}}/>
              </EditField>
            </div>

            <div style={{marginTop:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <div>
                  <div style={fieldLabel}>Major Components Replaced</div>
                  <div style={{color:"#64748b",fontSize:13}}>Optional. Add only major components replaced during the maintenance event.</div>
                </div>
                <button type="button" style={secondaryButton} onClick={addMaintenanceComponent}>Add Component</button>
              </div>

              {maintenanceComponents.length ? (
                <div style={{display:"grid",gap:10,marginTop:10}}>
                  {maintenanceComponents.map((component,index)=>(
                    <div key={index} style={{border:"1px solid #e2e8f0",borderRadius:10,padding:12,background:"#f8fafc"}}>
                      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr .7fr",gap:8}}>
                        <input value={component.component_description} onChange={e=>updateMaintenanceComponent(index,"component_description",e.target.value)} placeholder="Component description" style={input}/>
                        <input value={component.part_number} onChange={e=>updateMaintenanceComponent(index,"part_number",e.target.value)} placeholder="Part number" style={input}/>
                        <input value={component.serial_or_lot_number} onChange={e=>updateMaintenanceComponent(index,"serial_or_lot_number",e.target.value)} placeholder="Serial / Lot" style={input}/>
                        <input type="number" min="0" step="any" value={component.quantity} onChange={e=>updateMaintenanceComponent(index,"quantity",e.target.value)} placeholder="Qty" style={input}/>
                      </div>
                      <div style={{display:"flex",gap:8,marginTop:8}}>
                        <input value={component.notes} onChange={e=>updateMaintenanceComponent(index,"notes",e.target.value)} placeholder="Optional notes" style={input}/>
                        <button type="button" style={secondaryButton} onClick={()=>removeMaintenanceComponent(index)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div style={{marginTop:18}}>
              <div style={fieldLabel}>Maintenance Attachments</div>
              <div style={{color:"#64748b",fontSize:13,marginBottom:8}}>
                Attach multiple service reports, repair records, vendor documentation, photographs, or other supporting records.
              </div>

              {existingMaintenanceAttachments.length ? (
                <div style={{display:"grid",gap:8,marginBottom:10}}>
                  {existingMaintenanceAttachments.map((attachment:any,index:number)=>(
                    <div key={`${attachment?.path||attachment?.name||"attachment"}-${index}`} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,border:"1px solid #bfdbfe",background:"#eff6ff",borderRadius:9,padding:"8px 10px"}}>
                      <button type="button" style={attachmentButton} onClick={()=>openMaintenanceAttachment(attachment)}>
                        {attachment?.name||`Attachment ${index+1}`}
                      </button>
                      <button type="button" style={secondaryButton} onClick={()=>removeExistingMaintenanceAttachment(index)}>Remove</button>
                    </div>
                  ))}
                </div>
              ) : null}

              <input
                type="file"
                multiple
                onChange={e=>{
                  const files=Array.from(e.target.files||[]);
                  setMaintenanceFiles(current=>[...current,...files]);
                  e.currentTarget.value="";
                }}
                style={input}
              />

              {maintenanceFiles.length ? (
                <div style={{display:"grid",gap:8,marginTop:10}}>
                  {maintenanceFiles.map((file,index)=>(
                    <div key={`${file.name}-${index}`} style={{display:"flex",justifyContent:"space-between",alignItems:"center",border:"1px solid #e2e8f0",borderRadius:9,padding:"8px 10px"}}>
                      <span><strong>{file.name}</strong> · {Math.max(1,Math.round(file.size/1024))} KB</span>
                      <button type="button" style={secondaryButton} onClick={()=>setMaintenanceFiles(current=>current.filter((_,i)=>i!==index))}>Remove</button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div style={{marginTop:14}}>
              <EditField label="Comments">
                <textarea rows={3} value={maintenanceEvent.comments} onChange={e=>setMaintenanceEvent({...maintenanceEvent,comments:e.target.value})} placeholder="Optional maintenance comments." style={{...input,resize:"vertical"}}/>
              </EditField>
            </div>

            {maintenanceEvent.maintenance_type==="unplanned" && record.post_unplanned_maintenance_assessment!=="disabled" ? (
              <div style={{marginTop:18,border:"1px solid #fde68a",background:"#fffbeb",borderRadius:12,padding:14}}>
                <h4 style={{margin:"0 0 5px"}}>Post-Unplanned-Maintenance Assessment</h4>
                <p style={{margin:"0 0 12px",color:"#64748b",fontSize:13}}>
                  Lean assessment to determine whether calibration and/or requalification are required after the repair. Customer QMS remains controlling.
                </p>

                <div style={formGridStyle}>
                  <CheckboxField
                    label="Calibration Required"
                    checked={postMaintenanceAssessment.calibration_required}
                    onChange={value=>setPostMaintenanceAssessment({...postMaintenanceAssessment,calibration_required:value})}
                  />
                  <CheckboxField
                    label="Requalification Required"
                    checked={postMaintenanceAssessment.requalification_required}
                    onChange={value=>setPostMaintenanceAssessment({...postMaintenanceAssessment,requalification_required:value})}
                  />
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12}}>
                  <EditField label="Calibration Rationale">
                    <textarea rows={3} value={postMaintenanceAssessment.calibration_rationale} onChange={e=>setPostMaintenanceAssessment({...postMaintenanceAssessment,calibration_rationale:e.target.value})} placeholder="Document rationale for the calibration decision." style={{...input,resize:"vertical"}}/>
                  </EditField>
                  <EditField label="Requalification Rationale">
                    <textarea rows={3} value={postMaintenanceAssessment.requalification_rationale} onChange={e=>setPostMaintenanceAssessment({...postMaintenanceAssessment,requalification_rationale:e.target.value})} placeholder="Document rationale for the requalification decision." style={{...input,resize:"vertical"}}/>
                  </EditField>
                </div>
              </div>
            ) : null}

            {maintenanceEventMessage ? (
              <div style={{marginTop:14,border:"1px solid #fecaca",background:"#fef2f2",color:"#991b1b",borderRadius:10,padding:10}}>
                {maintenanceEventMessage}
              </div>
            ) : null}

            <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:16}}>
              <button type="button" style={secondaryButton} onClick={()=>{setShowMaintenanceEvent(false);resetMaintenanceEventForm();}}>Cancel</button>
              <button type="button" style={{...primaryButton,opacity:savingMaintenanceEvent?0.6:1}} disabled={savingMaintenanceEvent} onClick={saveMaintenanceEvent}>
                {savingMaintenanceEvent?"Saving...":editingMaintenanceEventId?"Update Maintenance Record":"Save Maintenance Record"}
              </button>
            </div>
          </div>
        ) : null}

        <ScheduleSummary
          required={record.preventive_maintenance_required}
          schedule={pmSchedule}
          emptyText="No preventive-maintenance schedule configured."
        />

        <div style={{marginTop:18}}>
          <h3 style={{margin:"0 0 10px"}}>Maintenance History</h3>
          {maintenance.length===0 ? (
            <div style={emptyPanelStyle}>No maintenance events recorded.</div>
          ) : (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:1200}}>
                <thead>
                  <tr>
                    {["Event","Type","Performed","Result","Provider","Issue / Work","Comments","Attachments","Status","Action"].map(header=>(
                      <th key={header} style={{textAlign:"left",padding:"9px 10px",borderBottom:"1px solid #cbd5e1"}}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {maintenance.map(row=>{
                    const attachments=Array.isArray(row.service_report_attachments)?row.service_report_attachments:[];
                    const issueWork=
                      row.maintenance_type==="unplanned"
                        ? [row.issue_description,row.maintenance_activities].filter(Boolean).join(" — ")
                        : row.maintenance_activities;

                    return (
                      <tr key={row.id}>
                        <td style={tdMini}><strong>{row.maintenance_number}</strong></td>
                        <td style={tdMini}>{formatLabel(row.maintenance_type)}</td>
                        <td style={tdMini}>{formatDate(row.performed_date)}</td>
                        <td style={tdMini}>{formatLabel(row.result)}</td>
                        <td style={tdMini}>{row.provider_name||"Not Recorded"}</td>
                        <td style={{...tdMini,maxWidth:300,whiteSpace:"pre-wrap"}}>{issueWork||"Not Recorded"}</td>
                        <td style={{...tdMini,maxWidth:240,whiteSpace:"pre-wrap"}}>{row.comments||"Not Recorded"}</td>
                        <td style={tdMini}>
                          {attachments.length===0 ? "None" : (
                            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                              {attachments.map((attachment:any,index:number)=>(
                                <button key={`${attachment?.path||attachment?.name||index}`} type="button" style={attachmentButton} onClick={()=>openMaintenanceAttachment(attachment)}>
                                  {attachment?.name||`Attachment ${index+1}`}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={tdMini}>{formatLabel(row.status)}</td>
                        <td style={tdMini}>
                          <button type="button" style={secondaryButton} onClick={()=>editMaintenanceEvent(row)}>Edit</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
