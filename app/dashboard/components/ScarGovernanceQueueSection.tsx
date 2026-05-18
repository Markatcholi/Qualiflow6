"use client";

import Link from "next/link";
import { DashboardSection } from "./DashboardComponents";

export default function ScarGovernanceQueueSection({
  scarGovernanceQueue,
}: {
  scarGovernanceQueue: any[];
}) {
  return (
    <DashboardSection title="SCAR Governance Queue">
      {scarGovernanceQueue.length === 0 ? (
        <p>No SCAR governance actions pending.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Supplier</th>
              <th style={thStyle}>SCAR Required</th>
              <th style={thStyle}>Linked SCAR</th>
              <th style={thStyle}>Action</th>
            </tr>
          </thead>

          <tbody>
            {scarGovernanceQueue.map((item) => (
              <tr key={item.id}>
                <td style={tdStyle}>
                  {item.ncmr_number || item.finding_title || "Record"}
                </td>

                <td style={tdStyle}>
                  {item.supplier_name || "N/A"}
                </td>

                <td style={tdStyle}>
                  {item.scar_required ? "Yes" : "Evaluation Needed"}
                </td>

                <td style={tdStyle}>
                  {item.linked_scar_id ? "Linked" : "Not Linked"}
                </td>

                <td style={tdStyle}>
                  <Link
                    href={
                      item.audit_id
                        ? `/audits/${item.audit_id}`
                        : `/ncmrs/${item.id}`
                    }
                  >
                    Open Record
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
