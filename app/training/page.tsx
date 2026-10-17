"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ESignatureModal from "../../components/ESignatureModal";
import { acknowledgeTraining } from "../../services/trainingService";

type TrainingAssignment = {
  id: string;
  tenant_id?: string | null;
  training_category?: string | null;
  recurring_evidence_mode?: string | null;
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
  "effectiveness_pending",
  "effectiveness_complete",
  "waived",
];

export default function TrainingManagementPage() {
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [matrixRows, setMatrixRows] = useState<TrainingMatrixRow[]>([]);
  const [documents, setDocuments] = useState<ControlledDocument[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [signatures, setSignatures] = useState<ElectronicSignature[]>([]);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [generatingRecurring, setGeneratingRecurring] = useState(false);
  const [sendingTrainingNotices, setSendingTrainingNotices] = useState(false);
  const [autoAssignResult, setAutoAssignResult] = useState<any>(null);

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

  const [activeTrainingSection, setActiveTrainingSection] = useState("overview");
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("section");
    if (requested && ["overview", "assignments", "administration", "employees", "history"].includes(requested)) {
      setActiveTrainingSection(requested);
    }
  }, []);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMine, setFilterMine] = useState(false);
  const [showTrainingSignature, setShowTrainingSignature] = useState(false);
  const [pendingSignatureAssignment, setPendingSignatureAssignment] =
    useState<TrainingAssignment | null>(null);

  const [completionAssignment, setCompletionAssignment] = useState<TrainingAssignment | null>(null);
  const [completionFile, setCompletionFile] = useState<File | null>(null);
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().slice(0,10));
  const [validUntil, setValidUntil] = useState("");
  const [retrainingDue, setRetrainingDue] = useState("");
  const [savingCompletion, setSavingCompletion] = useState(false);
  const evidenceMode = (assignment: TrainingAssignment) =>
    assignment.training_category === "certification" ? "attachment" :
    assignment.training_category === "recurring" ? (assignment.recurring_evidence_mode || "attachment") : "signature";
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

  const [newMatrix, setNewMatrix] = useState({
    role_name: "",
    department: "",
    document_number: "",
    required_training: true,
    effectiveness_required: false,
  });

  const [effectivenessMethod, setEffectivenessMethod] = useState("");
  const [effectivenessResult, setEffectivenessResult] = useState("");
  const [effectivenessComments, setEffectivenessComments] = useState("");

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

  const filteredAssignments = useMemo(() => {
    const reportEmails = new Set(employees.filter((e) => e.manager_email?.toLowerCase() === userEmail.toLowerCase()).map((e) => e.user_email.toLowerCase()));
    return assignments.filter((item) => {
      if (!canManage && item.assigned_to_email.toLowerCase() !== userEmail.toLowerCase() && !reportEmails.has(item.assigned_to_email.toLowerCase())) return false;
      const matchesStatus =
        filterStatus === "all" || item.status === filterStatus;

      const matchesMine =
        !filterMine || item.assigned_to_email === userEmail;

      return matchesStatus && matchesMine;
    });
  }, [assignments, employees, canManage, filterStatus, filterMine, userEmail]);

  const metrics = useMemo(() => {
    const open = assignments.filter(
      (a) => a.status !== "completed" && a.status !== "waived"
    );

    const overdue = open.filter((a) => a.due_date && a.due_date < today);
    const completed = assignments.filter((a) => a.status === "completed");
    const trainingSignatures = signatures.filter(
      (signature) => signature.module_name === "training"
    );
    const awaitingSignature = assignments.filter(
      (a) =>
        a.acknowledgement_required &&
        a.status !== "completed" &&
        a.status !== "waived" &&
        !a.signature_id
    );

    const effectivenessPending = assignments.filter(
      (a) =>
        a.effectiveness_required &&
        a.effectiveness_status !== "effectiveness_complete"
    );

    return {
      total: assignments.length,
      open: open.length,
      overdue: overdue.length,
      completed: completed.length,
      trainingSignatures: trainingSignatures.length,
      awaitingSignature: awaitingSignature.length,
      effectivenessPending: effectivenessPending.length,
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
            assignment.status !== "completed" &&
            assignment.status !== "waived" &&
            assignment.due_date &&
            assignment.due_date < today
        ).length;
        const awaitingSignature = docAssignments.filter(
          (assignment) =>
            assignment.acknowledgement_required &&
            !assignment.signature_id &&
            assignment.status !== "completed" &&
            assignment.status !== "waived"
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
              assignment.status !== "completed" && assignment.status !== "waived"
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

    const { error } = await supabase.from("training_assignments").insert({
      document_id: newAssignment.document_id || null,
      assigned_to_email: normalizeEmail(newAssignment.assigned_to_email),
      assigned_by_email: userEmail || "unknown",
      assignment_source: "manual",
      training_category: newAssignment.training_category,
      recurrence_months: newAssignment.training_category === "recurring" ? Number(newAssignment.recurrence_months) : null,
      recurrence_basis: newAssignment.training_category === "recurring" ? newAssignment.recurrence_basis : null,
      recurring_evidence_mode: newAssignment.training_category === "recurring" ? newAssignment.recurring_evidence_mode : null,
      role_name: newAssignment.role_name || null,
      department: newAssignment.department || null,
      training_title: newAssignment.training_title,
      training_description: newAssignment.training_description || null,
      due_date: newAssignment.due_date || null,
      status: "assigned",
      effectiveness_required: newAssignment.training_category === "certification" || newAssignment.effectiveness_required,
      effectiveness_status: (newAssignment.training_category === "certification" || newAssignment.effectiveness_required)
        ? "effectiveness_pending"
        : "not_required",
      supervisor_verification_required:
        newAssignment.supervisor_verification_required,
      acknowledgement_required: newAssignment.acknowledgement_required,
    });

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

    fetchData();
  };

  const createMatrixRow = async () => {
    if (!newMatrix.role_name.trim() && !newMatrix.department.trim()) {
      alert("Role or department is required.");
      return;
    }

    if (!newMatrix.document_number.trim()) {
      alert("Document number is required.");
      return;
    }

    const { error } = await supabase.from("training_matrix").insert({
      role_name: newMatrix.role_name || null,
      department: newMatrix.department || null,
      document_number: newMatrix.document_number,
      required_training: newMatrix.required_training,
      effectiveness_required: newMatrix.effectiveness_required,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewMatrix({
      role_name: "",
      department: "",
      document_number: "",
      required_training: true,
      effectiveness_required: false,
    });

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

      if (assignment.effectiveness_required) {
        payload.effectiveness_status = "effectiveness_pending";
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

  const completeEffectiveness = async (assignment: TrainingAssignment) => {
    if (!canManage) {
      alert(
        "Only training admin, quality, approver, admin, or VP Quality can complete effectiveness checks."
      );
      return;
    }

    if (!assignment.effectiveness_required || assignment.effectiveness_status === "effectiveness_complete") {
      alert("This training evaluation is already completed or not required.");
      return;
    }

    if (!effectivenessMethod.trim() || !effectivenessResult.trim()) {
      alert("Effectiveness method and result are required.");
      return;
    }

    const { error: checkError } = await supabase
      .from("training_effectiveness_checks")
      .insert({
        training_assignment_id: assignment.id,
        effectiveness_method: effectivenessMethod,
        effectiveness_result: effectivenessResult,
        verified_by: userEmail,
        verified_at: new Date().toISOString(),
        comments: effectivenessComments || null,
      });

    if (checkError) {
      alert(checkError.message);
      return;
    }

    const { error } = await supabase
      .from("training_assignments")
      .update({
        effectiveness_status: "effectiveness_complete",
      })
      .eq("id", assignment.id);

    if (error) {
      alert(error.message);
      return;
    }

    setEffectivenessMethod("");
    setEffectivenessResult("");
    setEffectivenessComments("");
    fetchData();
  };

  const autoAssignFromMatrix = async () => {
    if (!canManage) {
      alert(
        "Only training admin, quality, approver, admin, or VP Quality can auto-assign training."
      );
      return;
    }

    setAutoAssigning(true);
    setAutoAssignResult(null);

    const effectiveDocs = documents.filter(
      (doc) => doc.status === "effective"
    );

    let created = 0;
    let skipped = 0;

    for (const doc of effectiveDocs) {
      const matchingMatrixRows = matrixRows.filter(
        (row) =>
          String(row.document_number || "").trim().toLowerCase() ===
          String(doc.document_number || "").trim().toLowerCase()
      );

      for (const row of matchingMatrixRows) {
        const matchingEmployees = employees.filter((employee) => {
          const roleMatch =
            !row.role_name ||
            String(employee.role_name || "").trim().toLowerCase() ===
              String(row.role_name || "").trim().toLowerCase();

          const departmentMatch =
            !row.department ||
            String(employee.department || "").trim().toLowerCase() ===
              String(row.department || "").trim().toLowerCase();

          return roleMatch && departmentMatch;
        });

        for (const employee of matchingEmployees) {
          const existing = assignments.find(
            (assignment) =>
              assignment.document_id === doc.id &&
              assignment.assigned_to_email === employee.user_email
          );

          if (existing) {
            skipped += 1;
            continue;
          }

          const { error } = await supabase
            .from("training_assignments")
            .insert({
              document_id: doc.id,
              assigned_to_email: employee.user_email,
              assigned_by_email: userEmail || "system",
              assignment_source:
                "training_matrix_document_effective",
              role_name: employee.role_name || null,
              department: employee.department || null,
              training_title: `${doc.document_number} Rev ${doc.revision} Training`,
              training_description:
                `Training auto-assigned because ${doc.document_number} Rev ${doc.revision} is effective.`,
              due_date: addDays(14),
              status: "assigned",
              effectiveness_required:
                row.effectiveness_required || false,
              effectiveness_status:
                row.effectiveness_required
                  ? "effectiveness_pending"
                  : "not_required",
              supervisor_verification_required:
                row.effectiveness_required || false,
              acknowledgement_required: true,
            });

          if (!error) {
            created += 1;
          }
        }
      }
    }

    setAutoAssignResult({
      created,
      skipped,
      effectiveDocuments: effectiveDocs.length,
    });

    setAutoAssigning(false);

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

        <div style={buttonRowStyle}>
          {canManage && (
            <a href="/training/compliance" style={darkButtonStyle}>
              Training Compliance Report
            </a>
          )}
          <a href="/training/dashboard" style={darkButtonStyle}>
            Training Intelligence Dashboard
          </a>


        </div>
      </header>

      
      <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <aside aria-label="Training Management navigation" style={{ width: 224, flex: "0 0 224px", position: "sticky", top: 12, alignSelf: "flex-start", background: "#fff", border: "1px solid #d1d5db", borderRadius: 12, padding: 12 }}>
          <strong style={{ display: "block", padding: "8px 10px 14px" }}>Training Navigation</strong>
          {[
            { id: "overview", label: "Overview" },
            { id: "assignments", label: "Training Assignments" },
            ...(canManage ? [{ id: "administration", label: "Training Administration" }, { id: "employees", label: "Employee Profiles" }] : []),
            { id: "history", label: "Signature History" }
          ].map(item => <button key={item.id} type="button" onClick={() => setActiveTrainingSection(item.id)} aria-current={activeTrainingSection === item.id ? "page" : undefined} style={{ display: "block", width: "100%", padding: "11px 10px", marginBottom: 4, textAlign: "left", borderRadius: 7, border: "none", cursor: "pointer", background: activeTrainingSection === item.id ? "#dbeafe" : "transparent", color: "#111827", fontWeight: activeTrainingSection === item.id ? 700 : 500 }}>{item.label}</button>)}
          <a href="/training/certifications" style={{ display: "block", padding: "11px 10px" }}>Certification Register</a>
          <a href="/training/compliance" style={{ display: canManage ? "block" : "none", padding: "11px 10px" }}>Compliance Report</a>
          <a href="/training/dashboard" style={{ display: "block", padding: "11px 10px" }}>Training Intelligence</a>
        </aside>
        <div style={{ flex: "1 1 680px", minWidth: 0 }}>
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
            setFilterStatus("all");
            setActiveTrainingSection("assignments");
          }}
        >
          Open My Training
        </button>
      </section>

      <section style={{ ...cardStyle, display: activeTrainingSection === "assignments" ? undefined : "none" }}>
        <h2 style={{ marginTop: 0 }}>Training Assignments</h2>

        <div style={filterRowStyle}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={inputStyle}
          >
            <option value="all">All Statuses</option>
            {TRAINING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <label>
            <input
              type="checkbox"
              checked={filterMine}
              onChange={(e) => setFilterMine(e.target.checked)}
            />{" "}
            My Training Only
          </label>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Training</th>
                <th style={thStyle}>Document</th>
                <th style={thStyle}>Assigned To</th>
                <th style={thStyle}>Due Date</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Effectiveness</th>
                <th style={thStyle}>Supervisor</th>
                <th style={thStyle}>Signature</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredAssignments.map((assignment) => {
                const linkedDocument = getDocumentForAssignment(assignment);
                const signature = getSignatureForAssignment(assignment);

                return (
                <tr key={assignment.id}>
                  <td style={tdStyle}>
                    <strong>
                      {assignment.training_title || "Untitled Training"}
                    </strong>
                    <div style={smallTextStyle}>
                      {assignment.training_description || "No description"}
                    </div>
                    <div style={smallTextStyle}>
                      Source: {assignment.assignment_source || "N/A"}
                    </div>
                  </td>

                  <td style={tdStyle}>
                    {linkedDocument ? (
                      <>
                        <strong>{linkedDocument.document_number} Rev {linkedDocument.revision}</strong>
                        <div style={smallTextStyle}>{linkedDocument.title}</div>
                        {linkedDocument.file_url ? (
                          <a href={linkedDocument.file_url} target="_blank" rel="noreferrer">
                            Open Training Document
                          </a>
                        ) : (
                          <div style={smallTextStyle}>No document file attached</div>
                        )}
                      </>
                    ) : (
                      "No linked document"
                    )}
                  </td>

                  <td style={tdStyle}>{assignment.assigned_to_email}</td>
                  <td style={tdStyle}>{assignment.due_date || "N/A"}</td>
                  <td style={tdStyle}>
                    <StatusBadge
                      status={
                        assignment.status !== "completed" &&
                        assignment.due_date &&
                        assignment.due_date < today
                          ? "overdue"
                          : assignment.status || "assigned"
                      }
                    />
                  </td>
                  <td style={tdStyle}>
                    {assignment.effectiveness_required
                      ? trainingEffectivenessLabel(assignment.effectiveness_status)
                      : "Not Required"}
                  </td>
                  <td style={tdStyle}>
                    {assignment.supervisor_verification_required
                      ? assignment.supervisor_verified_at
                        ? "Verified"
                        : "Required"
                      : "Not required"}
                  </td>

                  <td style={tdStyle}>
                    {signature ? (
                      <>
                        <StatusBadge status="completed" />
                        <div style={smallTextStyle}>
                          {signature.signed_by}
                        </div>
                        <div style={smallTextStyle}>
                          {formatDateTime(signature.signed_at)}
                        </div>
                      </>
                    ) : assignment.acknowledgement_required ? (
                      <span style={warningTextStyle}>Signature required</span>
                    ) : (
                      "Not required"
                    )}
                  </td>

                  <td style={tdStyle}>
                    <div style={actionStackStyle}>
                      <a href={`/training/${assignment.id}`} style={darkButtonStyle}>
                        Open Training Record
                      </a>

                      {assignment.status === "assigned" && assignment.assigned_to_email.trim().toLowerCase() === userEmail.trim().toLowerCase() ? (
                        <button
                          onClick={() =>
                            updateAssignmentStatus(assignment, "in_progress")
                          }
                        >
                          Start
                        </button>
                      ) : null}

                      {assignment.status !== "completed" &&
                      assignment.status !== "waived" &&
                      (assignment.assigned_to_email === userEmail || canManage) ? (
                        <button
                          onClick={() => {
                            beginCompletion(assignment);
                          }}
                        >
                          Record Training Completion
                        </button>
                      ) : null}

                      {canManage &&
                      assignment.supervisor_verification_required ? (
                        <button onClick={() => verifySupervisor(assignment)}>
                          Supervisor Verify
                        </button>
                      ) : null}

                      {canManage && assignment.effectiveness_required && assignment.effectiveness_status !== "effectiveness_complete" ? (
                        <details>
                          <summary>Training Evaluation</summary>
                          <input
                            placeholder="Evaluation Method"
                            value={effectivenessMethod}
                            onChange={(e) =>
                              setEffectivenessMethod(e.target.value)
                            }
                            style={inputStyle}
                          />
                          <input
                            placeholder="Evaluation Result"
                            value={effectivenessResult}
                            onChange={(e) =>
                              setEffectivenessResult(e.target.value)
                            }
                            style={inputStyle}
                          />
                          <textarea
                            placeholder="Comments"
                            value={effectivenessComments}
                            onChange={(e) =>
                              setEffectivenessComments(e.target.value)
                            }
                            rows={3}
                            style={textareaStyle}
                          />
                          <button
                            onClick={() => completeEffectiveness(assignment)}
                          >
                            Complete Evaluation
                          </button>
                        </details>
                      ) : null}

                      {canManage && assignment.status !== "completed" ? (
                        <button
                          onClick={() =>
                            updateAssignmentStatus(assignment, "waived")
                          }
                        >
                          Waive
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
      </section>

{canManage ? (
<section style={{ ...cardStyle, display: activeTrainingSection === "administration" ? undefined : "none" }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <h2 style={{ marginTop: 0 }}>Create Training Assignment</h2>
          {canManage ? <button onClick={generateRecurringCycles} disabled={generatingRecurring} style={primaryButtonStyle}>{generatingRecurring ? "Checking Cycles..." : "Generate Due Recurring Cycles"}</button> : null}
          {canManage ? <button onClick={sendTrainingDueNotices} disabled={sendingTrainingNotices} style={primaryButtonStyle}>{sendingTrainingNotices ? "Sending Notices..." : "Send Due Training Notices"}</button> : null}
        </div>
        <p style={subtleText}>Recurring cycles are generated when due, based on the previous completed cycle. Each new cycle retains its own assignment, evidence and history. Uncompleted cycles remain open.</p>
        <p style={subtleText}>Completed certification is registered individually with an externally approved signed form. <a href="/training/certifications" style={{ textDecoration: "underline" }}>Open Certification Register</a>.</p>

        <div style={gridStyle}>
          <Field label="Training Type"><select value={newAssignment.training_category} onChange={(e) => setNewAssignment({ ...newAssignment, training_category: e.target.value, effectiveness_required: e.target.value === "certification" ? true : newAssignment.training_category === "certification" ? false : newAssignment.effectiveness_required })} style={inputStyle}><option value="standard">Read &amp; Understand / Standard Training</option><option value="recurring">Recurring Training</option></select></Field>
          {newAssignment.training_category === "recurring" ? <>
            <Field label="Repeat Every (Months)"><input type="number" min={1} max={120} value={newAssignment.recurrence_months} onChange={(e) => setNewAssignment({ ...newAssignment, recurrence_months: e.target.value })} style={inputStyle} /></Field>
            <Field label="Recurrence Basis"><select value={newAssignment.recurrence_basis} onChange={(e) => setNewAssignment({ ...newAssignment, recurrence_basis: e.target.value })} style={inputStyle}><option value="completion">Last Completion Date</option><option value="calendar">Fixed Calendar Schedule</option></select></Field>
            <Field label="Required Completion Evidence"><select value={newAssignment.recurring_evidence_mode} onChange={(e) => setNewAssignment({ ...newAssignment, recurring_evidence_mode: e.target.value })} style={inputStyle}><option value="signature">Electronic Acknowledgement</option><option value="attachment">Training Evidence Attachment</option><option value="both">Both</option></select></Field>
            <p style={subtleText}>Recurring configuration is saved for planning. Automatic future assignments and attachment enforcement will be enabled in the next phase.</p>
          </> : null}
          <Field label="Controlled Document">
            <select
              value={newAssignment.document_id}
              onChange={(e) =>
                setNewAssignment({
                  ...newAssignment,
                  document_id: e.target.value,
                })
              }
              style={inputStyle}
            >
              <option value="">No linked document</option>
              {documents.filter((doc) => ["release", "effective"].includes(String(doc.status || "").toLowerCase())).map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.document_number} Rev {doc.revision} — {doc.title}
                </option>
              ))}
            </select>
          </Field>

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
              checked={newAssignment.acknowledgement_required}
              onChange={(e) =>
                setNewAssignment({
                  ...newAssignment,
                  acknowledgement_required: e.target.checked,
                })
              }
            />{" "}
            Acknowledgement Required
          </label>

          <label>
            <input
              type="checkbox"
              checked={newAssignment.training_category === "certification" || newAssignment.effectiveness_required}
              disabled={newAssignment.training_category === "certification"}
              onChange={(e) =>
                setNewAssignment({
                  ...newAssignment,
                  effectiveness_required: e.target.checked,
                })
              }
            />{" "}
            Effectiveness Required {newAssignment.training_category === "certification" ? "(required for certification)" : "(optional assessment)"}
          </label>

          <label>
            <input
              type="checkbox"
              checked={newAssignment.supervisor_verification_required}
              onChange={(e) =>
                setNewAssignment({
                  ...newAssignment,
                  supervisor_verification_required: e.target.checked,
                })
              }
            />{" "}
            Supervisor Verification Required
          </label>
        </div>

        <button onClick={createAssignment} style={primaryButtonStyle}>
          Create Assignment
        </button>
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

      <section style={{ ...cardStyle, display: activeTrainingSection === "administration" && canManage ? undefined : "none" }}>
        <h2 style={{ marginTop: 0 }}>
          Auto-Assign Training From Effective Documents
        </h2>

        <p style={subtleText}>
          This scans effective controlled documents, matches them to the training matrix,
          finds matching employees, and automatically creates training assignments.
        </p>

        <button
          onClick={autoAssignFromMatrix}
          style={autoAssigning ? secondaryButtonStyle : primaryButtonStyle}
        >
          {autoAssigning ? "Auto-Assigning..." : "Run Auto-Assignment"}
        </button>

        {autoAssignResult ? (
          <div style={{ marginTop: "12px" }}>
            <strong>Results:</strong>
            <div>Effective Documents: {autoAssignResult.effectiveDocuments}</div>
            <div>Assignments Created: {autoAssignResult.created}</div>
            <div>Duplicates Skipped: {autoAssignResult.skipped}</div>
          </div>
        ) : null}
      </section>

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

        </div>
      </div>

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
      : status === "waived"
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

function trainingEffectivenessLabel(status?: string | null) {
  if (!status || status === "effectiveness_pending") return "Pending Evaluation";
  if (status === "effectiveness_complete") return "Evaluation Completed";
  if (status === "not_required") return "Not Required";
  return status.replaceAll("_", " ");
}
