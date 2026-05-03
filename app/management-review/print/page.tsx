"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type SignatureRole = "vp_quality" | "operations" | "regulatory";

type SignatureRecord = {
  id: string;
  report_id: string;
  signer_role: SignatureRole;
  signer_email: string;
  signed_at: string;
  signature_meaning: string;
  signature_method: string;
};

export default function PrintManagementReview() {
  const [data, setData] = useState<any>({});
  const [reportId, setReportId] = useState("");
  const [reportTitle, setReportTitle] = useState("Management Review Report");
  const [reportPeriod, setReportPeriod] = useState("");
  const [companyName, setCompanyName] = useState("QualiFlow QMS");
  const [qmsReference, setQmsReference] = useState("Management Review / ISO 13485 5.6");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  const [locked, setLocked] = useState(false);
  const [signatures, setSignatures] = useState<SignatureRecord[]>([]);
  const [snapshotFrozen, setSnapshotFrozen] = useState(false);

  const signatureMeaning =
    "I confirm this Management Review report snapshot has been reviewed and is accurate at the time of approval.";

  const fetchUser = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";
    setUserEmail(email);

    if (!email) return;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", email)
      .maybeSingle();

    setUserRole(roleData?.role || "");
  };

  const fetchData = async () => {
    if (snapshotFrozen || locked || reportId) {
      return;
    }

    const { data: ncmr } = await supabase.from("ncmrs").select("*");
    const { data: capa } = await supabase.from("capas").select("*");
    const { data: oos } = await supabase.from("oos_oot_investigations").select("*");
    const { data: audits } = await supabase.from("audits").select("*");
    const { data: findings } = await supabase.from("audit_findings").select("*");

    const ncmrList = ncmr || [];
    const capaList = capa || [];
    const oosList = oos || [];
    const auditList = audits || [];
    const findingList = findings || [];

    const today = new Date().toISOString().split("T")[0];

    setData({
      generated_at: new Date().toISOString(),
      snapshot_status: "Live preview - not frozen",

      ncmrTotal: ncmrList.length,
      ncmrOpen: ncmrList.filter((x: any) => x.status !== "closed").length,
      ncmrClosed: ncmrList.filter((x: any) => x.status === "closed").length,
      ncmrCritical: ncmrList.filter((x: any) => x.severity === "critical").length,
      ncmrMajor: ncmrList.filter((x: any) => x.severity === "major").length,
      ncmrCapaRequired: ncmrList.filter((x: any) => x.capa_required).length,
      ncmrRecurring: ncmrList.filter((x: any) => x.recurring_issue).length,

      capaTotal: capaList.length,
      capaOpen: capaList.filter((x: any) => x.status !== "closed").length,
      capaClosed: capaList.filter((x: any) => x.status === "closed").length,
      capaOverdue: capaList.filter(
        (x: any) => x.status !== "closed" && x.due_date && x.due_date < today
      ).length,
      capaEffectivenessOpen: capaList.filter((x: any) => x.status === "effectiveness_check").length,

      oosTotal: oosList.length,
      oosOpen: oosList.filter((x: any) => x.status !== "closed").length,
      oosClosed: oosList.filter((x: any) => x.status === "closed").length,
      oosImpact: oosList.filter((x: any) => x.product_impact).length,
      oosNcmrRequired: oosList.filter((x: any) => x.ncmr_required).length,
      systemic: oosList.filter((x: any) => x.systemic_issue).length,
      oosEscalation: oosList.filter((x: any) => x.escalation_required).length,

      auditTotal: auditList.length,
      auditOpen: auditList.filter((x: any) => x.status !== "closed").length,
      auditClosed: auditList.filter((x: any) => x.status === "closed").length,
      findingTotal: findingList.length,
      findingOpen: findingList.filter((x: any) => x.finding_status !== "closed").length,
      findingCapaRequired: findingList.filter((x: any) => x.capa_required).length,
    });
  };

  const fetchSignatures = async (id: string) => {
    if (!id) return;

    const { data, error } = await supabase
      .from("printable_management_review_signatures")
      .select("*")
      .eq("report_id", id)
      .order("signed_at", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setSignatures((data as SignatureRecord[]) || []);
  };

  useEffect(() => {
    fetchUser();
    fetchData();
  }, []);

  const createOrGetReport = async () => {
    if (reportId) return reportId;

    if (!reportTitle) {
      alert("Report title is required.");
      return "";
    }

    if (!reportPeriod) {
      alert("Report period is required.");
      return "";
    }

    const frozenSnapshot = {
      ...data,
      generated_at: data.generated_at || new Date().toISOString(),
      frozen_at: new Date().toISOString(),
      snapshot_status: "Frozen at first electronic signature",
      frozen_by: userEmail || null,
    };

    const { data: inserted, error } = await supabase
      .from("printable_management_reviews")
      .insert({
        report_title: reportTitle,
        report_period: reportPeriod,
        report_data: frozenSnapshot,
        is_locked: false,
        created_by: userEmail || null,
        company_name: companyName,
        qms_reference: qmsReference,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return "";
    }

    setReportId(inserted.id);
    setData(inserted.report_data || frozenSnapshot);
    setSnapshotFrozen(true);
    return inserted.id;
  };

  const signReport = async (signerRole: SignatureRole) => {
    if (!userEmail) {
      alert("You must be logged in to sign this report.");
      return;
    }

    if (locked) {
      alert("This report is locked. No additional signatures can be added.");
      return;
    }

    if (!reportTitle) {
      alert("Report title is required.");
      return;
    }

    if (!reportPeriod) {
      alert("Report period is required.");
      return;
    }

    const alreadySigned = signatures.some((sig) => sig.signer_role === signerRole);
    if (alreadySigned) {
      alert("This role has already signed the report.");
      return;
    }

    const enteredEmail = window.prompt(
      `Electronic Signature Required\n\nRole: ${displayRole(signerRole)}\n\nRe-enter your email to sign:`
    );

    if (!enteredEmail) {
      alert("Signature cancelled.");
      return;
    }

    if (enteredEmail.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
      alert("Signature email does not match the logged-in user.");
      return;
    }

    const confirmed = window.confirm(
      `Electronic Signature:\n\n${signatureMeaning}\n\nRole: ${displayRole(signerRole)}\n\nBy clicking OK, your active login session will be used as your electronic signature.`
    );

    if (!confirmed) return;

    const activeReportId = await createOrGetReport();
    if (!activeReportId) return;

    const now = new Date().toISOString();

    const { error } = await supabase.from("printable_management_review_signatures").insert({
      report_id: activeReportId,
      signer_role: signerRole,
      signer_email: userEmail,
      signature_email_entered: enteredEmail,
      signed_at: now,
      signature_meaning: signatureMeaning,
      signature_method: "active_login_session_confirmation",
      user_role_at_signature: userRole || null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await fetchSignatures(activeReportId);
    alert(`${displayRole(signerRole)} signature completed.`);
  };

  const lockReport = async () => {
    const activeReportId = await createOrGetReport();
    if (!activeReportId) return;

    await fetchSignatures(activeReportId);

    const { data: latestSignatures, error: sigError } = await supabase
      .from("printable_management_review_signatures")
      .select("*")
      .eq("report_id", activeReportId);

    if (sigError) {
      alert(sigError.message);
      return;
    }

    const sigs = latestSignatures || [];
    const vpSigned = sigs.some((sig: any) => sig.signer_role === "vp_quality");
    const opsSigned = sigs.some((sig: any) => sig.signer_role === "operations");
    const regSigned = sigs.some((sig: any) => sig.signer_role === "regulatory");

    if (!vpSigned || !opsSigned || !regSigned) {
      alert("All required signatures are required before locking: VP Quality, Operations, and Regulatory.");
      return;
    }

    const confirmed = window.confirm(
      "Lock Report:\n\nThis will lock the Management Review report as a controlled record. No additional signatures or edits will be allowed."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("printable_management_reviews")
      .update({
        is_locked: true,
        locked_at: new Date().toISOString(),
        locked_by: userEmail,
        report_data: data,
      })
      .eq("id", activeReportId);

    if (error) {
      alert(error.message);
      return;
    }

    setLocked(true);
    setSignatures(sigs as SignatureRecord[]);
    alert("Report locked.");
  };

  const hasSignature = (role: SignatureRole) => {
    return signatures.find((sig) => sig.signer_role === role);
  };

  const totalOpenIssues =
    (data.ncmrOpen || 0) + (data.capaOpen || 0) + (data.oosOpen || 0) + (data.auditOpen || 0);

  const totalRiskEvents =
    (data.ncmrCritical || 0) +
    (data.ncmrMajor || 0) +
    (data.capaOverdue || 0) +
    (data.oosImpact || 0) +
    (data.systemic || 0) +
    (data.findingCapaRequired || 0);

  return (
    <main style={{ padding: "40px", fontFamily: "Arial, sans-serif", color: "#111" }}>
      <div className="no-print" style={{ marginBottom: "20px" }}>
        <button onClick={() => window.print()}>Print / Save as PDF</button>

        {!locked ? (
          <>
            <button onClick={() => signReport("vp_quality")} style={{ marginLeft: "10px" }}>
              Sign as VP Quality
            </button>

            <button onClick={() => signReport("operations")} style={{ marginLeft: "10px" }}>
              Sign as Operations
            </button>

            <button onClick={() => signReport("regulatory")} style={{ marginLeft: "10px" }}>
              Sign as Regulatory
            </button>

            <button onClick={lockReport} style={{ marginLeft: "10px" }}>
              Lock Report
            </button>
          </>
        ) : null}
      </div>

      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: "0 0 6px 0" }}>{reportTitle}</h1>
          <div><strong>Company:</strong> {companyName}</div>
          <div><strong>QMS Reference:</strong> {qmsReference}</div>
          <div><strong>Report ID:</strong> {reportId || "Draft - not yet saved"}</div>
          <div><strong>Record Status:</strong> {locked ? "Locked / Controlled Record" : "Draft / Pending Lock"}</div>
          <div><strong>Snapshot Status:</strong> {data.snapshot_status || (snapshotFrozen ? "Frozen" : "Live preview")}</div>
          <div><strong>Frozen At:</strong> {data.frozen_at || "Not frozen until first signature"}</div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div><strong>Report Period:</strong> {reportPeriod || "Not entered"}</div>
          <div><strong>Generated At:</strong> {data.generated_at || "N/A"}</div>
          <div><strong>Generated By:</strong> {userEmail || "N/A"}</div>
        </div>
      </header>

      <div className="no-print" style={{ marginBottom: "20px" }}>
        <label>Company Name</label>
        <br />
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          disabled={locked || snapshotFrozen}
          style={inputStyle}
        />

        <br />
        <br />

        <label>QMS Reference</label>
        <br />
        <input
          value={qmsReference}
          onChange={(e) => setQmsReference(e.target.value)}
          disabled={locked || snapshotFrozen}
          style={inputStyle}
        />

        <br />
        <br />

        <label>Report Title</label>
        <br />
        <input
          value={reportTitle}
          onChange={(e) => setReportTitle(e.target.value)}
          disabled={locked || snapshotFrozen}
          style={inputStyle}
        />

        <br />
        <br />

        <label>Report Period</label>
        <br />
        <input
          value={reportPeriod}
          onChange={(e) => setReportPeriod(e.target.value)}
          disabled={locked || snapshotFrozen}
          placeholder="Example: Q2 2026"
          style={inputStyle}
        />
      </div>

      <section style={sectionStyle}>
        <h2>Executive Summary</h2>

        <div style={gridStyle}>
          <Metric label="Total Open Issues" value={totalOpenIssues} />
          <Metric label="Total Risk Events" value={totalRiskEvents} />
          <Metric label="Overdue CAPAs" value={data.capaOverdue || 0} />
          <Metric label="OOS/OOT Product Impact Events" value={data.oosImpact || 0} />
        </div>

        <div style={{ marginTop: "8px", marginBottom: "8px", fontSize: "12px" }}>
          <span style={{ ...legendDotStyle, background: "#15803d" }} /> Controlled / Closed &nbsp;
          <span style={{ ...legendDotStyle, background: "#b45309" }} /> Watch / Low Count Risk &nbsp;
          <span style={{ ...legendDotStyle, background: "#b91c1c" }} /> Elevated Risk
        </div>

        <p>
          This report summarizes Management Review inputs including NCMR performance, CAPA
          performance, OOS/OOT investigations, audit activity, systemic issues, and open quality
          risks for the selected review period.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>NCMR Summary</h2>
        <div style={gridStyle}>
          <Metric label="Total NCMRs" value={data.ncmrTotal || 0} />
          <Metric label="Open NCMRs" value={data.ncmrOpen || 0} />
          <Metric label="Closed NCMRs" value={data.ncmrClosed || 0} />
          <Metric label="Critical NCMRs" value={data.ncmrCritical || 0} />
          <Metric label="Major NCMRs" value={data.ncmrMajor || 0} />
          <Metric label="CAPA Required" value={data.ncmrCapaRequired || 0} />
          <Metric label="Recurring Issues" value={data.ncmrRecurring || 0} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>CAPA Summary</h2>
        <div style={gridStyle}>
          <Metric label="Total CAPAs" value={data.capaTotal || 0} />
          <Metric label="Open CAPAs" value={data.capaOpen || 0} />
          <Metric label="Closed CAPAs" value={data.capaClosed || 0} />
          <Metric label="Overdue CAPAs" value={data.capaOverdue || 0} />
          <Metric label="Effectiveness Open" value={data.capaEffectivenessOpen || 0} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>OOS / OOT / Environmental Monitoring Summary</h2>
        <div style={gridStyle}>
          <Metric label="Total Investigations" value={data.oosTotal || 0} />
          <Metric label="Open Investigations" value={data.oosOpen || 0} />
          <Metric label="Closed Investigations" value={data.oosClosed || 0} />
          <Metric label="Product Impact Events" value={data.oosImpact || 0} />
          <Metric label="NCMR Required" value={data.oosNcmrRequired || 0} />
          <Metric label="Systemic Issues" value={data.systemic || 0} />
          <Metric label="Escalations" value={data.oosEscalation || 0} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Audit Summary</h2>
        <div style={gridStyle}>
          <Metric label="Total Audits" value={data.auditTotal || 0} />
          <Metric label="Open Audits" value={data.auditOpen || 0} />
          <Metric label="Closed Audits" value={data.auditClosed || 0} />
          <Metric label="Total Findings" value={data.findingTotal || 0} />
          <Metric label="Open Findings" value={data.findingOpen || 0} />
          <Metric label="Findings Requiring CAPA" value={data.findingCapaRequired || 0} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Risk Assessment / Management Review Decision</h2>
        <p>
          Risk review should consider overdue CAPAs, recurring NCMRs, product-impacting OOS/OOT
          investigations, systemic issues, audit findings requiring CAPA, and open quality system
          risks. Required actions should be documented in CAPA, NCMR, audit, or OOS/OOT workflows as
          applicable.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Electronic Signatures</h2>
        <p><strong>Snapshot Freeze Rule:</strong> Report data is frozen at the first electronic signature.</p>
        <p><strong>Snapshot Status:</strong> {data.snapshot_status || "Live preview"}</p>
        <p><strong>Frozen At:</strong> {data.frozen_at || "Not frozen yet"}</p>

        <SignatureBlock
          title="VP Quality Approval"
          role="vp_quality"
          signature={hasSignature("vp_quality")}
        />

        <SignatureBlock
          title="Operations Approval"
          role="operations"
          signature={hasSignature("operations")}
        />

        <SignatureBlock
          title="Regulatory Approval"
          role="regulatory"
          signature={hasSignature("regulatory")}
        />

        <p><strong>Report Lock Status:</strong> {locked ? "Locked" : "Not locked"}</p>
        <p><strong>Authentication Method:</strong> Current authenticated user session with email re-entry confirmation</p>
      </section>

      <footer className="print-footer">
        <div>{companyName} | {qmsReference}</div>
        <div>{reportTitle} | {reportPeriod || "Period not entered"} | Report ID: {reportId || "Draft"}</div>
        <div>Controlled Management Review Record</div>
      </footer>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }

          body {
            color: black;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          main {
            padding: 20px !important;
          }

          section {
            page-break-inside: avoid;
          }

          .print-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            font-size: 10px;
            border-top: 1px solid #999;
            padding: 6px 20px;
            background: white;
          }
        }

        @page {
          margin: 0.75in;
        }
      `}</style>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  const numericValue = typeof value === "number" ? value : Number(value);
  const lowerLabel = label.toLowerCase();

  const isRiskMetric =
    lowerLabel.includes("open") ||
    lowerLabel.includes("overdue") ||
    lowerLabel.includes("critical") ||
    lowerLabel.includes("major") ||
    lowerLabel.includes("impact") ||
    lowerLabel.includes("systemic") ||
    lowerLabel.includes("escalation") ||
    lowerLabel.includes("capa required") ||
    lowerLabel.includes("recurring");

  let color = "#2563eb";
  let background = "#eff6ff";
  let border = "#bfdbfe";

  if (isRiskMetric && numericValue > 0) {
    color = numericValue >= 5 ? "#b91c1c" : "#b45309";
    background = numericValue >= 5 ? "#fef2f2" : "#fffbeb";
    border = numericValue >= 5 ? "#fecaca" : "#fde68a";
  }

  if (lowerLabel.includes("closed") || lowerLabel.includes("total")) {
    color = "#15803d";
    background = "#f0fdf4";
    border = "#bbf7d0";
  }

  return (
    <div
      style={{
        ...metricStyle,
        border: `1px solid ${border}`,
        background,
      }}
    >
      <div style={{ fontSize: "12px", color: "#555" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: "bold", color }}>{value}</div>
    </div>
  );
}

function SignatureBlock({
  title,
  role,
  signature,
}: {
  title: string;
  role: SignatureRole;
  signature?: SignatureRecord;
}) {
  return (
    <div style={signatureBoxStyle}>
      <h3>{title}</h3>
      <p><strong>Role:</strong> {displayRole(role)}</p>

      {signature ? (
        <>
          <p><strong>Status:</strong> Signed</p>
          <p><strong>Signed By:</strong> {signature.signer_email}</p>
          <p><strong>Signed At:</strong> {signature.signed_at}</p>
          <p><strong>Signature Method:</strong> {signature.signature_method}</p>
          <p><strong>Signature Meaning:</strong> {signature.signature_meaning}</p>
        </>
      ) : (
        <p><strong>Status:</strong> Pending signature</p>
      )}
    </div>
  );
}

function displayRole(role: SignatureRole) {
  if (role === "vp_quality") return "VP Quality";
  if (role === "operations") return "Operations";
  if (role === "regulatory") return "Regulatory";
  return role;
}

const inputStyle: React.CSSProperties = {
  padding: "8px",
  width: "360px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  borderBottom: "2px solid #111",
  paddingBottom: "16px",
  marginBottom: "20px",
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "16px",
  marginTop: "20px",
  borderRadius: "8px",
  background: "#fff",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "12px",
  marginBottom: "12px",
};

const metricStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: "8px",
  padding: "10px",
  background: "#f9fafb",
};

const signatureBoxStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: "8px",
  padding: "12px",
  marginBottom: "12px",
};
