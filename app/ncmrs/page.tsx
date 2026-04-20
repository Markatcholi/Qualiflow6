"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function NcmrPage() {
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState("minor");
  const [owner, setOwner] = useState("");
  const [list, setList] = useState<any[]>([]);

  const fetchData = async () => {
    const { data } = await supabase
      .from("ncmrs")
      .select("*")
      .order("created_at", { ascending: false });

    setList(data || []);
  };

  const addNcmr = async () => {
    if (!title) return;

    await supabase.from("ncmrs").insert({
      title,
      severity,
      owner,
    });

    setTitle("");
    setOwner("");
    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <main style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>NCMR</h1>

      <div style={{ marginBottom: "10px" }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          style={{ marginRight: "10px" }}
        />

        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          style={{ marginRight: "10px" }}
        >
          <option value="minor">Minor</option>
          <option value="major">Major</option>
          <option value="critical">Critical</option>
        </select>

        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="Owner"
          style={{ marginRight: "10px" }}
        />

        <button onClick={addNcmr}>Add</button>
      </div>

      <ul>
        {list.map((item) => (
          <li key={item.id}>
            {item.title} — {item.severity} — {item.owner} — {item.status}
          </li>
        ))}
      </ul>
    </main>
  );
}
