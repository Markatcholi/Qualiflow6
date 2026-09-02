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
  record_status: string;
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
  next_nominal_due_date: string | null;
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
  product_impact: string | null;
  service_report_attachments: any[];
  comments: string | null;
  next_nominal_due_date: string | null;
  status: string;
  created_at: string;
};

type Qualification = {
  id: string;
  qualification_number: string;
  qualification_type: string;
  qualification_basis: string | null;
  iq_applicable: boolean;
  oq_applicable: boolean;
  pq_applicable: boolean;
  qualification_date: string | null;
  next_requalification_date: string | null;
  next_requalification_requirement: string | null;
  protocol_document_url: string | null;
  report_document_url: string | null;
  qualification_element_documents: any;
  reason: string | null;
  owner_email: string | null;
  target_completion_date: string | null;
  protocol_number: string | null;
  protocol_title: string | null;
  protocol_revision: string | null;
  protocol_released_at: string | null;
  execution_started_at: string | null;
  execution_completed_at: string | null;
  executed_by: string | null;
  execution_notes: string | null;
  execution_attachments: any[];
  report_number: string | null;
  report_revision: string | null;
  draft_report_attachments: any[];
  qualification_result: string | null;
  result_summary: string | null;
  approval_requirement: string;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  approval_comment: string | null;
  status: string;
  released_for_use_by: string | null;
  released_for_use_at: string | null;
  created_at: string;
};

type DocumentLink = {
  id: string;
  document_id: string;
  relationship_type: string;
  is_active: boolean;
  linked_by: string | null;
  linked_at: string;
};

