"use client";

import Link from "next/link";
import { DashboardSection } from "./DashboardComponents";

export default function CapaGovernanceQueueSection({
  capaGovernanceQueue,
}: {
  capaGovernanceQueue: any[];
}) {
  const getAgeDays = (item: any) => {
    if (!item.created_at) return "N/A";
    const created = new Date(item.created_at).getTime();
    const now = new Date().getTime();
    return Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
  };

  const getPriority = (item: any) => {
    const severity = String(item.severity || "").toLowerCase();
    const outcome = String(item.capa_evaluation_outcome || "").toLowerCase();

    if (severity.includes("critical") || outcome.includes("required")) return "High";
    if (severity.includes("major") || outcome.includes("recommended") || item.recurring_issue) return "Medium";
    return "Low";
  };

  const getPriorityStyle = (priority: string): React.CSSProperties => {
    if (priority === "High") return badgeStyle("#fee2e2", "#991b1b", "#fecaca");
    if (priority === "Medium") return badgeStyle("#fef3c7", "#92400e", "#fde68a");
    return badgeStyle("#dcfce7", "#166534", "#bbf7d0");
  };

  return (
    <DashboardSection title="CAPA Governance Queue">
      <p style={{ color: "#4b5563", marginTop: 0 }}>
        NCMRs that need CAPA evaluation, CAPA linkage, or documented no-CAPA justification.
      </p>

      {capaGovernanceQueue.length === 0 ? (
        <p style={{ color: "#15803d", fontWeight: 700 }}>No CAPA governance actions pending.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Priority</th>
              <th style={thStyle}>NCMR</th>
              <th style={thStyle}>Severity</th>
              <th style={thStyle}>Age</th>
              <th style={thStyle}>CAPA Evaluation</th>
              <th style={thStyle}>Reason</th>
              <th style={thStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {capaGovernanceQueue.map((item) => {
              const priority = getPriority(item);

              return (
                <tr key={item.id}>
                  <td style={tdStyle}><span style={getPriorityStyle(priority)}>{priority}</span></td>
                  <td style={tdStyle}>
                    <strong>{item.ncmr_number || item.title || "NCMR"}</strong>
                    {item.title ? <div style={subTextStyle}>{item.title}</div> : null}
                  </td>
                  <td style={tdStyle}>{item.severity || "N/A"}</td>
                  <td style={tdStyle}>{getAgeDays(item)} days</td>
                  <td style={tdStyle}>{item.capa_evaluation_outcome || "Pending"}</td>
                  <td style={tdStyle}>
                    {item.capa_evaluation_rationale ||
                      item.capa_trigger_reason ||
                      (item.recurring_issue ? "Recurring issue" : "CAPA decision needed")}
                  </td>
                  <td style={tdStyle}><Link href={`/ncmrs/${item.id}`}>Open NCMR</Link></td>
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
