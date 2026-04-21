"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function DashboardPage() {
  const [ncmrOpen, setNcmrOpen] = useState(0);
  const [ncmrInvestigation, setNcmrInvestigation] = useState(0);
  const [capaOpen, setCapaOpen] = useState(0);
  const [capaOverdue, setCapaOverdue] = useState(0);

  const fetchData = async () => {
    // NCMR Open
    const { data: ncmrOpenData } = await supabase
      .from("ncmrs")
      .select("*")
      .eq("status", "open");

    setNcmrOpen(ncmrOpenData?.length || 0);

    // NCMR Investigation
    const { data: ncmrInvData } = await supabase
      .from("ncmrs")
      .select("*")
      .eq("status", "investigation");

    setNcmrInvestigation(ncmrInvData?.length || 0);

    // CAPA Open
    const { data: capaData } = await supabase
      .from("capas")
      .select("*")
      .neq("status", "closed");

    setCapaOpen(capaData?.length || 0);

    // CAPA Overdue
    const today = new Date().toISOString().split("T")[0];

    const { data: overdueData } = await supabase
      .from("capas")
      .select("*")
      .lt("due_date", today)
      .neq("status", "closed");

    setCapaOverdue(overdueData?.length || 0);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Quality Dashboard</h1>

      <div style={{ display: "grid", gap: "15px", maxWidth: "500px" }}>
        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>Open NCMRs:</strong> {ncmrOpen}
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>NCMRs in Investigation:</strong> {ncmrInvestigation}
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>Active CAPAs:</strong> {capaOpen}
        </div>

        <div style={{ padding: "15px", border: "1px solid red" }}>
          <strong>Overdue CAPAs:</strong> {capaOverdue}
        </div>
      </div>

      <br />

      <a href="/ncmrs">Go to NCMRs</a> |{" "}
      <a href="/capa">Go to CAPAs</a>
    </main>
  );
}
<br />
<a href="/audit">Go to Audit Trail</a>
