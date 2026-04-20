"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function CapaPage() {
  const [list, setList] = useState<any[]>([]);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("ncmrs")
      .select("*")
      .eq("capa_required", true)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setList(data || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <main style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>CAPA Required NCMRs</h1>

      {list.length === 0 ? (
        <p>No CAPA required items.</p>
      ) : (
        <ul>
          {list.map((item) => (
            <li key={item.id} style={{ marginBottom: "10px" }}>
              <strong>{item.title}</strong> — {item.severity} — {item.status}
              <br />
              <a href={`/ncmrs/${item.id}`}>Open Investigation</a>
            </li>
          ))}
        </ul>
      )}

      <br />
      <a href="/ncmrs">Back to NCMRs</a>
    </main>
  );
}
