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

    setList(data || []);
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

    if (capaRequired && data) {
      const { error: capaError } = await supabase.from("capas").insert({
        ncmr_id: data.id,
        title: `CAPA for ${title}`,
      });

      if (capaError) {
        alert(capaError.message);
        return;
      }
    }

    setTitle("");
    setOwner("");
    setSeverity("minor");
    fetchData();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("ncmrs")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

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
            <strong>{item.title}</strong> — {item.severity} — {item.owner} — {item.status}
            {item.capa_required ? (
              <span style={{ color: "red", marginLeft: "10px" }}>
                CAPA Required
              </span>
            ) : null}

            <div style={{ marginTop: "6px" }}>
              <button
                onClick={() => updateStatus(item.id, "investigation")}
                style={{ marginRight: "8px" }}
              >
                Move to Investigation
              </button>

              <button
                onClick={() => updateStatus(item.id, "closed")}
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
