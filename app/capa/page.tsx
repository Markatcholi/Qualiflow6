"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Capa = {
  id: string;
  title: string | null;
  status: string | null;
  ncmrs: {
    id: string;
    title: string;
    severity: string;
  }[];
};

export default function CapaPage() {
  const [list, setList] = useState<Capa[]>([]);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("capas")
      .select(`
        id,
        title,
        status,
        ncmrs (
          id,
          title,
          severity
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setList((data as Capa[]) || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <main style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>CAPA Records</h1>

      {list.length === 0 ? (
        <p>No CAPA records yet.</p>
      ) : (
        <ul>
          {list.map((item) => {
            const linkedNcmr = item.ncmrs?.[0];

            return (
              <li key={item.id} style={{ marginBottom: "12px" }}>
                <strong>{item.title}</strong> — {item.status}
                <br />
                {linkedNcmr && (
                  <>
                    Linked NCMR: {linkedNcmr.title} — {linkedNcmr.severity}
                    <br />
                    <a href={`/ncmrs/${linkedNcmr.id}`}>Open Investigation</a>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <br />
      <a href="/ncmrs">Back to NCMRs</a>
    </main>
  );
}
