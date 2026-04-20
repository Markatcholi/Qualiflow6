"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function NcmrPage() {
  const [title, setTitle] = useState("");
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
      description: "",
    });

    setTitle("");
    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <main style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>NCMR</h1>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Enter NCMR title"
        style={{ marginRight: "10px" }}
      />

      <button onClick={addNcmr}>Add</button>

      <ul style={{ marginTop: "20px" }}>
        {list.map((item) => (
          <li key={item.id}>
            {item.title} — {item.status}
          </li>
        ))}
      </ul>
    </main>
  );
}
