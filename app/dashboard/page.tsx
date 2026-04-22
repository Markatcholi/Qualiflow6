"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function DashboardPage() {
  const [ncmrOpen, setNcmrOpen] = useState(0);
  const [ncmrInvestigation, setNcmrInvestigation] = useState(0);
  const [capaOpen, setCapaOpen] = useState(0);
  const [capaOverdue, setCapaOverdue] = useState(0);

  const [ncmrTotal, setNcmrTotal] = useState(0);
  const [ncmrClosed, setNcmrClosed] = useState(0);
  const [capaTotal, setCapaTotal] = useState(0);
  const [capaClosed, setCapaClosed] = useState(0);

  const fetchData = async () => {
    const { data: ncmrAllData } = await supabase
      .from("ncmrs")
      .select("*");
    setNcmrTotal(ncmrAllData?.length || 0);

    const { data: ncmrClosedData } = await supabase
      .from("ncmrs")
      .select("*")
      .eq("status", "closed");
    setNcmrClosed(ncmrClosedData?.length || 0);

    const { data: ncmrOpenData } = await supabase
      .from("ncmrs")
      .select("*")
      .eq("status", "open");
    setNcmrOpen(ncmrOpenData?.length || 0);

    const { data: ncmrInvData } = await supabase
      .from("ncmrs")
      .select("*")
      .eq("status", "investigation");
    setNcmrInvestigation(ncmrInvData?.length || 0);

    const { data: capaAllData } = await supabase
      .from("capas")
      .select("*");
    setCapaTotal(capaAllData?.length || 0);

    const { data: capaClosedData } = await supabase
      .from("capas")
      .select("*")
      .eq("status", "closed");
    setCapaClosed(capaClosedData?.length || 0);

    const { data: capaData } = await supabase
      .from("capas")
      .select("*")
      .neq("status", "closed");
    setCapaOpen(capaData?.length || 0);

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

  const ncmrClosureRate =
    ncmrTotal > 0 ? ((ncmrClosed / ncmrTotal) * 100).toFixed(1) : "0.0";

  const capaClosureRate =
    capaTotal > 0 ? ((capaClosed / capaTotal) * 100).toFixed(1) : "0.0";

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Quality Dashboard</h1>

      <div style={{ display: "grid", gap: "15px", maxWidth: "600px" }}>
        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>Total NCMRs:</strong> {ncmrTotal}
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>Open NCMRs:</strong> {ncmrOpen}
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>NCMRs in Investigation:</strong> {ncmrInvestigation}
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>Closed NCMRs:</strong> {ncmrClosed}
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>NCMR Closure Rate:</strong> {ncmrClosureRate}%
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>Total CAPAs:</strong> {capaTotal}
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>Active CAPAs:</strong> {capaOpen}
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>Closed CAPAs:</strong> {capaClosed}
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>CAPA Closure Rate:</strong> {capaClosureRate}%
        </div>

        <div style={{ padding: "15px", border: "1px solid red" }}>
          <strong>Overdue CAPAs:</strong> {capaOverdue}
        </div>
      </div>

      <div style={{ marginTop: "20px" }}>
        <a href="/ncmrs">Go to NCMRs</a>
        {" | "}
        <a href="/capa">Go to CAPAs</a>
        {" | "}
        <a href="/audit">Go to Audit Trail</a>
      </div>
    </main>
  );
}
