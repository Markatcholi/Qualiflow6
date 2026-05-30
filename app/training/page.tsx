"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ESignatureModal from "../../components/ESignatureModal";
import { acknowledgeTraining } from "../../services/trainingService";

type TrainingAssignment = {
  id: string;
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

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMine, setFilterMine] = useState(false);
  const [showTrainingSignature, setShowTrainingSignature] = useState(false);
  const [pendingSignatureAssignment, setPendingSignatureAssignment] =
    useState<TrainingAssignment | null>(null);

  const [newAssignment, setNewAssignment] = useState({
    document_id: "",
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

  const canManage =
    userRole === "admin" ||
    userRole === "approver" ||
    userRole === "vp_quality" ||
    userRole === "quality" ||
    userRole === "training_admin";

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
    return assignments.filter((item) => {
      const matchesStatus =
        filterStatus === "all" || item.status === filterStatus;

      const matchesMine =
        !filterMine || item.assigned_to_email === userEmail;

      return matchesStatus && matchesMine;
    });
  }, [assignments, filterStatus, filterMine, userEmail]);

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

  const createAssignment = async () => {
    if (!normalizeEmail(newAssignment.assigned_to_email)) {
      alert("Assigned-to email is required.");
      return;
    }

    if (!newAssignment.training_title.trim()) {
      alert("Training title is required.");
      return;
    }

    const { error } = await supabase.from("training_assignments").insert({
      document_id: newAssignment.document_id || null,
      assigned_to_email: normalizeEmail(newAssignment.assigned_to_email),
      assigned_by_email: userEmail || "unknown",
      assignment_source: "manual",
      role_name: newAssignment.role_name || null,
      department: newAssignment.department || null,
      training_title: newAssignment.training_title,
      training_description: newAssignment.training_description || null,
      due_date: newAssignment.due_date || null,
      status: "assigned",
      effectiveness_required: newAssignment.effectiveness_required,
      effectiveness_status: newAssignment.effectiveness_required
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
    const payload: any = { status };

    if (status === "in_progress") {
      payload.training_comments =
        assignment.training_comments || "Training started.";
    }

    if (status === "completed") {
      if (assignment.acknowledgement_required && !assignment.signature_id) {
        setPendingSignatureAssignment(assignment);
        setShowTrainingSignature(true);
        return;
      }

      payload.completed_at = new Date().toISOString();
      payload.completed_by = userEmail;

      if (assignment.acknowledgement_required) {
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
        status:
          assignment.status === "completed"
            ? "effectiveness_complete"
            : assignment.status,
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

        <a href="/dashboard" style={darkButtonStyle}>
          Dashboard
        </a>
      </header>

      <section style={kpiGridStyle}>
        <KpiCard title="Total Assignments" value={metrics.total} color="#2563eb" />
        <KpiCard title="Open Training" value={metrics.open} color="#d97706" />
        <KpiCard title="Overdue" value={metrics.overdue} color="#dc2626" />
        <KpiCard title="Completed" value={metrics.completed} color="#15803d" />
        <KpiCard title="Training Signatures" value={metrics.trainingSignatures} color="#7c3aed" />
        <KpiCard title="Awaiting Signature" value={metrics.awaitingSignature} color="#d97706" />
        <KpiCard
          title="Completion Rate"
          value={metrics.completionRate}
          color="#15803d"
          suffix="%"
        />
        <KpiCard
          title="Effectiveness Pending"
          value={metrics.effectivenessPending}
          color="#d97706"
        />
        <KpiCard title="Matrix Rows" value={metrics.matrixRows} color="#2563eb" />
      </section>

      
      <section style={cardStyle}>
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

      <section style={cardStyle}>
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

<section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Create Training Assignment</h2>

        <div style={gridStyle}>
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
              {documents.map((doc) => (
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
              checked={newAssignment.effectiveness_required}
              onChange={(e) =>
                setNewAssignment({
                  ...newAssignment,
                  effectiveness_required: e.target.checked,
                })
              }
            />{" "}
            Effectiveness Required
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

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Training Matrix</h2>
        <p style={subtleText}>
          Define required training by role, department, and document number.
          Auto-assignment will use this matrix in the next upgrade.
        </p>

        <div style={gridStyle}>
          <Field label="Role">
            <input
              value={newMatrix.role_name}
              onChange={(e) =>
                setNewMatrix({ ...newMatrix, role_name: e.target.value })
              }
              style={inputStyle}
            />
          </Field>

          <Field label="Department">
            <input
              value={newMatrix.department}
              onChange={(e) =>
                setNewMatrix({ ...newMatrix, department: e.target.value })
              }
              style={inputStyle}
            />
          </Field>

          <Field label="Document Number">
            <input
              value={newMatrix.document_number}
              onChange={(e) =>
                setNewMatrix({
                  ...newMatrix,
                  document_number: e.target.value,
                })
              }
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={buttonRowStyle}>
          <label>
            <input
              type="checkbox"
              checked={newMatrix.required_training}
              onChange={(e) =>
                setNewMatrix({
                  ...newMatrix,
                  required_training: e.target.checked,
                })
              }
            />{" "}
            Required Training
          </label>

          <label>
            <input
              type="checkbox"
              checked={newMatrix.effectiveness_required}
              onChange={(e) =>
                setNewMatrix({
                  ...newMatrix,
                  effectiveness_required: e.target.checked,
                })
              }
            />{" "}
            Effectiveness Required
          </label>
        </div>

        <button onClick={createMatrixRow} style={primaryButtonStyle}>
          Add Matrix Row
        </button>

        <button onClick={autoAssignFromMatrix} style={secondaryButtonStyle}>
          Auto-Assign From Matrix
        </button>

        <ul>
          {matrixRows.map((row) => (
            <li key={row.id}>
              {row.role_name || "Any Role"} /{" "}
              {row.department || "Any Department"} → {row.document_number}
              {row.effectiveness_required ? " | Effectiveness Required" : ""}
            </li>
          ))}
        </ul>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Electronic Training Signatures</h2>
        {signatures.length === 0 ? (
          <p style={subtleText}>No electronic training signatures recorded yet.</p>
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

      <section style={cardStyle}>
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
                      ? assignment.effectiveness_status || "pending"
                      : "Not required"}
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

                      {assignment.status === "assigned" ? (
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
                            if (assignment.acknowledgement_required) {
                              setPendingSignatureAssignment(assignment);
                              setShowTrainingSignature(true);
                            } else {
                              updateAssignmentStatus(assignment, "completed");
                            }
                          }}
                        >
                          {assignment.acknowledgement_required
                            ? "Electronic Signature Required"
                            : "Complete Training"}
                        </button>
                      ) : null}

                      {canManage &&
                      assignment.supervisor_verification_required ? (
                        <button onClick={() => verifySupervisor(assignment)}>
                          Supervisor Verify
                        </button>
                      ) : null}

                      {canManage && assignment.effectiveness_required ? (
                        <details>
                          <summary>Effectiveness Check</summary>
                          <input
                            placeholder="Method"
                            value={effectivenessMethod}
                            onChange={(e) =>
                              setEffectivenessMethod(e.target.value)
                            }
                            style={inputStyle}
                          />
                          <input
                            placeholder="Result"
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
                            Complete Effectiveness
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
