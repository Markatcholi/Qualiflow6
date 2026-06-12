"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Complaint = {
  id: string;
  complaint_number: string | null;
  complaint_title: string;
  complaint_description: string | null;
  date_received: string | null;
  source: string | null;
  customer_name: string | null;
  customer_organization: string | null;
  product_name: string | null;
  part_number: string | null;
  lot_number: string | null;
  serial_number: string | null;
  severity: string | null;
  potential_patient_impact: boolean | null;
  potential_safety_issue: boolean | null;
  status: string | null;
  mdr_assessment_required: boolean | null;
  regulatory_assessment: string | null;
  ncmr_required: boolean | null;
  capa_required: boolean | null;
  scar_required: boolean | null;
  change_control_required: boolean | null;
  closed_at: string | null;
  created_at: string | null;
};

const statusOptions = [
  "intake",
  "investigation",
  "risk_assessment",
  "reportability_assessment",
  "disposition",
  "closure",
  "closed",
];

const severityOptions = ["minor", "major", "critical"];

const sourceOptions = [
  "phone",
  "email",
  "distributor",
  "sales_rep",
  "website",
  "audit",
  "other",
];

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const [complaintTitle, setComplaintTitle] = useState("");
  const [complaintDescription, setComplaintDescription] = useState("");
  const [source, setSource] = useState("email");
  const [dateReceived, setDateReceived] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [customerName, setCustomerName] = useState("");
  const [customerOrganization, setCustomerOrganization] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [country, setCountry] = useState("");

  const [productFamily, setProductFamily] = useState("");
  const [productName, setProductName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [returnedProductAvailable, setReturnedProductAvailable] =
    useState(false);

  const [severity, setSeverity] = useState("minor");
  const [potentialPatientImpact, setPotentialPatientImpact] = useState(false);
  const [potentialSafetyIssue, setPotentialSafetyIssue] = useState(false);

  const generateComplaintNumber = async () => {
    const year = new Date().getFullYear();

    const { count, error } = await supabase
      .from("complaints")
      .select("id", { count: "exact", head: true });

    if (error) {
      return `COMP-${year}-${Math.floor(Math.random() * 999999)
        .toString()
        .padStart(6, "0")}`;
    }

    return `COMP-${year}-${String((count || 0) + 1).padStart(6, "0")}`;
  };

  const fetchComplaints = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setComplaints((data as Complaint[]) || []);
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const filteredComplaints = useMemo(() => {
    return complaints.filter((complaint) => {
      const statusMatch =
        statusFilter === "all" || complaint.status === statusFilter;

      const severityMatch =
        severityFilter === "all" || complaint.severity === severityFilter;

      return statusMatch && severityMatch;
    });
  }, [complaints, statusFilter, severityFilter]);

  const createComplaint = async () => {
    if (!complaintTitle.trim()) {
      alert("Complaint title is required.");
      return;
    }

    if (!complaintDescription.trim()) {
      alert("Complaint description is required.");
      return;
    }

    setCreating(true);

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";
    const complaintNumber = await generateComplaintNumber();

    const { data, error } = await supabase
      .from("complaints")
      .insert({
        complaint_number: complaintNumber,
        complaint_title: complaintTitle.trim(),
        complaint_description: complaintDescription.trim(),
        date_received: dateReceived || new Date().toISOString().split("T")[0],
        received_by: userEmail,
        source,

        customer_name: customerName.trim() || null,
        customer_organization: customerOrganization.trim() || null,
        customer_email: customerEmail.trim() || null,
        customer_phone: customerPhone.trim() || null,
        country: country.trim() || null,

        product_family: productFamily.trim() || null,
        product_name: productName.trim() || null,
        part_number: partNumber.trim() || null,
        lot_number: lotNumber.trim() || null,
        serial_number: serialNumber.trim() || null,
        returned_product_available: returnedProductAvailable,

        severity,
        potential_patient_impact: potentialPatientImpact,
        potential_safety_issue: potentialSafetyIssue,
        status: "intake",
        regulatory_assessment: "pending",
        created_by: userEmail,
      })
      .select()
      .single();

    setCreating(false);

    if (error) {
      alert(error.message);
      return;
    }

    if (data?.id) {
      await supabase.from("complaint_activity_log").insert({
        complaint_id: data.id,
        action: "complaint_created",
        details: `Complaint ${complaintNumber} created.`,
        user_email: userEmail,
      });
    }

    alert("Complaint created.");

    setComplaintTitle("");
    setComplaintDescription("");
    setSource("email");
    setDateReceived(new Date().toISOString().split("T")[0]);
    setCustomerName("");
    setCustomerOrganization("");
    setCustomerEmail("");
    setCustomerPhone("");
    setCountry("");
    setProductFamily("");
    setProductName("");
    setPartNumber("");
    setLotNumber("");
    setSerialNumber("");
    setReturnedProductAvailable(false);
    setSeverity("minor");
    setPotentialPatientImpact(false);
    setPotentialSafetyIssue(false);

    fetchComplaints();
  };

  if (loading) {
    return <main style={pageStyle}>Loading complaints...</main>;
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>COMPLAINT MANAGEMENT</div>
          <h1 style={{ margin: "6px 0" }}>Complaints</h1>
          <p style={subtleText}>
            Capture, investigate, assess reportability, link quality records,
            and close customer complaints through a controlled workflow.
          </p>
        </div>

        <div style={buttonRowStyle}>
          <Link href="/complaints/dashboard" style={secondaryLinkStyle}>
            Complaint Dashboard
          </Link>

          <Link href="/dashboard" style={darkLinkStyle}>
            Dashboard
          </Link>
        </div>
      </header>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Create Complaint</h2>
            <p style={subtleText}>
              Start complaint intake. Investigation, reportability assessment,
              linked records, and closure are completed on the complaint detail
              page.
            </p>
          </div>

          <button
            onClick={createComplaint}
            disabled={creating}
            style={creating ? disabledButtonStyle : primaryButtonStyle}
          >
            {creating ? "Creating..." : "Create Complaint"}
          </button>
        </div>

        <div style={gridStyle}>
          <Field label="Complaint Title">
            <input
              value={complaintTitle}
              onChange={(e) => setComplaintTitle(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Date Received">
            <input
              type="date"
              value={dateReceived}
              onChange={(e) => setDateReceived(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Source">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              style={inputStyle}
            >
              {sourceOptions.map((item) => (
                <option key={item} value={item}>
                  {formatLabel(item)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Severity">
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              style={inputStyle}
            >
              {severityOptions.map((item) => (
                <option key={item} value={item}>
                  {formatLabel(item)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Complaint Description">
          <textarea
            value={complaintDescription}
            onChange={(e) => setComplaintDescription(e.target.value)}
            rows={4}
            style={textareaStyle}
          />
        </Field>

        <h3>Customer Information</h3>
        <div style={gridStyle}>
          <Field label="Customer Name">
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Customer Organization">
            <input value={customerOrganization} onChange={(e) => setCustomerOrganization(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Customer Email">
            <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Customer Phone">
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Country">
            <input value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <h3>Product Information</h3>
        <div style={gridStyle}>
          <Field label="Product Family">
            <input value={productFamily} onChange={(e) => setProductFamily(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Product Name">
            <input value={productName} onChange={(e) => setProductName(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Part Number">
            <input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Lot Number">
            <input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Serial Number">
            <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <div style={toggleRowStyle}>
          <label style={toggleLabelStyle}>
            <input type="checkbox" checked={returnedProductAvailable} onChange={(e) => setReturnedProductAvailable(e.target.checked)} />
            Returned Product Available
          </label>
          <label style={toggleLabelStyle}>
            <input type="checkbox" checked={potentialPatientImpact} onChange={(e) => setPotentialPatientImpact(e.target.checked)} />
            Potential Patient Impact
          </label>
          <label style={toggleLabelStyle}>
            <input type="checkbox" checked={potentialSafetyIssue} onChange={(e) => setPotentialSafetyIssue(e.target.checked)} />
            Potential Safety Issue
          </label>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Complaint Registry</h2>
            <p style={subtleText}>
              Open complaints to continue investigation, assessment,
              disposition, linked records, and closure.
            </p>
          </div>

          <div style={buttonRowStyle}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={smallSelectStyle}>
              <option value="all">All Statuses</option>
              {statusOptions.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}
            </select>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={smallSelectStyle}>
              <option value="all">All Severities</option>
              {severityOptions.map((item) => <option key={item} value={item}>{formatLabel(item)}</option>)}
            </select>
          </div>
        </div>

        {filteredComplaints.length === 0 ? (
          <div style={infoBoxStyle}>No complaints match the current filters.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Complaint</th>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>Severity</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Reportability</th>
                  <th style={thStyle}>Linked Actions</th>
                  <th style={thStyle}>Open</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map((complaint) => (
                  <tr key={complaint.id}>
                    <td style={tdStyle}>
                      <strong>{complaint.complaint_number || "Pending Number"}</strong>
                      <div>{complaint.complaint_title}</div>
                      <div style={smallTextStyle}>Received: {complaint.date_received || "N/A"}</div>
                    </td>
                    <td style={tdStyle}>{complaint.customer_name || "N/A"}<div style={smallTextStyle}>{complaint.customer_organization || ""}</div></td>
                    <td style={tdStyle}>{complaint.product_name || "N/A"}<div style={smallTextStyle}>Part: {complaint.part_number || "N/A"} | Lot: {complaint.lot_number || "N/A"}</div></td>
                    <td style={tdStyle}>
                      <StatusBadge label={formatLabel(complaint.severity || "minor")} tone={complaint.severity === "critical" ? "red" : complaint.severity === "major" ? "orange" : "green"} />
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge label={formatLabel(complaint.status || "intake")} tone={complaint.status === "closed" ? "green" : complaint.status === "closure" ? "blue" : "orange"} />
                    </td>
                    <td style={tdStyle}>{complaint.mdr_assessment_required ? "MDR Required" : "N/A"}<div style={smallTextStyle}>{formatLabel(complaint.regulatory_assessment || "pending")}</div></td>
                    <td style={tdStyle}>
                      <div>NCMR: {complaint.ncmr_required ? "Yes" : "No"}</div>
                      <div>CAPA: {complaint.capa_required ? "Yes" : "No"}</div>
                      <div>SCAR: {complaint.scar_required ? "Yes" : "No"}</div>
                      <div>Change: {complaint.change_control_required ? "Yes" : "No"}</div>
                    </td>
                    <td style={tdStyle}><Link href={`/complaints/${complaint.id}`}>Open Complaint</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ marginTop: "6px" }}>{children}</div>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "green" | "blue" | "orange" | "red" }) {
  const toneMap = { green: { background: "#dcfce7", color: "#166534" }, blue: { background: "#dbeafe", color: "#1e40af" }, orange: { background: "#ffedd5", color: "#9a3412" }, red: { background: "#fee2e2", color: "#991b1b" } };
  return <span style={{ display: "inline-block", background: toneMap[tone].background, color: toneMap[tone].color, borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 800 }}>{label}</span>;
}

const formatLabel = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

const pageStyle: React.CSSProperties = { padding: "24px", background: "#f8fafc", minHeight: "100vh", fontFamily: "Arial, sans-serif" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "20px" };
const eyebrowStyle: React.CSSProperties = { fontSize: "12px", letterSpacing: "0.08em", color: "#6b7280", fontWeight: 800 };
const subtleText: React.CSSProperties = { color: "#6b7280" };
const cardStyle: React.CSSProperties = { background: "white", border: "1px solid #d1d5db", borderRadius: "16px", padding: "20px", marginBottom: "18px" };
const sectionHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "16px" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" };
const labelStyle: React.CSSProperties = { fontWeight: 700 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db" };
const textareaStyle: React.CSSProperties = { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", fontFamily: "Arial, sans-serif" };
const toggleRowStyle: React.CSSProperties = { display: "flex", gap: "24px", flexWrap: "wrap", marginTop: "16px" };
const toggleLabelStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "8px", fontWeight: 700 };
const buttonRowStyle: React.CSSProperties = { display: "flex", gap: "8px", flexWrap: "wrap" };
const primaryButtonStyle: React.CSSProperties = { background: "#2563eb", color: "white", border: "none", borderRadius: "8px", padding: "10px 14px", fontWeight: 700, cursor: "pointer" };
const disabledButtonStyle: React.CSSProperties = { background: "#9ca3af", color: "white", border: "none", borderRadius: "8px", padding: "10px 14px", fontWeight: 700, cursor: "not-allowed" };
const secondaryLinkStyle: React.CSSProperties = {
  background: "#15803d",
  color: "white",
  borderRadius: "8px",
  padding: "10px 14px",
  textDecoration: "none",
  fontWeight: 700,
};

const darkLinkStyle: React.CSSProperties = { background: "#111827", color: "white", borderRadius: "8px", padding: "10px 14px", textDecoration: "none", fontWeight: 700 };
const smallSelectStyle: React.CSSProperties = { padding: "9px", borderRadius: "8px", border: "1px solid #d1d5db" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #d1d5db", padding: "10px", fontSize: "13px" };
const tdStyle: React.CSSProperties = { borderBottom: "1px solid #e5e7eb", padding: "10px", verticalAlign: "top" };
const smallTextStyle: React.CSSProperties = { color: "#6b7280", fontSize: "12px", marginTop: "4px" };
const infoBoxStyle: React.CSSProperties = { marginTop: "16px", background: "#eff6ff", color: "#1e3a8a", border: "1px solid #bfdbfe", borderRadius: "12px", padding: "14px" };
