"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { isOverdue } from "../../lib/documentWorkflowEngine";

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
  change_rationale?: string | null;
  owner_email: string | null;
  approver_email: string | null;
  effective_date: string | null;
  read_ack_required: boolean | null;
  training_required: boolean | null;
  created_at: string | null;
  created_by: string | null;
};

type AssignedReviewer = {
  id: string;
  document_id: string;
  reviewer_type: string;
  reviewer_email: string;
  reviewer_role: string | null;
  required_reviewer: boolean | null;
  review_sequence: number | null;
  review_status: string | null;
  due_date?: string | null;
  sla_days?: number | null;
};

type QuickFilter =
  | "all"
  | "my_documents"
  | "awaiting_my_review"
  | "in_workflow"
  | "effective"
  | "rejected";

type SortOption =
  | "newest"
  | "document_number"
  | "title"
  | "status"
  | "effective_date";

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

export default function DocumentControlLandingPage() {
  const [documents, setDocuments] = useState<ControlledDocument[]>([]);
  const [assignedReviewers, setAssignedReviewers] = useState<AssignedReviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newDoc, setNewDoc] = useState({
    document_number: "",
    title: "",
    document_type: "SOP",
    revision: "A",
    department: "",
    process_area: "",
    change_description: "",
    change_rationale: "",
    owner_email: "",
    effective_date: "",
    read_ack_required: true,
    training_required: false,
  });

  const fetchUser = async () => {
    const { data: userData } = await supabase.auth.getUser();
    setUserEmail(userData?.user?.email || "");
  };

  const fetchData = async () => {
    setLoading(true);
    await fetchUser();

    const [docRes, reviewerRes] = await Promise.all([
      supabase
        .from("controlled_documents")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("document_assigned_reviewers")
        .select("id, document_id, reviewer_type, reviewer_email, reviewer_role, required_reviewer, review_sequence, review_status, due_date, sla_days")
        .order("due_date", { ascending: true }),
    ]);

    if (docRes.error) alert(docRes.error.message);
    else setDocuments((docRes.data as ControlledDocument[]) || []);

    if (!reviewerRes.error) setAssignedReviewers((reviewerRes.data as AssignedReviewer[]) || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const normalizeEmail = (value: string | null | undefined) => {
    const text = String(value || "").trim().toLowerCase();
    if (!text || !text.includes("@")) return "";
    return text;
  };

  const documentMap = useMemo(() => {
    const map = new Map<string, ControlledDocument>();
    documents.forEach((doc) => map.set(doc.id, doc));
    return map;
  }, [documents]);

  const myOpenReviewAssignments = useMemo(() => {
    const currentUser = normalizeEmail(userEmail);

    if (!currentUser) return [];

    return assignedReviewers.filter(
      (reviewer) =>
        normalizeEmail(reviewer.reviewer_email) === currentUser &&
        reviewer.review_status !== "approved" &&
        reviewer.review_status !== "rejected"
    );
  }, [assignedReviewers, userEmail]);

  const myReviewDocumentIds = useMemo(() => {
    return new Set(myOpenReviewAssignments.map((reviewer) => reviewer.document_id));
  }, [myOpenReviewAssignments]);

  const registerSummary = useMemo(() => {
    const inWorkflow = documents.filter(
      (doc) => doc.status === "collaboration" || doc.status === "formal_review" || doc.status === "approved"
    ).length;

    return {
      total: documents.length,
      effective: documents.filter((doc) => doc.status === "effective").length,
      inWorkflow,
      rejected: documents.filter((doc) => doc.status === "rejected").length,
      obsolete: documents.filter((doc) => doc.status === "obsolete" || doc.status === "superseded").length,
    };
  }, [documents]);

  const documentReviewStats = useMemo(() => {
    const stats = new Map<
      string,
      {
        openReviews: number;
        overdueReviews: number;
        needsMyReview: boolean;
      }
    >();

    const currentUser = normalizeEmail(userEmail);

    documents.forEach((doc) => {
      stats.set(doc.id, {
        openReviews: 0,
        overdueReviews: 0,
        needsMyReview: false,
      });
    });

    assignedReviewers.forEach((reviewer) => {
      const existing =
        stats.get(reviewer.document_id) ||
        {
          openReviews: 0,
          overdueReviews: 0,
          needsMyReview: false,
        };

      const isOpen =
        reviewer.review_status !== "approved" &&
        reviewer.review_status !== "rejected";

      if (isOpen) {
        existing.openReviews += 1;

        if (isOverdue(reviewer.due_date || null)) {
          existing.overdueReviews += 1;
        }

        if (
          currentUser &&
          normalizeEmail(reviewer.reviewer_email) === currentUser
        ) {
          existing.needsMyReview = true;
        }
      }

      stats.set(reviewer.document_id, existing);
    });

    return stats;
  }, [documents, assignedReviewers, userEmail]);

  const filteredDocuments = useMemo(() => {
    const currentUser = normalizeEmail(userEmail);

    const filtered = documents.filter((doc) => {
      const matchesStatus = filterStatus === "all" || doc.status === filterStatus;
      const text = `${doc.document_number} ${doc.title} ${doc.document_type} ${doc.revision} ${doc.department} ${doc.process_area}`.toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());

      let matchesQuickFilter = true;

      if (quickFilter === "my_documents") {
        matchesQuickFilter =
          normalizeEmail(doc.owner_email) === currentUser ||
          normalizeEmail(doc.created_by) === currentUser;
      }

      if (quickFilter === "awaiting_my_review") {
        matchesQuickFilter = myReviewDocumentIds.has(doc.id);
      }

      if (quickFilter === "in_workflow") {
        matchesQuickFilter =
          doc.status === "collaboration" ||
          doc.status === "formal_review" ||
          doc.status === "approved";
      }

      if (quickFilter === "effective") {
        matchesQuickFilter = doc.status === "effective";
      }

      if (quickFilter === "rejected") {
        matchesQuickFilter = doc.status === "rejected";
      }

      return matchesStatus && matchesSearch && matchesQuickFilter;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "document_number") {
        return String(a.document_number || "").localeCompare(
          String(b.document_number || "")
        );
      }

      if (sortBy === "title") {
        return String(a.title || "").localeCompare(String(b.title || ""));
      }

      if (sortBy === "status") {
        return String(a.status || "").localeCompare(String(b.status || ""));
      }

      if (sortBy === "effective_date") {
        return String(b.effective_date || "").localeCompare(
          String(a.effective_date || "")
        );
      }

      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
  }, [
    documents,
    filterStatus,
    search,
    quickFilter,
    sortBy,
    userEmail,
    myReviewDocumentIds,
  ]);

  const workflowSnapshot = useMemo(() => {
    const openReviews = assignedReviewers.filter(
      (reviewer) => reviewer.review_status !== "approved" && reviewer.review_status !== "rejected"
    );

    const overdueReviews = openReviews.filter((reviewer) => isOverdue(reviewer.due_date || null));

    const reviewerCount = assignedReviewers.length;
    const workflowSla =
      reviewerCount === 0
        ? "100.0"
        : (((reviewerCount - overdueReviews.length) / reviewerCount) * 100).toFixed(1);

    return {
      documentsInCollaboration: documents.filter((doc) => doc.status === "collaboration").length,
      documentsInFormalReview: documents.filter((doc) => doc.status === "formal_review").length,
      documentsAwaitingRelease: documents.filter((doc) => doc.status === "approved").length,
      effectiveDocuments: documents.filter((doc) => doc.status === "effective").length,
      openReviews: openReviews.length,
      overdueReviews: overdueReviews.length,
      workflowSla,
      overdueQueue: overdueReviews.slice(0, 5),
    };
  }, [documents, assignedReviewers]);

  const uploadDocumentFile = async () => {
    if (!selectedFile) return { fileName: null, filePath: null, fileUrl: null };

    const safeDocNumber =
      newDoc.document_number.trim().replace(/[^a-zA-Z0-9-_]/g, "_") ||
      "document";
    const safeRevision =
      newDoc.revision.trim().replace(/[^a-zA-Z0-9-_]/g, "_") || "rev";
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

  const resetCreateForm = () => {
    setNewDoc({
      document_number: "",
      title: "",
      document_type: "SOP",
      revision: "A",
      department: "",
      process_area: "",
      change_description: "",
      change_rationale: "",
      owner_email: "",
      effective_date: "",
      read_ack_required: true,
      training_required: false,
    });
    setSelectedFile(null);
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
      alert("Owner email must be valid.");
      return;
    }

    setUploading(true);

    try {
      const uploaded = await uploadDocumentFile();

      const { data, error } = await supabase
        .from("controlled_documents")
        .insert({
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
          change_summary: newDoc.change_description || null,
          change_rationale: newDoc.change_rationale || null,
          owner_email: normalizeEmail(newDoc.owner_email) || userEmail || null,
          approver_email: null,
          effective_date: newDoc.effective_date || null,
          read_ack_required: newDoc.read_ack_required,
          training_required: newDoc.training_required,
          created_by: userEmail || "unknown",
        })
        .select()
        .single();

      if (error) {
        alert(error.message);
        setUploading(false);
        return;
      }

      window.location.href = `/documents/${data.id}`;
    } catch (error: any) {
      alert(error.message);
    }

    setUploading(false);
  };

  const reviseDocument = async (doc: ControlledDocument) => {
    const nextRevision = prompt(
      `Enter new revision for ${doc.document_number}`,
      `${doc.revision}-1`
    );

    if (!nextRevision) return;

    const { data, error } = await supabase
      .from("controlled_documents")
      .insert({
        document_number: doc.document_number,
        title: doc.title,
        document_type: doc.document_type,
        revision: nextRevision,
        status: "draft",
        department: doc.department,
        process_area: doc.process_area,
        owner_email: doc.owner_email || userEmail || null,
        approver_email: null,
        read_ack_required: doc.read_ack_required,
        training_required: doc.training_required,
        superseded_document_id: doc.id,
        change_summary: `Revision created from ${doc.document_number} Rev ${doc.revision}`,
        change_rationale: doc.change_rationale || null,
        created_by: userEmail || "unknown",
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await supabase
      .from("controlled_documents")
      .update({ superseded_by_document_id: data.id })
      .eq("id", doc.id);

    window.location.href = `/documents/${data.id}`;
  };

  if (loading) return <main style={pageStyle}>Loading Document Control...</main>;

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>DOCUMENT CONTROL</div>
          <h1 style={{ margin: "6px 0" }}>Controlled Documents</h1>
          <p style={subtleText}>
            Search, open, review, revise, and create controlled document workflows.
          </p>
        </div>
      </header>

      <section style={workflowSnapshotStyle}>
        <div style={snapshotHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>QUALIFLOW ENTERPRISE</div>
            <h2 style={{ margin: "6px 0" }}>Document Workflow Dashboard</h2>
            <p style={subtleText}>
              Real-time snapshot of controlled document workflow, review aging, release status, and SLA performance.
            </p>
          </div>
          <a href="/dashboard/workflow" style={primaryLinkStyle}>Open Full Workflow Dashboard</a>
        </div>

        <div style={kpiGridStyle}>
          <KpiCard title="Collaboration" value={workflowSnapshot.documentsInCollaboration} color="#7c3aed" />
          <KpiCard title="Formal Review" value={workflowSnapshot.documentsInFormalReview} color="#d97706" />
          <KpiCard title="Awaiting Release" value={workflowSnapshot.documentsAwaitingRelease} color="#2563eb" />
          <KpiCard title="Effective" value={workflowSnapshot.effectiveDocuments} color="#15803d" />
          <KpiCard title="Open Reviews" value={workflowSnapshot.openReviews} color="#d97706" />
          <KpiCard title="Overdue Reviews" value={workflowSnapshot.overdueReviews} color="#dc2626" />
          <KpiCard title="Workflow SLA" value={`${workflowSnapshot.workflowSla}%`} color="#2563eb" />
        </div>

        {workflowSnapshot.overdueQueue.length > 0 ? (
          <div style={miniQueueStyle}>
            <h3 style={{ marginTop: 0 }}>Overdue Review Queue</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Document</th>
                    <th style={thStyle}>Reviewer</th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>Due Date</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {workflowSnapshot.overdueQueue.map((reviewer) => {
                    const relatedDoc = documentMap.get(reviewer.document_id);
                    return (
                      <tr key={reviewer.id}>
                        <td style={tdStyle}>
                          {relatedDoc ? `${relatedDoc.document_number} Rev ${relatedDoc.revision}` : reviewer.document_id}
                        </td>
                        <td style={tdStyle}>{reviewer.reviewer_email}</td>
                        <td style={tdStyle}>{reviewer.reviewer_role || reviewer.reviewer_type}</td>
                        <td style={overdueCellStyle}>{formatDate(reviewer.due_date)}</td>
                        <td style={tdStyle}>
                          <a href={`/documents/${reviewer.document_id}`} style={smallLinkStyle}>Open Workflow</a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      {myOpenReviewAssignments.length > 0 ? (
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={{ margin: 0 }}>Awaiting My Review</h2>
              <p style={subtleText}>Documents assigned to you for collaboration, formal review, or approval.</p>
            </div>
            <button onClick={() => setQuickFilter("awaiting_my_review")} style={secondaryButtonStyle}>
              Show in Register
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Document</th>
                  <th style={thStyle}>Review Type</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Due Date</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {myOpenReviewAssignments.map((reviewer) => {
                  const relatedDoc = documentMap.get(reviewer.document_id);
                  return (
                    <tr key={reviewer.id}>
                      <td style={tdStyle}>
                        <strong>{relatedDoc ? relatedDoc.document_number : reviewer.document_id}</strong>
                        <div>{relatedDoc ? `Rev ${relatedDoc.revision} — ${relatedDoc.title}` : "Document details unavailable"}</div>
                      </td>
                      <td style={tdStyle}>{reviewer.reviewer_type}</td>
                      <td style={tdStyle}>{reviewer.reviewer_role || "Reviewer"}</td>
                      <td style={isOverdue(reviewer.due_date || null) ? overdueCellStyle : tdStyle}>{formatDate(reviewer.due_date)}</td>
                      <td style={tdStyle}>
                        <a href={`/documents/${reviewer.document_id}`} style={primaryLinkStyle}>Open Review</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Document Register</h2>
            <p style={subtleText}>Search, sort, filter, open files, launch workflows, and revise documents.</p>
          </div>
          <button onClick={() => setShowCreateForm(true)} style={primaryButtonStyle}>
            Create New Document
          </button>
        </div>

        <div style={summaryBarStyle}>
          <SummaryPill label="Total" value={registerSummary.total} color="#2563eb" />
          <SummaryPill label="Effective" value={registerSummary.effective} color="#15803d" />
          <SummaryPill label="In Workflow" value={registerSummary.inWorkflow} color="#d97706" />
          <SummaryPill label="Rejected" value={registerSummary.rejected} color="#dc2626" />
          <SummaryPill label="Obsolete" value={registerSummary.obsolete} color="#991b1b" />
        </div>

        <div style={quickFilterRowStyle}>
          <button onClick={() => setQuickFilter("all")} style={quickFilter === "all" ? activeFilterButtonStyle : filterButtonStyle}>All</button>
          <button onClick={() => setQuickFilter("my_documents")} style={quickFilter === "my_documents" ? activeFilterButtonStyle : filterButtonStyle}>My Documents</button>
          <button onClick={() => setQuickFilter("awaiting_my_review")} style={quickFilter === "awaiting_my_review" ? activeFilterButtonStyle : filterButtonStyle}>Awaiting My Review</button>
          <button onClick={() => setQuickFilter("in_workflow")} style={quickFilter === "in_workflow" ? activeFilterButtonStyle : filterButtonStyle}>In Workflow</button>
          <button onClick={() => setQuickFilter("effective")} style={quickFilter === "effective" ? activeFilterButtonStyle : filterButtonStyle}>Effective Only</button>
          <button onClick={() => setQuickFilter("rejected")} style={quickFilter === "rejected" ? activeFilterButtonStyle : filterButtonStyle}>Rejected</button>
        </div>

        <div style={filterRowStyle}>
          <input
            placeholder="Search document number, title, type, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inputStyle}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={inputStyle}>
            <option value="all">All Statuses</option>
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} style={inputStyle}>
            <option value="newest">Sort: Newest First</option>
            <option value="document_number">Sort: Document Number</option>
            <option value="title">Sort: Title</option>
            <option value="status">Sort: Status</option>
            <option value="effective_date">Sort: Effective Date</option>
          </select>
        </div>

        <div style={resultSummaryStyle}>
          Showing <strong>{filteredDocuments.length}</strong> of <strong>{documents.length}</strong> documents
          {quickFilter !== "all" ? <> • Quick filter: <strong>{quickFilter.split("_").join(" ")}</strong></> : null}
          {filterStatus !== "all" ? <> • Status: <strong>{filterStatus}</strong></> : null}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Document</th>
                <th style={thStyle}>Type / Area</th>
                <th style={thStyle}>Revision</th>
                <th style={thStyle}>Workflow Status</th>
                <th style={thStyle}>Owner</th>
                <th style={thStyle}>Effective Date</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={7} style={tdStyle}>No documents match the current filter.</td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => {
                  const stats = documentReviewStats.get(doc.id) || {
                    openReviews: 0,
                    overdueReviews: 0,
                    needsMyReview: false,
                  };

                  return (
                    <tr key={doc.id}>
                      <td style={tdStyle}>
                        <strong>{doc.document_number}</strong>
                        <div>{doc.title}</div>
                        <div style={smallTextStyle}>{doc.file_name || "No file attached"}</div>
                        {stats.needsMyReview ? (
                          <div style={myReviewBadgeStyle}>Awaiting my review</div>
                        ) : null}
                      </td>
                      <td style={tdStyle}>
                        <div>{doc.document_type || "N/A"}</div>
                        <div style={smallTextStyle}>{doc.department || "No department"} {doc.process_area ? `• ${doc.process_area}` : ""}</div>
                      </td>
                      <td style={tdStyle}>{doc.revision}</td>
                      <td style={tdStyle}>
                        <StatusBadge status={doc.status} />
                        <div style={smallTextStyle}>
                          {stats.openReviews} open review(s)
                          {stats.overdueReviews > 0 ? (
                            <span style={inlineOverdueStyle}> • {stats.overdueReviews} overdue</span>
                          ) : null}
                        </div>
                      </td>
                      <td style={tdStyle}>{doc.owner_email || "N/A"}</td>
                      <td style={tdStyle}>{doc.effective_date || "N/A"}</td>
                      <td style={tdStyle}>
                        <div style={actionButtonGroupStyle}>
                          {doc.file_url ? (
                            <a href={doc.file_url} target="_blank" rel="noreferrer" style={smallLinkButtonStyle}>Open File</a>
                          ) : (
                            <span style={disabledActionStyle}>No File</span>
                          )}
                          <a href={`/documents/${doc.id}`} style={primaryLinkStyle}>Workflow</a>
                          <button onClick={() => reviseDocument(doc)} style={secondaryButtonStyle}>Revise</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Create / Revise Document</h2>
            <p style={subtleText}>Create a new controlled document package. Existing documents can be revised from the register above.</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={showCreateForm ? secondaryButtonStyle : primaryButtonStyle}
          >
            {showCreateForm ? "Hide Form" : "Create New Document"}
          </button>
        </div>

        {showCreateForm ? (
          <>
            <div style={gridStyle}>
              <Field label="Document Number"><input value={newDoc.document_number} onChange={(e) => setNewDoc({ ...newDoc, document_number: e.target.value })} style={inputStyle} /></Field>
              <Field label="Title"><input value={newDoc.title} onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })} style={inputStyle} /></Field>
              <Field label="Document Type"><select value={newDoc.document_type} onChange={(e) => setNewDoc({ ...newDoc, document_type: e.target.value })} style={inputStyle}>{DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></Field>
              <Field label="Revision"><input value={newDoc.revision} onChange={(e) => setNewDoc({ ...newDoc, revision: e.target.value })} style={inputStyle} /></Field>
              <Field label="Department"><input value={newDoc.department} onChange={(e) => setNewDoc({ ...newDoc, department: e.target.value })} style={inputStyle} /></Field>
              <Field label="Process Area"><input value={newDoc.process_area} onChange={(e) => setNewDoc({ ...newDoc, process_area: e.target.value })} style={inputStyle} /></Field>
              <Field label="Owner Email"><input type="email" value={newDoc.owner_email} onChange={(e) => setNewDoc({ ...newDoc, owner_email: e.target.value })} style={inputStyle} /></Field>
            </div>

            <Field label="Change Description"><textarea value={newDoc.change_description} onChange={(e) => setNewDoc({ ...newDoc, change_description: e.target.value })} rows={3} style={textareaStyle} /></Field>

            <Field label="Change Rationale / Justification"><textarea value={newDoc.change_rationale} onChange={(e) => setNewDoc({ ...newDoc, change_rationale: e.target.value })} rows={3} style={textareaStyle} /></Field>

            <div style={buttonRowStyle}>
              <label><input type="checkbox" checked={newDoc.read_ack_required} onChange={(e) => setNewDoc({ ...newDoc, read_ack_required: e.target.checked })} /> Read & Acknowledge Required</label>
              <label><input type="checkbox" checked={newDoc.training_required} onChange={(e) => setNewDoc({ ...newDoc, training_required: e.target.checked })} /> Training Required</label>
            </div>

            <Field label="Document File"><input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} style={inputStyle} /></Field>

            <div style={buttonRowStyle}>
              <button onClick={createDocument} disabled={uploading} style={uploading ? disabledButtonStyle : primaryButtonStyle}>{uploading ? "Uploading..." : "Create Document"}</button>
              <button onClick={resetCreateForm} disabled={uploading} style={secondaryButtonStyle}>Reset Form</button>
            </div>
          </>
        ) : (
          <p style={subtleText}>The creation form is collapsed to keep the document register visible. Use “Create New Document” when you need to start a new controlled document.</p>
        )}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div style={{ marginBottom: "12px" }}><label style={labelStyle}>{label}</label><div style={{ marginTop: "5px" }}>{children}</div></div>; }
function KpiCard({ title, value, color }: { title: string; value: number | string; color: string }) { return <div style={{ ...kpiCardStyle, borderLeft: `8px solid ${color}` }}><div style={kpiTitleStyle}>{title}</div><div style={{ fontSize: "30px", fontWeight: 800, color }}>{value}</div></div>; }
function SummaryPill({ label, value, color }: { label: string; value: number | string; color: string }) { return <div style={{ ...summaryPillStyle, borderColor: color }}><span style={smallTextStyle}>{label}</span><strong style={{ color }}>{value}</strong></div>; }
function StatusBadge({ status }: { status: string }) { const color = status === "effective" ? "#15803d" : status === "approved" ? "#2563eb" : status === "formal_review" ? "#d97706" : status === "collaboration" ? "#7c3aed" : status === "rejected" ? "#dc2626" : status === "obsolete" || status === "superseded" ? "#991b1b" : "#6b7280"; return <span style={{ background: color, color: "white", borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 700 }}>{status}</span>; }
function formatDate(value: string | null | undefined) { if (!value) return "N/A"; try { return new Date(value).toLocaleDateString(); } catch { return value; } }

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "20px" };
const workflowSnapshotStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "20px" };
const snapshotHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "16px" };
const sectionHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "16px" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" };
const kpiGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" };
const kpiCardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "14px", padding: "16px" };
const kpiTitleStyle: React.CSSProperties = { color: "#6b7280", marginBottom: "8px" };
const labelStyle: React.CSSProperties = { fontWeight: 700 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db" };
const textareaStyle: React.CSSProperties = { width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "6px" };
const primaryButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const disabledButtonStyle: React.CSSProperties = { background: "#9ca3af", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "not-allowed" };
const secondaryButtonStyle: React.CSSProperties = { background: "#111827", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const primaryLinkStyle: React.CSSProperties = { background: "#2563eb", color: "white", padding: "8px 12px", borderRadius: "8px", textDecoration: "none", fontWeight: 700, display: "inline-block" };
const smallLinkStyle: React.CSSProperties = { color: "#2563eb", fontWeight: 700, textDecoration: "none" };
const smallLinkButtonStyle: React.CSSProperties = { background: "#eef2ff", color: "#1d4ed8", padding: "8px 12px", borderRadius: "8px", textDecoration: "none", fontWeight: 700, display: "inline-block" };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginTop: "12px" };
const quickFilterRowStyle: React.CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" };
const filterButtonStyle: React.CSSProperties = { background: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", padding: "8px 10px", borderRadius: "999px", fontWeight: 700, cursor: "pointer" };
const activeFilterButtonStyle: React.CSSProperties = { ...filterButtonStyle, background: "#2563eb", color: "white", border: "1px solid #2563eb" };
const filterRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px", marginBottom: "14px" };
const resultSummaryStyle: React.CSSProperties = { color: "#4b5563", fontSize: "13px", marginBottom: "12px" };
const summaryBarStyle: React.CSSProperties = { display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" };
const summaryPillStyle: React.CSSProperties = { display: "flex", gap: "8px", alignItems: "center", border: "1px solid #d1d5db", borderRadius: "999px", padding: "7px 10px", background: "#f9fafb" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "10px" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e5e7eb", padding: "10px", verticalAlign: "top" };
const overdueCellStyle: React.CSSProperties = { ...tdStyle, color: "#dc2626", fontWeight: 700 };
const miniQueueStyle: React.CSSProperties = { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px", marginTop: "4px" };
const smallTextStyle: React.CSSProperties = { fontSize: "12px", color: "#6b7280" };
const myReviewBadgeStyle: React.CSSProperties = { display: "inline-block", marginTop: "6px", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: "999px", padding: "3px 8px", fontSize: "12px", fontWeight: 700 };
const inlineOverdueStyle: React.CSSProperties = { color: "#dc2626", fontWeight: 700 };
const disabledActionStyle: React.CSSProperties = { background: "#f3f4f6", color: "#6b7280", padding: "8px 12px", borderRadius: "8px", fontWeight: 700, display: "inline-block" };
const actionButtonGroupStyle: React.CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" };
