"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function SupplierProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [supplier, setSupplier] = useState<any>(null);
  const [linkedNcmrs, setLinkedNcmrs] = useState<any[]>([]);
  const [scars, setScars] = useState<any[]>([]);
  const [supplierAudits, setSupplierAudits] = useState<any[]>([]);
  const [auditFindings, setAuditFindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [supplierStatus, setSupplierStatus] = useState("approved");
  const [supplierRiskLevel, setSupplierRiskLevel] = useState("medium");
  const [qualificationStatus, setQualificationStatus] = useState("qualified");
  const [qualificationExpirationDate, setQualificationExpirationDate] = useState("");
  const [requalificationDueDate, setRequalificationDueDate] = useState("");
  const [qualificationRationale, setQualificationRationale] = useState("");

  const [aslStatus, setAslStatus] = useState("approved");
  const [approvedCommodities, setApprovedCommodities] = useState("");
  const [approvedServices, setApprovedServices] = useState("");
  const [qualificationDate, setQualificationDate] = useState("");
  const [criticalSupplier, setCriticalSupplier] = useState(false);
  const [qualityAgreementApproved, setQualityAgreementApproved] = useState(false);
  const [probationReason, setProbationReason] = useState("");
  const [disqualificationReason, setDisqualificationReason] = useState("");
  const [aslSignatureEmail, setAslSignatureEmail] = useState("");
  const [receivingInspectionEnabled, setReceivingInspectionEnabled] = useState(false);

  const fetchSupplier = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setSupplier(data);

    setSupplierStatus(data?.supplier_status || "approved");
    setSupplierRiskLevel(data?.supplier_risk_level || "medium");
    setQualificationStatus(data?.qualification_status || "qualified");
    setQualificationExpirationDate(data?.qualification_expiration_date || "");
    setRequalificationDueDate(data?.requalification_due_date || "");
    setQualificationRationale(data?.qualification_rationale || "");

    setAslStatus(data?.asl_status || data?.supplier_status || "approved");
    setApprovedCommodities(data?.approved_commodities || "");
    setApprovedServices(data?.approved_services || "");
    setQualificationDate(data?.qualification_date || "");
    setCriticalSupplier(data?.critical_supplier || false);
    setQualityAgreementApproved(data?.quality_agreement_approved || false);
    setProbationReason(data?.probation_reason || "");
    setDisqualificationReason(data?.disqualification_reason || "");
    setAslSignatureEmail("");

    const ncmrRes = await supabase
      .from("ncmrs")
      .select("id, ncmr_number, title, status, severity, defect_category, defect_subcategory, created_at")
      .eq("supplier_id", id)
      .order("created_at", { ascending: false });

    if (!ncmrRes.error) {
      setLinkedNcmrs(ncmrRes.data || []);
    }

    const scarRes = await supabase
      .from("scars")
      .select("*")
      .eq("supplier_id", id)
      .order("created_at", { ascending: false });

    if (!scarRes.error) {
      setScars(scarRes.data || []);
    }

    const auditRes = await supabase
      .from("supplier_audits")
      .select("*")
      .eq("supplier_id", id)
      .order("created_at", { ascending: false });

    if (!auditRes.error) {
      const audits = auditRes.data || [];
      setSupplierAudits(audits);

      const auditIds = audits.map((audit) => audit.id);

      if (auditIds.length > 0) {
        const findingsRes = await supabase
          .from("supplier_audit_findings")
          .select("*")
          .in("audit_id", auditIds);

        if (!findingsRes.error) {
          setAuditFindings(findingsRes.data || []);
        }
      } else {
        setAuditFindings([]);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (id) fetchSupplier();
  }, [id]);

  const metrics = useMemo(() => {
    const openNcmrs = linkedNcmrs.filter((n) => n.status !== "closed");
    const closedNcmrs = linkedNcmrs.filter((n) => n.status === "closed");
    const majorCriticalNcmrs = linkedNcmrs.filter(
      (n) => n.severity === "major" || n.severity === "critical"
    );

    const openScars = scars.filter((scar) => scar.status !== "closed");
    const closedScars = scars.filter((scar) => scar.status === "closed");

    const openAudits = supplierAudits.filter((audit) => audit.audit_status !== "closed");
    const closedAudits = supplierAudits.filter((audit) => audit.audit_status === "closed");

    const majorCriticalFindings = auditFindings.filter(
      (finding) => finding.finding_type === "major" || finding.finding_type === "critical"
    );
    const criticalFindings = auditFindings.filter(
      (finding) => finding.finding_type === "critical"
    );

    const defectCounts: Record<string, number> = {};
    linkedNcmrs.forEach((ncmr) => {
      const key = ncmr.defect_category || "Uncategorized";
      defectCounts[key] = (defectCounts[key] || 0) + 1;
    });

    const topDefect = Object.entries(defectCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      totalNcmrs: linkedNcmrs.length,
      openNcmrs: openNcmrs.length,
      closedNcmrs: closedNcmrs.length,
      majorCriticalNcmrs: majorCriticalNcmrs.length,
      totalScars: scars.length,
      openScars: openScars.length,
      closedScars: closedScars.length,
      totalAudits: supplierAudits.length,
      openAudits: openAudits.length,
      closedAudits: closedAudits.length,
      totalFindings: auditFindings.length,
      majorCriticalFindings: majorCriticalFindings.length,
      criticalFindings: criticalFindings.length,
      topDefect: topDefect ? `${topDefect[0]} (${topDefect[1]})` : "N/A",
    };
  }, [linkedNcmrs, scars, supplierAudits, auditFindings]);

  const getRecommendedSupplierControl = () => {
    const reasons: string[] = [];
    let recommendedStatus = supplierStatus || "approved";
    let recommendedRisk = supplierRiskLevel || "medium";
    let recommendedQualification = qualificationStatus || "qualified";

    if (supplier?.supplier_status === "disqualified") {
      recommendedStatus = "disqualified";
      recommendedRisk = "critical";
      recommendedQualification = "disqualified";
      reasons.push("Supplier is currently disqualified.");
    }

    if (metrics.criticalFindings > 0) {
      recommendedStatus = "probation";
      recommendedRisk = "critical";
      recommendedQualification = "conditional";
      reasons.push("Critical supplier audit finding detected.");
    } else if (metrics.majorCriticalFindings >= 2) {
      recommendedStatus = "conditional";
      recommendedRisk = "high";
      recommendedQualification = "conditional";
      reasons.push("Multiple major/critical supplier audit findings detected.");
    }

    if (metrics.openScars >= 2) {
      recommendedStatus = "probation";
      recommendedRisk = recommendedRisk === "critical" ? "critical" : "high";
      recommendedQualification = "conditional";
      reasons.push("Multiple open SCARs detected.");
    } else if (metrics.openScars === 1) {
      recommendedRisk = recommendedRisk === "critical" ? "critical" : "high";
      reasons.push("Open SCAR detected.");
    }

    if (metrics.openNcmrs >= 3) {
      recommendedStatus = recommendedStatus === "probation" ? "probation" : "conditional";
      recommendedRisk = recommendedRisk === "critical" ? "critical" : "high";
      reasons.push("Three or more open supplier-linked NCMRs detected.");
    }

    if (reasons.length === 0) {
      reasons.push("No automatic escalation trigger detected based on current supplier quality data.");
    }

    return {
      recommendedStatus,
      recommendedRisk,
      recommendedQualification,
      reasons,
    };
  };

  const applyRecommendedSupplierControl = () => {
    const recommendation = getRecommendedSupplierControl();
    setSupplierStatus(recommendation.recommendedStatus);
    setSupplierRiskLevel(recommendation.recommendedRisk);
    setQualificationStatus(recommendation.recommendedQualification);

    if (!qualificationRationale.trim()) {
      setQualificationRationale(recommendation.reasons.join(" "));
    }
  };

  const saveSupplierQualification = async () => {
    if (!qualificationRationale.trim()) {
      alert("Qualification/status rationale is required.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { error } = await supabase
      .from("suppliers")
      .update({
        supplier_status: supplierStatus,
        supplier_risk_level: supplierRiskLevel,
        qualification_status: qualificationStatus,
        qualification_expiration_date: qualificationExpirationDate || null,
        requalification_due_date: requalificationDueDate || null,
        qualification_rationale: qualificationRationale,
        qualification_updated_by: userEmail,
        qualification_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: "supplier",
      entity_id: id,
      action: "supplier_qualification_updated",
      details: `Supplier qualification/status updated. Status: ${supplierStatus}. Risk: ${supplierRiskLevel}. Qualification: ${qualificationStatus}.`,
      user_email: userEmail,
    });

    alert("Supplier qualification/status saved.");
    fetchSupplier();
  };


  const saveAslGovernance = async () => {
    if (!aslSignatureEmail.trim()) {
      alert("Please re-enter your email to approve ASL governance changes.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    if (aslSignatureEmail.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
      alert("Electronic signature email does not match the logged-in user.");
      return;
    }

    if (!qualificationDate) {
      alert("Qualification date is required for ASL governance.");
      return;
    }

    if (!approvedCommodities.trim() && !approvedServices.trim()) {
      alert("At least one approved commodity or approved service is required.");
      return;
    }

    if (aslStatus === "probation" && !probationReason.trim()) {
      alert("Probation reason is required when ASL status is Probation.");
      return;
    }

    if (aslStatus === "disqualified" && !disqualificationReason.trim()) {
      alert("Disqualification reason is required when ASL status is Disqualified.");
      return;
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("suppliers")
      .update({
        asl_status: aslStatus,
        supplier_status: aslStatus,
        approved_commodities: approvedCommodities || null,
        approved_services: approvedServices || null,
        qualification_date: qualificationDate || null,
        critical_supplier: criticalSupplier,
        quality_agreement_approved: qualityAgreementApproved,
        asl_approved_by: userEmail,
        asl_approved_at: now,
        probation_reason: aslStatus === "probation" ? probationReason : null,
        disqualification_reason: aslStatus === "disqualified" ? disqualificationReason : null,
        qualification_status:
          aslStatus === "disqualified"
            ? "disqualified"
            : aslStatus === "conditional" || aslStatus === "probation"
            ? "conditional"
            : qualificationStatus,
        updated_at: now,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: "supplier",
      entity_id: id,
      action: "asl_governance_approved",
      details: `ASL governance approved. ASL Status: ${aslStatus}. Critical Supplier: ${criticalSupplier ? "Yes" : "No"}. Quality Agreement Approved: ${qualityAgreementApproved ? "Yes" : "No"}.`,
      user_email: userEmail,
    });

    alert("ASL governance saved with electronic signature.");
    fetchSupplier();
  };


  const saveReceivingInspectionSetting = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { error } = await supabase
      .from("suppliers")
      .update({
        receiving_inspection_enabled: receivingInspectionEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: "supplier",
      entity_id: id,
      action: "receiving_inspection_setting_updated",
      details: `Receiving inspection ${receivingInspectionEnabled ? "enabled" : "disabled"} for supplier.`,
      user_email: userEmail,
    });

    alert(
      receivingInspectionEnabled
        ? "Receiving inspection enabled for this supplier."
        : "Receiving inspection disabled for this supplier."
    );

    fetchSupplier();
  };

  if (loading) {
    return <main style={{ padding: "24px" }}>Loading supplier...</main>;
  }

  if (!supplier) {
    return <main style={{ padding: "24px" }}>Supplier not found.</main>;
  }

  const recommendation = getRecommendedSupplierControl();

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <h1>{supplier.supplier_name}</h1>
        <div>
          <Link href="/suppliers" style={{ marginRight: "12px" }}>Supplier List</Link>
          <Link href="/supplier-quality-dashboard" style={{ marginRight: "12px" }}>Supplier Dashboard</Link>
          <Link href={`/supplier-quality/scorecards/${supplier.id}`} style={{ marginRight: "12px" }}>Supplier Scorecard</Link>
          <Link href={`/suppliers/${supplier.id}/audits`}>Supplier Audits</Link>
        </div>
      </div>

      <section style={summaryGridStyle}>
        <MetricCard label="Linked NCMRs" value={metrics.totalNcmrs} />
        <MetricCard label="Open NCMRs" value={metrics.openNcmrs} />
        <MetricCard label="Open SCARs" value={metrics.openScars} />
        <MetricCard label="Open Audits" value={metrics.openAudits} />
        <MetricCard label="Major/Critical Findings" value={metrics.majorCriticalFindings} />
        <MetricCard label="Top Defect Category" value={metrics.topDefect} />
      </section>

      <section style={sectionStyle}>
        <h2>Supplier Summary</h2>

        <div style={gridStyle}>
          <Field label="Supplier Number" value={supplier.supplier_number} />
          <Field label="Category" value={supplier.supplier_category} />
          <Field label="Status" value={supplier.supplier_status} />
          <Field label="ASL Status" value={supplier.asl_status} />
          <Field label="Risk Level" value={supplier.supplier_risk_level} />
          <Field label="Qualification Status" value={supplier.qualification_status} />
          <Field label="Qualification Expiration" value={supplier.qualification_expiration_date} />
          <Field label="Requalification Due" value={supplier.requalification_due_date} />
          <Field label="Qualification Updated By" value={supplier.qualification_updated_by} />
          <Field label="Qualification Updated At" value={supplier.qualification_updated_at} />
          <Field label="Primary Contact" value={supplier.primary_contact_name} />
          <Field label="Primary Email" value={supplier.primary_contact_email} />
          <Field label="Primary Phone" value={supplier.primary_contact_phone} />
          <Field label="Country" value={supplier.supplier_country} />
          <Field label="ISO Certification" value={supplier.iso_certification} />
          <Field label="ISO Expiration" value={supplier.iso_expiration_date} />
          <Field label="Quality Agreement Signed" value={supplier.quality_agreement_signed ? "Yes" : "No"} />
          <Field label="Last Audit" value={supplier.last_supplier_audit_date} />
          <Field label="Next Audit" value={supplier.next_supplier_audit_date} />
          <Field label="Approved Products / Services" value={supplier.approved_products_services} />
          <Field label="Approved Commodities" value={supplier.approved_commodities} />
          <Field label="Approved Services" value={supplier.approved_services} />
          <Field label="Qualification Date" value={supplier.qualification_date} />
          <Field label="Critical Supplier" value={supplier.critical_supplier ? "Yes" : "No"} />
          <Field label="Quality Agreement Approved" value={supplier.quality_agreement_approved ? "Yes" : "No"} />
          <Field label="Receiving Inspection Enabled" value={supplier.receiving_inspection_enabled ? "Yes" : "No"} />
          <Field label="ASL Approved By" value={supplier.asl_approved_by} />
          <Field label="ASL Approved At" value={supplier.asl_approved_at} />
          <Field label="Supplier Notes" value={supplier.supplier_notes} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>ASL Governance / Approved Supplier Controls</h2>

        <p style={{ color: "#4b5563" }}>
          This controls the supplier's Approved Supplier List status without duplicating supplier master data.
          Document approval scope, qualification basis, criticality, and electronic approval here.
        </p>

        <div style={{ display: "grid", gap: "12px", maxWidth: "800px" }}>
          <div>
            <label>ASL Status</label><br />
            <select
              value={aslStatus}
              onChange={(e) => {
                setAslStatus(e.target.value);
                setSupplierStatus(e.target.value);
              }}
              style={{ padding: "8px", width: "100%" }}
            >
              <option value="approved">Approved</option>
              <option value="conditional">Conditional</option>
              <option value="probation">Probation</option>
              <option value="disqualified">Disqualified</option>
              <option value="pending_qualification">Pending Qualification</option>
            </select>
          </div>

          <div>
            <label>Approved Commodities / Materials</label><br />
            <textarea
              value={approvedCommodities}
              onChange={(e) => setApprovedCommodities(e.target.value)}
              rows={3}
              placeholder="Example: sterile packaging, bovine pericardium, machined components, labels"
              style={{ padding: "8px", width: "100%" }}
            />
          </div>

          <div>
            <label>Approved Services</label><br />
            <textarea
              value={approvedServices}
              onChange={(e) => setApprovedServices(e.target.value)}
              rows={3}
              placeholder="Example: sterilization, calibration, testing, contract manufacturing"
              style={{ padding: "8px", width: "100%" }}
            />
          </div>

          <div>
            <label>Qualification Date</label><br />
            <input
              type="date"
              value={qualificationDate}
              onChange={(e) => setQualificationDate(e.target.value)}
              style={{ padding: "8px", width: "100%" }}
            />
          </div>

          <label>
            <input
              type="checkbox"
              checked={criticalSupplier}
              onChange={(e) => {
                setCriticalSupplier(e.target.checked);
                if (e.target.checked && supplierRiskLevel !== "critical") {
                  setSupplierRiskLevel("high");
                }
              }}
            />{" "}
            Critical Supplier
          </label>

          <label>
            <input
              type="checkbox"
              checked={qualityAgreementApproved}
              onChange={(e) => setQualityAgreementApproved(e.target.checked)}
            />{" "}
            Quality Agreement Approved
          </label>

          {aslStatus === "probation" ? (
            <div>
              <label>Probation Reason</label><br />
              <textarea
                value={probationReason}
                onChange={(e) => setProbationReason(e.target.value)}
                rows={3}
                style={{ padding: "8px", width: "100%" }}
              />
            </div>
          ) : null}

          {aslStatus === "disqualified" ? (
            <div>
              <label>Disqualification Reason</label><br />
              <textarea
                value={disqualificationReason}
                onChange={(e) => setDisqualificationReason(e.target.value)}
                rows={3}
                style={{ padding: "8px", width: "100%" }}
              />
            </div>
          ) : null}

          <div
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "12px",
              background: "#f8fafc",
            }}
          >
            <strong>Electronic Approval</strong>
            <p style={{ color: "#4b5563" }}>
              Re-enter your logged-in email to approve this ASL governance decision.
            </p>

            <input
              value={aslSignatureEmail}
              onChange={(e) => setAslSignatureEmail(e.target.value)}
              placeholder="your.email@company.com"
              style={{ padding: "8px", width: "100%", maxWidth: "500px" }}
            />
          </div>

          <button type="button" onClick={saveAslGovernance}>
            Save ASL Governance Decision
          </button>
        </div>

        {supplier.asl_approved_by ? (
          <div style={{ marginTop: "12px" }}>
            <strong>Last ASL Approval:</strong> {supplier.asl_approved_by} at {supplier.asl_approved_at || "N/A"}
          </div>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2>Supplier Qualification / Status Control</h2>

        <p style={{ color: "#4b5563" }}>
          Use this section to document supplier approval status, risk level, qualification status,
          expiration, requalification due date, and the rationale for the decision.
        </p>

        <div
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            padding: "12px",
            background: "#f8fafc",
            marginBottom: "12px",
          }}
        >
          <strong>System Recommendation</strong>
          <div><strong>Recommended Status:</strong> {recommendation.recommendedStatus}</div>
          <div><strong>Recommended Risk:</strong> {recommendation.recommendedRisk}</div>
          <div><strong>Recommended Qualification:</strong> {recommendation.recommendedQualification}</div>
          <ul>
            {recommendation.reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>

          <button type="button" onClick={applyRecommendedSupplierControl}>
            Apply Recommendation
          </button>
        </div>

        <div style={{ display: "grid", gap: "12px", maxWidth: "750px" }}>
          <div>
            <label>Supplier Status</label><br />
            <select
              value={supplierStatus}
              onChange={(e) => setSupplierStatus(e.target.value)}
              style={{ padding: "8px", width: "100%" }}
            >
              <option value="approved">Approved</option>
              <option value="conditional">Conditional</option>
              <option value="probation">Probation</option>
              <option value="disqualified">Disqualified</option>
            </select>
          </div>

          <div>
            <label>Supplier Risk Level</label><br />
            <select
              value={supplierRiskLevel}
              onChange={(e) => setSupplierRiskLevel(e.target.value)}
              style={{ padding: "8px", width: "100%" }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label>Qualification Status</label><br />
            <select
              value={qualificationStatus}
              onChange={(e) => setQualificationStatus(e.target.value)}
              style={{ padding: "8px", width: "100%" }}
            >
              <option value="qualified">Qualified</option>
              <option value="conditional">Conditional</option>
              <option value="requalification_required">Requalification Required</option>
              <option value="disqualified">Disqualified</option>
            </select>
          </div>

          <div>
            <label>Qualification Expiration Date</label><br />
            <input
              type="date"
              value={qualificationExpirationDate}
              onChange={(e) => setQualificationExpirationDate(e.target.value)}
              style={{ padding: "8px", width: "100%" }}
            />
          </div>

          <div>
            <label>Requalification Due Date</label><br />
            <input
              type="date"
              value={requalificationDueDate}
              onChange={(e) => setRequalificationDueDate(e.target.value)}
              style={{ padding: "8px", width: "100%" }}
            />
          </div>

          <div>
            <label>Qualification / Status Rationale</label><br />
            <textarea
              value={qualificationRationale}
              onChange={(e) => setQualificationRationale(e.target.value)}
              rows={4}
              style={{ padding: "8px", width: "100%" }}
            />
          </div>

          <button type="button" onClick={saveSupplierQualification}>
            Save Supplier Qualification / Status Decision
          </button>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Supplier Quality Metrics</h2>

        <div style={gridStyle}>
          <Field label="Total NCMRs" value={metrics.totalNcmrs} />
          <Field label="Open NCMRs" value={metrics.openNcmrs} />
          <Field label="Closed NCMRs" value={metrics.closedNcmrs} />
          <Field label="Major/Critical NCMRs" value={metrics.majorCriticalNcmrs} />
          <Field label="Total SCARs" value={metrics.totalScars} />
          <Field label="Open SCARs" value={metrics.openScars} />
          <Field label="Closed SCARs" value={metrics.closedScars} />
          <Field label="Total Supplier Audits" value={metrics.totalAudits} />
          <Field label="Open Supplier Audits" value={metrics.openAudits} />
          <Field label="Closed Supplier Audits" value={metrics.closedAudits} />
          <Field label="Audit Findings" value={metrics.totalFindings} />
          <Field label="Major/Critical Audit Findings" value={metrics.majorCriticalFindings} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Optional Receiving Inspection</h2>

        <p style={{ color: "#4b5563" }}>
          Enable this optional add-on only for suppliers where incoming material inspection needs to be tracked in QualiFlow.
          If disabled, the supplier profile remains clean and the receiving inspection workflow stays hidden.
        </p>

        <label>
          <input
            type="checkbox"
            checked={receivingInspectionEnabled}
            onChange={(e) => setReceivingInspectionEnabled(e.target.checked)}
          />{" "}
          Enable Receiving Inspection for this supplier
        </label>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
          <button type="button" onClick={saveReceivingInspectionSetting}>
            Save Receiving Inspection Setting
          </button>

          {supplier.receiving_inspection_enabled ? (
            <a
              href={`/suppliers/${supplier.id}/receiving-inspections`}
              style={{
                display: "inline-block",
                padding: "8px 12px",
                background: "#2563eb",
                color: "white",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Open Receiving Inspections
            </a>
          ) : null}
        </div>

        {!supplier.receiving_inspection_enabled ? (
          <p style={{ color: "#6b7280", fontSize: "14px", marginTop: "10px" }}>
            Receiving inspection is currently disabled for this supplier.
          </p>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2>Linked Supplier NCMRs</h2>

        {linkedNcmrs.length === 0 ? (
          <p>No linked NCMRs.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>NCMR Number</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Severity</th>
                <th style={thStyle}>Defect</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Open</th>
              </tr>
            </thead>

            <tbody>
              {linkedNcmrs.map((ncmr) => (
                <tr key={ncmr.id}>
                  <td style={tdStyle}>{ncmr.ncmr_number}</td>
                  <td style={tdStyle}>{ncmr.title}</td>
                  <td style={tdStyle}>{ncmr.status}</td>
                  <td style={tdStyle}>{ncmr.severity}</td>
                  <td style={tdStyle}>{ncmr.defect_category || "N/A"}</td>
                  <td style={tdStyle}>{ncmr.created_at}</td>
                  <td style={tdStyle}>
                    <Link href={`/ncmrs/${ncmr.id}`}>Open NCMR</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <strong>{label}:</strong> {value || "N/A"}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: any }) {
  return (
    <div style={metricCardStyle}>
      <div style={{ color: "#4b5563", fontSize: "13px" }}>{label}</div>
      <div style={{ fontSize: "24px", fontWeight: "bold", marginTop: "6px" }}>{value}</div>
    </div>
  );
}

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
  marginBottom: "20px",
};

const metricCardStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "14px",
  background: "#f9fafb",
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  padding: "14px",
  marginTop: "16px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "10px",
};

const thStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px",
  background: "#f3f4f6",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "10px",
};
