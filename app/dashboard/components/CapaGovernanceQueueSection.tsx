"use client";

import Link from "next/link";
import { DashboardSection } from "./DashboardComponents";

export default function CapaGovernanceQueueSection({
  capaGovernanceQueue,
}: {
  capaGovernanceQueue: any[];
}) {
  return (
    <DashboardSection title="CAPA Governance Queue">
      {capaGovernanceQueue.length === 0 ? (
        <p>No CAPA governance actions pending.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>NCMR</th>
              <th style={thStyle}>Severity</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>CAPA Evaluation</th>
              <th style={thStyle}>Action</th>
            </tr>
          </thead>

          <tbody>
            {capaGovernanceQueue.map((item) => (
              <tr key={item.id}>
                <td style={tdStyle}>
                  {item.ncmr_number || item.title || "NCMR"}
                </td>

                <td style={tdStyle}>{item.severity || "N/A"}</td>

                <td style={tdStyle}>{item.status || "open"}</td>

                <td style={tdStyle}>
                  {item.capa_evaluation_outcome || "Pending"}
                </td>

                <td style={tdStyle}>
                  <Link href={`/ncmrs/${item.id}`}>
                    Open NCMR
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
