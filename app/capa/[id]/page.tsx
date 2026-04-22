"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function CapaDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [actionPlan, setActionPlan] = useState("");
  const [effectiveness, setEffectiveness] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchRecord = async () => {
    const { data, error } = await supabase
      .from("capas")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setRecord(data);
    setOwner(data.owner || "");
    setDueDate(data.due_date || "");
    setActionPlan(data.action_plan || "");
    setEffectiveness(data.effectiveness_check || "");
    setEvidenceUrl(data.evidence_url || "");
    setEvidenceNotes(data.evidence_notes || "");
    setLoading(false);
  };

  const uploadEvidence = async () => {
    if (!selectedFile) {
      alert("Please choose a file first.");
      return;
    }

    setUploading(true);

    const fileExt = selectedFile.name.split(".").pop();
    const filePath = `capas/${id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("evidence")
      .upload(filePath, selectedFile, {
        upsert: false,
      });

    if (uploadError) {
      alert(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage
      .from("evidence")
      .getPublicUrl(filePath);

    setEvidenceUrl(data.publicUrl);
    setUploading(false);
    alert("Evidence uploaded. Click Save CAPA to store it on the record.");
  };

  const saveCapa = async () => {
    const { error } = await supabase
      .from("capas")
      .update({
        owner,
        due_date: dueDate,
        action_plan: actionPlan,
        effectiveness_check: effectiveness,
        evidence_url: evidenceUrl,
        evidence_notes: evidenceNotes,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("CAPA saved");
    fetchRecord();
  };

  useEffect(() => {
    if (id) {
      fetchRecord();
    }
  }, [id]);

  if (loading) {
    return <main style={{ padding: "20px" }}>Loading...</main>;
  }

  if (!record) {
    return <main style={{ padding: "20px" }}>CAPA not found</main>;
  }

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>CAPA Detail</h1>

      <p><strong>Title:</strong> {record.title}</p>
      <p><strong>Status:</strong> {record.status}</p>

      <div style={{ marginTop: "15px" }}>
        <label>Owner</label><br />
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          style={{ padding: "8px", width: "300px" }}
        />
      </div>

      <div style={{ marginTop: "15px" }}>
        <label>Due Date</label><br />
        <input
          type="date"
          value={dueDate || ""}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <div style={{ marginTop: "15px" }}>
        <label>Action Plan</label><br />
        <textarea
          value={actionPlan}
          onChange={(e) => setActionPlan(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "600px" }}
        />
      </div>

      <div style={{ marginTop: "15px" }}>
        <label>Effectiveness Check</label><br />
        <textarea
          value={effectiveness}
          onChange={(e) => setEffectiveness(e.target.value)}
          rows={4}
          style={{ width: "100%", maxWidth: "600px" }}
        />
      </div>

      <div style={{ marginTop: "15px" }}>
        <label>Upload Evidence File</label><br />
        <input
          type="file"
          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
        />
        <button
          onClick={uploadEvidence}
          disabled={uploading}
          style={{ marginLeft: "10px" }}
        >
          {uploading ? "Uploading..." : "Upload Evidence"}
        </button>
      </div>

      <div style={{ marginTop: "15px" }}>
        <label>Evidence URL</label><br />
        <input
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="Uploaded file URL will appear here"
          style={{ padding: "8px", width: "100%", maxWidth: "600px" }}
        />
      </div>

      <div style={{ marginTop: "15px" }}>
        <label>Evidence Notes</label><br />
        <textarea
          value={evidenceNotes}
          onChange={(e) => setEvidenceNotes(e.target.value)}
          rows={3}
          style={{ width: "100%", maxWidth: "600px" }}
        />
      </div>

      {record.evidence_url ? (
        <div style={{ marginTop: "15px" }}>
          <strong>Saved Evidence:</strong>{" "}
          <a href={record.evidence_url} target="_blank" rel="noreferrer">
            Open Evidence
          </a>
        </div>
      ) : null}

      <button onClick={saveCapa} style={{ marginTop: "15px" }}>
        Save CAPA
      </button>

      <br /><br />

      <a href="/capa">Back to CAPA</a>
    </main>
  );
}
