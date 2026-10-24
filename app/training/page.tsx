"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import TrainingMatrixAssignment from "../../components/TrainingMatrixAssignment";
import {trainingEvidenceMode} from "../../lib/trainingMatrix";
import ESignatureModal from "../../components/ESignatureModal";
import { acknowledgeTraining } from "../../services/trainingService";

type TrainingAssignment = {
  id: string;
  tenant_id?: string | null;
  training_category?: string | null;
  recurring_evidence_mode?: string | null;
  approved_evaluation_attachment_required?: boolean | null;
  training_evidence_storage_path?: string | null;
  training_evidence_file_name?: string | null;
  training_completed_on?: string | null;
  training_valid_until?: string | null;
  retraining_due_date?: string | null;
  document_id: string | null;
  assigned_to_email: string;
  assigned_by_email: string | null;
  assignment_source: string | null;
  role_name: string | null;
  department: string | null;
  training_title: string | null;
  training_description: string | null;
  due_date: string | null;
  status: string | null;
  completed_at: string | null;
  completed_by: string | null;
  effectiveness_required: boolean | null;
  effectiveness_status: string | null;
  supervisor_verification_required: boolean | null;
  supervisor_verified_by: string | null;
  supervisor_verified_at: string | null;
  acknowledgement_required: boolean | null;
  acknowledged_at: string | null;
  acknowledged_by?: string | null;
  signature_id?: string | null;
  training_comments: string | null;
  created_at: string | null;
};

type TrainingMatrixRow = {
  id: string;
  role_name: string | null;
  department: string | null;
  document_number: string | null;
  required_training: boolean | null;
  effectiveness_required: boolean | null;
  created_at: string | null;
};

type ControlledDocument = {
  id: string;
  document_number: string;
  title: string;
  revision: string;
  status: string;
  file_name?: string | null;
  file_url?: string | null;
};


type ElectronicSignature = {
  id: string;
  module_name: string;
  record_id: string;
  action_type: string;
  signed_by: string;
  signer_role: string | null;
  signature_meaning: string;
  signature_reason: string | null;
  signed_at: string | null;
};

type EmployeeProfile = {
  id: string;
  user_email: string;
  full_name: string | null;
  department: string | null;
  role_name: string | null;
  manager_email: string | null;
  active: boolean | null;
};

const TRAINING_STATUSES = [
  "assigned",
  "in_progress",
  "completed",
  "overdue",
  "waived",
  "cancelled",
  "withdrawn",
];

