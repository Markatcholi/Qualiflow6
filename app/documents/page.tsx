"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

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

export default function DocumentControlPage() {
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

  const canApprove =
    userRole === "admin" || userRole === "approver" || userRole === "vp_quality";

  const canManage =
    canApprove || userRole === "document_control" || userRole === "quality";

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
      .order("created_at", { ascending: false });

    const ackRes = await supabase
      .from("document_acknowledgements")
      .select("*")
      .order("acknowledged_at", { ascending: false });

    const trainingRes = await supabase
      .from("document_training_assignments")
      .select("*")
      .order("assigned_at", { ascending: false });

    const collaborationRes = await supabase
      .from("document_collaboration_reviews")
      .select("*")
      .order("created_at", { ascending: false });

    const formalRes = await supabase
      .from("document_formal_reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (docRes.error) alert(docRes.error.message);
    else setDocuments((docRes.data as ControlledDocument[]) || []);

    if (!ackRes.error) setAcknowledgements(ackRes.data || []);
    if (!trainingRes.error) setTrainingAssignments(trainingRes.data || []);
    if (!collaborationRes.error) setCollaborationReviews(collaborationRes.data || []);
    if (!formalRes.error) setFormalReviews(formalRes.data || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const openTrainingCount = (docId: string) =>
    trainingAssignments.filter(
      (item) => item.document_id === docId && item.status !== "completed"
    ).length;

  if (loading) return <main style={pageStyle}>Loading Document Control...</main>;

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>DOCUMENT CONTROL</div>
          <h1 style={{ margin: "6px 0" }}>Controlled Documents</h1>
          <p style={subtleText}>
            Upload, revise, approve, make effective, obsolete, acknowledge, and assign training for controlled documents.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <a href="/dashboard" style={darkButtonStyle}>Dashboard</a>
        </div>
      </header>

      <section style={kpiGridStyle}>
        <KpiCard title="Total Documents" value={metrics.total} color="#2563eb" />
        <KpiCard title="Draft" value={metrics.draft} color="#6b7280" />
        <KpiCard title="Collaboration" value={(metrics as any).collaboration} color="#2563eb" />
        <KpiCard title="Formal Review" value={metrics.pending} color="#d97706" />
        <KpiCard title="Rejected" value={(metrics as any).rejected} color="#dc2626" />
        <KpiCard title="Effective" value={metrics.effective} color="#15803d" />
        <KpiCard title="Obsolete" value={metrics.obsolete} color="#991b1b" />
        <KpiCard title="Open Training" value={metrics.trainingOpen} color="#dc2626" />
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Create / Upload Document</h2>

        <div style={gridStyle}>
          <Field label="Document Number"><input value={newDoc.document_number} onChange={(e) => setNewDoc({ ...newDoc, document_number: e.target.value })} style={inputStyle} /></Field>
          <Field label="Title"><input value={newDoc.title} onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })} style={inputStyle} /></Field>
          <Field label="Document Type"><select value={newDoc.document_type} onChange={(e) => setNewDoc({ ...newDoc, document_type: e.target.value })} style={inputStyle}>{DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></Field>
          <Field label="Revision"><input value={newDoc.revision} onChange={(e) => setNewDoc({ ...newDoc, revision: e.target.value })} style={inputStyle} /></Field>
          <Field label="Department"><input value={newDoc.department} onChange={(e) => setNewDoc({ ...newDoc, department: e.target.value })} style={inputStyle} /></Field>
          <Field label="Process Area"><input value={newDoc.process_area} onChange={(e) => setNewDoc({ ...newDoc, process_area: e.target.value })} style={inputStyle} /></Field>
          <Field label="Owner Email"><input type="email" value={newDoc.owner_email} onChange={(e) => setNewDoc({ ...newDoc, owner_email: e.target.value })} style={inputStyle} /></Field>
          <Field label="Approver Email"><input type="email" value={newDoc.approver_email} onChange={(e) => setNewDoc({ ...newDoc, approver_email: e.target.value })} style={inputStyle} /></Field>
          <Field label="Effective Date"><input type="date" value={newDoc.effective_date} onChange={(e) => setNewDoc({ ...newDoc, effective_date: e.target.value })} style={inputStyle} /></Field>
          <Field label="Document File"><input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} style={inputStyle} /></Field>
        </div>

        <Field label="Change Summary">
          <textarea value={newDoc.change_summary} onChange={(e) => setNewDoc({ ...newDoc, change_summary: e.target.value })} rows={3} style={textareaStyle} />
        </Field>

        <div style={buttonRowStyle}>
          <label><input type="checkbox" checked={newDoc.read_ack_required} onChange={(e) => setNewDoc({ ...newDoc, read_ack_required: e.target.checked })} /> Read & Acknowledge Required</label>
          <label><input type="checkbox" checked={newDoc.training_required} onChange={(e) => setNewDoc({ ...newDoc, training_required: e.target.checked })} /> Training Required</label>
        </div>

        <button onClick={createDocument} disabled={uploading} style={uploading ? disabledButtonStyle : primaryButtonStyle}>
          {uploading ? "Uploading..." : "Create Document"}
        </button>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Document Register</h2>

        <div style={filterRowStyle}>
          <input placeholder="Search document number, title, type, department..." value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={inputStyle}>
            <option value="all">All Statuses</option>
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Document</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Revision</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Effective Date</th>
                <th style={thStyle}>Owner</th>
                <th style={thStyle}>Acks</th>
                <th style={thStyle}>Training</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((doc) => (
                <tr key={doc.id}>
                  <td style={tdStyle}>
                    <strong>{doc.document_number}</strong>
                    <div>{doc.title}</div>
                    {doc.file_url ? <a href={doc.file_url} target="_blank">Open File</a> : null}
                  </td>
                  <td style={tdStyle}>{doc.document_type || "N/A"}</td>
                  <td style={tdStyle}>{doc.revision}</td>
                  <td style={tdStyle}><StatusBadge status={doc.status} /><div style={smallTextStyle}>Collab: {doc.collaboration_completed ? "Complete" : "Open"}</div><div style={smallTextStyle}>Review: {doc.formal_review_completed ? "Complete" : "Open"}</div></td>
                  <td style={tdStyle}>{doc.effective_date || "N/A"}</td>
                  <td style={tdStyle}>{doc.owner_email || "N/A"}</td>
                  <td style={tdStyle}>{documentAckCount(doc.id)}</td>
                  <td style={tdStyle}>{trainingCount(doc.id)} assigned<div style={smallTextStyle}>{openTrainingCount(doc.id)} open</div></td>
                  <td style={tdStyle}>
                    <div style={actionStackStyle}>
                      {doc.status === "draft" || doc.status === "rejected" ? (
                        <details>
                          <summary>Send to Collaboration</summary>
                          <textarea
                            value={collaborationReviewerEmails[doc.id] || ""}
                            onChange={(e) =>
                              setCollaborationReviewerEmails({
                                ...collaborationReviewerEmails,
                                [doc.id]: e.target.value,
                              })
                            }
                            placeholder="Reviewer emails separated by comma, semicolon, or new line"
                            rows={3}
                            style={textareaStyle}
                          />
                          <button onClick={() => sendToCollaboration(doc)}>
                            Send Collaboration
                          </button>
                        </details>
                      ) : null}

                      {doc.status === "draft" ||
                      doc.status === "collaboration" ||
                      doc.status === "rejected" ? (
                        <details>
                          <summary>Send to Formal Review</summary>
                          <textarea
                            value={formalReviewerEmails[doc.id] || ""}
                            onChange={(e) =>
                              setFormalReviewerEmails({
                                ...formalReviewerEmails,
                                [doc.id]: e.target.value,
                              })
                            }
                            placeholder="Formal reviewer / approver emails"
                            rows={3}
                            style={textareaStyle}
                          />
                          <button onClick={() => sendToFormalReview(doc)}>
                            Send Formal Review
                          </button>
                        </details>
                      ) : null}

                      {doc.status === "collaboration" ? (
                        <button onClick={() => completeCollaboration(doc)}>
                          Complete Collaboration
                        </button>
                      ) : null}

                      {doc.status === "formal_review" ? (
                        <button onClick={() => approveDocument(doc)}>Approve</button>
                      ) : null}

                      {doc.status === "formal_review" || doc.status === "collaboration" ? (
                        <details>
                          <summary>Reject</summary>
                          <textarea
                            value={rejectComments[doc.id] || ""}
                            onChange={(e) =>
                              setRejectComments({
                                ...rejectComments,
                                [doc.id]: e.target.value,
                              })
                            }
                            placeholder="Rejection comments"
                            rows={3}
                            style={textareaStyle}
                          />
                          <button onClick={() => rejectDocument(doc)}>Reject</button>
                        </details>
                      ) : null}

                      {doc.status === "approved" ? (
                        <details>
                          <summary>Make Effective</summary>
                          <textarea
                            value={releaseComments[doc.id] || ""}
                            onChange={(e) =>
                              setReleaseComments({
                                ...releaseComments,
                                [doc.id]: e.target.value,
                              })
                            }
                            placeholder="Release comments"
                            rows={3}
                            style={textareaStyle}
                          />
                          <button onClick={() => makeEffective(doc)}>Make Effective</button>
                        </details>
                      ) : null}
                      {doc.status === "effective" && doc.read_ack_required ? <button onClick={() => acknowledgeDocument(doc)}>Read & Acknowledge</button> : null}
                      {doc.training_required ? (
                        <details>
                          <summary>Assign Training</summary>
                          <textarea value={trainingEmails[doc.id] || ""} onChange={(e) => setTrainingEmails({ ...trainingEmails, [doc.id]: e.target.value })} placeholder="Emails separated by comma, semicolon, or new line" rows={3} style={textareaStyle} />
                          <button onClick={() => assignTraining(doc)}>Assign</button>
                        </details>
                      ) : null}
                      {doc.status !== "obsolete" ? (
                        <details>
                          <summary>Obsolete</summary>
                          <textarea value={obsoleteReason[doc.id] || ""} onChange={(e) => setObsoleteReason({ ...obsoleteReason, [doc.id]: e.target.value })} placeholder="Obsolete reason" rows={3} style={textareaStyle} />
                          <button onClick={() => obsoleteDocument(doc)}>Obsolete</button>
                        </details>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>My Training Assignments</h2>
        {trainingAssignments.filter((item) => item.user_email === userEmail).length === 0 ? (
          <p style={subtleText}>No training assigned to you.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {trainingAssignments.filter((item) => item.user_email === userEmail).map((item) => {
              const doc = documents.find((d) => d.id === item.document_id);
              return (
                <div key={item.id} style={trainingCardStyle}>
                  <strong>{doc?.document_number || "Document"} Rev {doc?.revision || "N/A"}</strong>
                  <div>{doc?.title || "Document title unavailable"}</div>
                  <div style={smallTextStyle}>Status: {item.status}</div>
                  {item.status !== "completed" ? <button onClick={() => completeTraining(item.id)}>Complete Training</button> : null}
                </div>
              );
            })}
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
