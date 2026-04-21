"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Ncmr = {
  id: string;
  title: string | null;
  severity: string | null;
  owner: string | null;
  status: string | null;
  capa_required: boolean | null;
  problem_description: string | null;
  containment_action: string | null;
  investigation_summary: string | null;
  root_cause: string | null;
  risk_assessment: string | null;
  corrective_action: string | null;
  created_at: string | null;
};

export default function NcmrPage() {
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState("minor");
  const [owner, setOwner] = useState("");
  const [list, setList] = useState<Ncmr[]>([]);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("ncmrs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setList((data as Ncmr[]) || []);
  };

  const addAuditLog = async (
    entityType: string,
    entityId: string,
    action: string,
    details: string
  ) => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "unknown";

    await supabase.from("audit_logs").insert({
      entity_type: entityType,
      entity_id: entityId,
      action,
      details,
      user_email: email,
    });
  };

  const addNcmr = async () => {
    if (!title) return;

    const capaRequired = severity === "major" || severity === "critical";

    const { data, error } = await supabase
      .from("ncmrs")
      .insert({
        title,
        severity,
        owner,
        status: "open",
        capa_required: capaRequired,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog("ncmr", data.id, "created", `Created NCMR: ${title}`);

    if (capaRequired && data) {
      const { error: capaError } = await supabase.from("capas").insert({
        ncmr_id: data.id,
        title: `CAPA for ${title}`,
        linked_ncmr_title: title,
      });

      if (capaError) {
        alert(capaError.message);
        return;
      }

      await addAuditLog(
        "ncmr",
        data.id,
        "capa_triggered",
        `CAPA automatically required for severity: ${severity}`
      );
    }

    setTitle("");
    setOwner("");
    setSeverity("minor");
    fetchData();
  };

  const investigationComplete = (item: Ncmr) => {
    return Boolean(
      item.problem_description &&
        item.containment_action &&
        item.investigation_summary &&
        item.root_cause &&
        item.risk_assessment &&
        item.corrective_action
    );
  };

  const updateStatus = async (item: Ncmr, status: string) => {
    if (status === "closed" && !investigationComplete(item)) {
      alert("Cannot close NCMR until investigation is completed.");
      return;
    }

    const oldStatus = item.status;

    const { error } = await supabase
      .from("ncmrs")
      .update({ status })
      .eq("id", item.id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "ncmr",
      item.id,
      "status_changed",
      `Status changed from ${oldStatus} to ${status}`
    );

    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>NCMR</h1>

      <div style={{ marginBottom: "14px" }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          style={{ marginRight: "10px", padding: "8px" }}
        />

        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          style={{ marginRight: "10px", padding: "8px" }}
        >
          <option value="minor">Minor</option>
          <option value="major">Major</option>
          <option value="critical">Critical</option>
        </select>

        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="Owner"
          style={{ marginRight: "10px", padding: "8px" }}
        />

        <button onClick={addNcmr}>Add</button>
      </div>

      <ul>
        {list.map((item) => (
          <li key={item.id} style={{ marginBottom: "12px" }}>
            <strong>{item.title}</strong> — {item.severity} — {item.owner} —{" "}
            {item.status}
            {item.capa_required ? (
              <span style={{ color: "red", marginLeft: "10px" }}>
                CAPA Required
              </span>
            ) : null}

            <div style={{ marginTop: "6px" }}>
              <button
                onClick={() => updateStatus(item, "investigation")}
                style={{ marginRight: "8px" }}
              >
                Move to Investigation
              </button>

              <button
                onClick={() => updateStatus(item, "closed")}
                style={{ marginRight: "8px" }}
              >
                Close
              </button>

              <a href={`/ncmrs/${item.id}`}>Open Investigation</a>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
