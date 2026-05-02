"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function PrintManagementReview() {
  const [data, setData] = useState<any>({});

  const fetchData = async () => {
    const { data: ncmr } = await supabase.from("ncmrs").select("*");
    const { data: capa } = await supabase.from("capas").select("*");
    const { data: oos } = await supabase.from("oos_oot_investigations").select("*");

    const ncmrList = ncmr || [];
    const capaList = capa || [];
    const oosList = oos || [];

    const result = {
      ncmrOpen: ncmrList.filter(x => x.status !== "closed").length,
      capaOpen: capaList.filter(x => x.status !== "closed").length,
      oosOpen: oosList.filter(x => x.status !== "closed").length,

      capaOverdue: capaList.filter(x => x.status !== "closed" && x.due_date && x.due_date < new Date().toISOString()).length,
      oosImpact: oosList.filter(x => x.product_impact).length,
      systemic: oosList.filter(x => x.systemic_issue).length,
    };

    setData(result);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const today = new Date().toLocaleDateString();

  return (
    <main style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Management Review Report</h1>
      <div>Date: {today}</div>

      {/* EXEC SUMMARY */}
      <section style={{ marginTop: "30px" }}>
        <h2>Executive Summary</h2>
        <ul>
          <li>Total Open Issues: {data.ncmrOpen + data.capaOpen + data.oosOpen}</li>
          <li>Overdue CAPA: {data.capaOverdue}</li>
          <li>OOS Product Impact: {data.oosImpact}</li>
          <li>Systemic Issues: {data.systemic}</li>
        </ul>
      </section>

      {/* NCMR */}
      <section style={{ marginTop: "30px" }}>
        <h2>NCMR Summary</h2>
        <p>Open NCMRs: {data.ncmrOpen}</p>
      </section>

      {/* CAPA */}
      <section style={{ marginTop: "30px" }}>
        <h2>CAPA Summary</h2>
        <p>Open CAPAs: {data.capaOpen}</p>
        <p>Overdue CAPAs: {data.capaOverdue}</p>
      </section>

      {/* OOS */}
      <section style={{ marginTop: "30px" }}>
        <h2>OOS / OOT Summary</h2>
        <p>Open Investigations: {data.oosOpen}</p>
        <p>Product Impact Events: {data.oosImpact}</p>
        <p>Systemic Issues: {data.systemic}</p>
      </section>

      {/* RISK */}
      <section style={{ marginTop: "30px" }}>
        <h2>Risk Assessment</h2>
        <p>
          Overall risk is driven by CAPA overdue items and OOS product impact events.
          Continued monitoring and corrective actions are required.
        </p>
      </section>

      {/* SIGNATURE */}
      <section style={{ marginTop: "60px" }}>
        <h2>Approval</h2>

        <div style={{ marginTop: "40px" }}>
          ___________________________<br />
          VP Quality Signature
        </div>

        <div style={{ marginTop: "20px" }}>
          Date: _____________________
        </div>
      </section>

      {/* PRINT BUTTON */}
      <button
        onClick={() => window.print()}
        style={{
          marginTop: "40px",
          padding: "10px",
          background: "#2563eb",
          color: "white",
        }}
      >
        Print / Save as PDF
      </button>
    </main>
  );
}
