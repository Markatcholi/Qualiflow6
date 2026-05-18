"use client";

import Link from "next/link";
import { DashboardSection } from "./DashboardComponents";

export default function AuditEscalationQueueSection({
  auditEscalationQueue,
}: {
  auditEscalationQueue: any[];
}) {
  return (
    <DashboardSection title="Audit Escalation Queue">
      {auditEscalationQueue.length === 0 ? (
        <p>No audit escalation actions pending.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Finding</th>
              <th style={thStyle}>Severity</th>
              <th style={thStyle}>CAPA</th>
              <th style={thStyle}>SCAR</th>
              <th style={thStyle}>Action</th>
            </tr>
          </thead>

          <tbody>
            {auditEscalationQueue.map((item) => (
              <tr key={item.id}>
                <td style={tdStyle}>{item.finding_title}</td>

                <td style={tdStyle}>
                  {item.finding_severity || "N/A"}
                </td>

                <td style={tdStyle}>
                  {item.linked_capa_id ? "Linked" : "Pending"}
                </td>

                <td style={tdStyle}>
                  {item.linked_scar_id ? "Linked" : "Pending"}
                </td>

                <td style={tdStyle}>
                  <Link href={`/audits/${item.audit_id}`}>
                    Open Audit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashboardSection>
  );
}

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
