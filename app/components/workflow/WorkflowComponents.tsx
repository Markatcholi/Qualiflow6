"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

type DirectoryUser = {
  user_email: string;
  job_title: string | null;
  department: string | null;
  account_status: string | null;
};

type Thread = {
  id: string;
  module: string;
  record_id: string;
  record_number: string | null;
  subject: string | null;
  status: "open" | "resolved" | "cancelled";
  due_date: string | null;
  created_by: string | null;
  created_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_summary: string | null;
};

type Participant = {
  id: string;
  thread_id: string;
  user_email: string;
  assigned_role: string | null;
  status: "active" | "completed" | "removed";
  assigned_by: string | null;
  assigned_at: string | null;
  completed_at: string | null;
};

type Attachment = {
  name: string;
  url: string;
  storage_path: string;
  uploaded_at: string;
  uploaded_by: string;
};

type Comment = {
  id: string;
  thread_id: string;
  comment_text: string;
  created_by: string | null;
  created_at: string | null;
  tagged_users: string[] | null;
  attachments: Attachment[] | null;
};

const MODULE = "ncmr";

export default function NcmrCollaborationPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [newComment, setNewComment] = useState("");
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [resolving, setResolving] = useState(false);

  const activeEmails = useMemo(
    () => new Set(participants.filter((p) => p.status === "active").map((p) => normalizeEmail(p.user_email))),
    [participants]
  );

  const availableUsers = useMemo(
    () => directoryUsers.filter((u) => {
      const email = normalizeEmail(u.user_email);
      return email && email !== normalizeEmail(userEmail) && !activeEmails.has(email) && String(u.account_status || "active").toLowerCase() !== "inactive";
    }),
    [directoryUsers, userEmail, activeEmails]
  );

  const addAuditLog = async (action: string, details: string, actor?: string) => {
    await supabase.from("audit_logs").insert({
      entity_type: MODULE,
      entity_id: id,
      action,
      details,
      user_email: actor || userEmail || "unknown",
    });
  };

  const fetchParticipants = async (threadId: string) => {
    const { data, error } = await supabase
      .from("collaboration_participants")
      .select("*")
      .eq("thread_id", threadId)
      .order("assigned_at", { ascending: true });
    if (error) throw new Error(error.message);
    setParticipants((data as Participant[]) || []);
  };

  const fetchComments = async (threadId: string) => {
    const { data, error } = await supabase
      .from("collaboration_comments")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    setComments((data as Comment[]) || []);
  };

  const refreshThread = async (threadId: string) => {
    await Promise.all([fetchParticipants(threadId), fetchComments(threadId)]);
  };

  const createOrLoadThread = async (recordData: any, actor: string) => {
    const existing = await supabase
      .from("collaboration_threads")
      .select("*")
      .eq("module", MODULE)
      .eq("record_id", id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      setThread(existing.data as Thread);
      setDueDate(existing.data.due_date || "");
      setResolutionSummary(existing.data.resolution_summary || "");
      return existing.data as Thread;
    }

    const created = await supabase
      .from("collaboration_threads")
      .insert({
        module: MODULE,
        record_id: id,
        record_number: recordData?.ncmr_number || null,
        subject: recordData?.issue_description || "NCMR investigation collaboration",
        status: "open",
        created_by: actor || null,
      })
      .select("*")
      .single();

    if (created.error) throw new Error(created.error.message);
    await addAuditLog("collaboration_thread_created", `Collaboration Workspace created for ${recordData?.ncmr_number || "NCMR"}.`, actor);
    setThread(created.data as Thread);
    return created.data as Thread;
  };

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const userResponse = await supabase.auth.getUser();
        if (userResponse.error) throw new Error(userResponse.error.message);
        const actor = normalizeEmail(userResponse.data?.user?.email);
        setUserEmail(actor);

        const [recordResponse, usersResponse] = await Promise.all([
          supabase.from("ncmrs").select("*").eq("id", id).maybeSingle(),
          supabase.from("user_roles").select("user_email,job_title,department,account_status").order("user_email"),
        ]);

        if (recordResponse.error) throw new Error(recordResponse.error.message);
        if (!recordResponse.data) throw new Error("NCMR record not found.");
        setRecord(recordResponse.data);
        if (!usersResponse.error) setDirectoryUsers((usersResponse.data as DirectoryUser[]) || []);

        const loadedThread = await createOrLoadThread(recordResponse.data, actor);
        await refreshThread(loadedThread.id);
      } catch (error: any) {
        alert(error?.message || "Unable to load Collaboration Workspace.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const createTaskAndNotification = async (email: string, currentThread: Thread) => {
    const taskCheck = await supabase
      .from("approval_tasks")
      .select("id")
      .eq("entity_type", MODULE)
      .eq("entity_id", id)
      .eq("task_type", "collaboration_task")
      .eq("assigned_to_email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (!taskCheck.data?.id) {
      const taskInsert = await supabase.from("approval_tasks").insert({
        entity_type: MODULE,
        entity_id: id,
        task_type: "collaboration_task",
        task_title: `Collaborate on ${currentThread.record_number || record?.ncmr_number || "NCMR"} investigation`,
        required_function: "Investigation Collaborator",
        assigned_to_email: email,
        assigned_by_email: userEmail,
        due_date: dueDate || currentThread.due_date || null,
        status: "pending",
        comments: "Review the NCMR investigation discussion, provide technical input, and post your response in the Collaboration Workspace.",
      });
      if (taskInsert.error) throw new Error(taskInsert.error.message);
    }

    await Promise.all([
      supabase.from("notifications").insert({
        user_email: email,
        assigned_role: "Collaborator",
        notification_type: "collaboration_assignment",
        severity: "info",
        title: `Collaboration assigned: ${currentThread.record_number || "NCMR"}`,
        message: `${userEmail || "A QualiSphere user"} added you to an NCMR investigation collaboration.`,
        related_module: MODULE,
        related_record_id: id,
        related_url: `/ncmrs/${id}/collaboration`,
        read_status: false,
        created_by: userEmail || null,
        delivery_frequency: "immediate",
        delivery_status: "in_app",
        deduplication_key: `${MODULE}:${id}:collaboration_assignment:${email}`,
      }),
      supabase.from("notification_queue").insert({
        recipient_email: email,
        subject: `Collaboration assigned: ${currentThread.record_number || "NCMR"}`,
        body: `${userEmail || "A QualiSphere user"} added you to an NCMR investigation collaboration. Open My Workspace to review and respond.`,
        entity_type: MODULE,
        entity_id: id,
        status: "pending",
      }),
    ]);
  };

  const assignCollaborators = async () => {
    if (!thread || selectedCollaborators.length === 0) return alert("Select at least one collaborator.");
    if (thread.status !== "open") return alert("This collaboration is not open.");

    setAssigning(true);
    try {
      if (dueDate !== (thread.due_date || "")) {
        const update = await supabase.from("collaboration_threads").update({ due_date: dueDate || null }).eq("id", thread.id);
        if (update.error) throw new Error(update.error.message);
        setThread({ ...thread, due_date: dueDate || null });
      }

      for (const rawEmail of selectedCollaborators) {
        const email = normalizeEmail(rawEmail);
        const participant = await supabase.from("collaboration_participants").upsert({
          thread_id: thread.id,
          user_email: email,
          assigned_role: "Investigation Collaborator",
          status: "active",
          assigned_by: userEmail,
          assigned_at: new Date().toISOString(),
          completed_at: null,
        }, { onConflict: "thread_id,user_email" });
        if (participant.error) throw new Error(participant.error.message);
        await createTaskAndNotification(email, thread);
        await addAuditLog("collaboration_participant_assigned", `${email} was assigned as an investigation collaborator.`);
      }

      setSelectedCollaborators([]);
      setShowPicker(false);
      await refreshThread(thread.id);
      alert("Collaborators assigned.");
    } catch (error: any) {
      alert(error?.message || "Unable to assign collaborators.");
    } finally {
      setAssigning(false);
    }
  };

  const uploadFiles = async (threadId: string) => {
    const attachments: Attachment[] = [];
    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];
      const safeName = sanitizeFileName(file.name) || `attachment_${index + 1}`;
      const path = `collaboration/${MODULE}/${id}/${threadId}/${Date.now()}_${index + 1}_${safeName}`;
      const upload = await supabase.storage.from("evidence").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upload.error) throw new Error(`Unable to upload ${file.name}: ${upload.error.message}`);
      const publicUrl = supabase.storage.from("evidence").getPublicUrl(path).data.publicUrl;
      attachments.push({
        name: file.name,
        url: publicUrl,
        storage_path: path,
        uploaded_at: new Date().toISOString(),
        uploaded_by: userEmail || "unknown",
      });
    }
    return attachments;
  };

  const postComment = async () => {
    if (!thread) return;
    if (thread.status !== "open") return alert("This collaboration is resolved.");
    if (!newComment.trim() && selectedFiles.length === 0) return alert("Enter a comment or attach a file.");

    setPosting(true);
    try {
      const attachments = await uploadFiles(thread.id);
      const recipients = participants.filter((p) => p.status === "active").map((p) => normalizeEmail(p.user_email)).filter(Boolean);
      const insert = await supabase.from("collaboration_comments").insert({
        thread_id: thread.id,
        comment_text: newComment.trim() || "Supporting attachment added.",
        created_by: userEmail || "unknown",
        tagged_users: recipients.length > 0 ? recipients : null,
        attachments,
      });
      if (insert.error) throw new Error(insert.error.message);

      const notify = recipients.filter((email) => email !== normalizeEmail(userEmail));
      if (notify.length > 0) {
        await supabase.from("notifications").insert(notify.map((email) => ({
          user_email: email,
          assigned_role: "Collaborator",
          notification_type: "collaboration_update",
          severity: "info",
          title: `Collaboration updated: ${thread.record_number || "NCMR"}`,
          message: `${userEmail || "A collaborator"} posted a new collaboration comment.`,
          related_module: MODULE,
          related_record_id: id,
          related_url: `/ncmrs/${id}/collaboration`,
          read_status: false,
          created_by: userEmail || null,
          delivery_frequency: "immediate",
          delivery_status: "in_app",
        })));
      }

      await addAuditLog("collaboration_comment_posted", `Collaboration comment posted by ${userEmail || "unknown"}${attachments.length ? ` with ${attachments.length} attachment(s)` : ""}.`);
      setNewComment("");
      setSelectedFiles([]);
      await fetchComments(thread.id);
    } catch (error: any) {
      alert(error?.message || "Unable to post comment.");
    } finally {
      setPosting(false);
    }
  };

  const markMyAssignmentComplete = async () => {
    if (!thread || !userEmail) return;
    const participant = participants.find((p) => normalizeEmail(p.user_email) === normalizeEmail(userEmail) && p.status === "active");
    if (!participant) return alert("You do not have an active collaboration assignment.");

    const completedAt = new Date().toISOString();
    const update = await supabase.from("collaboration_participants").update({ status: "completed", completed_at: completedAt }).eq("id", participant.id);
    if (update.error) return alert(update.error.message);

    await supabase.from("approval_tasks").update({ status: "completed", completed_at: completedAt, completed_by_email: userEmail })
      .eq("entity_type", MODULE).eq("entity_id", id).eq("task_type", "collaboration_task").eq("assigned_to_email", userEmail).eq("status", "pending");

    await addAuditLog("collaboration_assignment_completed", `${userEmail} completed their collaboration assignment.`);
    await fetchParticipants(thread.id);
    alert("Your collaboration assignment is complete.");
  };

  const resolveCollaboration = async () => {
    if (!thread || !record) return;

    const ownerEmail = normalizeEmail(record.owner_email || record.owner);
    const currentUserEmail = normalizeEmail(userEmail);
    const eligibleParticipants = participants.filter(
      (participant) => participant.status !== "removed"
    );
    const allAssignmentsCompleted =
      eligibleParticipants.length > 0 &&
      eligibleParticipants.every(
        (participant) => participant.status === "completed"
      );

    if (!ownerEmail || ownerEmail !== currentUserEmail) {
      alert("Only the NCMR owner may resolve this collaboration.");
      return;
    }

    if (!allAssignmentsCompleted) {
      alert(
        "All collaborator assignments must be completed before the collaboration can be resolved."
      );
      return;
    }

    if (!resolutionSummary.trim()) {
      alert("Resolution summary is required.");
      return;
    }

    if (
      !window.confirm(
        "Resolve this collaboration? All collaborator assignments have been completed."
      )
    ) {
      return;
    }

    setResolving(true);

    try {
      const resolvedAt = new Date().toISOString();

      const update = await supabase
        .from("collaboration_threads")
        .update({
          status: "resolved",
          resolution_summary: resolutionSummary.trim(),
          resolved_by: userEmail,
          resolved_at: resolvedAt,
        })
        .eq("id", thread.id);

      if (update.error) {
        throw new Error(update.error.message);
      }

      await supabase
        .from("approval_tasks")
        .update({
          status: "completed",
          completed_at: resolvedAt,
          completed_by_email: userEmail,
        })
        .eq("entity_type", MODULE)
        .eq("entity_id", id)
        .eq("task_type", "collaboration_task")
        .eq("status", "pending");

      await addAuditLog(
        "collaboration_resolved",
        `Collaboration resolved by NCMR owner ${userEmail}. Summary: ${resolutionSummary.trim()}`
      );

      setThread({
        ...thread,
        status: "resolved",
        resolution_summary: resolutionSummary.trim(),
        resolved_by: userEmail,
        resolved_at: resolvedAt,
      });

      await refreshThread(thread.id);
      alert("Collaboration resolved.");
    } catch (error: any) {
      alert(error?.message || "Unable to resolve collaboration.");
    } finally {
      setResolving(false);
    }
  };

  if (loading) return <main style={pageStyle}>Loading Collaboration Workspace...</main>;
  if (!record || !thread) return <main style={pageStyle}>Collaboration Workspace could not be loaded.</main>;

  const isOpen = thread.status === "open";
  const currentUserEmail = normalizeEmail(userEmail);
  const ncmrOwnerEmail = normalizeEmail(record.owner_email || record.owner);
  const isNcmrOwner =
    Boolean(ncmrOwnerEmail) && ncmrOwnerEmail === currentUserEmail;

  const eligibleParticipants = participants.filter(
    (participant) => participant.status !== "removed"
  );
  const completedParticipantCount = eligibleParticipants.filter(
    (participant) => participant.status === "completed"
  ).length;
  const totalParticipantCount = eligibleParticipants.length;
  const allCollaboratorsCompleted =
    totalParticipantCount > 0 &&
    completedParticipantCount === totalParticipantCount;

  const myActiveAssignment = participants.some(
    (participant) =>
      normalizeEmail(participant.user_email) === currentUserEmail &&
      participant.status === "active"
  );

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE COLLABORATION ENGINE</div>
          <h1 style={{ margin: "6px 0" }}>Collaboration Workspace</h1>
          <p style={mutedStyle}>Cross-functional investigation discussion, supporting evidence, assignments, and resolution.</p>
        </div>
        <div style={actionRowStyle}>
          <a href={`/ncmrs/${id}`} style={secondaryLinkStyle}>Back to NCMR Workflow</a>
          <span style={{ ...badgeStyle, ...(isOpen ? openStyle : resolvedStyle) }}>{formatLabel(thread.status)}</span>
        </div>
      </header>

      <section style={summaryGridStyle}>
        <SummaryCard label="Module" value="NCMR" />
        <SummaryCard label="Record" value={record.ncmr_number || thread.record_number || "NCMR"} />
        <SummaryCard label="Due Date" value={thread.due_date || "Not set"} />
        <SummaryCard label="Logged In" value={userEmail || "Not available"} />
      </section>

      <section style={issueCardStyle}>
        <div style={eyebrowStyle}>ISSUE DESCRIPTION</div>
        <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{record.issue_description || "No issue description provided."}</p>
      </section>

      <section style={twoColumnStyle}>
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Collaborators</h2>
              <p style={mutedStyle}>Assigned users receive a Workspace task and notification.</p>
            </div>
            {isOpen ? <button onClick={() => setShowPicker((v) => !v)} style={primaryButtonStyle}>+ Add Collaborator</button> : null}
          </div>

          {showPicker && isOpen ? (
            <div style={pickerStyle}>
              <label style={labelStyle}>Due Date (Optional)</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
              <label style={{ ...labelStyle, marginTop: "14px" }}>Select Registered Users</label>
              {availableUsers.length === 0 ? <p style={mutedStyle}>No additional active users are available.</p> : (
                <div style={userListStyle}>
                  {availableUsers.map((user) => {
                    const email = normalizeEmail(user.user_email);
                    return (
                      <label key={email} style={userItemStyle}>
                        <input type="checkbox" checked={selectedCollaborators.includes(email)} onChange={(e) => setSelectedCollaborators((current) => e.target.checked ? [...current, email] : current.filter((x) => x !== email))} />
                        <span><strong>{email}</strong><span style={metaStyle}>{[user.job_title, user.department].filter(Boolean).join(" • ") || "Registered user"}</span></span>
                      </label>
                    );
                  })}
                </div>
              )}
              <div style={actionRowStyle}>
                <button onClick={() => { setShowPicker(false); setSelectedCollaborators([]); }} style={secondaryButtonStyle}>Cancel</button>
                <button onClick={assignCollaborators} disabled={assigning || selectedCollaborators.length === 0} style={primaryButtonStyle}>{assigning ? "Assigning..." : "Add Selected"}</button>
              </div>
            </div>
          ) : null}

          {participants.length === 0 ? <div style={emptyStyle}>No collaborators assigned yet.</div> : (
            <div style={{ display: "grid", gap: "8px" }}>
              {participants.map((p) => (
                <div key={p.id} style={participantStyle}>
                  <div><strong>{p.user_email}</strong><span style={metaStyle}>{p.assigned_role || "Collaborator"}</span></div>
                  <span style={{ ...badgeStyle, ...(p.status === "active" ? openStyle : resolvedStyle) }}>{formatLabel(p.status)}</span>
                </div>
              ))}
            </div>
          )}

          {myActiveAssignment && isOpen ? <button onClick={markMyAssignmentComplete} style={completeButtonStyle}>Mark My Collaboration Complete</button> : null}
        </div>

        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Post Collaboration Comment</h2>
          <label style={labelStyle}>Comment</label>
          <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={6} disabled={!isOpen || posting} placeholder="Enter investigation discussion, SME input, supplier update, manufacturing feedback, or technical review notes." style={textareaStyle} />
          <label style={labelStyle}>Attachments (Optional)</label>
          <input type="file" multiple disabled={!isOpen || posting} onChange={(e) => { addFiles(e.target.files, selectedFiles, setSelectedFiles); e.currentTarget.value = ""; }} />
          {selectedFiles.length > 0 ? (
            <div style={{ display: "grid", gap: "7px", margin: "10px 0" }}>
              {selectedFiles.map((file, index) => (
                <div key={`${file.name}-${file.size}-${file.lastModified}`} style={fileStyle}>
                  <span><strong>{file.name}</strong> <span style={metaStyle}>({formatFileSize(file.size)})</span></span>
                  <button onClick={() => setSelectedFiles((current) => current.filter((_, i) => i !== index))}>Remove</button>
                </div>
              ))}
            </div>
          ) : null}
          <button onClick={postComment} disabled={!isOpen || posting} style={primaryButtonStyle}>{posting ? "Posting..." : "Post Comment"}</button>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Discussion History</h2>
        {comments.length === 0 ? <div style={emptyStyle}>No collaboration comments posted yet.</div> : (
          <div style={{ display: "grid", gap: "12px" }}>
            {comments.map((comment) => (
              <article key={comment.id} style={commentStyle}>
                <strong>{comment.created_by || "Unknown user"}</strong>
                <span style={metaStyle}>{formatDateTime(comment.created_at)}</span>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, marginTop: "10px" }}>{comment.comment_text}</div>
                {Array.isArray(comment.attachments) && comment.attachments.length > 0 ? (
                  <div style={attachmentRowStyle}>{comment.attachments.map((a, index) => <a key={`${a.storage_path}-${index}`} href={a.url} target="_blank" rel="noreferrer" style={attachmentLinkStyle}>📎 {a.name}</a>)}</div>
                ) : null}
                {Array.isArray(comment.tagged_users) && comment.tagged_users.length > 0 ? <div style={tagStyle}><strong>Collaborators notified:</strong> {comment.tagged_users.join(", ")}</div> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Collaboration Resolution</h2>

        {thread.status === "resolved" ? (
          <div style={resolvedPanelStyle}>
            <strong>Resolved by:</strong> {thread.resolved_by || "N/A"}
            <br />
            <strong>Resolved:</strong> {formatDateTime(thread.resolved_at)}
            <br />
            <strong>Summary:</strong>
            <div style={{ marginTop: "6px", whiteSpace: "pre-wrap" }}>
              {thread.resolution_summary || "No resolution summary provided."}
            </div>
          </div>
        ) : (
          <>
            <div style={resolutionProgressStyle}>
              <div>
                <strong>Collaborator completion:</strong>{" "}
                {completedParticipantCount} of {totalParticipantCount} completed
              </div>
              <div style={progressTrackStyle}>
                <div
                  style={{
                    ...progressFillStyle,
                    width:
                      totalParticipantCount > 0
                        ? `${Math.round(
                            (completedParticipantCount /
                              totalParticipantCount) *
                              100
                          )}%`
                        : "0%",
                  }}
                />
              </div>
            </div>

            {!isNcmrOwner ? (
              <div style={ownerOnlyNoticeStyle}>
                <strong>Owner-controlled resolution</strong>
                <p style={{ margin: "6px 0 0" }}>
                  Only the NCMR owner ({ncmrOwnerEmail || "not assigned"}) may
                  resolve the overall collaboration after every collaborator
                  has completed their assigned task.
                </p>
              </div>
            ) : (
              <>
                {!allCollaboratorsCompleted ? (
                  <div style={pendingCompletionNoticeStyle}>
                    All collaborator assignments must be completed before the
                    collaboration can be resolved.
                  </div>
                ) : (
                  <div style={readyToResolveNoticeStyle}>
                    All collaborator assignments are complete. The NCMR owner
                    may now document the outcome and resolve the collaboration.
                  </div>
                )}

                <label style={labelStyle}>Resolution Summary</label>
                <textarea
                  value={resolutionSummary}
                  onChange={(event) =>
                    setResolutionSummary(event.target.value)
                  }
                  rows={4}
                  style={textareaStyle}
                  placeholder="Summarize the collaboration outcome and how the input will be used in the investigation."
                  disabled={!allCollaboratorsCompleted || resolving}
                />

                <button
                  onClick={resolveCollaboration}
                  disabled={!allCollaboratorsCompleted || resolving}
                  style={{
                    ...resolveButtonStyle,
                    opacity:
                      !allCollaboratorsCompleted || resolving ? 0.55 : 1,
                    cursor:
                      !allCollaboratorsCompleted || resolving
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {resolving ? "Resolving..." : "Resolve Collaboration"}
                </button>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div style={summaryCardStyle}><div style={summaryLabelStyle}>{label}</div><div style={summaryValueStyle}>{value}</div></div>;
}

function normalizeEmail(value?: string | null) { return String(value || "").trim().toLowerCase(); }
function sanitizeFileName(value: string) { return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_"); }
function formatLabel(value?: string | null) { return String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function formatDateTime(value?: string | null) { if (!value) return "N/A"; try { return new Date(value).toLocaleString(); } catch { return value; } }
function formatFileSize(bytes: number) { if (!bytes) return "0 KB"; const units = ["B", "KB", "MB", "GB"]; const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); const value = bytes / Math.pow(1024, index); return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`; }
function addFiles(files: FileList | null, current: File[], setter: React.Dispatch<React.SetStateAction<File[]>>) { if (!files) return; const keys = new Set(current.map((f) => `${f.name}:${f.size}:${f.lastModified}`)); setter([...current, ...Array.from(files).filter((f) => !keys.has(`${f.name}:${f.size}:${f.lastModified}`))]); }

const pageStyle: React.CSSProperties = { minHeight: "100vh", padding: "24px", fontFamily: "Arial, sans-serif", background: "#f8fafc", color: "#0f172a" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { color: "#2563eb", fontSize: "12px", fontWeight: 900, letterSpacing: "0.12em" };
const mutedStyle: React.CSSProperties = { color: "#64748b", margin: "4px 0 0", lineHeight: 1.5 };
const actionRowStyle: React.CSSProperties = { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginTop: "12px" };
const summaryGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" };
const summaryCardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #d1d5db", borderRadius: "12px", padding: "14px" };
const summaryLabelStyle: React.CSSProperties = { color: "#64748b", fontSize: "12px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" };
const summaryValueStyle: React.CSSProperties = { marginTop: "6px", fontWeight: 900, wordBreak: "break-word" };
const issueCardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #d1d5db", borderLeft: "6px solid #2563eb", borderRadius: "12px", padding: "16px", marginBottom: "16px" };
const twoColumnStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "16px", marginBottom: "16px" };
const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #d1d5db", borderRadius: "14px", padding: "18px", marginBottom: "16px", boxShadow: "0 4px 18px rgba(15,23,42,.04)" };
const sectionHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap", marginBottom: "12px" };
const sectionTitleStyle: React.CSSProperties = { margin: "0 0 10px" };
const pickerStyle: React.CSSProperties = { border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: "12px", padding: "14px", marginBottom: "14px" };
const labelStyle: React.CSSProperties = { display: "block", fontWeight: 900, marginBottom: "6px" };
const inputStyle: React.CSSProperties = { width: "100%", maxWidth: "320px", border: "1px solid #cbd5e1", borderRadius: "9px", padding: "9px 10px", boxSizing: "border-box" };
const textareaStyle: React.CSSProperties = { width: "100%", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "10px", boxSizing: "border-box", marginBottom: "12px", resize: "vertical" };
const userListStyle: React.CSSProperties = { display: "grid", gap: "8px", maxHeight: "280px", overflowY: "auto", marginTop: "8px" };
const userItemStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "20px 1fr", gap: "8px", alignItems: "start", background: "#fff", border: "1px solid #dbeafe", borderRadius: "9px", padding: "10px", cursor: "pointer" };
const metaStyle: React.CSSProperties = { display: "block", color: "#64748b", fontSize: "12px", marginTop: "3px" };
const primaryButtonStyle: React.CSSProperties = { border: "none", background: "#2563eb", color: "#fff", borderRadius: "9px", padding: "9px 13px", fontWeight: 900, cursor: "pointer" };
const secondaryButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: "9px", padding: "9px 13px", fontWeight: 900, cursor: "pointer" };
const secondaryLinkStyle: React.CSSProperties = { ...secondaryButtonStyle, textDecoration: "none" };
const badgeStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", border: "1px solid", borderRadius: "999px", padding: "5px 9px", fontWeight: 900, fontSize: "12px", whiteSpace: "nowrap" };
const openStyle: React.CSSProperties = { background: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8" };
const resolvedStyle: React.CSSProperties = { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" };
const participantStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "11px" };
const completeButtonStyle: React.CSSProperties = { marginTop: "14px", border: "1px solid #86efac", background: "#f0fdf4", color: "#166534", borderRadius: "9px", padding: "9px 13px", fontWeight: 900, cursor: "pointer" };
const emptyStyle: React.CSSProperties = { border: "1px dashed #cbd5e1", borderRadius: "10px", padding: "14px", color: "#64748b", background: "#f8fafc" };
const fileStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", border: "1px solid #e2e8f0", borderRadius: "9px", padding: "9px 10px", background: "#f8fafc" };
const commentStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: "12px", padding: "14px", background: "#fff" };
const attachmentRowStyle: React.CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" };
const attachmentLinkStyle: React.CSSProperties = { display: "inline-block", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "7px 9px", textDecoration: "none", fontWeight: 800, fontSize: "13px" };
const tagStyle: React.CSSProperties = { marginTop: "10px", color: "#2563eb", fontSize: "13px" };
const resolveButtonStyle: React.CSSProperties = { border: "none", background: "#15803d", color: "#fff", borderRadius: "9px", padding: "10px 14px", fontWeight: 900, cursor: "pointer" };
const resolutionProgressStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: "10px",
  padding: "12px",
  marginBottom: "14px",
};

const progressTrackStyle: React.CSSProperties = {
  height: "8px",
  background: "#e2e8f0",
  borderRadius: "999px",
  overflow: "hidden",
  marginTop: "8px",
};

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  background: "#2563eb",
  borderRadius: "999px",
  transition: "width 180ms ease",
};

const ownerOnlyNoticeStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: "10px",
  padding: "14px",
};

const pendingCompletionNoticeStyle: React.CSSProperties = {
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  borderRadius: "10px",
  padding: "12px",
  marginBottom: "12px",
  fontWeight: 800,
};

const readyToResolveNoticeStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  borderRadius: "10px",
  padding: "12px",
  marginBottom: "12px",
  fontWeight: 800,
};

const resolvedPanelStyle: React.CSSProperties = { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", borderRadius: "10px", padding: "14px", lineHeight: 1.6 };
