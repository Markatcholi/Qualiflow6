"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type ControlledDocument = {
  id: string;
  document_number: string;
  title: string;
  document_type: string | null;
  revision: string;
  status: string;
  department: string | null;
  process_area: string | null;
  file_name: string | null;
  file_path: string | null;
  file_url: string | null;
  change_summary: string | null;
  approval_comments: string | null;
  owner_email: string | null;
  approver_email: string | null;
  submitted_for_approval_at: string | null;
  submitted_for_approval_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  effective_date: string | null;
  obsolete_at: string | null;
  obsolete_by: string | null;
  obsolete_reason: string | null;
  read_ack_required: boolean | null;
  training_required: boolean | null;
  originating_change_control_id?: string | null;
  change_required?: boolean | null;
  superseded_by_document_id?: string | null;
  superseded_document_id?: string | null;
  collaboration_required?: boolean | null;
  formal_review_required?: boolean | null;
  collaboration_completed?: boolean | null;
  formal_review_completed?: boolean | null;
  release_comments?: string | null;
  release_approved_by?: string | null;
  release_approved_at?: string | null;
  created_at: string | null;
  created_by: string | null;
};

const DOCUMENT_TYPES = [
  "SOP",
  "Work Instruction",
  "Form",
  "Policy",
  "Specification",
  "Protocol",
  "Report",
  "Template",
  "Other",
];

const STATUSES = [
  "draft",
  "collaboration",
  "formal_review",
  "approved",
  "effective",
  "rejected",
  "obsolete",
  "superseded",
];

