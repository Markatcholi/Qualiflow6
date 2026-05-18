"use client";

import Link from "next/link";
import { DashboardSection } from "./DashboardComponents";

export default function ScarGovernanceQueueSection({
  scarGovernanceQueue,
}: {
  scarGovernanceQueue: any[];
}) {
  const getAgeDays = (item: any) => {
    if (!item.created_at) return "N/A";
    const created = new Date(item.created_at).getTime();
    const now = new Date().getTime();
    return Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
  };

  const getPriority = (item: any) => {
    const severity = String(item.severity || item.finding_severity || "").toLowerCase();

    if (severity.includes("critical") || item.scar_required) return "High";
    if (severity.includes("major") || item.supplier_name || item.linked_supplier_id || item.supplier_id) return "Medium";
    return "Low";
  };

  const getPriorityStyle = (priority: string): React.CSSProperties => {
    if (priority === "High") return badgeStyle("#fee2e2", "#991b1b", "#fecaca");
    if (priority === "Medium") return badgeStyle("#fef3c7", "#92400e", "#fde68a");
    return badgeStyle("#dcfce7", "#166534", "#bbf7d0");
  };

  const getSourceLabel = (item: any) => {
    if (item.finding_title) return "Audit Finding";
    return "NCMR";
  };

  const getOpenLink = (item: any) => {
    if (item.audit_id) return `/audits/${item.audit_id}`;
    return `/ncmrs/${item.id}`;
  };

  return (
    <DashboardSection title="SCAR Governance Queue">
      <p style={{ color: "#4b5563", marginTop: 0 }}>
        Supplier-related NCMRs or audit findings that need SCAR linkage, SCAR decision, or supplier escalation justification.
      </p>

      {scarGovernanceQueue.length === 0 ? (
        <p style={{ color: "#15803d", fontWeight: 700 }}>No SCAR governance actions pending.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Priority</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Supplier</th>
              <th style={thStyle}>Age</th>
              <th style={thStyle}>SCAR Status</th>
              <th style={thStyle}>Reason</th>
              <th style={thStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {scarGovernanceQueue.map((item) => {
              const priority = getPriority(item);

              return (
                <tr key={item.id}>
                  <td style={tdStyle}><span style={getPriorityStyle(priority)}>{priority}</span></td>
                  <td style={tdStyle}>
                    <strong>{getSourceLabel(item)}</strong>
                    <div style={subTextStyle}>{item.ncmr_number || item.finding_title || item.title || "Record"}</div>
                  </td>
                  <td style={tdStyle}>{item.supplier_name || "N/A"}</td>
                  <td style={tdStyle}>{getAgeDays(item)} days</td>
                  <td style={tdStyle}>{item.linked_scar_id ? "Linked" : "Not Linked"}</td>
                  <td style={tdStyle}>
                    {item.scar_justification ||
                      item.supplier_capa_reason ||
                      item.finding_description ||
                      "SCAR decision needed"}
                  </td>
                  <td style={tdStyle}><Link href={getOpenLink(item)}>Open Record</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </DashboardSection>
  );
}

const badgeStyle = (background: string, color: string, border: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: "999px",
  background,
  color,
  border: `1px solid ${border}`,
  fontWeight: 700,
  fontSize: "12px",
});

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const thStyle: React.CSSProperties = { border: "1px solid #d1d5db", padding: "10px", background: "#f3f4f6", textAlign: "left" };
const tdStyle: React.CSSProperties = { border: "1px solid #d1d5db", padding: "10px", verticalAlign: "top" };
const subTextStyle: React.CSSProperties = { color: "#6b7280", fontSize: "12px", marginTop: "4px" };
