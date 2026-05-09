"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export default function NcmrCollaborationPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [newComment, setNewComment] = useState("");
  const [taggedUsers, setTaggedUsers] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    const { data } = await supabase.auth.getUser();
    setUserEmail(data?.user?.email || "");
  };

  const fetchRecord = async () => {
    const { data, error } = await supabase
      .from("ncmrs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setRecord(data);
  };

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from("ncmr_comments")
      .select("*")
      .eq("ncmr_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setComments(data || []);
    setLoading(false);
  };

  const addAuditLog = async (action: string, details: string) => {
    await supabase.from("audit_logs").insert({
      entity_type: "ncmr",
      entity_id: id,
      action,
      details,
      user_email: userEmail || "unknown",
    });
  };

  const postComment = async () => {
    if (!newComment.trim()) {
      alert("Comment is required.");
      return;
    }

    const taggedUserArray = taggedUsers
      .split(",")
      .map((user) => user.trim().toLowerCase())
      .filter((user) => user);

    const { error } = await supabase.from("ncmr_comments").insert({
      ncmr_id: id,
      comment_text: newComment,
      created_by: userEmail || "unknown",
      tagged_users: taggedUserArray.length > 0 ? taggedUserArray : null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    if (taggedUserArray.length > 0) {
      const notifications = taggedUserArray.map((email) => ({
        recipient_email: email,
        subject: `Tagged in NCMR collaboration thread: ${record?.ncmr_number || "NCMR"}`,
        body: `${userEmail || "A user"} tagged you in the NCMR collaboration thread.`,
        entity_type: "ncmr",
        entity_id: id,
        status: "pending",
      }));

      await supabase.from("notification_queue").insert(notifications);
    }

    await addAuditLog(
      "collaboration_comment_posted",
      `Collaboration comment posted by ${userEmail || "unknown"}.`
    );

    setNewComment("");
    setTaggedUsers("");
    fetchComments();
  };

  useEffect(() => {
    if (id) {
      fetchUser();
      fetchRecord();
      fetchComments();
    }
  }, [id]);

  if (loading) {
    return <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>Loading collaboration thread...</main>;
  }

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>NCMR Collaboration Thread</h1>

      <p><strong>NCMR:</strong> {record?.ncmr_number || "NCMR"}</p>
      <p><strong>Title:</strong> {record?.title || "Untitled"}</p>
      <p><strong>Logged-in:</strong> {userEmail || "none"}</p>

      <section style={{ border: "1px solid #cbd5e1", borderRadius: "10px", padding: "14px", background: "#f8fafc", marginBottom: "18px" }}>
        <h2 style={{ marginTop: 0 }}>Post Collaboration Comment</h2>

        <label>Comment</label><br />
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={5}
          placeholder="Enter investigation discussion, SME input, supplier update, manufacturing feedback, or technical review notes."
          style={{ width: "100%", maxWidth: "950px", marginBottom: "10px" }}
        />

        <br />
        <label>Tag Users / Notify Users</label><br />
        <input
          value={taggedUsers}
          onChange={(e) => setTaggedUsers(e.target.value)}
          placeholder="quality@company.com, operations@company.com"
          style={{ width: "100%", maxWidth: "700px", padding: "8px", marginBottom: "10px" }}
        />

        <br />
        <button type="button" onClick={postComment}>Post Comment</button>
      </section>

      <section>
        <h2>Discussion History</h2>

        {comments.length === 0 ? (
          <p>No collaboration comments posted yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {comments.map((comment) => (
              <div key={comment.id} style={{ border: "1px solid #d1d5db", borderRadius: "8px", padding: "12px", background: "white" }}>
                <div style={{ marginBottom: "8px", color: "#334155" }}>
                  <strong>{comment.created_by}</strong>{" • "}{new Date(comment.created_at).toLocaleString()}
                </div>
                <div style={{ whiteSpace: "pre-wrap", marginBottom: "8px" }}>{comment.comment_text}</div>
                {comment.tagged_users && comment.tagged_users.length > 0 ? (
                  <div style={{ color: "#2563eb", fontSize: "14px" }}>
                    <strong>Tagged:</strong> {comment.tagged_users.join(", ")}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <div style={{ marginTop: "18px" }}>
        <a href={`/ncmrs/${id}`}>Back to NCMR Workflow</a>
      </div>
    </main>
  );
}
