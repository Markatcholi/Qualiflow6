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
    setLoading(false);
  };

  const saveCapa = async () => {
    const { error } = await supabase
      .from("capas")
      .update({
        owner,
        due_date: dueDate,
        action_plan: actionPlan,
        effectiveness_check: effectiveness,
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
    if (id) fetchRecord();
  }, [id]);

  if (loading) return <main style={{ padding: "20px" }}>Loading...</main>;
  if (!record) return <main style={{ padding: "20px" }}>Not found</main>;

  return (
    <main style={{ padding: "20px", fontFamily: "Arial" }}>
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

      <button onClick={saveCapa} style={{ marginTop: "15px" }}>
        Save CAPA
      </button>

      <br /><br />
      <a href="/capa">Back to CAPA</a>
    </main>
  );
}