type ControlledDocumentReference = {
  id: string;
  document_number: string;
  title: string;
  document_type: string | null;
  revision: string;
  status: string;
  effective_date: string | null;
  controlled_copy_file_url: string | null;
  file_url: string | null;
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

type EquipmentReleaseRequest = {
  id: string; equipment_id: string; submitted_by: string; submitted_at: string;
  approver_email: string; status: string; decision_by: string | null;
  decision_at: string | null; decision_comment: string | null;
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
  const [controlledDocuments, setControlledDocuments] = useState<ControlledDocumentReference[]>([]);
  const [showDocumentLinkForm, setShowDocumentLinkForm] = useState(false);
  const [documentSearch, setDocumentSearch] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [documentRelationshipType, setDocumentRelationshipType] = useState("operating_procedure");
  const [documentLinkMessage, setDocumentLinkMessage] = useState("");
  const [savingDocumentLink, setSavingDocumentLink] = useState(false);
  const [changes, setChanges] = useState<ChangeLink[]>([]);
  const [oosLinks, setOosLinks] = useState<OosLink[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [currentUserEmail,setCurrentUserEmail]=useState("");
  const [governanceRole,setGovernanceRole]=useState<"viewer"|"coordinator"|"quality_approver"|"admin">("viewer");
  const [enterpriseApprovalAuthority,setEnterpriseApprovalAuthority]=useState<"none"|"quality_approver"|"admin">("none");
  const [releaseRequest,setReleaseRequest]=useState<EquipmentReleaseRequest | null>(null);
  const [releaseApproverEmail,setReleaseApproverEmail]=useState("");
  const [releaseComment,setReleaseComment]=useState("");
  const [releaseMessage,setReleaseMessage]=useState("");
  const [processingRelease,setProcessingRelease]=useState(false);


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
    comments:"",
    next_due_date:""
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
    product_impact:"",
    comments:"",
    next_due_date:""
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

  const [showQualificationForm,setShowQualificationForm]=useState(false);
  const [savingQualification,setSavingQualification]=useState(false);
  const [qualificationMessage,setQualificationMessage]=useState("");
  const [editingQualificationId,setEditingQualificationId]=useState<string | null>(null);
  const [qualificationExecutionFiles,setQualificationExecutionFiles]=useState<File[]>([]);
  const [qualificationReportFiles,setQualificationReportFiles]=useState<File[]>([]);
  const [existingExecutionAttachments,setExistingExecutionAttachments]=useState<any[]>([]);
  const [existingReportAttachments,setExistingReportAttachments]=useState<any[]>([]);
  const [removedQualificationAttachments,setRemovedQualificationAttachments]=useState<any[]>([]);
  const [qualificationForm,setQualificationForm]=useState({
    qualification_type:"initial",
    qualification_basis:"new_activity",
    iq_applicable:false,
    oq_applicable:false,
    pq_applicable:false,
    qualification_date:"",
    next_requalification_date:"",
    next_requalification_requirement:"na",
    protocol_document_url:"",
    report_document_url:"",
    qualification_element_documents:{},
    reason:"",
    owner_email:"",
    target_completion_date:"",
    protocol_number:"",
    protocol_title:"",
    protocol_revision:"",
    execution_started_at:"",
    execution_completed_at:"",
    executed_by:"",
    execution_notes:"",
    report_number:"",
    report_revision:"",
    qualification_result:"",
    result_summary:"",
    approval_requirement:"required",
    approval_status:"not_required",
    approved_by:"",
    approval_comment:"",
    status:"initiated"
  });

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
      const {data:userData}=await supabase.auth.getUser();
      const userEmail=(userData?.user?.email||"").toLowerCase();
      setCurrentUserEmail(userEmail);

      const [
        equipmentRes,
        schedulesRes,
        calibrationRes,
        maintenanceRes,
        qualificationRes,
        documentsRes,
        controlledDocumentsRes,
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
          .select("id,calibration_number,event_source,scheduled_date,hard_due_date,performed_date,result,certificate_number,certificate_attachments,provider_type,provider_name,performed_by,comments,next_nominal_due_date,status,created_at")
          .eq("equipment_id", equipmentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("equipment_maintenance_events")
          .select("id,maintenance_number,maintenance_type,scheduled_date,hard_due_date,performed_date,result,provider_type,provider_name,performed_by,procedure_document_number,procedure_revision,issue_description,maintenance_activities,product_impact,service_report_attachments,comments,next_nominal_due_date,status,created_at")
          .eq("equipment_id", equipmentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("equipment_qualification_events")
          .select("id,qualification_number,qualification_type,qualification_basis,iq_applicable,oq_applicable,pq_applicable,qualification_date,next_requalification_date,next_requalification_requirement,protocol_document_url,report_document_url,qualification_element_documents,reason,owner_email,target_completion_date,protocol_number,protocol_title,protocol_revision,protocol_released_at,execution_started_at,execution_completed_at,executed_by,execution_notes,execution_attachments,report_number,report_revision,draft_report_attachments,qualification_result,result_summary,approval_requirement,approval_status,approved_by,approved_at,approval_comment,status,released_for_use_by,released_for_use_at,created_at")
          .eq("equipment_id", equipmentId)
          .order("created_at", { ascending: false }),
        supabase.rpc("get_equipment_controlled_document_links", {
          p_equipment_id: equipmentId
        }),
        supabase
          .from("controlled_documents")
          .select("id,document_number,title,document_type,revision,status,effective_date,controlled_copy_file_url,file_url")
          .order("document_number", { ascending: true })
          .order("revision", { ascending: false }),
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

      const [{data:equipmentRoleRow},{data:enterpriseAuthority,error:enterpriseAuthorityError},{data:releaseRow}]=await Promise.all([
        supabase.from("equipment_governance_members").select("role")
          .eq("tenant_id",eq.tenant_id).ilike("user_email",userEmail).eq("is_active",true).eq("role","coordinator").maybeSingle(),
        supabase.rpc("get_qualisphere_enterprise_authority",{p_user_email:userEmail}),
        supabase.from("equipment_release_requests")
          .select("id,equipment_id,submitted_by,submitted_at,approver_email,status,decision_by,decision_at,decision_comment")
          .eq("equipment_id",eq.id).order("submitted_at",{ascending:false}).limit(1).maybeSingle()
      ]);
      if(enterpriseAuthorityError)throw new Error(enterpriseAuthorityError.message);
      const fallbackCoordinator=[eq.owner_email,eq.created_by].filter(Boolean)
        .map((v:any)=>String(v).toLowerCase()).includes(userEmail);
      setGovernanceRole((equipmentRoleRow?.role||(fallbackCoordinator?"coordinator":"viewer")) as any);
      setEnterpriseApprovalAuthority(
        enterpriseAuthority?.is_admin
          ? "admin"
          : enterpriseAuthority?.is_quality_approver
            ? "quality_approver"
            : "none"
      );
      setReleaseRequest((releaseRow||null) as EquipmentReleaseRequest|null);
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
      setControlledDocuments((controlledDocumentsRes.data || []) as ControlledDocumentReference[]);
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
    if (!record || governanceRole!=="coordinator") return;

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
    setCalibrationEvent({event_source:"manual",performed_date:"",result:"pass",certificate_number:"",provider_type:"",provider_name:"",performed_by:"",comments:"",next_due_date:""});
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
      comments:row.comments||"",
      next_due_date:row.next_nominal_due_date||""
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

  const getNextHardDueDate=(currentNominal?:string|null,currentHard?:string|null,nextNominal?:string|null)=>{
    if(!nextNominal)return null;
    if(!currentNominal||!currentHard)return nextNominal;

    const nominalDate=new Date(`${currentNominal}T00:00:00`);
    const hardDate=new Date(`${currentHard}T00:00:00`);
    const nextDate=new Date(`${nextNominal}T00:00:00`);

    if(
      Number.isNaN(nominalDate.getTime())||
      Number.isNaN(hardDate.getTime())||
      Number.isNaN(nextDate.getTime())
    ){
      return nextNominal;
    }

    const deltaMs=hardDate.getTime()-nominalDate.getTime();
    const nextHard=new Date(nextDate.getTime()+Math.max(0,deltaMs));
    return nextHard.toISOString().slice(0,10);
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
        next_nominal_due_date:calibrationEvent.next_due_date||null,
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

      if(calibrationEvent.next_due_date&&calibrationSchedule?.id){
        const nextHardDue=getNextHardDueDate(
          calibrationSchedule.nominal_due_date,
          calibrationSchedule.hard_due_date,
          calibrationEvent.next_due_date
        );
        const {error:scheduleAdvanceError}=await supabase
          .from("equipment_schedule_configurations")
          .update({
            nominal_due_date:calibrationEvent.next_due_date,
            scheduled_service_date:null,
            hard_due_date:nextHardDue
          })
          .eq("id",calibrationSchedule.id);
        if(scheduleAdvanceError)throw new Error(scheduleAdvanceError.message);
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
      product_impact:"",
      comments:"",
      next_due_date:""
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
      product_impact:row.product_impact||"",
      comments:row.comments||"",
      next_due_date:row.next_nominal_due_date||""
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
        product_impact:
          maintenanceEvent.maintenance_type==="unplanned"
            ? (maintenanceEvent.product_impact.trim()||null)
            : null,
        next_nominal_due_date:maintenanceEvent.next_due_date||null,
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

      if(maintenanceEvent.next_due_date&&pmSchedule?.id){
        const nextHardDue=getNextHardDueDate(
          pmSchedule.nominal_due_date,
          pmSchedule.hard_due_date,
          maintenanceEvent.next_due_date
        );
        const {error:scheduleAdvanceError}=await supabase
          .from("equipment_schedule_configurations")
          .update({
            nominal_due_date:maintenanceEvent.next_due_date,
            scheduled_service_date:null,
            hard_due_date:nextHardDue
          })
          .eq("id",pmSchedule.id);
        if(scheduleAdvanceError)throw new Error(scheduleAdvanceError.message);
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


  const resetQualificationForm=()=>{
    setQualificationForm({
      qualification_type:"initial",
      qualification_basis:"new_activity",
      iq_applicable:false,
      oq_applicable:false,
      pq_applicable:false,
      qualification_date:"",
      next_requalification_date:"",
      next_requalification_requirement:"na",
      protocol_document_url:"",
      report_document_url:"",
      qualification_element_documents:{},
      reason:"",
      owner_email:"",
      target_completion_date:"",
      protocol_number:"",
      protocol_title:"",
      protocol_revision:"",
      execution_started_at:"",
      execution_completed_at:"",
      executed_by:"",
      execution_notes:"",
      report_number:"",
      report_revision:"",
      qualification_result:"",
      result_summary:"",
      approval_requirement:"required",
      approval_status:"not_required",
      approved_by:"",
      approval_comment:"",
      status:"initiated"
    });
    setQualificationExecutionFiles([]);
    setQualificationReportFiles([]);
    setExistingExecutionAttachments([]);
    setExistingReportAttachments([]);
    setRemovedQualificationAttachments([]);
    setEditingQualificationId(null);
    setQualificationMessage("");
  };

  const toDateTimeLocal=(value?:string|null)=>{
    if(!value)return "";
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return "";
    const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
    return local.toISOString().slice(0,16);
  };

  const openQualificationAttachment=async(attachment:any)=>{
    const path=attachment?.path||attachment?.storage_path;
    if(!path)return;
    const {data,error}=await supabase.storage
      .from("controlled-documents")
      .createSignedUrl(path,600);
    if(error||!data?.signedUrl){
      alert(error?.message||"Unable to open qualification attachment.");
      return;
    }
    window.open(data.signedUrl,"_blank","noopener,noreferrer");
  };

  const removePendingQualificationFile=(kind:"execution"|"report",index:number)=>{
    if(kind==="execution"){
      setQualificationExecutionFiles(current=>current.filter((_,i)=>i!==index));
    }else{
      setQualificationReportFiles(current=>current.filter((_,i)=>i!==index));
    }
  };

  const removeQualificationAttachment=(kind:"execution"|"report",index:number)=>{
    if(kind==="execution"){
      setExistingExecutionAttachments(current=>{
        const target=current[index];
        if(target)setRemovedQualificationAttachments(removed=>[...removed,target]);
        return current.filter((_,i)=>i!==index);
      });
    }else{
      setExistingReportAttachments(current=>{
        const target=current[index];
        if(target)setRemovedQualificationAttachments(removed=>[...removed,target]);
        return current.filter((_,i)=>i!==index);
      });
    }
  };

  const editQualification=(row:Qualification)=>{
    setEditingQualificationId(row.id);
    setQualificationForm({
      qualification_type:row.qualification_type||"initial",
      qualification_basis:row.qualification_basis||"new_activity",
      iq_applicable:!!row.iq_applicable,
      oq_applicable:!!row.oq_applicable,
      pq_applicable:!!row.pq_applicable,
      qualification_date:row.qualification_date||"",
      next_requalification_date:row.next_requalification_date||"",
      next_requalification_requirement:row.next_requalification_requirement||(row.next_requalification_date?"date":"na"),
      protocol_document_url:row.protocol_document_url||"",
      report_document_url:row.report_document_url||"",
      qualification_element_documents:row.qualification_element_documents||{},
      reason:row.reason||"",
      owner_email:row.owner_email||"",
      target_completion_date:row.target_completion_date||"",
      protocol_number:row.protocol_number||"",
      protocol_title:row.protocol_title||"",
      protocol_revision:row.protocol_revision||"",
      execution_started_at:toDateTimeLocal(row.execution_started_at),
      execution_completed_at:toDateTimeLocal(row.execution_completed_at),
      executed_by:row.executed_by||"",
      execution_notes:row.execution_notes||"",
      report_number:row.report_number||"",
      report_revision:row.report_revision||"",
      qualification_result:row.qualification_result||"",
      result_summary:row.result_summary||"",
      approval_requirement:row.approval_requirement||"required",
      approval_status:row.approval_status||"not_required",
      approved_by:row.approved_by||"",
      approval_comment:row.approval_comment||"",
      status:row.status||"initiated"
    });
    setExistingExecutionAttachments(Array.isArray(row.execution_attachments)?row.execution_attachments:[]);
    setExistingReportAttachments(Array.isArray(row.draft_report_attachments)?row.draft_report_attachments:[]);
    setQualificationExecutionFiles([]);
    setQualificationReportFiles([]);
    setRemovedQualificationAttachments([]);
    setQualificationMessage("");
    setShowQualificationForm(true);
  };

  const uploadQualificationFiles=async(files:File[],folder:string,email:string)=>{
    if(!record)return [];
    const uploaded:any[]=[];
    for(const file of files){
      const safe=file.name.trim().replace(/[^a-zA-Z0-9._-]+/g,"_").replace(/_+/g,"_");
      const path=`equipment/${record.id}/qualification/${folder}/${Date.now()}-${safe}`;
      const {error}=await supabase.storage
        .from("controlled-documents")
        .upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type||undefined});
      if(error)throw new Error(error.message);
      uploaded.push({
        name:file.name,
        path,
        size:file.size,
        type:file.type||null,
        uploaded_by:email,
        uploaded_at:new Date().toISOString()
      });
    }
    return uploaded;
  };

  const qualificationElementMeta=[
    {key:"iq",flag:"iq_applicable",label:"IQ",name:"Installation Qualification"},
    {key:"oq",flag:"oq_applicable",label:"OQ",name:"Operational Qualification"},
    {key:"pq",flag:"pq_applicable",label:"PQ",name:"Performance Qualification"}
  ] as const;

  const qualificationElementDoc=(key:string)=>{
    const docs=qualificationForm.qualification_element_documents||{};
    return docs[key]||{protocol_number:"",protocol_revision:"",protocol_document_url:"",report_number:"",report_revision:"",report_document_url:"",result:""};
  };

  const setQualificationElementDoc=(key:string,field:string,value:string)=>{
    const docs=qualificationForm.qualification_element_documents||{};
    setQualificationForm({...qualificationForm,qualification_element_documents:{...docs,[key]:{...qualificationElementDoc(key),[field]:value}}});
  };

  const saveQualification=async()=>{
    if(!record||!canMaintain)return;
    setQualificationMessage("");

    if(!qualificationForm.reason.trim()){
      setQualificationMessage("Qualification / Requalification Reason or migration rationale is required.");
      return;
    }
    if(!qualificationForm.iq_applicable&&!qualificationForm.oq_applicable&&!qualificationForm.pq_applicable){
      setQualificationMessage("Select at least one applicable qualification element: IQ, OQ, or PQ.");
      return;
    }

    const selectedElements=qualificationElementMeta.filter(element=>(qualificationForm as any)[element.flag]);
    const selectedDocs=qualificationForm.qualification_element_documents||{};

    if(qualificationForm.status==="released"){
      for(const element of selectedElements){
        const doc=selectedDocs[element.key]||{};
        if(!String(doc.protocol_number||"").trim()){setQualificationMessage(`${element.label} Protocol Number is required before the overall qualification can be marked Qualified.`);return;}
        if(!String(doc.report_number||"").trim()){setQualificationMessage(`${element.label} Report Number is required before the overall qualification can be marked Qualified.`);return;}
        if(doc.result!=="acceptable"){setQualificationMessage(`${element.label} must have an Acceptable result before the overall qualification can be marked Qualified.`);return;}
      }
    }

    if(qualificationForm.next_requalification_requirement==="date"&&!qualificationForm.next_requalification_date){
      setQualificationMessage("Select the Next Requalification Date or choose N/A.");
      return;
    }

    const status=qualificationForm.status;
    const isHistorical=qualificationForm.qualification_basis==="existing_qualified";
    const protocolRequired=!isHistorical && ["protocol_released","execution","draft_report","released"].includes(status);
    const executionRequired=!isHistorical && ["draft_report","released"].includes(status);
    if(protocolRequired&&!selectedElements.some(element=>String((selectedDocs[element.key]||{}).protocol_number||"").trim())){
      setQualificationMessage("At least one selected qualification activity must have a released protocol before execution.");
      return;
    }
    if(executionRequired&&!qualificationForm.execution_completed_at){
      setQualificationMessage("Execution Completed is required before the qualification report stage.");
      return;
    }
    setSavingQualification(true);
    try{
      const {data:userData}=await supabase.auth.getUser();
      const email=userData?.user?.email||"unknown";
      const folder=editingQualificationId||crypto.randomUUID();

      const [newExecution,newReports]=await Promise.all([
        uploadQualificationFiles(qualificationExecutionFiles,`${folder}/execution`,email),
        uploadQualificationFiles(qualificationReportFiles,`${folder}/report`,email)
      ]);

      const executionAttachments=[...existingExecutionAttachments,...newExecution];
      const reportAttachments=[...existingReportAttachments,...newReports];
      const now=new Date().toISOString();

      const payload:any={
        qualification_type:qualificationForm.qualification_type,
        qualification_basis:qualificationForm.qualification_basis,
        iq_applicable:qualificationForm.iq_applicable,
        oq_applicable:qualificationForm.oq_applicable,
        pq_applicable:qualificationForm.pq_applicable,
        next_requalification_requirement:qualificationForm.next_requalification_requirement||"na",
        next_requalification_date:qualificationForm.next_requalification_requirement==="date"
          ? (qualificationForm.next_requalification_date||null)
          : null,
        protocol_document_url:null,
        report_document_url:null,
        qualification_element_documents:selectedDocs,
        reason:qualificationForm.reason.trim(),
        owner_email:qualificationForm.owner_email.trim()||record.owner_email||email,
        target_completion_date:qualificationForm.target_completion_date||null,
        protocol_number:qualificationForm.protocol_number.trim()||null,
        protocol_title:qualificationForm.protocol_title.trim()||null,
        protocol_revision:qualificationForm.protocol_revision.trim()||null,
        execution_started_at:qualificationForm.execution_started_at?new Date(qualificationForm.execution_started_at).toISOString():null,
        execution_completed_at:qualificationForm.execution_completed_at?new Date(qualificationForm.execution_completed_at).toISOString():null,
        executed_by:qualificationForm.executed_by.trim()||null,
        execution_notes:qualificationForm.execution_notes.trim()||null,
        execution_attachments:executionAttachments,
        report_number:qualificationForm.report_number.trim()||null,
        report_revision:qualificationForm.report_revision.trim()||null,
        draft_report_attachments:reportAttachments,
        qualification_result:selectedElements.length&&selectedElements.every(element=>(selectedDocs[element.key]||{}).result==="acceptable")?"acceptable":null,
        result_summary:qualificationForm.result_summary.trim()||null,
        approval_requirement:"disabled",
        approval_status:"not_required",
        approved_by:null,
        approved_at:null,
        approval_comment:null,
        status,
        protocol_released_at:["protocol_released","execution","draft_report","released"].includes(status)
          ? (editingQualificationId ? qualifications.find(q=>q.id===editingQualificationId)?.protocol_released_at||now : now)
          : null,
        released_for_use_by:null,
        released_for_use_at:null
      };

      let qualificationNumber="";
      if(editingQualificationId){
        const {data,error}=await supabase.from("equipment_qualification_events")
          .update(payload).eq("id",editingQualificationId).eq("equipment_id",record.id)
          .select("qualification_number").single();
        if(error)throw new Error(error.message);
        qualificationNumber=data.qualification_number;
      }else{
        const {data,error}=await supabase.from("equipment_qualification_events").insert({
          ...payload,tenant_id:record.tenant_id,qualification_number:"",equipment_id:record.id,created_by:email
        }).select("qualification_number").single();
        if(error)throw new Error(error.message);
        qualificationNumber=data.qualification_number;
      }

      const removedPaths=removedQualificationAttachments.map(a=>a?.path).filter(Boolean);
      if(removedPaths.length) await supabase.storage.from("controlled-documents").remove(removedPaths);

      await addAudit(
        editingQualificationId?"qualification_updated":"qualification_recorded",
        `Qualification ${qualificationNumber} ${editingQualificationId?"updated":"recorded"}. Type: ${qualificationForm.qualification_type}. Basis: ${qualificationForm.qualification_basis}. Elements: ${[
          qualificationForm.iq_applicable?"IQ":null,qualificationForm.oq_applicable?"OQ":null,qualificationForm.pq_applicable?"PQ":null
        ].filter(Boolean).join(", ")}. Status: ${status}.`
      );
      setShowQualificationForm(false);
      resetQualificationForm();
      await load();
    }catch(e:any){
      setQualificationMessage(e?.message||"Unable to save qualification record.");
    }finally{
      setSavingQualification(false);
    }
  };

  const activeControlledDocuments=controlledDocuments.filter(doc=>
    ["effective","released","release"].includes(String(doc.status||"").toLowerCase())
  );
  const filteredControlledDocuments=activeControlledDocuments.filter(doc=>{
    const q=documentSearch.trim().toLowerCase();
    if(!q)return true;
    return [doc.document_number,doc.title,doc.document_type,doc.revision]
      .filter(Boolean).some(value=>String(value).toLowerCase().includes(q));
  });

  const controlledDocumentById=(documentId:string)=>
    controlledDocuments.find(doc=>doc.id===documentId)||null;

  const linkControlledDocument=async()=>{
    if(!record||!canMaintain)return;
    setDocumentLinkMessage("");
    if(!selectedDocumentId){
      setDocumentLinkMessage("Select an effective controlled document to link.");
      return;
    }
    const selected=controlledDocumentById(selectedDocumentId);
    if(!selected||!["effective","released","release"].includes(String(selected.status||"").toLowerCase())){
      setDocumentLinkMessage("Only released/effective controlled documents can be newly linked to Equipment.");
      return;
    }

    setSavingDocumentLink(true);
    try{
      const {data:linkedRow,error}=await supabase.rpc(
        "link_equipment_controlled_document",
        {
          p_equipment_id:record.id,
          p_document_id:selected.id,
          p_relationship_type:documentRelationshipType
        }
      );
      if(error)throw new Error(error.message);
      if(!linkedRow)throw new Error("The link operation completed without returning a relationship record.");

      await addAudit(
        "controlled_document_linked",
        `Controlled document ${selected.document_number} Rev ${selected.revision} linked as ${formatLabel(documentRelationshipType)}.`
      );

      setSelectedDocumentId("");
      setDocumentSearch("");
      setDocumentLinkMessage(`SUCCESS: ${selected.document_number} Rev ${selected.revision} is now linked to this equipment. Select another document below to continue linking.`);
      setShowDocumentLinkForm(true);
      await load();
      window.setTimeout(()=>{
        const searchInput=document.getElementById("equipment-controlled-document-search") as HTMLInputElement|null;
        searchInput?.focus();
      },50);
    }catch(e:any){
      console.error("Equipment controlled document link failed:",e);
      setDocumentLinkMessage(`LINK FAILED: ${e?.message||"Unable to link controlled document."}`);
    }finally{
      setSavingDocumentLink(false);
    }
  };

  const deactivateControlledDocumentLink=async(link:DocumentLink)=>{
    if(!record||!canMaintain)return;
    const selected=controlledDocumentById(link.document_id);
    if(!window.confirm(`Remove the Equipment relationship to ${selected?.document_number||"this controlled document"}? The historical link record will be retained as inactive.`))return;

    setSavingDocumentLink(true);
    setDocumentLinkMessage("");
    try{
      const {error}=await supabase
        .from("equipment_document_links")
        .update({is_active:false})
        .eq("id",link.id)
        .eq("equipment_id",record.id);
      if(error)throw new Error(error.message);

      await addAudit(
        "controlled_document_unlinked",
        `Controlled document ${selected?.document_number||link.document_id}${selected?.revision?` Rev ${selected.revision}`:""} relationship deactivated.`
      );
      setDocumentLinkMessage("Controlled document relationship removed. Historical traceability was retained.");
      await load();
    }catch(e:any){
      setDocumentLinkMessage(e?.message||"Unable to remove controlled document relationship.");
    }finally{
      setSavingDocumentLink(false);
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
          qualifications.some((item) => item.status === "released" && item.qualification_result === "acceptable"),
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

  const canMaintain=governanceRole==="coordinator";
  const canApproveRelease=enterpriseApprovalAuthority==="quality_approver"||enterpriseApprovalAuthority==="admin";
  const recordIsReleased=record?.record_status==="released";
  const pendingRelease=releaseRequest?.status==="pending";

  const submitEquipmentForRelease=async()=>{
    if(!record||!canMaintain)return;
    setReleaseMessage("");
    const approver=releaseApproverEmail.trim().toLowerCase();
    if(!approver||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(approver)){
      setReleaseMessage("Enter a valid Quality Approver email address."); return;
    }
    const pendingReadiness=lifecycleReadiness.filter(item=>item.required&&!item.complete);
    if(pendingReadiness.length){
      setReleaseMessage(`RELEASE BLOCKED: Complete the following required readiness item(s) before submission: ${pendingReadiness.map(item=>item.label).join(", ")}.`);
      return;
    }
    setProcessingRelease(true);
    try{
      const {data,error}=await supabase.rpc("submit_equipment_record_for_release",{
        p_equipment_id:record.id,
        p_approver_email:approver
      });
      if(error)throw new Error(error.message);
      if(!data)throw new Error("Release submission completed without returning a release request.");
      await addAudit("equipment_release_submitted",`Equipment Master submitted for release to ${approver}.`);
      setReleaseApproverEmail("");
      setReleaseMessage(`Equipment Master submitted for controlled release to ${approver}.`);
      await load();
    }catch(e:any){
      setReleaseMessage(e?.message||"Unable to submit equipment for release.");
    }finally{setProcessingRelease(false);}
  };

  const decideEquipmentRelease=async(decision:"approved"|"rejected")=>{
    if(!record||!releaseRequest||!canApproveRelease)return;
    if(currentUserEmail!==releaseRequest.approver_email.toLowerCase()&&enterpriseApprovalAuthority!=="admin"){
      setReleaseMessage("This release request is assigned to another Quality Approver."); return;
    }
    if(decision==="rejected"&&!releaseComment.trim()){
      setReleaseMessage("A comment is required when rejecting an Equipment Master release."); return;
    }
    setProcessingRelease(true); setReleaseMessage("");
    try{
      const {data,error}=await supabase.rpc("decide_equipment_record_release",{
        p_release_request_id:releaseRequest.id,
        p_decision:decision,
        p_comment:releaseComment.trim()||null
      });
      if(error)throw new Error(error.message);
      if(!data)throw new Error("Release decision completed without returning a release request.");
      await addAudit(decision==="approved"?"equipment_release_approved":"equipment_release_rejected",
        `Equipment Master release ${decision} by ${currentUserEmail}${releaseComment.trim()?`: ${releaseComment.trim()}`:""}.`);
      setReleaseComment(""); setReleaseMessage(decision==="approved"?"Equipment Master released for operational use.":"Equipment Master returned for correction."); await load();
    }catch(e:any){setReleaseMessage(e?.message||"Unable to process equipment release.");}
    finally{setProcessingRelease(false);}
  };

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
            canMaintain ? (
              <button style={primaryButton} onClick={() => setEditing(true)}>Edit Master Record</button>
            ) : (
              <span style={{display:"inline-flex",alignItems:"center",padding:"8px 12px",borderRadius:999,border:"1px solid #cbd5e1",background:"#f1f5f9",color:"#475569",fontSize:13,fontWeight:700}}>Read Only</span>
            )
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
        <Summary label="Record Governance" value={formatLabel(record.record_status||"draft")} tone={record.record_status==="released"?"success":record.record_status==="pending_release"?"warning":undefined} />
        <Summary label="Access" value={canMaintain?formatLabel(governanceRole):"Read Only"} />
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
          Required items marked Pending must be completed before Equipment Record Release can be submitted.
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
            <div style={{marginTop:14,maxWidth:360}}>
              <EditField label="Next Calibration Due Date">
                <input type="date" value={calibrationEvent.next_due_date} onChange={e=>setCalibrationEvent({...calibrationEvent,next_due_date:e.target.value})} style={input}/>
              </EditField>
              <div style={{color:"#64748b",fontSize:12,marginTop:5}}>Optional. When entered, QualiSphere advances the recurring calibration schedule to this date.</div>
            </div>
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
              <thead><tr>{["Event","Performed","Result","Certificate / Record","Provider","Comments","Next Due","Attachments","Status","Action"].map(h=><th key={h} style={{textAlign:"left",padding:"9px 10px",borderBottom:"1px solid #cbd5e1"}}>{h}</th>)}</tr></thead>
              <tbody>{calibrations.map(row=>{
                const a=Array.isArray(row.certificate_attachments)?row.certificate_attachments:[];
                return <tr key={row.id}>
                  <td style={tdMini}><strong>{row.calibration_number}</strong></td>
                  <td style={tdMini}>{formatDate(row.performed_date)}</td>
                  <td style={tdMini}>{formatLabel(row.result)}</td>
                  <td style={tdMini}>{row.certificate_number||"Not Recorded"}</td>
                  <td style={tdMini}>{row.provider_name||"Not Recorded"}</td>
                  <td style={{...tdMini,maxWidth:260,whiteSpace:"pre-wrap"}}>{row.comments||"Not Recorded"}</td>
                  <td style={tdMini}>{formatDate(row.next_nominal_due_date)}</td>
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

            {maintenanceEvent.maintenance_type==="unplanned" ? (
              <div style={{marginTop:14}}>
                <EditField label="Product Impact (Optional)">
                  <textarea rows={3} value={maintenanceEvent.product_impact} onChange={e=>setMaintenanceEvent({...maintenanceEvent,product_impact:e.target.value})} placeholder="Document any known or potential product impact, if applicable." style={{...input,resize:"vertical"}}/>
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

            <div style={{marginTop:14,maxWidth:360}}>
              <EditField label="Next Preventive Maintenance Due Date">
                <input type="date" value={maintenanceEvent.next_due_date} onChange={e=>setMaintenanceEvent({...maintenanceEvent,next_due_date:e.target.value})} style={input}/>
              </EditField>
              <div style={{color:"#64748b",fontSize:12,marginTop:5}}>Optional. When entered, QualiSphere advances the recurring Preventive Maintenance schedule to this date.</div>
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
                    {["Event","Type","Performed","Result","Provider","Issue / Work","Product Impact","Comments","Next PM Due","Attachments","Status","Action"].map(header=>(
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
                        <td style={{...tdMini,maxWidth:240,whiteSpace:"pre-wrap"}}>{row.product_impact||"Not Recorded"}</td>
                        <td style={{...tdMini,maxWidth:240,whiteSpace:"pre-wrap"}}>{row.comments||"Not Recorded"}</td>
                        <td style={tdMini}>{formatDate(row.next_nominal_due_date)}</td>
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
          subtitle="Equipment Management tracks qualification applicability, activity status, and released-document evidence. Document Control governs protocol and report approval/release."
          action={
            record.qualification_required && canMaintain ? (
              <button type="button" style={primaryButton} onClick={()=>{
                if(showQualificationForm){setShowQualificationForm(false);resetQualificationForm();}
                else{
                  resetQualificationForm();
                  setQualificationForm(current=>({
                    ...current,
                    qualification_type:qualifications.length?"requalification":"initial",
                    owner_email:record.owner_email||""
                  }));
                  setShowQualificationForm(true);
                }
              }}>{showQualificationForm?"Close Qualification":"Add Qualification Record"}</button>
            ) : null
          }
        />

        {!record.qualification_required ? <div style={emptyPanelStyle}>Qualification is marked Not Required for this equipment.</div> : null}

        {showQualificationForm && record.qualification_required ? (
          <div style={{border:"1px solid #bfdbfe",background:"#f8fbff",borderRadius:12,padding:16,marginBottom:20}}>
            <h3 style={{margin:"0 0 5px"}}>{editingQualificationId?"Update Qualification Record":"Qualification / Requalification Record"}</h3>
            <p style={{margin:"0 0 14px",color:"#64748b",fontSize:13,lineHeight:1.5}}>
              Use Existing Qualified Equipment when bringing historically qualified equipment into QualiSphere. QualiSphere records the status and evidence; it does not recreate or duplicate Document Control approval.
            </p>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
              <EditField label="Qualification Basis">
                <select value={qualificationForm.qualification_basis} onChange={e=>setQualificationForm({...qualificationForm,qualification_basis:e.target.value,status:e.target.value==="existing_qualified"?"released":qualificationForm.status})} style={input}>
                  <option value="new_activity">New Equipment</option>
                  <option value="existing_qualified">Existing Qualified Equipment</option>
                </select>
              </EditField>
              <EditField label="Qualification Type">
                <select value={qualificationForm.qualification_type} onChange={e=>setQualificationForm({...qualificationForm,qualification_type:e.target.value})} style={input}>
                  <option value="initial">Initial Qualification</option>
                  <option value="requalification">Requalification</option>
                </select>
              </EditField>
              <EditField label="Qualification Status">
                <select value={qualificationForm.status} onChange={e=>setQualificationForm({...qualificationForm,status:e.target.value})} style={input}>
                  <option value="initiated">Qualification Initiated</option>
                  <option value="protocol_released">Protocol Released</option>
                  <option value="execution">Execution In Progress</option>
                  <option value="draft_report">Qualification Report In Progress</option>
                  <option value="released">Qualified</option>
                  <option value="rejected">Not Acceptable / Returned</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </EditField>
              <EditField label="Qualification Owner">
                <input value={qualificationForm.owner_email} onChange={e=>setQualificationForm({...qualificationForm,owner_email:e.target.value})} style={input}/>
              </EditField>
            </div>

            <div style={{marginTop:16}}>
              <div style={fieldLabel}>Applicable Qualification Elements</div>
              <div style={{display:"flex",gap:18,flexWrap:"wrap",padding:"10px 0"}}>
                {[
                  ["iq_applicable","IQ — Installation Qualification"],
                  ["oq_applicable","OQ — Operational Qualification"],
                  ["pq_applicable","PQ — Performance Qualification"]
                ].map(([key,label])=><label key={key} style={{display:"flex",alignItems:"center",gap:7,fontSize:14}}>
                  <input type="checkbox" checked={(qualificationForm as any)[key]} onChange={e=>setQualificationForm({...qualificationForm,[key]:e.target.checked})}/>
                  {label}
                </label>)}
              </div>
            </div>

            <div style={{marginTop:12}}>
              <EditField label="Qualification / Requalification Reason or Migration Rationale">
                <textarea rows={3} value={qualificationForm.reason} onChange={e=>setQualificationForm({...qualificationForm,reason:e.target.value})} style={{...input,resize:"vertical"}}/>
              </EditField>
            </div>

            <div style={{marginTop:20,borderTop:"1px solid #e2e8f0",paddingTop:16}}>
              <h4 style={{margin:"0 0 6px"}}>Qualification Documentation</h4>
              <div style={{fontSize:13,color:"#64748b",marginBottom:14,lineHeight:1.5}}>
                Each applicable qualification activity is independently traceable to its released protocol and released report. Document Control links are optional and customer-selected.
              </div>

              {qualificationElementMeta.filter(element=>(qualificationForm as any)[element.flag]).map(element=>{
                const doc=qualificationElementDoc(element.key);
                return <div key={element.key} style={{border:"1px solid #dbe3ee",borderRadius:10,padding:14,marginBottom:12,background:"#fff"}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:12}}>
                    <strong style={{fontSize:15}}>{element.label}</strong>
                    <span style={{fontSize:13,color:"#64748b"}}>{element.name}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(185px,1fr))",gap:10}}>
                    <EditField label={`${element.label} Protocol Number`}><input value={doc.protocol_number||""} onChange={e=>setQualificationElementDoc(element.key,"protocol_number",e.target.value)} style={input}/></EditField>
                    <EditField label="Protocol Revision"><input value={doc.protocol_revision||""} onChange={e=>setQualificationElementDoc(element.key,"protocol_revision",e.target.value)} style={input}/></EditField>
                    <EditField label="Protocol Link — Optional"><input value={doc.protocol_document_url||""} onChange={e=>setQualificationElementDoc(element.key,"protocol_document_url",e.target.value)} placeholder="/documents/... or approved URL" style={input}/></EditField>
                    <EditField label={`${element.label} Report Number`}><input value={doc.report_number||""} onChange={e=>setQualificationElementDoc(element.key,"report_number",e.target.value)} style={input}/></EditField>
                    <EditField label="Report Revision"><input value={doc.report_revision||""} onChange={e=>setQualificationElementDoc(element.key,"report_revision",e.target.value)} style={input}/></EditField>
                    <EditField label="Report Link — Optional"><input value={doc.report_document_url||""} onChange={e=>setQualificationElementDoc(element.key,"report_document_url",e.target.value)} placeholder="/documents/... or approved URL" style={input}/></EditField>
                    <EditField label={`${element.label} Result`}>
                      <select value={doc.result||""} onChange={e=>setQualificationElementDoc(element.key,"result",e.target.value)} style={input}>
                        <option value="">Select Result</option><option value="acceptable">Acceptable</option><option value="not_acceptable">Not Acceptable</option>
                      </select>
                    </EditField>
                  </div>
                </div>;
              })}

              {!qualificationElementMeta.some(element=>(qualificationForm as any)[element.flag]) ? <div style={emptyPanelStyle}>Select IQ, OQ, and/or PQ above to document the applicable qualification activities.</div> : null}

              <div style={{marginTop:12}}>
                <EditField label="Overall Qualification Summary / Notes"><textarea rows={3} value={qualificationForm.result_summary} onChange={e=>setQualificationForm({...qualificationForm,result_summary:e.target.value})} style={{...input,resize:"vertical"}}/></EditField>
              </div>
            </div>

            {qualificationForm.qualification_basis==="new_activity" ? <div style={{marginTop:20,borderTop:"1px solid #e2e8f0",paddingTop:16}}>
              <h4 style={{margin:"0 0 10px"}}>Execution Evidence — Optional</h4>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
                <EditField label="Execution Started"><input type="datetime-local" value={qualificationForm.execution_started_at} onChange={e=>setQualificationForm({...qualificationForm,execution_started_at:e.target.value})} style={input}/></EditField>
                <EditField label="Execution Completed"><input type="datetime-local" value={qualificationForm.execution_completed_at} onChange={e=>setQualificationForm({...qualificationForm,execution_completed_at:e.target.value})} style={input}/></EditField>
                <EditField label="Executed By"><input value={qualificationForm.executed_by} onChange={e=>setQualificationForm({...qualificationForm,executed_by:e.target.value})} style={input}/></EditField>
              </div>
              <div style={{marginTop:12}}>
                <div style={fieldLabel}>Supporting Evidence</div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:8,lineHeight:1.5}}>
                  Attach execution records, completed qualification worksheets, photographs, test output, or other supporting evidence. Selected files are uploaded when the Qualification record is saved.
                </div>
                <input
                  type="file"
                  multiple
                  onChange={e=>{
                    const files=Array.from(e.target.files||[]);
                    setQualificationExecutionFiles(current=>[...current,...files]);
                    e.currentTarget.value="";
                  }}
                  style={input}
                />

                {qualificationExecutionFiles.length>0 ? (
                  <div style={{marginTop:10,border:"1px solid #bfdbfe",background:"#eff6ff",borderRadius:10,padding:10}}>
                    <div style={{fontWeight:800,fontSize:13,marginBottom:7}}>Selected for Upload ({qualificationExecutionFiles.length})</div>
                    <div style={{display:"grid",gap:7}}>
                      {qualificationExecutionFiles.map((file,index)=>(
                        <div key={`${file.name}-${index}`} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,border:"1px solid #dbeafe",background:"#fff",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:700,wordBreak:"break-word"}}>{file.name}</div>
                            <div style={{fontSize:11,color:"#64748b"}}>{Math.max(1,Math.round(file.size/1024))} KB · Pending upload</div>
                          </div>
                          <button type="button" style={secondaryButton} onClick={()=>removePendingQualificationFile("execution",index)}>Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {existingExecutionAttachments.length>0 ? (
                  <div style={{marginTop:10,border:"1px solid #d1fae5",background:"#f0fdf4",borderRadius:10,padding:10}}>
                    <div style={{fontWeight:800,fontSize:13,marginBottom:7}}>Saved Supporting Evidence ({existingExecutionAttachments.length})</div>
                    <div style={{display:"grid",gap:7}}>
                      {existingExecutionAttachments.map((attachment:any,index:number)=>(
                        <div key={`${attachment?.path||attachment?.name||"attachment"}-${index}`} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,border:"1px solid #bbf7d0",background:"#fff",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:700,wordBreak:"break-word"}}>{attachment?.name||"Supporting Evidence"}</div>
                            <div style={{fontSize:11,color:"#64748b"}}>
                              Saved{attachment?.uploaded_by?` · ${attachment.uploaded_by}`:""}{attachment?.uploaded_at?` · ${formatDateTime(attachment.uploaded_at)}`:""}
                            </div>
                          </div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                            <button type="button" style={secondaryButton} onClick={()=>openQualificationAttachment(attachment)}>Open</button>
                            {canMaintain ? <button type="button" style={secondaryButton} onClick={()=>removeQualificationAttachment("execution",index)}>Remove</button> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : editingQualificationId ? (
                  <div style={{marginTop:8,fontSize:12,color:"#64748b"}}>No saved supporting evidence is attached to this qualification event.</div>
                ) : null}
              </div>
            </div> : null}

            <div style={{marginTop:20,borderTop:"1px solid #e2e8f0",paddingTop:16}}>
              <h4 style={{margin:"0 0 6px"}}>Future Requalification Requirement</h4>
              <div style={{fontSize:13,color:"#64748b",marginBottom:12,lineHeight:1.5}}>
                This sets the requirement for the next qualification activity. It is not part of the execution evidence for the current qualification.
              </div>
              <div style={{display:"grid",gridTemplateColumns:"minmax(220px,320px) minmax(220px,320px)",gap:12}}>
                <EditField label="Next Requalification">
                  <select
                    value={qualificationForm.next_requalification_requirement}
                    onChange={e=>setQualificationForm({
                      ...qualificationForm,
                      next_requalification_requirement:e.target.value,
                      next_requalification_date:e.target.value==="na"?"":qualificationForm.next_requalification_date
                    })}
                    style={input}
                  >
                    <option value="na">N/A</option>
                    <option value="date">Date Required</option>
                  </select>
                </EditField>
                {qualificationForm.next_requalification_requirement==="date" ? (
                  <EditField label="Next Requalification Date">
                    <input
                      type="date"
                      value={qualificationForm.next_requalification_date}
                      onChange={e=>setQualificationForm({...qualificationForm,next_requalification_date:e.target.value})}
                      style={input}
                    />
                  </EditField>
                ) : null}
              </div>
            </div>

            <div style={{marginTop:16,border:"1px solid #dbeafe",background:"#eff6ff",borderRadius:10,padding:12,color:"#1e3a8a",fontSize:13,lineHeight:1.5}}>
              <strong>Governance:</strong> Qualification status and evidence support Equipment Record Release. Related Controlled Documents, Change Control, and OOS/OOT links are optional and never required merely because the relationship section is empty.
            </div>

            {qualificationMessage ? <div style={{marginTop:14,border:"1px solid #fecaca",background:"#fef2f2",color:"#991b1b",borderRadius:10,padding:10}}>{qualificationMessage}</div> : null}
            <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:16}}>
              <button type="button" style={secondaryButton} onClick={()=>{setShowQualificationForm(false);resetQualificationForm();}}>Cancel</button>
              <button type="button" style={{...primaryButton,opacity:savingQualification?0.6:1}} disabled={savingQualification} onClick={saveQualification}>
                {savingQualification?"Saving...":editingQualificationId?"Update Qualification":"Save Qualification"}
              </button>
            </div>
          </div>
        ) : null}

        <div style={{marginTop:18}}>
          <h3 style={{margin:"0 0 10px"}}>Qualification History</h3>
          {qualifications.length===0 ? <div style={emptyPanelStyle}>No qualification or requalification events recorded.</div> : (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:1450}}>
                <thead><tr>{["Event","Basis","Type","Elements","Status","Qualification Date","Protocol","Report","Result","Supporting Evidence","Next Requalification","Action"].map(h=><th key={h} style={{textAlign:"left",padding:"9px 10px",borderBottom:"1px solid #cbd5e1"}}>{h}</th>)}</tr></thead>
                <tbody>{qualifications.map(row=><tr key={row.id}>
                  <td style={tdMini}><strong>{row.qualification_number}</strong></td>
                  <td style={tdMini}>{row.qualification_basis==="existing_qualified"?"Existing Qualified Equipment":"New Equipment"}</td>
                  <td style={tdMini}>{formatLabel(row.qualification_type)}</td>
                  <td style={tdMini}>{[row.iq_applicable?"IQ":null,row.oq_applicable?"OQ":null,row.pq_applicable?"PQ":null].filter(Boolean).join(", ")||"Not Recorded"}</td>
                  <td style={tdMini}>{row.status==="released"?"Qualified":formatLabel(row.status)}</td>
                  <td style={tdMini}>{formatDate(row.qualification_date)}</td>
                  <td style={tdMini}>{["iq","oq","pq"].filter(key=>(row as any)[`${key}_applicable`]).map(key=><div key={key}><strong>{key.toUpperCase()}:</strong> {row.qualification_element_documents?.[key]?.protocol_number||"Not Recorded"}</div>)}</td>
                  <td style={tdMini}>{["iq","oq","pq"].filter(key=>(row as any)[`${key}_applicable`]).map(key=><div key={key}><strong>{key.toUpperCase()}:</strong> {row.qualification_element_documents?.[key]?.report_number||"Not Recorded"}</div>)}</td>
                  <td style={tdMini}>{["iq","oq","pq"].filter(key=>(row as any)[`${key}_applicable`]).map(key=><div key={key}><strong>{key.toUpperCase()}:</strong> {formatLabel(row.qualification_element_documents?.[key]?.result)}</div>)}</td>
                  <td style={tdMini}>
                    {Array.isArray(row.execution_attachments)&&row.execution_attachments.length>0 ? (
                      <div style={{display:"grid",gap:6}}>
                        {row.execution_attachments.map((attachment:any,index:number)=>(
                          <button
                            key={`${attachment?.path||attachment?.name||"evidence"}-${index}`}
                            type="button"
                            style={{...secondaryButton,textAlign:"left",whiteSpace:"normal"}}
                            onClick={()=>openQualificationAttachment(attachment)}
                          >
                            Open: {attachment?.name||`Evidence ${index+1}`}
                          </button>
                        ))}
                      </div>
                    ) : "None"}
                  </td>
                  <td style={tdMini}>{row.next_requalification_requirement==="na"?"N/A":formatDate(row.next_requalification_date)}</td>
                  <td style={tdMini}>{canMaintain?<button type="button" style={secondaryButton} onClick={()=>editQualification(row)}>Edit</button>:"Read Only"}</td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <SectionHeader
          title="7. Equipment Lifecycle / Status / Release"
          subtitle="Equipment Record Release governs operational readiness. Most users receive read-only visibility; controlled roles maintain and release the record."
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
                  <option value="active" disabled={!recordIsReleased}>Active — available only after Equipment Record Release</option>
                  <option value="retired">Retired</option>
                </select>
              </EditField>

              <EditField label="Use Status">
                <select value={form.use_status} onChange={(e) => {
                  const next=e.target.value;
                  setForm({...form,use_status:next,lifecycle_phase:next==="retired"?"retirement":form.lifecycle_phase,equipment_status:next==="retired"?"retired":form.equipment_status});
                }} style={input}>
                  <option value="available_for_use" disabled={!recordIsReleased}>Available for Use — available only after Equipment Record Release</option>
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
              <Detail label="Retired By" value={record.retired_by} />
              <Detail label="Retired At" value={formatDateTime(record.retired_at)} />
              <Detail label="Retirement Reason" value={record.retirement_reason} wide />
            </div>
          </>
        ) : (
          <div style={detailGridStyle}>
            <Detail label="Lifecycle Phase" value={formatLifecyclePhase(record.lifecycle_phase)} />
            <Detail label="Equipment Status" value={record.record_status!=="released"&&record.equipment_status==="active" ? "Pending Production Release" : formatEquipmentStatus(record.equipment_status)} />
            <Detail label="Use Status" value={record.record_status!=="released"&&record.use_status==="available_for_use" ? "Restricted — Record Not Released" : formatEquipmentUseStatus(record.use_status)} />
            <Detail label="Status Rationale / Notes" value={record.use_status_reason} wide />
            <Detail label="Retired By" value={record.retired_by} />
            <Detail label="Retired At" value={formatDateTime(record.retired_at)} />
            <Detail label="Retirement Reason" value={record.retirement_reason} wide />
          </div>
        )}
        {record.record_status!=="released"&&(record.equipment_status==="active"||record.use_status==="available_for_use") ? (
          <div style={{marginTop:16,border:"1px solid #f59e0b",background:"#fffbeb",color:"#92400e",borderRadius:10,padding:12,lineHeight:1.5}}>
            <strong>Governance override:</strong> this Equipment Record is not released. Active / Available-for-Use values do not authorize operational use until Equipment Record Release is approved.
          </div>
        ) : null}

        <div style={{marginTop:18,border:"1px solid #cbd5e1",borderRadius:12,padding:14,background:"#f8fafc"}}>
          <h3 style={{margin:"0 0 6px"}}>Equipment Record Release Governance</h3>
          <div style={{color:"#64748b",fontSize:13,lineHeight:1.5,marginBottom:12}}>
            This gate approves Equipment Master readiness. It does not approve calibration certificates, maintenance records, or qualification protocols/reports.
          </div>
          <div style={{...detailGridStyle,marginBottom:12}}>
            <Detail label="Record Status" value={formatLabel(record.record_status||"draft")} />
            <Detail label="Operational Authorization" value={recordIsReleased?"Authorized for Use":"Not Released / Use Restricted"} />
            <Detail label="Your Equipment Role" value={canMaintain?"Coordinator / Owner":"Viewer / Read Only"} />
            <Detail label="Release Approval Authority" value={enterpriseApprovalAuthority==="admin"?"Admin":enterpriseApprovalAuthority==="quality_approver"?"Quality Approver":"None"} />
            <Detail label="Released By" value={record.released_by} />
            <Detail label="Released At" value={formatDateTime(record.released_at)} />
          </div>

          <div style={{border:"1px solid #e2e8f0",background:"#fff",borderRadius:10,padding:12,marginBottom:12}}>
            <div style={{fontWeight:800,marginBottom:8}}>Release Readiness</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8}}>
              {lifecycleReadiness.map(item=>(
                <div key={`release-${item.label}`} style={{border:item.required&&!item.complete?"1px solid #fecaca":"1px solid #bbf7d0",background:item.required&&!item.complete?"#fef2f2":"#f0fdf4",borderRadius:8,padding:9}}>
                  <div style={{fontWeight:700,fontSize:13}}>{item.label}</div>
                  <div style={{fontSize:12,marginTop:4}}>{!item.required?"Not Required":item.complete?"Ready":"Required / Pending"}</div>
                </div>
              ))}
            </div>
          </div>
          {pendingRelease ? <div style={{border:"1px solid #fde68a",background:"#fffbeb",borderRadius:10,padding:12,marginBottom:12}}>
            <strong>Pending Equipment Record Release</strong>
            <div style={{marginTop:5,fontSize:13}}>Approver: {releaseRequest?.approver_email} · Submitted by {releaseRequest?.submitted_by} on {formatDateTime(releaseRequest?.submitted_at)}</div>
          </div> : null}
          {canMaintain && !recordIsReleased && !pendingRelease && lifecycleReadiness.some(item=>item.required&&!item.complete) ? (
            <div style={{marginBottom:12,border:"1px solid #fecaca",background:"#fef2f2",color:"#991b1b",borderRadius:10,padding:12,fontSize:13,lineHeight:1.5}}>
              <strong>Release not yet ready:</strong> {lifecycleReadiness.filter(item=>item.required&&!item.complete).map(item=>item.label).join(", ")} must be completed before Equipment Record Release can be submitted. You may still click <strong>Submit Equipment Record for Release</strong> to review the blocking requirement.
            </div>
          ) : null}

          {canMaintain && !recordIsReleased && !pendingRelease ? <div style={{display:"grid",gridTemplateColumns:"minmax(260px,1fr) auto",gap:10,alignItems:"end"}}>
            <div>
              <EditField label="Quality Approver Email"><input value={releaseApproverEmail} onChange={e=>setReleaseApproverEmail(e.target.value)} placeholder="approver@company.com" style={input}/></EditField>
              <div style={{fontSize:12,color:"#64748b",marginTop:5}}>Assigned approver must be an authorized Quality Approver or Admin.</div>
            </div>
            <button
              type="button"
              style={{...primaryButton,opacity:processingRelease?0.6:1}}
              disabled={processingRelease}
              onClick={submitEquipmentForRelease}
            >
              {processingRelease?"Submitting...":"Submit Equipment Record for Release"}
            </button>
          </div> : null}
          {pendingRelease && canApproveRelease ? <div style={{marginTop:12}}>
            <EditField label="Release Decision Comment"><textarea rows={3} value={releaseComment} onChange={e=>setReleaseComment(e.target.value)} placeholder="Optional for approval; required for rejection." style={{...input,resize:"vertical"}}/></EditField>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:10}}>
              <button type="button" style={secondaryButton} disabled={processingRelease} onClick={()=>decideEquipmentRelease("rejected")}>Reject / Return</button>
              <button type="button" style={primaryButton} disabled={processingRelease} onClick={()=>decideEquipmentRelease("approved")}>Approve & Release Equipment</button>
            </div>
          </div> : null}
          {releaseMessage ? (
            <div style={{
              marginTop:12,
              border:releaseMessage.startsWith("RELEASE BLOCKED")?"1px solid #fecaca":"1px solid #bfdbfe",
              background:releaseMessage.startsWith("RELEASE BLOCKED")?"#fef2f2":"#eff6ff",
              color:releaseMessage.startsWith("RELEASE BLOCKED")?"#991b1b":"#1e3a8a",
              borderRadius:10,
              padding:10,
              fontWeight:releaseMessage.startsWith("RELEASE BLOCKED")?700:400
            }}>{releaseMessage}</div>
          ) : null}
        </div>
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <SectionHeader
          title="8. Related Controlled Documents — Optional"
          subtitle="Link one or more released controlled documents that support this equipment. Document Control remains the system of record; these relationships do not block Equipment Record Release."
          action={
            canMaintain ? (
              <button
                type="button"
                style={showDocumentLinkForm?secondaryButton:primaryButton}
                onClick={()=>{
                  setShowDocumentLinkForm(!showDocumentLinkForm);
                  setDocumentLinkMessage("");
                  if(showDocumentLinkForm){
                    setSelectedDocumentId("");
                    setDocumentSearch("");
                  }
                }}
              >
                {showDocumentLinkForm?"Close":"Link Controlled Document"}
              </button>
            ) : null
          }
        />

        {showDocumentLinkForm && canMaintain ? (
          <div style={{border:"1px solid #bfdbfe",background:"#f8fbff",borderRadius:12,padding:16,marginBottom:16}}>
            <h3 style={{margin:"0 0 5px"}}>Link Existing Controlled Document</h3>
            <div style={{fontSize:13,color:"#64748b",lineHeight:1.5,marginBottom:14}}>
              Released/Effective documents from Document Control are available for Equipment linking. Select a document, click <strong>Link Document</strong>, then repeat for any additional documents needed.
            </div>

            <div style={{display:"grid",gridTemplateColumns:"minmax(220px,1fr) minmax(220px,1fr)",gap:12}}>
              <EditField label="Search Released Documents">
                <input
                  id="equipment-controlled-document-search"
                  value={documentSearch}
                  onChange={e=>setDocumentSearch(e.target.value)}
                  placeholder="Search document number, title, type, or revision"
                  style={input}
                />
              </EditField>

              <EditField label="Relationship">
                <select value={documentRelationshipType} onChange={e=>setDocumentRelationshipType(e.target.value)} style={input}>
                  <option value="specification">Specification</option>
                  <option value="operating_procedure">Operating Procedure / SOP</option>
                  <option value="calibration_procedure">Calibration Procedure</option>
                  <option value="preventive_maintenance_procedure">Preventive Maintenance Procedure</option>
                  <option value="qualification_protocol">Qualification Document</option>
                  <option value="work_instruction">Work Instruction</option>
                  <option value="other">Other</option>
                </select>
              </EditField>
            </div>

            <div style={{marginTop:14}}>
              <div style={fieldLabel}>Released Controlled Documents</div>

              {filteredControlledDocuments.length===0 ? (
                <div style={{marginTop:8,border:"1px solid #fde68a",background:"#fffbeb",borderRadius:8,padding:10,fontSize:13}}>
                  No released/effective controlled documents match this search.
                </div>
              ) : (
                <div style={{display:"grid",gap:8,marginTop:8,maxHeight:300,overflowY:"auto"}}>
                  {filteredControlledDocuments.map(doc=>{
                    const selected=selectedDocumentId===doc.id;
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={()=>setSelectedDocumentId(doc.id)}
                        style={{
                          textAlign:"left",
                          width:"100%",
                          border:selected?"2px solid #2563eb":"1px solid #cbd5e1",
                          background:selected?"#eff6ff":"#fff",
                          borderRadius:10,
                          padding:"11px 12px",
                          cursor:"pointer"
                        }}
                      >
                        <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap"}}>
                          <div style={{minWidth:0}}>
                            <div style={{fontWeight:800,fontSize:14}}>
                              {doc.document_number} <span style={{fontWeight:600,color:"#64748b"}}>Rev {doc.revision}</span>
                            </div>
                            <div style={{fontSize:13,marginTop:3,wordBreak:"break-word"}}>{doc.title}</div>
                            <div style={{fontSize:12,color:"#64748b",marginTop:3}}>
                              {formatLabel(doc.document_type)} · Effective {formatDate(doc.effective_date)}
                            </div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{
                              display:"inline-flex",
                              alignItems:"center",
                              borderRadius:999,
                              padding:"4px 9px",
                              fontSize:11,
                              fontWeight:800,
                              background:"#dcfce7",
                              color:"#166534"
                            }}>
                              {String(doc.status||"").toLowerCase()==="effective"?"Effective":"Released"}
                            </span>
                            <span style={{
                              display:"inline-flex",
                              alignItems:"center",
                              borderRadius:999,
                              padding:"4px 9px",
                              fontSize:11,
                              fontWeight:800,
                              background:selected?"#dbeafe":"#f1f5f9",
                              color:selected?"#1d4ed8":"#475569"
                            }}>
                              {selected?"Selected":"Select"}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginTop:14,flexWrap:"wrap"}}>
              <div style={{fontSize:12,color:"#64748b"}}>
                {selectedDocumentId
                  ? "Document selected — Link Document is ready."
                  : "Select a document above to enable Link Document."}
              </div>
              <div style={{display:"flex",gap:10}}>
                <button type="button" style={secondaryButton} onClick={()=>{
                  setShowDocumentLinkForm(false);
                  setSelectedDocumentId("");
                  setDocumentSearch("");
                  setDocumentLinkMessage("");
                }}>Cancel</button>
                <button
                  type="button"
                  style={{...primaryButton,opacity:(savingDocumentLink||!selectedDocumentId)?0.55:1}}
                  disabled={savingDocumentLink||!selectedDocumentId}
                  onClick={linkControlledDocument}
                >
                  {savingDocumentLink?"Linking...":"Link Document"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {documentLinkMessage ? (
          <div style={{
            marginBottom:14,
            border:(documentLinkMessage.startsWith("LINK FAILED")||documentLinkMessage.startsWith("LINK READBACK FAILED"))?"1px solid #fecaca":documentLinkMessage.startsWith("SUCCESS")?"1px solid #bbf7d0":"1px solid #bfdbfe",
            background:(documentLinkMessage.startsWith("LINK FAILED")||documentLinkMessage.startsWith("LINK READBACK FAILED"))?"#fef2f2":documentLinkMessage.startsWith("SUCCESS")?"#f0fdf4":"#eff6ff",
            color:(documentLinkMessage.startsWith("LINK FAILED")||documentLinkMessage.startsWith("LINK READBACK FAILED"))?"#991b1b":documentLinkMessage.startsWith("SUCCESS")?"#166534":"#1e3a8a",
            borderRadius:10,padding:10,fontWeight:700
          }}>
            {documentLinkMessage}
          </div>
        ) : null}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:10}}>
          <div style={{fontSize:13,color:"#64748b"}}>
            Active linked documents: <strong style={{color:"#0f172a"}}>{documents.filter(row=>row.is_active).length}</strong>
          </div>
          {canMaintain && !showDocumentLinkForm ? (
            <button
              type="button"
              style={secondaryButton}
              onClick={()=>{setShowDocumentLinkForm(true);setDocumentLinkMessage("");}}
            >
              + Link Another Document
            </button>
          ) : null}
        </div>

        {documents.filter(row=>row.is_active).length===0 ? (
          <div style={emptyPanelStyle}>No controlled documents linked.</div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:1050}}>
              <thead>
                <tr>
                  {["Relationship","Document Number","Title","Revision","Type","Status","Effective Date","Linked By","Actions"].map(header=>(
                    <th key={header} style={{textAlign:"left",padding:"9px 10px",borderBottom:"1px solid #cbd5e1"}}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.filter(row=>row.is_active).map(link=>{
                  const doc=controlledDocumentById(link.document_id);
                  return (
                    <tr key={link.id}>
                      <td style={tdMini}>{formatLabel(link.relationship_type)}</td>
                      <td style={tdMini}><strong>{doc?.document_number||"Document unavailable"}</strong></td>
                      <td style={tdMini}>{doc?.title||"Metadata unavailable"}</td>
                      <td style={tdMini}>{doc?.revision||"—"}</td>
                      <td style={tdMini}>{formatLabel(doc?.document_type)}</td>
                      <td style={tdMini}>{formatLabel(doc?.status)}</td>
                      <td style={tdMini}>{formatDate(doc?.effective_date)}</td>
                      <td style={tdMini}>{link.linked_by||"Not Recorded"}</td>
                      <td style={tdMini}>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                          {doc ? <Link href={`/documents/${doc.id}`} style={secondaryButton}>Open Document</Link> : null}
                          {doc?.controlled_copy_file_url ? (
                            <a href={doc.controlled_copy_file_url} target="_blank" rel="noreferrer" style={secondaryButton}>Controlled Copy</a>
                          ) : null}
                          {canMaintain ? (
                            <button
                              type="button"
                              style={secondaryButton}
                              disabled={savingDocumentLink}
                              onClick={()=>deactivateControlledDocumentLink(link)}
                            >
                              Remove Link
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

        {documents.some(row=>!row.is_active) ? (
          <div style={{marginTop:10,color:"#64748b",fontSize:12}}>
            Removed relationships are retained in the database and audit history for traceability.
          </div>
        ) : null}
      </section>

      <section style={{ ...card, marginBottom: 16 }}>
        <SectionHeader
          title="9. Change Control — Optional"
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
          title="10. OOS / OOT — Optional"
          subtitle="Optional link to the existing OOS/OOT module when an applicable equipment-related exception exists."
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