export default function TrainingManagementPage() {
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [matrixRows, setMatrixRows] = useState<TrainingMatrixRow[]>([]);
  const [documents, setDocuments] = useState<ControlledDocument[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [signatures, setSignatures] = useState<ElectronicSignature[]>([]);
  const [generatingRecurring, setGeneratingRecurring] = useState(false);
  const [sendingTrainingNotices, setSendingTrainingNotices] = useState(false);

  const [newEmployee, setNewEmployee] = useState({
    user_email: "",
    full_name: "",
    department: "",
    role_name: "",
    manager_email: "",
  });

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  const [trainingCoordinator, setTrainingCoordinator] = useState(false);
  const [trainingMethods,setTrainingMethods]=useState<{id:string;label:string;acknowledgement_required:boolean;evidence_required:boolean}[]>([]);
  const [manualMethod,setManualMethod]=useState("");
  const [creatingAssignment,setCreatingAssignment]=useState(false);

  const [activeTrainingSection, setActiveTrainingSection] = useState("overview");
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("section");
    if (requested && ["overview", "assignments", "administration", "employees", "history", "due"].includes(requested)) {
      setActiveTrainingSection(requested);
    }
  }, []);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMine, setFilterMine] = useState(false);
  const [filterTeamPending, setFilterTeamPending] = useState(false);
  const [showTrainingSignature, setShowTrainingSignature] = useState(false);
  const [pendingSignatureAssignment, setPendingSignatureAssignment] =
    useState<TrainingAssignment | null>(null);

  const [completionAssignment, setCompletionAssignment] = useState<TrainingAssignment | null>(null);
  const [completionFile, setCompletionFile] = useState<File | null>(null);
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().slice(0,10));
  const [validUntil, setValidUntil] = useState("");
  const [retrainingDue, setRetrainingDue] = useState("");
  const [savingCompletion, setSavingCompletion] = useState(false);
  const evidenceMode = trainingEvidenceMode;
  const beginCompletion = (assignment: TrainingAssignment) => {
    setCompletionAssignment(assignment);
    setCompletionFile(null);
    setCompletionDate(new Date().toISOString().slice(0,10));
    setValidUntil(assignment.training_valid_until || "");
    setRetrainingDue(assignment.retraining_due_date || "");
  };
  const submitCompletion = async () => {
    const assignment=completionAssignment;
    if (!assignment || savingCompletion) return;
    const mode=evidenceMode(assignment);
    const attachmentRequired=mode==="attachment" || mode==="both";
    const signatureRequired=mode==="signature" || mode==="both";
    if (attachmentRequired && !completionFile && !assignment.training_evidence_storage_path) { alert("A signed training evidence form is required."); return; }
    if (!completionDate) { alert("Completion date is required."); return; }
    if (validUntil && validUntil<completionDate) { alert("Validity date cannot precede completion."); return; }
    setSavingCompletion(true);
    try {
      let path=assignment.training_evidence_storage_path || null;
      let fileName=assignment.training_evidence_file_name || null;
      if (completionFile) {
        if (!assignment.tenant_id) throw new Error("Training tenant is missing.");
        if (completionFile.size>10485760) throw new Error("Maximum evidence file size is 10 MB.");
        const extension=completionFile.name.split(".").pop()?.toLowerCase() || "bin";
        path=`${assignment.tenant_id}/${assignment.id}/${crypto.randomUUID()}.${extension}`;
        const upload=await supabase.storage.from("training-completion-evidence").upload(path,completionFile,{upsert:false});
        if(upload.error) throw upload.error;
        fileName=completionFile.name;
      }
      const payload:any={training_completed_on:completionDate,training_valid_until:validUntil||null,retraining_due_date:retrainingDue||null,training_evidence_storage_path:path,training_evidence_file_name:fileName};
      if (!signatureRequired) { payload.status="completed";payload.completed_at=new Date().toISOString();payload.completed_by=userEmail; }
      const update=await supabase.from("training_assignments").update(payload).eq("id",assignment.id);
      if(update.error) throw update.error;
      setCompletionAssignment(null);
      if(signatureRequired) {
        setPendingSignatureAssignment({...assignment,...payload});
        setShowTrainingSignature(true);
      } else {
        alert("Training completion recorded.");
      }
      await fetchData();
    } catch(err:any) {alert(err?.message || "Unable to save training completion.");}
    finally {setSavingCompletion(false);}
  };

  const [newAssignment, setNewAssignment] = useState({
    document_id: "",
    training_category: "standard",
    recurrence_months: "12",
    recurrence_basis: "completion",
    recurring_evidence_mode: "attachment",
    approved_evaluation_attachment_required: false,
    supervisor_designee_evidence_approval_required: false,
    assigned_to_email: "",
    training_title: "",
    training_description: "",
    role_name: "",
    department: "",
    due_date: "",
    effectiveness_required: false,
    supervisor_verification_required: false,
    acknowledgement_required: true,
  });

  const canManage = trainingCoordinator;

  const fetchUser = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";
    setUserEmail(email);

    if (!email) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", email)
      .maybeSingle();

    setUserRole(data?.role || "user");
    const { data: tenant } = await supabase.rpc("qualisphere_resolve_training_tenant");
    if (tenant) {
      const { data: allowed } = await supabase.rpc("qualisphere_training_is_coordinator", {p_tenant:tenant});
      setTrainingCoordinator(allowed === true);
      const result=await supabase.from("training_methods").select("id,label,acknowledgement_required,evidence_required").eq("tenant_id",tenant).eq("is_active",true).order("label");
      if(result.error) alert(result.error.message); else setTrainingMethods(result.data||[]);
    } else setTrainingCoordinator(false);

  };

  const fetchData = async () => {
    setLoading(true);
    await fetchUser();

    const assignmentRes = await supabase
      .from("training_assignments")
      .select("*")
      .order("created_at", { ascending: false });

    const matrixRes = await supabase
      .from("training_matrix")
      .select("*")
      .order("created_at", { ascending: false });

    const docRes = await supabase
      .from("controlled_documents")
      .select("id,document_number,title,revision,status,file_name,file_url")
      .order("document_number", { ascending: true });

    if (assignmentRes.error) alert(assignmentRes.error.message);
    else setAssignments((assignmentRes.data as TrainingAssignment[]) || []);

    if (!matrixRes.error) {
      setMatrixRows((matrixRes.data as TrainingMatrixRow[]) || []);
    }

    if (!docRes.error) {
      setDocuments((docRes.data as ControlledDocument[]) || []);
    }

    const employeeRes = await supabase
      .from("employee_profiles")
      .select("*")
      .order("user_email", { ascending: true });

    if (!employeeRes.error) {
      setEmployees((employeeRes.data as EmployeeProfile[]) || []);
    }

    const signatureRes = await supabase
      .from("electronic_signatures")
      .select("*")
      .eq("module_name", "training")
      .order("signed_at", { ascending: false });

    if (!signatureRes.error) {
      setSignatures((signatureRes.data as ElectronicSignature[]) || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const normalizeEmail = (value: string) => {
    const text = String(value || "").trim().toLowerCase();
    if (!text || !text.includes("@")) return "";
    return text;
  };

  const addDays = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  const createEmployeeProfile = async () => {
    const email = normalizeEmail(newEmployee.user_email);

    if (!email) {
      alert("Employee email is required.");
      return;
    }

    const { error } = await supabase.from("employee_profiles").upsert(
      {
        user_email: email,
        full_name: newEmployee.full_name || null,
        department: newEmployee.department || null,
        role_name: newEmployee.role_name || null,
        manager_email: normalizeEmail(newEmployee.manager_email) || null,
        active: true,
      },
      { onConflict: "user_email" }
    );

    if (error) {
      alert(error.message);
      return;
    }

    setNewEmployee({
      user_email: "",
      full_name: "",
      department: "",
      role_name: "",
      manager_email: "",
    });

    fetchData();
  };


  const today = new Date().toISOString().slice(0, 10);

  const directReportEmails = useMemo(() => new Set(employees.filter((e) => normalizeEmail(e.manager_email || "") === normalizeEmail(userEmail)).map((e) => normalizeEmail(e.user_email))), [employees, userEmail]);
  const filteredAssignments = useMemo(() => {
    const reportEmails = directReportEmails;
    return assignments.filter((item) => {
      if (!canManage && item.assigned_to_email.toLowerCase() !== userEmail.toLowerCase() && !reportEmails.has(item.assigned_to_email.toLowerCase())) return false;
      if (filterTeamPending && (!reportEmails.has(normalizeEmail(item.assigned_to_email)) || ["completed", "waived", "cancelled", "withdrawn"].includes(item.status || ""))) return false;
      const matchesStatus = filterStatus === "all" ||
        (filterStatus === "certification" ? item.training_category === "certification" :
        filterStatus === "recurring" ? item.training_category === "recurring" :
        filterStatus === "standard" ? item.training_category !== "certification" && item.training_category !== "recurring" :
        filterStatus === "overdue" ? !["completed", "waived", "cancelled", "withdrawn"].includes(item.status || "") && item.due_date != null && item.due_date < today :
        item.status === filterStatus);

      const matchesMine =
        !filterMine || item.assigned_to_email === userEmail;

      return matchesStatus && matchesMine;
    });
  }, [assignments, directReportEmails, canManage, filterStatus, filterMine, filterTeamPending, userEmail]);

  const metrics = useMemo(() => {
    const open = assignments.filter(
      (a) => !["completed", "waived", "cancelled", "withdrawn"].includes(a.status || "")
    );

    const overdue = open.filter((a) => a.due_date && a.due_date < today);
    const completed = assignments.filter((a) => a.status === "completed");
    const trainingSignatures = signatures.filter(
      (signature) => signature.module_name === "training"
    );
    const awaitingSignature = assignments.filter(
      (a) =>
        a.acknowledgement_required &&
        !["completed", "waived", "cancelled", "withdrawn"].includes(a.status || "") &&
        !a.signature_id
    );

    return {
      total: assignments.length,
      open: open.length,
      overdue: overdue.length,
      completed: completed.length,
      trainingSignatures: trainingSignatures.length,
      awaitingSignature: awaitingSignature.length,
      matrixRows: matrixRows.length,
      completionRate:
        assignments.length === 0
          ? 100
          : Math.round((completed.length / assignments.length) * 100),
    };
  }, [assignments, matrixRows, signatures, today]);


  const myTrainingMetrics = useMemo(() => {
    const mine = assignments.filter(
      (a) => normalizeEmail(a.assigned_to_email) === normalizeEmail(userEmail)
    );

    return {
      open: mine.filter(
        (a) => a.status !== "completed" && a.status !== "waived"
      ).length,
      overdue: mine.filter(
        (a) =>
          a.status !== "completed" &&
          a.status !== "waived" &&
          a.due_date &&
          a.due_date < today
      ).length,
      awaitingSignature: mine.filter(
        (a) =>
          a.acknowledgement_required &&
          !a.signature_id &&
          a.status !== "completed" &&
          a.status !== "waived"
      ).length,
    };
  }, [assignments, userEmail, today]);

  const documentCompliance = useMemo(() => {
    return documents
      .map((doc) => {
        const docAssignments = assignments.filter(
          (assignment) => assignment.document_id === doc.id
        );

        const assigned = docAssignments.length;
        const completed = docAssignments.filter(
          (assignment) => assignment.status === "completed"
        ).length;
        const overdue = docAssignments.filter(
          (assignment) =>
            !["completed", "waived", "cancelled", "withdrawn"].includes(assignment.status || "") &&
            assignment.due_date &&
            assignment.due_date < today
        ).length;
        const awaitingSignature = docAssignments.filter(
          (assignment) =>
            assignment.acknowledgement_required &&
            !assignment.signature_id &&
            !["completed", "waived", "cancelled", "withdrawn"].includes(assignment.status || "")
        ).length;

        return {
          id: doc.id,
          documentNumber: doc.document_number,
          title: doc.title,
          revision: doc.revision,
          assigned,
          completed,
          open: docAssignments.filter(
            (assignment) =>
              !["completed", "waived", "cancelled", "withdrawn"].includes(assignment.status || "")
          ).length,
          overdue,
          awaitingSignature,
          compliance: assigned === 0 ? 100 : Math.round((completed / assigned) * 100),
        };
      })
      .filter((row) => row.assigned > 0);
  }, [documents, assignments, today]);

  const sendTrainingDueNotices = async () => {
    if (sendingTrainingNotices) return;
    setSendingTrainingNotices(true);
    try {
      const { data, error } = await supabase.rpc("qualisphere_send_training_due_notices");
      if (error) throw error;
      alert(`${Number(data || 0)} new due-soon or overdue notification(s) sent. Duplicate notices were skipped.`);
    } catch (error: any) {
      alert(error?.message || "Unable to send training notifications.");
    } finally {
      setSendingTrainingNotices(false);
    }
  };

  const generateRecurringCycles = async () => {
    if (generatingRecurring) return;
    setGeneratingRecurring(true);
    try {
      const { data, error } = await supabase.rpc("qualisphere_generate_recurring_training_cycles");
      if (error) throw error;
      alert(`${Number(data || 0)} recurring training cycle(s) created. Existing open cycles were not changed.`);
      await fetchData();
    } catch (error: any) {
      alert(error?.message || "Could not generate recurring training cycles.");
    } finally {
      setGeneratingRecurring(false);
    }
  };

  const createAssignment = async () => {
    if (newAssignment.training_category === "certification") { alert("Use the Certification Register to record externally approved signed certifications. Certification training is not an employee acknowledgement assignment."); return; }
    // Verify the selected revision again at submission time; the dropdown alone is not a security boundary.
    if (newAssignment.document_id) {
      const { data: currentDocument, error: documentError } = await supabase
        .from("controlled_documents")
        .select("id,status")
        .eq("id", newAssignment.document_id)
        .maybeSingle();
      if (documentError || !currentDocument || !["release", "effective"].includes(String(currentDocument.status || "").toLowerCase())) {
        alert("Select a currently released, effective controlled document. Superseded and unreleased revisions cannot be assigned to new training.");
        await fetchData();
        return;
      }
    }
    if (!normalizeEmail(newAssignment.assigned_to_email)) {
      alert("Assigned-to email is required.");
      return;
    }

    if (!newAssignment.training_title.trim()) {
      alert("Training title is required.");
      return;
    }

    if (newAssignment.training_category === "recurring" && (!Number.isInteger(Number(newAssignment.recurrence_months)) || Number(newAssignment.recurrence_months) < 1 || Number(newAssignment.recurrence_months) > 120)) { alert("Recurrence must be between 1 and 120 months."); return; }

    if(!canManage||creatingAssignment)return;
    const method=trainingMethods.find(m=>m.id===manualMethod);
    if(!method||!newAssignment.due_date){alert("Select a training method and due date.");return;}
    const mode=method.evidence_required?(method.acknowledgement_required?"both":"attachment"):"signature";
    setCreatingAssignment(true);
    const { error } = await supabase.from("training_assignments").insert({
      document_id: newAssignment.document_id || null,
      assigned_to_email: normalizeEmail(newAssignment.assigned_to_email),
      assigned_by_email: userEmail || "unknown",
      assignment_source: "manual",
      training_category: newAssignment.training_category,
      recurrence_months: newAssignment.training_category === "recurring" ? Number(newAssignment.recurrence_months) : null,
      recurrence_basis: newAssignment.training_category === "recurring" ? newAssignment.recurrence_basis : null,
      recurring_evidence_mode: newAssignment.training_category === "recurring" ? newAssignment.recurring_evidence_mode : mode,
      training_method_id: method.id,
      approved_evaluation_attachment_required: newAssignment.training_category === "recurring" && !!newAssignment.approved_evaluation_attachment_required,
      supervisor_designee_evidence_approval_required: !!newAssignment.supervisor_designee_evidence_approval_required,
      role_name: newAssignment.role_name || null,
      department: newAssignment.department || null,
      training_title: newAssignment.training_title,
      training_description: newAssignment.training_description || null,
      due_date: newAssignment.due_date || null,
      status: "assigned",
      effectiveness_required: false,
      effectiveness_status: "not_required",
      supervisor_verification_required: false,
      acknowledgement_required: newAssignment.training_category === "recurring" ? ["signature","both"].includes(newAssignment.recurring_evidence_mode) : ["signature","both"].includes(mode),
    });

    setCreatingAssignment(false);
    if (error) {
      alert(error.message);
      return;
    }

    setNewAssignment({
      document_id: "",
      training_category: "standard",
      recurrence_months: "12",
      recurrence_basis: "completion",
      recurring_evidence_mode: "attachment",
      approved_evaluation_attachment_required: false,
    supervisor_designee_evidence_approval_required: false,
      assigned_to_email: "",
      training_title: "",
      training_description: "",
      role_name: "",
      department: "",
      due_date: "",
      effectiveness_required: false,
      supervisor_verification_required: false,
      acknowledgement_required: true,
    });

    setManualMethod("");
    fetchData();
  };

  const getDocumentForAssignment = (assignment: TrainingAssignment) => {
    if (!assignment.document_id) return null;
    return documents.find((doc) => doc.id === assignment.document_id) || null;
  };

  const getSignatureForAssignment = (assignment: TrainingAssignment) => {
    return (
      signatures.find((signature) => signature.id === assignment.signature_id) ||
      signatures.find((signature) => signature.record_id === assignment.id) ||
      null
    );
  };

  const completeTrainingWithSignature = async (
    assignment: TrainingAssignment,
    meaning: string,
    reason: string
  ) => {
    if (!userEmail) {
      alert("You must be logged in to sign training.");
      return;
    }

    if (normalizeEmail(assignment.assigned_to_email) !== normalizeEmail(userEmail) && !canManage) {
      alert("Only the assigned trainee or training administrator can complete this training.");
      return;
    }

    try {
      await acknowledgeTraining({
        assignmentId: assignment.id,
        documentId: assignment.document_id,
        userEmail,
        userRole,
        meaning: meaning || "Acknowledge Training",
        reason: reason || "Training completed and understood.",
      });

      setShowTrainingSignature(false);
      setPendingSignatureAssignment(null);
      await fetchData();
      alert("Training completed and electronically signed.");
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleTrainingSignatureSubmit = async (data: {
    meaning: string;
    reason: string;
  }) => {
    if (!pendingSignatureAssignment) return;

    await completeTrainingWithSignature(
      pendingSignatureAssignment,
      data.meaning,
      data.reason
    );
  };

  const updateAssignmentStatus = async (
    assignment: TrainingAssignment,
    status: string
  ) => {
    if (status === "in_progress" && assignment.assigned_to_email.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
      alert("Only the assigned employee can start this training.");
      return;
    }
    const payload: any = { status };

    if (status === "in_progress") {
      payload.training_comments =
        assignment.training_comments || "Training started.";
    }

    if (status === "completed") {
      if ((evidenceMode(assignment) === "signature" || evidenceMode(assignment) === "both") && !assignment.signature_id) {
        setPendingSignatureAssignment(assignment);
        setShowTrainingSignature(true);
        return;
      }

      payload.completed_at = new Date().toISOString();
      payload.completed_by = userEmail;

      if (evidenceMode(assignment) === "signature" || evidenceMode(assignment) === "both") {
        payload.acknowledged_at = new Date().toISOString();
        payload.acknowledged_by = userEmail;
      }

    }

    if (status === "waived") {
      payload.completed_at = new Date().toISOString();
      payload.completed_by = userEmail;
    }

    const { error } = await supabase
      .from("training_assignments")
      .update(payload)
      .eq("id", assignment.id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchData();
  };

  const verifySupervisor = async (assignment: TrainingAssignment) => {
    if (!canManage) {
      alert(
        "Only training admin, quality, approver, admin, or VP Quality can verify training."
      );
      return;
    }

    const { error } = await supabase
      .from("training_assignments")
      .update({
        supervisor_verified_by: userEmail,
        supervisor_verified_at: new Date().toISOString(),
      })
      .eq("id", assignment.id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchData();
  };

  if (loading) {
    return <main style={pageStyle}>Loading Training Management...</main>;
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>TRAINING MANAGEMENT</div>
          <h1 style={{ margin: "6px 0" }}>Training Management</h1>
          <p style={subtleText}>
            Assign, complete, acknowledge, verify, and track training connected
            to controlled documents and the training matrix.
          </p>
        </div>


      </header>

      
      <section style={{ ...cardStyle, display: activeTrainingSection === "overview" ? undefined : "none" }}>
        <h2 style={{ marginTop: 0 }}>My Training Queue</h2>
        <p style={subtleText}>
          Your open training, overdue training, and training assignments awaiting electronic signature.
        </p>

        <div style={kpiGridStyle}>
          <KpiCard
            title="Awaiting My Signature"
            value={myTrainingMetrics.awaitingSignature}
            color="#d97706"
          />
          <KpiCard
            title="My Open Training"
            value={myTrainingMetrics.open}
            color="#2563eb"
          />
          <KpiCard
            title="My Overdue"
            value={myTrainingMetrics.overdue}
            color="#dc2626"
          />
        </div>

        <button
          style={primaryButtonStyle}
          onClick={() => {
            setFilterMine(true);
            setFilterTeamPending(false);
            setFilterStatus("all");
            setActiveTrainingSection("assignments");
          }}
        >
          Open My Training
        </button>
        {directReportEmails.size > 0 && <button
          style={{ ...primaryButtonStyle, marginLeft: 12 }}
          onClick={() => {
            setFilterMine(false);
            setFilterTeamPending(true);
            setFilterStatus("all");
            setActiveTrainingSection("assignments");
          }}
        >
          View My Team Pending Training
        </button>}
      </section>

      <section style={{ ...cardStyle, display: activeTrainingSection === "assignments" ? undefined : "none" }}>
        <h2 style={{ marginTop: 0 }}>{filterTeamPending ? "My Team Pending Training" : "Training Assignments"}</h2>
        {filterTeamPending && <button type="button" onClick={() => setFilterTeamPending(false)}>Show All Accessible Training</button>}

        <div style={filterRowStyle}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={inputStyle}
          >
            <option value="all">All Statuses</option>
            <optgroup label="Training Type"><option value="certification">Certification</option><option value="recurring">Recurring Training</option><option value="standard">Read &amp; Acknowledge</option></optgroup>
          <optgroup label="Status">{TRAINING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}</optgroup>
          </select>

          <label>
            <input
              type="checkbox"
              checked={filterMine}
              onChange={(e) => { setFilterMine(e.target.checked); if (e.target.checked) setFilterTeamPending(false); }}
            />{" "}
            My Training Only
          </label>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead><tr>
              {["Document", "Description", "Revision", "Training Type", "Assigned To", "Due Date", "Status", "Action"].map(heading => <th key={heading} style={thStyle}>{heading}</th>)}
            </tr></thead>
            <tbody>
              {filteredAssignments.map(assignment => {
                const doc = getDocumentForAssignment(assignment);
                const trainingType = assignment.training_category === "certification" ? "Certification" : assignment.training_category === "recurring" ? "Recurring Training" : "Read & Understand";
                const displayStatus = !["completed", "effectiveness_complete", "waived", "cancelled", "withdrawn"].includes(assignment.status || "") && assignment.due_date && assignment.due_date < today ? "overdue" : assignment.status || "assigned";
                return <tr key={assignment.id}>
                  <td style={tdStyle}>{doc?.document_number || "—"}</td>
                  <td style={tdStyle}>{doc?.title || assignment.training_title || "—"}</td>
                  <td style={tdStyle}>{doc?.revision || "—"}</td>
                  <td style={tdStyle}>{trainingType}</td>
                  <td style={tdStyle}>{assignment.assigned_to_email}</td>
                  <td style={tdStyle}>{assignment.due_date || "N/A"}</td>
                  <td style={tdStyle}><StatusBadge status={displayStatus} /></td>
                  <td style={tdStyle}><a href={`/training/${assignment.id}`} style={darkButtonStyle}>Open Record</a></td>
                </tr>;
              })}
              {filteredAssignments.length === 0 && <tr><td colSpan={8} style={tdStyle}>No training assignments match the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

{canManage ? (
<section style={{ ...cardStyle, display: activeTrainingSection === "administration" ? undefined : "none" }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <h2 style={{ marginTop: 0 }}>Create Training Assignment</h2>
        </div>

        <div style={{ ...cardStyle, marginBottom: 16, padding: 16 }}>
          {(() => {
            const selectedDocument = documents.find((doc) => String(doc.id) === String(newAssignment.document_id));
            return (
              <div style={gridStyle}>
                <Field label="Released SOP">
                  <select
                    value={newAssignment.document_id}
                    onChange={(e) => setNewAssignment({ ...newAssignment, document_id: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">Select SOP</option>
                    {documents.filter((doc) => ["release", "effective"].includes(String(doc.status || "").toLowerCase())).map((doc) => (
                      <option key={doc.id} value={doc.id}>{doc.document_number}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Description"><input value={selectedDocument?.title || ""} readOnly style={inputStyle} /></Field>
                <Field label="Revision"><input value={selectedDocument?.revision || ""} readOnly style={inputStyle} /></Field>
              </div>
            );
          })()}
        </div>
        <div style={gridStyle}>
          <Field label="Training Method"><select value={manualMethod} onChange={e=>{setManualMethod(e.target.value);const m=trainingMethods.find(m=>m.id===e.target.value);setNewAssignment({...newAssignment,recurring_evidence_mode:m?.evidence_required?(m.acknowledgement_required?"both":"attachment"):"signature"});}} style={inputStyle}><option value="">Select configured method</option>{trainingMethods.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></Field>
          <Field label="Training Frequency"><select value={newAssignment.training_category} onChange={e=>setNewAssignment({...newAssignment,training_category:e.target.value})} style={inputStyle}><option value="standard">One-time</option><option value="recurring">Recurring</option></select></Field>
          {newAssignment.training_category === "recurring" ? <>
            <Field label="Repeat Every (Months)"><input type="number" min={1} max={120} value={newAssignment.recurrence_months} onChange={(e) => setNewAssignment({ ...newAssignment, recurrence_months: e.target.value })} style={inputStyle} /></Field>
            <Field label="Recurrence Basis"><select value={newAssignment.recurrence_basis} onChange={(e) => setNewAssignment({ ...newAssignment, recurrence_basis: e.target.value })} style={inputStyle}><option value="completion">Last Completion Date</option><option value="calendar">Fixed Calendar Schedule</option></select></Field>
            <Field label="Required Completion Evidence"><select value={newAssignment.recurring_evidence_mode} onChange={(e) => setNewAssignment({ ...newAssignment, recurring_evidence_mode: e.target.value })} style={inputStyle}><option value="signature">Electronic Acknowledgement</option><option value="attachment">Training Evidence Attachment</option><option value="both">Both</option></select></Field>

          </> : null}
          <Field label="Assigned To Email">
            <input
              type="email"
              value={newAssignment.assigned_to_email}
              onChange={(e) =>
                setNewAssignment({
                  ...newAssignment,
                  assigned_to_email: e.target.value,
                })
              }
              style={inputStyle}
            />
          </Field>

          <Field label="Training Title">
            <input
              value={newAssignment.training_title}
              onChange={(e) =>
                setNewAssignment({
                  ...newAssignment,
                  training_title: e.target.value,
                })
              }
              style={inputStyle}
            />
          </Field>

          <Field label="Due Date">
            <input
              type="date"
              value={newAssignment.due_date}
              onChange={(e) =>
                setNewAssignment({
                  ...newAssignment,
                  due_date: e.target.value,
                })
              }
              style={inputStyle}
            />
          </Field>

          <Field label="Role">
            <input
              value={newAssignment.role_name}
              onChange={(e) =>
                setNewAssignment({
                  ...newAssignment,
                  role_name: e.target.value,
                })
              }
              style={inputStyle}
            />
          </Field>

          <Field label="Department">
            <input
              value={newAssignment.department}
              onChange={(e) =>
                setNewAssignment({
                  ...newAssignment,
                  department: e.target.value,
                })
              }
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Training Description">
          <textarea
            value={newAssignment.training_description}
            onChange={(e) =>
              setNewAssignment({
                ...newAssignment,
                training_description: e.target.value,
              })
            }
            rows={3}
            style={textareaStyle}
          />
        </Field>

        <div style={buttonRowStyle}>
          <label>
            <input
              type="checkbox"
              checked={newAssignment.supervisor_designee_evidence_approval_required}
              onChange={(e) => setNewAssignment({ ...newAssignment, supervisor_designee_evidence_approval_required: e.target.checked })}
            />{" "}
            Supervisor/Designee Evidence Approval Required
          </label>




        </div>

        <button disabled={creatingAssignment||!manualMethod} onClick={createAssignment} style={primaryButtonStyle}>
          Create Assignment
        </button>
        {newAssignment.training_category === "recurring" && <p style={{ ...subtleText, marginTop: 12 }}>Recurring training configuration is saved with this assignment. Eligible future assignments are generated automatically when due; use Generate Due Training in the sidebar for manual backup.</p>}
      </section>

) : null}

{canManage ? (
      <section style={{ ...cardStyle, display: activeTrainingSection === "employees" ? undefined : "none" }}>
        <h2 style={{ marginTop: 0 }}>Employee Profiles</h2>

        <p style={subtleText}>
          Employee profiles are used for automatic training assignment from the training matrix.
        </p>

        <div style={gridStyle}>
          <Field label="Employee Email">
            <input
              value={newEmployee.user_email}
              onChange={(e) =>
                setNewEmployee({
                  ...newEmployee,
                  user_email: e.target.value,
                })
              }
              style={inputStyle}
            />
          </Field>

          <Field label="Full Name">
            <input
              value={newEmployee.full_name}
              onChange={(e) =>
                setNewEmployee({
                  ...newEmployee,
                  full_name: e.target.value,
                })
              }
              style={inputStyle}
            />
          </Field>

          <Field label="Role">
            <input
              value={newEmployee.role_name}
              onChange={(e) =>
                setNewEmployee({
                  ...newEmployee,
                  role_name: e.target.value,
                })
              }
              style={inputStyle}
            />
          </Field>

          <Field label="Department">
            <input
              value={newEmployee.department}
              onChange={(e) =>
                setNewEmployee({
                  ...newEmployee,
                  department: e.target.value,
                })
              }
              style={inputStyle}
            />
          </Field>

          <Field label="Manager Email">
            <input
              value={newEmployee.manager_email}
              onChange={(e) =>
                setNewEmployee({
                  ...newEmployee,
                  manager_email: e.target.value,
                })
              }
              style={inputStyle}
            />
          </Field>
        </div>

        <button
          onClick={createEmployeeProfile}
          style={primaryButtonStyle}
        >
          Add / Update Employee
        </button>

        <ul>
          {employees.map((employee) => (
            <li key={employee.id}>
              {employee.user_email} —{" "}
              {employee.role_name || "No Role"} —{" "}
              {employee.department || "No Department"}
            </li>
          ))}
        </ul>
      </section>

) : null}

      {canManage && activeTrainingSection === "due" && <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Generate Due Training</h2>
        <p style={subtleText}>Generate eligible recurring cycles, then review existing due and overdue Recurring Training and Read &amp; Acknowledge assignments. Reviewing this list does not send notifications.</p>
        <div style={buttonRowStyle}>
          <button type="button" onClick={generateRecurringCycles} disabled={generatingRecurring} style={primaryButtonStyle}>{generatingRecurring ? "Generating..." : "Generate Due Training"}</button>
          <button type="button" onClick={sendTrainingDueNotices} disabled={sendingTrainingNotices} style={secondaryButtonStyle}>{sendingTrainingNotices ? "Sending..." : "Send Due Training Notices"}</button>
        </div>
        <p style={subtleText}>The notice action uses the existing due-training notification rules and duplicate protection. It does not send notices for completed certifications.</p>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead><tr>{["Training Type","Document","Employee","Due Date","Status","Action"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {assignments.filter(a => (a.training_category === "recurring" || (a.training_category !== "certification" && a.training_category !== "recurring")) && a.status !== "completed" && a.status !== "waived" && !!a.due_date && a.due_date <= today).map(a => { const d = getDocumentForAssignment(a); return <tr key={a.id}>
                <td style={tdStyle}>{a.training_category === "recurring" ? "Recurring Training" : "Read & Acknowledge"}</td>
                <td style={tdStyle}>{d ? `${d.document_number} Rev ${d.revision}` : a.training_title}</td>
                <td style={tdStyle}>{a.assigned_to_email}</td>
                <td style={tdStyle}>{a.due_date}</td>
                <td style={tdStyle}>{a.due_date! < today ? "Overdue" : "Due"}</td>
                <td style={tdStyle}><a href={`/training/${a.id}`}>Open Record</a></td>
              </tr>; })}
              {!assignments.some(a => a.training_category !== "certification" && a.status !== "completed" && a.status !== "waived" && !!a.due_date && a.due_date <= today) && <tr><td colSpan={6} style={tdStyle}>No due or overdue training assignments found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>}

      {canManage && activeTrainingSection === "administration" && <TrainingMatrixAssignment onAssigned={()=>{void supabase.from("training_assignments").select("*").order("created_at",{ascending:false}).then(({data,error})=>{if(error)alert(error.message);else setAssignments(data||[]);});}}/>}

      <section style={{ ...cardStyle, display: activeTrainingSection === "history" ? undefined : "none" }}>
        <h2 style={{ marginTop: 0 }}>Electronic Signature Records</h2>
        {signatures.length === 0 ? (
          <p style={subtleText}>No electronic signature records found yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Signed By</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Meaning</th>
                  <th style={thStyle}>Reason</th>
                  <th style={thStyle}>Signed At</th>
                </tr>
              </thead>
              <tbody>
                {signatures.slice(0, 20).map((signature) => (
                  <tr key={signature.id}>
                    <td style={tdStyle}>{signature.signed_by}</td>
                    <td style={tdStyle}>{signature.signer_role || "N/A"}</td>
                    <td style={tdStyle}>{signature.signature_meaning}</td>
                    <td style={tdStyle}>{signature.signature_reason || "N/A"}</td>
                    <td style={tdStyle}>{formatDateTime(signature.signed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {completionAssignment ? (
        <div role="dialog" aria-modal="true" aria-label="Record Training Completion" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"grid",placeItems:"center",zIndex:1000}}>
          <div style={{background:"white",padding:24,borderRadius:12,width:"min(540px,94vw)",maxHeight:"90vh",overflowY:"auto"}}>
            <h2>Record Training Completion</h2>
            <p>{completionAssignment.training_title || "Training"} — {completionAssignment.training_category || "standard"}</p>
            <Field label="Completion Date"><input type="date" value={completionDate} onChange={e=>setCompletionDate(e.target.value)} style={inputStyle}/></Field>
            {(evidenceMode(completionAssignment)==="attachment" || evidenceMode(completionAssignment)==="both") ? (
              <Field label="Signed Training Form (required)">
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>setCompletionFile(e.target.files?.[0]||null)} />
                {completionAssignment.training_evidence_file_name ? <p>Existing evidence: {completionAssignment.training_evidence_file_name}</p> : null}
              </Field>
            ) : null}
            <Field label="Valid Until (optional)"><input type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)} style={inputStyle}/></Field>
            <Field label="Retraining Due (optional)"><input type="date" value={retrainingDue} onChange={e=>setRetrainingDue(e.target.value)} style={inputStyle}/></Field>
            <p>{(evidenceMode(completionAssignment)==="signature" || evidenceMode(completionAssignment)==="both") ? "Electronic acknowledgement will follow this step." : "Completion will be recorded with the supplied evidence."}</p>
            <button disabled={savingCompletion} onClick={submitCompletion} style={primaryButtonStyle}>{savingCompletion?"Saving...":"Save Completion"}</button>
            <button disabled={savingCompletion} onClick={()=>setCompletionAssignment(null)}>Cancel</button>
          </div>
        </div>
      ) : null}
      <ESignatureModal
        open={showTrainingSignature}
        title="Training Acknowledgement Signature"
        actionLabel="Sign & Complete Training"
        onSubmit={handleTrainingSignatureSubmit}
        onClose={() => {
          setShowTrainingSignature(false);
          setPendingSignatureAssignment(null);
        }}
      />
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ marginTop: "5px" }}>{children}</div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  color,
  suffix = "",
}: {
  title: string;
  value: number;
  color: string;
  suffix?: string;
}) {
  return (
    <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}>
      <div style={kpiTitleStyle}>{title}</div>
      <div style={{ fontSize: "30px", fontWeight: 800, color }}>
        {value}
        {suffix}
      </div>
    </div>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "N/A";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function ComplianceBadge({ value }: { value: number }) {
  const color = value >= 95 ? "#15803d" : value >= 80 ? "#d97706" : "#dc2626";

  return (
    <span
      style={{
        background: color,
        color: "white",
        borderRadius: "999px",
        padding: "3px 8px",
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      {value}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "completed" || status === "effectiveness_complete"
      ? "#15803d"
      : status === "overdue"
      ? "#dc2626"
      : ["waived", "cancelled", "withdrawn"].includes(status)
      ? "#6b7280"
      : status === "in_progress"
      ? "#2563eb"
      : "#d97706";

  return (
    <span
      style={{
        background: color,
        color: "white",
        borderRadius: "999px",
        padding: "3px 8px",
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  );
}

const pageStyle: React.CSSProperties = {
  padding: "24px",
  background: "#f8fafc",
  minHeight: "100vh",
  fontFamily: "Arial, sans-serif",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: "20px",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: "12px",
  letterSpacing: "0.08em",
  color: "#6b7280",
  fontWeight: 800,
};

const subtleText: React.CSSProperties = {
  color: "#6b7280",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "16px",
  padding: "20px",
  marginBottom: "20px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "14px",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  marginBottom: "20px",
};

const kpiCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "16px",
};

const kpiTitleStyle: React.CSSProperties = {
  color: "#6b7280",
  marginBottom: "8px",
};

const labelStyle: React.CSSProperties = {
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  marginBottom: "8px",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  marginTop: "6px",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  border: "none",
  padding: "10px 14px",
  borderRadius: "8px",
  fontWeight: 700,
  cursor: "pointer",
  marginRight: "8px",
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "#15803d",
  color: "white",
  border: "none",
  padding: "10px 14px",
  borderRadius: "8px",
  fontWeight: 700,
  cursor: "pointer",
  marginLeft: "8px",
};

const darkButtonStyle: React.CSSProperties = {
  background: "#111827",
  color: "white",
  padding: "10px 14px",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: 700,
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  alignItems: "center",
  marginTop: "12px",
  marginBottom: "12px",
};

const filterRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "14px",
  alignItems: "center",
  marginBottom: "14px",
  flexWrap: "wrap",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #d1d5db",
  padding: "10px",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
  verticalAlign: "top",
};

const actionStackStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const smallTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
};
const warningTextStyle: React.CSSProperties = { color: "#b45309", fontWeight: 700 };
