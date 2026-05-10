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
  const [loading, setLoading] = useState(true);

  const fetchSupplier = async () => {
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

    const ncmrRes = await supabase
      .from("ncmrs")
      .select("id, ncmr_number, title, status, severity, defect_category, defect_subcategory, created_at, closed_at")
      .eq("supplier_id", id)
      .order("created_at", { ascending: false });

    if (!ncmrRes.error) {
      setLinkedNcmrs(ncmrRes.data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (id) fetchSupplier();
  }, [id]);

  const metrics = useMemo(() => {
    const open = linkedNcmrs.filter((n) => n.status !== "closed");
    const closed = linkedNcmrs.filter((n) => n.status === "closed");
    const majorCritical = linkedNcmrs.filter(
      (n) => n.severity === "major" || n.severity === "critical"
    );

    const defectCounts: Record<string, number> = {};
    linkedNcmrs.forEach((ncmr) => {
      const key = ncmr.defect_category || "Uncategorized";
      defectCounts[key] = (defectCounts[key] || 0) + 1;
    });

    const topDefect = Object.entries(defectCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      total: linkedNcmrs.length,
      open: open.length,
      closed: closed.length,
      majorCritical: majorCritical.length,
      topDefect: topDefect ? `${topDefect[0]} (${topDefect[1]})` : "N/A",
    };
  }, [linkedNcmrs]);

  if (loading) {
    return <main style={{ padding: "24px" }}>Loading supplier...</main>;
  }

  if (!supplier) {
    return <main style={{ padding: "24px" }}>Supplier not found.</main>;
  }

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <h1>{supplier.supplier_name}</h1>
        <div>
          <Link href="/suppliers" style={{ marginRight: "12px" }}>Supplier List</Link>
          <Link href="/supplier-quality-dashboard">Supplier Dashboard</Link>
        </div>
      </div>

      <section style={summaryGridStyle}>
        <MetricCard label="Total Supplier NCMRs" value={metrics.total} />
        <MetricCard label="Open NCMRs" value={metrics.open} />
        <MetricCard label="Closed NCMRs" value={metrics.closed} />
        <MetricCard label="Major/Critical NCMRs" value={metrics.majorCritical} />
        <MetricCard label="Top Defect Category" value={metrics.topDefect} />
      </section>

      <section style={sectionStyle}>
        <h2>Supplier Summary</h2>

        <div style={gridStyle}>
          <Field label="Supplier Number" value={supplier.supplier_number} />
          <Field label="Category" value={supplier.supplier_category} />
          <Field label="Status" value={supplier.supplier_status} />
          <Field label="Risk Level" value={supplier.supplier_risk_level} />
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
          <Field label="Supplier Notes" value={supplier.supplier_notes} />
        </div>
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