export default function DocumentWorkflowPage() {
  const params = useParams();
  const documentId = String(params?.id || "");
  const [documents, setDocuments] = useState<ControlledDocument[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<any[]>([]);
  const [trainingAssignments, setTrainingAssignments] = useState<any[]>([]);
  const [collaborationReviews, setCollaborationReviews] = useState<any[]>([]);
  const [formalReviews, setFormalReviews] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [newDoc, setNewDoc] = useState({
    document_number: "",
    title: "",
    document_type: "SOP",
    revision: "A",
    department: "",
    process_area: "",
    change_summary: "",
    owner_email: "",
    approver_email: "",
    effective_date: "",
    read_ack_required: true,
    training_required: false,
  });

  const [trainingEmails, setTrainingEmails] = useState<Record<string, string>>({});
  const [obsoleteReason, setObsoleteReason] = useState<Record<string, string>>({});
  const [rejectComments, setRejectComments] = useState<Record<string, string>>({});
  const [releaseComments, setReleaseComments] = useState<Record<string, string>>({});
  const [collaborationReviewerEmails, setCollaborationReviewerEmails] = useState<Record<string, string>>({});
  const [formalReviewerEmails, setFormalReviewerEmails] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const [approvalTemplates, setApprovalTemplates] = useState<any[]>([]);
  const [assignedReviewers, setAssignedReviewers] = useState<any[]>([]);

  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [newReviewer, setNewReviewer] = useState({
    reviewer_type: "formal_review",
    reviewer_email: "",
    reviewer_role: "",
    required_reviewer: true,
  });

  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

  const canApprove =
    userRole === "admin" || userRole === "approver" || userRole === "vp_quality";

  const canManage =
    canApprove || userRole === "document_control" || userRole === "quality";

  const doc = documents[0] || null;

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

    const docRes = await supabase
      .from("controlled_documents")
      .select("*")
      .eq("id", documentId)
      .order("created_at", { ascending: false });

    const ackRes = await supabase
      .from("document_acknowledgements")
      .select("*")
      .eq("document_id", documentId)
      .order("acknowledged_at", { ascending: false });

    const trainingRes = await supabase
      .from("document_training_assignments")
      .select("*")
      .eq("document_id", documentId)
      .order("assigned_at", { ascending: false });

    const collaborationRes = await supabase
      .from("document_collaboration_reviews")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false });

    const formalRes = await supabase
      .from("document_formal_reviews")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false });

    if (docRes.error) alert(docRes.error.message);
    else setDocuments((docRes.data as ControlledDocument[]) || []);

    if (!ackRes.error) setAcknowledgements(ackRes.data || []);
    if (!trainingRes.error) setTrainingAssignments(trainingRes.data || []);
    if (!collaborationRes.error) setCollaborationReviews(collaborationRes.data || []);
    if (!formalRes.error) setFormalReviews(formalRes.data || []);

    const templateRes = await supabase
      .from("approval_matrix_templates")
      .select("*")
      .eq("active", true);

    if (!templateRes.error) {
      setApprovalTemplates(templateRes.data || []);
    }

    const reviewerRes = await supabase
      .from("document_assigned_reviewers")
      .select("*")
      .eq("document_id", documentId)
      .order("review_sequence", { ascending: true });

    if (!reviewerRes.error) {
      setAssignedReviewers(reviewerRes.data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [documentId]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesStatus = filterStatus === "all" || doc.status === filterStatus;
      const text = `${doc.document_number} ${doc.title} ${doc.document_type} ${doc.revision} ${doc.department} ${doc.process_area}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [documents, filterStatus, search]);

  const metrics = useMemo(() => {
    return {
      total: documents.length,
      draft: documents.filter((doc) => doc.status === "draft").length,
      pending: documents.filter((doc) => doc.status === "formal_review").length,
      collaboration: documents.filter((doc) => doc.status === "collaboration").length,
      rejected: documents.filter((doc) => doc.status === "rejected").length,
      approved: documents.filter((doc) => doc.status === "approved").length,
      effective: documents.filter((doc) => doc.status === "effective").length,
      obsolete: documents.filter((doc) => doc.status === "obsolete").length,
      trainingOpen: trainingAssignments.filter((t) => t.status !== "completed").length,
    };
  }, [documents, trainingAssignments]);

  const normalizeEmail = (value: string) => {
    const text = String(value || "").trim().toLowerCase();
    if (!text || !text.includes("@")) return "";
    return text;
  };

  const uploadDocumentFile = async () => {
    if (!selectedFile) return { fileName: null, filePath: null, fileUrl: null };

    const safeDocNumber =
      newDoc.document_number.trim().replace(/[^a-zA-Z0-9-_]/g, "_") ||
      "document";
    const safeRevision = newDoc.revision.trim().replace(/[^a-zA-Z0-9-_]/g, "_") || "rev";
    const filePath = `${safeDocNumber}/${safeRevision}/${Date.now()}_${selectedFile.name}`;

    const { error } = await supabase.storage
      .from("controlled-documents")
      .upload(filePath, selectedFile, { upsert: true });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage
      .from("controlled-documents")
      .getPublicUrl(filePath);

    return {
      fileName: selectedFile.name,
      filePath,
      fileUrl: data?.publicUrl || null,
    };
  };

  const createDocument = async () => {
    if (!newDoc.document_number.trim() || !newDoc.title.trim()) {
      alert("Document number and title are required.");
      return;
    }

    if (!newDoc.revision.trim()) {
      alert("Revision is required.");
      return;
    }

    if (newDoc.owner_email && !normalizeEmail(newDoc.owner_email)) {
      alert("Owner email must be a valid email address.");
      return;
    }

    if (newDoc.approver_email && !normalizeEmail(newDoc.approver_email)) {
      alert("Approver email must be a valid email address.");
      return;
    }

    setUploading(true);

    try {
      const uploaded = await uploadDocumentFile();

      const { error } = await supabase.from("controlled_documents").insert({
        document_number: newDoc.document_number.trim(),
        title: newDoc.title.trim(),
        document_type: newDoc.document_type,
        revision: newDoc.revision.trim(),
        status: "draft",
        department: newDoc.department || null,
        process_area: newDoc.process_area || null,
        file_name: uploaded.fileName,
        file_path: uploaded.filePath,
        file_url: uploaded.fileUrl,
        change_summary: newDoc.change_summary || null,
        owner_email: normalizeEmail(newDoc.owner_email) || userEmail || null,
        approver_email: normalizeEmail(newDoc.approver_email) || null,
        effective_date: newDoc.effective_date || null,
        read_ack_required: newDoc.read_ack_required,
        training_required: newDoc.training_required,
        created_by: userEmail || "unknown",
      });

      if (error) {
        alert(error.message);
        setUploading(false);
        return;
      }

      setNewDoc({
        document_number: "",
        title: "",
        document_type: "SOP",
        revision: "A",
        department: "",
        process_area: "",
        change_summary: "",
        owner_email: "",
        approver_email: "",
        effective_date: "",
        read_ack_required: true,
        training_required: false,
      });
      setSelectedFile(null);
      await fetchData();
    } catch (error: any) {
      alert(error.message);
    }

    setUploading(false);
  };

  const sendToCollaboration = async (doc: ControlledDocument) => {
    if (doc.status !== "draft" && doc.status !== "rejected") {
      alert("Only draft or rejected documents can be sent to collaboration.");
      return;
    }

    const reviewerText = collaborationReviewerEmails[doc.id] || doc.owner_email || "";
    const reviewers = reviewerText
      .split(/[,\n;]/)
      .map((email) => normalizeEmail(email))
      .filter(Boolean);

    const { error } = await supabase
      .from("controlled_documents")
      .update({
        status: "collaboration",
        collaboration_completed: false,
        formal_review_completed: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (reviewers.length > 0) {
      const rows = reviewers.map((email) => ({
        document_id: doc.id,
        reviewer_email: email,
        review_status: "pending",
      }));

      const reviewRes = await supabase
        .from("document_collaboration_reviews")
        .upsert(rows, { onConflict: "document_id,reviewer_email" });

      if (reviewRes.error) alert(reviewRes.error.message);
    }

    fetchData();
  };

  const completeCollaboration = async (doc: ControlledDocument) => {
    if (doc.status !== "collaboration") {
      alert("Only documents in collaboration can complete collaboration.");
      return;
    }

    const { error } = await supabase
      .from("controlled_documents")
      .update({
        collaboration_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) alert(error.message);
    else fetchData();
  };

  const sendToFormalReview = async (doc: ControlledDocument) => {
    if (doc.status !== "collaboration" && doc.status !== "draft" && doc.status !== "rejected") {
      alert("Document must be in draft, collaboration, or rejected status before formal review.");
      return;
    }

    if (doc.collaboration_required && !doc.collaboration_completed && doc.status !== "draft") {
      alert("Collaboration must be completed before formal review.");
      return;
    }

    const reviewerText = formalReviewerEmails[doc.id] || doc.approver_email || "";
    const reviewers = reviewerText
      .split(/[,\n;]/)
      .map((email) => normalizeEmail(email))
      .filter(Boolean);

    const { error } = await supabase
      .from("controlled_documents")
      .update({
        status: "formal_review",
        formal_review_completed: false,
        submitted_for_approval_at: new Date().toISOString(),
        submitted_for_approval_by: userEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (reviewers.length > 0) {
      const rows = reviewers.map((email) => ({
        document_id: doc.id,
        reviewer_email: email,
        review_role: "formal_reviewer",
        review_status: "pending",
      }));

      const reviewRes = await supabase
        .from("document_formal_reviews")
        .upsert(rows, { onConflict: "document_id,reviewer_email" });

      if (reviewRes.error) alert(reviewRes.error.message);
    }

    fetchData();
  };

  const approveDocument = async (doc: ControlledDocument) => {
    if (!canApprove) {
      alert("Only approvers, admins, or VP Quality can approve documents.");
      return;
    }

    if (!requiredFormalApproved) {
      alert("Required formal reviewers must approve.");
      return;
    }

    if (!requiredApproversApproved) {
      alert("Required approvers must approve.");
      return;
    }

    if (doc.status !== "formal_review") {
      alert("Only documents in formal review can be approved.");
      return;
    }

    const { error } = await supabase
      .from("controlled_documents")
      .update({
        status: "approved",
        formal_review_completed: true,
        approved_at: new Date().toISOString(),
        approved_by: userEmail,
        approval_comments: "Approved controlled document.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase
      .from("document_formal_reviews")
      .upsert(
        {
          document_id: doc.id,
          reviewer_email: userEmail,
          review_role: "approver",
          review_status: "approved",
          approved_at: new Date().toISOString(),
        },
        { onConflict: "document_id,reviewer_email" }
      );

    fetchData();
  };

  const rejectDocument = async (doc: ControlledDocument) => {
    if (!canApprove) {
      alert("Only approvers, admins, or VP Quality can reject documents.");
      return;
    }

    if (doc.status !== "formal_review" && doc.status !== "collaboration") {
      alert("Only documents in collaboration or formal review can be rejected.");
      return;
    }

    const comments = rejectComments[doc.id] || "Rejected during document review.";

    const { error } = await supabase
      .from("controlled_documents")
      .update({
        status: "rejected",
        approval_comments: comments,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (doc.status === "formal_review") {
      await supabase
        .from("document_formal_reviews")
        .upsert(
          {
            document_id: doc.id,
            reviewer_email: userEmail,
            review_role: "approver",
            review_status: "rejected",
            review_comments: comments,
            approved_at: new Date().toISOString(),
          },
          { onConflict: "document_id,reviewer_email" }
        );
    }

    setRejectComments({ ...rejectComments, [doc.id]: "" });
    fetchData();
  };

  const makeEffective = async (doc: ControlledDocument) => {
    if (!canApprove) {
      alert("Only approvers, admins, or VP Quality can make documents effective.");
      return;
    }

    if (doc.status !== "approved") {
      alert("Only approved documents can be made effective.");
      return;
    }

    if (doc.formal_review_required && !doc.formal_review_completed) {
      alert("Formal review must be completed before release.");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    const { error } = await supabase
      .from("controlled_documents")
      .update({
        status: "effective",
        effective_date: doc.effective_date || today,
        release_comments: releaseComments[doc.id] || "Document released effective.",
        release_approved_by: userEmail,
        release_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) alert(error.message);
    else fetchData();
  };

  const obsoleteDocument = async (doc: ControlledDocument) => {
    if (!canApprove) {
      alert("Only approvers, admins, or VP Quality can obsolete documents.");
      return;
    }

    const reason = obsoleteReason[doc.id] || "";

    if (!reason.trim()) {
      alert("Obsolete reason is required.");
      return;
    }

    const { error } = await supabase
      .from("controlled_documents")
      .update({
        status: "obsolete",
        obsolete_at: new Date().toISOString(),
        obsolete_by: userEmail,
        obsolete_reason: reason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (error) {
      alert(error.message);
      return;
    }

    setObsoleteReason({ ...obsoleteReason, [doc.id]: "" });
    fetchData();
  };

  const acknowledgeDocument = async (doc: ControlledDocument) => {
    if (!userEmail) {
      alert("You must be logged in to acknowledge a document.");
      return;
    }

    const { error } = await supabase.from("document_acknowledgements").upsert(
      {
        document_id: doc.id,
        user_email: userEmail,
        acknowledged_at: new Date().toISOString(),
        acknowledgement_meaning: "I have read and understood this controlled document.",
      },
      { onConflict: "document_id,user_email" }
    );

    if (error) alert(error.message);
    else fetchData();
  };

  const assignTraining = async (doc: ControlledDocument) => {
    if (!canManage) {
      alert("Only document control, quality, approvers, admins, or VP Quality can assign training.");
      return;
    }

    const emails = (trainingEmails[doc.id] || "")
      .split(/[,\n;]/)
      .map((email) => normalizeEmail(email))
      .filter(Boolean);

    if (emails.length === 0) {
      alert("Enter at least one valid training assignee email.");
      return;
    }

    const rows = emails.map((email) => ({
      document_id: doc.id,
      user_email: email,
      status: "assigned",
      assigned_by: userEmail || "unknown",
    }));

    const { error } = await supabase
      .from("document_training_assignments")
      .upsert(rows, { onConflict: "document_id,user_email" });

    if (error) {
      alert(error.message);
      return;
    }

    setTrainingEmails({ ...trainingEmails, [doc.id]: "" });
    fetchData();
  };

  const completeTraining = async (assignmentId: string) => {
    const { error } = await supabase
      .from("document_training_assignments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: userEmail,
      })
      .eq("id", assignmentId);

    if (error) alert(error.message);
    else fetchData();
  };

  const documentAckCount = (docId: string) =>
    acknowledgements.filter((ack) => ack.document_id === docId).length;

  const trainingCount = (docId: string) =>
    trainingAssignments.filter((item) => item.document_id === docId).length;

  
  const requiredFormalApproved =
    assignedReviewers
      .filter(
        (r) =>
          r.reviewer_type === "formal_review" &&
          r.required_reviewer
      )
      .every(
        (r) =>
          r.review_status === "approved"
      );

  const requiredApproversApproved =
    assignedReviewers
      .filter(
        (r) =>
          r.reviewer_type === "approver" &&
          r.required_reviewer
      )
      .every(
        (r) =>
          r.review_status === "approved"
      );

  const loadApprovalTemplate = async () => {
    if (!selectedTemplateId || !doc) return;

    const { data } = await supabase
      .from("approval_matrix_reviewers")
      .select("*")
      .eq("template_id", selectedTemplateId);

    for (const reviewer of data || []) {
      await supabase
        .from("document_assigned_reviewers")
        .insert({
          document_id: doc.id,
          reviewer_type: reviewer.reviewer_type,
          reviewer_email: reviewer.reviewer_email,
          reviewer_role: reviewer.reviewer_role,
          required_reviewer: reviewer.required_reviewer,
          review_sequence: reviewer.sequence_order,
          assigned_by: userEmail,
        });
    }

    fetchData();
  };

  const addCustomReviewer = async () => {
    if (!doc) return;

    const { error } = await supabase
      .from("document_assigned_reviewers")
      .insert({
        document_id: doc.id,
        reviewer_type: newReviewer.reviewer_type,
        reviewer_email: newReviewer.reviewer_email,
        reviewer_role: newReviewer.reviewer_role,
        required_reviewer: newReviewer.required_reviewer,
        review_sequence: assignedReviewers.length + 1,
        assigned_by: userEmail,
      });

    if (!error) fetchData();
  };

  const reviewerDecision = async (
    reviewer: any,
    decision: string
  ) => {
    await supabase
      .from("document_assigned_reviewers")
      .update({
        review_status: decision,
        review_comments:
          reviewComments[reviewer.id] || "",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", reviewer.id);

    fetchData();
  };


  const openTrainingCount = (docId: string) =>
    trainingAssignments.filter(
      (item) => item.document_id === docId && item.status !== "completed"
    ).length;

  if (loading) return <main style={pageStyle}>Loading Document Workflow...</main>;

  if (!doc) {
    return (
      <main style={pageStyle}>
        <h1>Document not found</h1>
        <a href="/documents">Back to Document Control</a>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>DOCUMENT WORKFLOW</div>
          <h1 style={{ margin: "6px 0" }}>{doc.document_number} Rev {doc.revision}</h1>
          <p style={subtleText}>{doc.title}</p>
        </div>
        <div style={buttonRowStyle}>
          <a href="/documents" style={darkButtonStyle}>Back to Document Register</a>
          <a href="/dashboard" style={darkButtonStyle}>Dashboard</a>
        </div>
      </header>

      <section style={kpiGridStyle}>
        <div style={kpiCardStyle}><div style={kpiTitleStyle}>Status</div><StatusBadge status={doc.status} /></div>
        <KpiCard title="Acknowledgements" value={documentAckCount(doc.id)} color="#15803d" />
        <KpiCard title="Training Assigned" value={trainingCount(doc.id)} color="#2563eb" />
        <KpiCard title="Open Training" value={openTrainingCount(doc.id)} color="#dc2626" />
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Document Metadata</h2>
        <div style={gridStyle}>
          <Field label="Document Type"><div>{doc.document_type || "N/A"}</div></Field>
          <Field label="Department"><div>{doc.department || "N/A"}</div></Field>
          <Field label="Process Area"><div>{doc.process_area || "N/A"}</div></Field>
          <Field label="Owner"><div>{doc.owner_email || "N/A"}</div></Field>
          <Field label="Approver"><div>{doc.approver_email || "N/A"}</div></Field>
          <Field label="Effective Date"><div>{doc.effective_date || "N/A"}</div></Field>
          <Field label="Originating Change Control"><div>{doc.originating_change_control_id || "None"}</div></Field>
        </div>
        {doc.file_url ? <a href={doc.file_url} target="_blank">Open Document File</a> : null}
      </section>

      
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>
          Approval Matrix & Reviewers
        </h2>

        <div style={gridStyle}>
          <select
            value={selectedTemplateId}
            onChange={(e) =>
              setSelectedTemplateId(e.target.value)
            }
            style={inputStyle}
          >
            <option value="">
              Select Approval Matrix Template
            </option>

            {approvalTemplates.map((template) => (
              <option
                key={template.id}
                value={template.id}
              >
                {template.template_name}
              </option>
            ))}
          </select>

          <button onClick={loadApprovalTemplate}>
            Load Template
          </button>
        </div>

        <hr style={{ margin: "20px 0" }} />

        <h3>Add Custom Reviewer</h3>

        <div style={gridStyle}>
          <select
            value={newReviewer.reviewer_type}
            onChange={(e) =>
              setNewReviewer({
                ...newReviewer,
                reviewer_type: e.target.value,
              })
            }
            style={inputStyle}
          >
            <option value="collaboration">
              Collaboration
            </option>

            <option value="formal_review">
              Formal Review
            </option>

            <option value="approver">
              Approver
            </option>
          </select>

          <input
            placeholder="Reviewer Email"
            value={newReviewer.reviewer_email}
            onChange={(e) =>
              setNewReviewer({
                ...newReviewer,
                reviewer_email: e.target.value,
              })
            }
            style={inputStyle}
          />

          <input
            placeholder="Reviewer Role"
            value={newReviewer.reviewer_role}
            onChange={(e) =>
              setNewReviewer({
                ...newReviewer,
                reviewer_role: e.target.value,
              })
            }
            style={inputStyle}
          />
        </div>

        <button onClick={addCustomReviewer}>
          Add Reviewer
        </button>

        <hr style={{ margin: "20px 0" }} />

        <div style={{ display: "grid", gap: "12px" }}>
          {assignedReviewers.map((reviewer) => (
            <div
              key={reviewer.id}
              style={trainingCardStyle}
            >
              <strong>
                {reviewer.reviewer_email}
              </strong>

              <div style={smallTextStyle}>
                {reviewer.reviewer_type}
              </div>

              <div style={smallTextStyle}>
                Status:
                {reviewer.review_status || "pending"}
              </div>

              {doc.file_url ? (
                <a
                  href={doc.file_url}
                  target="_blank"
                >
                  Open Document
                </a>
              ) : null}

              <textarea
                placeholder="Review comments"
                value={
                  reviewComments[reviewer.id] || ""
                }
                onChange={(e) =>
                  setReviewComments({
                    ...reviewComments,
                    [reviewer.id]:
                      e.target.value,
                  })
                }
                rows={3}
                style={textareaStyle}
              />

              <div style={buttonRowStyle}>
                <button
                  onClick={() =>
                    reviewerDecision(
                      reviewer,
                      "approved"
                    )
                  }
                >
                  Approve
                </button>

                <button
                  onClick={() =>
                    reviewerDecision(
                      reviewer,
                      "rejected"
                    )
                  }
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

<section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Workflow Actions</h2>
        <div style={actionStackStyle}>
          {doc.status === "draft" || doc.status === "rejected" ? (
            <details><summary>Send to Collaboration</summary><textarea value={collaborationReviewerEmails[doc.id] || ""} onChange={(e) => setCollaborationReviewerEmails({ ...collaborationReviewerEmails, [doc.id]: e.target.value })} placeholder="Reviewer emails separated by comma, semicolon, or new line" rows={3} style={textareaStyle} /><button onClick={() => sendToCollaboration(doc)}>Send Collaboration</button></details>
          ) : null}
          {doc.status === "collaboration" ? <button onClick={() => completeCollaboration(doc)}>Complete Collaboration</button> : null}
          {doc.status === "draft" || doc.status === "collaboration" || doc.status === "rejected" ? (
            <details><summary>Send to Formal Review</summary><textarea value={formalReviewerEmails[doc.id] || ""} onChange={(e) => setFormalReviewerEmails({ ...formalReviewerEmails, [doc.id]: e.target.value })} placeholder="Formal reviewer / approver emails" rows={3} style={textareaStyle} /><button onClick={() => sendToFormalReview(doc)}>Send Formal Review</button></details>
          ) : null}
          {doc.status === "formal_review" ? <button onClick={() => approveDocument(doc)}>Approve</button> : null}
          {doc.status === "formal_review" || doc.status === "collaboration" ? (
            <details><summary>Reject</summary><textarea value={rejectComments[doc.id] || ""} onChange={(e) => setRejectComments({ ...rejectComments, [doc.id]: e.target.value })} placeholder="Rejection comments" rows={3} style={textareaStyle} /><button onClick={() => rejectDocument(doc)}>Reject</button></details>
          ) : null}
          {doc.status === "approved" ? (
            <details><summary>Make Effective / Release</summary><textarea value={releaseComments[doc.id] || ""} onChange={(e) => setReleaseComments({ ...releaseComments, [doc.id]: e.target.value })} placeholder="Release comments" rows={3} style={textareaStyle} /><button onClick={() => makeEffective(doc)}>Make Effective</button></details>
          ) : null}
          {doc.status === "effective" && doc.read_ack_required ? <button onClick={() => acknowledgeDocument(doc)}>Read & Acknowledge</button> : null}
          {doc.training_required ? (
            <details><summary>Assign Training</summary><textarea value={trainingEmails[doc.id] || ""} onChange={(e) => setTrainingEmails({ ...trainingEmails, [doc.id]: e.target.value })} placeholder="Emails separated by comma, semicolon, or new line" rows={3} style={textareaStyle} /><button onClick={() => assignTraining(doc)}>Assign Training</button></details>
          ) : null}
          {doc.status !== "obsolete" ? (
            <details><summary>Obsolete</summary><textarea value={obsoleteReason[doc.id] || ""} onChange={(e) => setObsoleteReason({ ...obsoleteReason, [doc.id]: e.target.value })} placeholder="Obsolete reason" rows={3} style={textareaStyle} /><button onClick={() => obsoleteDocument(doc)}>Obsolete</button></details>
          ) : null}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Review Records</h2>
        <h3>Collaboration Reviews</h3>
        <ul>{collaborationReviews.map((review) => <li key={review.id}>{review.reviewer_email} — {review.review_status}</li>)}</ul>
        <h3>Formal Reviews</h3>
        <ul>{formalReviews.map((review) => <li key={review.id}>{review.reviewer_email} — {review.review_status}</li>)}</ul>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Training Assignments</h2>
        {trainingAssignments.length === 0 ? <p style={subtleText}>No training assigned for this document.</p> : (
          <div style={{ display: "grid", gap: "10px" }}>
            {trainingAssignments.map((item) => <div key={item.id} style={trainingCardStyle}><strong>{item.user_email}</strong><div style={smallTextStyle}>Status: {item.status}</div>{item.status !== "completed" ? <button onClick={() => completeTraining(item.id)}>Complete Training</button> : null}</div>)}
          </div>
        )}
      </section>
    </main>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: "12px" }}><label style={labelStyle}>{label}</label><div style={{ marginTop: "5px" }}>{children}</div></div>;
}

function KpiCard({ title, value, color }: { title: string; value: number; color: string }) {
  return <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}><div style={kpiTitleStyle}>{title}</div><div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div></div>;
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "effective"
      ? "#15803d"
      : status === "approved"
      ? "#2563eb"
      : status === "formal_review"
      ? "#d97706"
      : status === "collaboration"
      ? "#7c3aed"
      : status === "rejected"
      ? "#dc2626"
      : status === "obsolete" || status === "superseded"
      ? "#991b1b"
      : "#6b7280";
  return <span style={{ background: color, color: "white", borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 700 }}>{status}</span>;
}

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "20px" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" };
const kpiGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" };
const kpiCardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "14px", padding: "16px" };
const kpiTitleStyle: React.CSSProperties = { color: "#6b7280", marginBottom: "8px" };
const labelStyle: React.CSSProperties = { fontWeight: 700 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db" };
const textareaStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "6px" };
const primaryButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer" };
const disabledButtonStyle: React.CSSProperties = { background: "#9ca3af", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "not-allowed" };
const darkButtonStyle: React.CSSProperties = { background: "#111827", color: "white", padding: "10px 14px", borderRadius: "8px", textDecoration: "none", fontWeight: 700 };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginTop: "12px" };
const filterRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", marginBottom: "14px" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "10px" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e5e7eb", padding: "10px", verticalAlign: "top" };
const actionStackStyle: React.CSSProperties = { display: "grid", gap: "8px" };
const smallTextStyle: React.CSSProperties = { fontSize: "12px", color: "#6b7280" };
const trainingCardStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: "12px", padding: "14px", background: "#f9fafb" };
