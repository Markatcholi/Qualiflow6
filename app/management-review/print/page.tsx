"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function PrintManagementReview() {
  const [data, setData] = useState<any>({});
  const [reportTitle, setReportTitle] = useState("Management Review Report");
  const [reportPeriod, setReportPeriod] = useState("");
  const [signedBy, setSignedBy] = useState("");
  const [signedAt, setSignedAt] = useState("");
  const [locked, setLocked] = useState(false);

  const fetchData = async () => {
    const { data: ncmr } = await supabase.from("ncmrs").select("*");
    const { data: capa } = await supabase.from("capas").select("*");
    const { data: oos } = await supabase.from("oos_oot_investigations").select("*");

    const ncmrList = ncmr || [];
    const capaList = capa || [];
    const oosList = oos || [];

    setData({
      generated_at: new Date().toISOString(),
      ncmrOpen: ncmrList.filter((x: any) => x.status !== "closed").length,
      ncmrClosed: ncmrList.filter((x: any) => x.status === "closed").length,
      capaOpen: capaList.filter((x: any) => x.status !== "closed").length,
      capaClosed: capaList.filter((x: any) => x.status === "closed").length,
      capaOverdue: capaList.filter(
        (x: any) =>
          x.status !== "closed" &&
          x.due_date &&
          x.due_date < new Date().toISOString().split("T")[0]
      ).length,
      oosOpen: oosList.filter((x: any) => x.status !== "closed").length,
      oosClosed: oosList.filter((x: any) => x.status === "closed").length,
      oosImpact: oosList.filter((x: any) => x.product_impact).length,
      systemic: oosList.filter((x: any) => x.systemic_issue).length,
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const signAndLockReport = async () => {
    if (!reportTitle) return alert("Report title is required.");
    if (!reportPeriod) return alert("Report period is required.");

    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";

    if (!email) {
      alert("You must be logged in to sign this report.");
      return;
    }

    const confirmed = window.confirm(
      "Electronic Signature:\n\nI confirm this Management Review report snapshot is accurate and approved for record retention.\n\nBy clicking OK, my active login session will be used as my electronic signature and the report will be locked."
    );

    if (!confirmed) return;

    const now = new Date().toISOString();

    const meaning =
      "I confirm this Management Review report snapshot is accurate and approved for record retention.";

    const { error } = await supabase.from("printable_management_reviews").insert({
      report_title: reportTitle,
      report_period: reportPeriod,
      report_data: data,
      is_locked: true,
      signed_by: email,
      signed_at: now,
      signature_meaning: meaning,
      signature_method: "session_confirm",
    });

    if (error) {
      alert(error.message);
      return;
    }

    setSignedBy(email);
    setSignedAt(now);
    setLocked(true);

    alert("Report signed and locked.");
  };

  return (
    <main style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}>
      <button onClick={() => window.print()} className="no-print">
        Print / Save as PDF
      </button>

      {!locked ? (
        <button
          onClick={signAndLockReport}
          className="no-print"
          style={{ marginLeft: "10px" }}
        >
          Sign & Lock Report
        </button>
      ) : null}

      <h1>{reportTitle}</h1>

      <div className="no-print" style={{ marginBottom: "20px" }}>
        <label>Report Title</label>
        <br />
        <input
          value={reportTitle}
          onChange={(e) => setReportTitle(e.target.value)}
          disabled={locked}
          style={{ padding: "8px", width: "300px" }}
        />

        <br />
        <br />

        <label>Report Period</label>
        <br />
        <input
          value={reportPeriod}
          onChange={(e) => setReportPeriod(e.target.value)}
          disabled={locked}
          placeholder="Example: Q2 2026"
          style={{ padding: "8px", width: "300px" }}
        />
      </div>

      <p><strong>Report Period:</strong> {reportPeriod || "Not entered"}</p>
      <p><strong>Generated At:</strong> {data.generated_at || "N/A"}</p>

      <section style={sectionStyle}>
        <h2>Executive Summary</h2>
        <p><strong>Total Open Issues:</strong> {(data.ncmrOpen || 0) + (data.capaOpen || 0) + (data.oosOpen || 0)}</p>
        <p><strong>Overdue CAPAs:</strong> {data.capaOverdue || 0}</p>
        <p><strong>OOS/OOT Product Impact Events:</strong> {data.oosImpact || 0}</p>
        <p><strong>Systemic Issues:</strong> {data.systemic || 0}</p>
      </section>

      <section style={sectionStyle}>
        <h2>NCMR Summary</h2>
        <p><strong>Open NCMRs:</strong> {data.ncmrOpen || 0}</p>
        <p><strong>Closed NCMRs:</strong> {data.ncmrClosed || 0}</p>
      </section>

      <section style={sectionStyle}>
        <h2>CAPA Summary</h2>
        <p><strong>Open CAPAs:</strong> {data.capaOpen || 0}</p>
        <p><strong>Closed CAPAs:</strong> {data.capaClosed || 0}</p>
        <p><strong>Overdue CAPAs:</strong> {data.capaOverdue || 0}</p>
      </section>

      <section style={sectionStyle}>
        <h2>OOS / OOT Summary</h2>
        <p><strong>Open Investigations:</strong> {data.oosOpen || 0}</p>
        <p><strong>Closed Investigations:</strong> {data.oosClosed || 0}</p>
        <p><strong>Product Impact Events:</strong> {data.oosImpact || 0}</p>
        <p><strong>Systemic Issues:</strong> {data.systemic || 0}</p>
      </section>

      <section style={sectionStyle}>
        <h2>Electronic Signature</h2>

        {locked ? (
          <>
            <p><strong>Status:</strong> Locked</p>
            <p><strong>Signed By:</strong> {signedBy}</p>
            <p><strong>Signed At:</strong> {signedAt}</p>
            <p>
              <strong>Signature Meaning:</strong> I confirm this Management Review report
              snapshot is accurate and approved for record retention.
            </p>
            <p><strong>Signature Method:</strong> Active login session confirmation</p>
          </>
        ) : (
          <p><strong>Status:</strong> Not signed / Not locked</p>
        )}
      </section>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none;
          }

          body {
            color: black;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </main>
  );
}

const sectionStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "16px",
  marginTop: "20px",
  borderRadius: "8px",
};
