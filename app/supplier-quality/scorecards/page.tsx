"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function SupplierScorecardsPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [ncmrs, setNcmrs] = useState<any[]>([]);
  const [scars, setScars] = useState<any[]>([]);
  const [receivingInspections, setReceivingInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);

    const suppliersRes = await supabase
      .from("suppliers")
      .select("*")
      .order("supplier_name", { ascending: true });

    const ncmrRes = await supabase
      .from("ncmrs")
      .select(
        "id, supplier_id, status, severity, defect_category, created_at"
      )
      .not("supplier_id", "is", null);

    const scarRes = await supabase
      .from("scars")
      .select(
        "id, supplier_id, status, risk_level, created_at"
      );

    const receivingInspectionRes = await supabase
      .from("receiving_inspections")
      .select(
        "id, supplier_id, inspection_result, quantity_received, quantity_rejected, approval_status, created_at"
      );

    if (suppliersRes.error) {
      alert(suppliersRes.error.message);
      setLoading(false);
      return;
    }

    if (ncmrRes.error) {
      alert(ncmrRes.error.message);
      setLoading(false);
      return;
    }

    if (scarRes.error) {
      alert(scarRes.error.message);
      setLoading(false);
      return;
    }

    if (receivingInspectionRes.error) {
      alert(receivingInspectionRes.error.message);
      setLoading(false);
      return;
    }

    setSuppliers(suppliersRes.data || []);
    setNcmrs(ncmrRes.data || []);
    setScars(scarRes.data || []);
    setReceivingInspections(
      receivingInspectionRes.data || []
    );

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const rows = useMemo(() => {
    return suppliers
      .map((supplier) => {
        const supplierNcmrs = ncmrs.filter(
          (n) => n.supplier_id === supplier.id
        );

        const supplierScars = scars.filter(
          (s) => s.supplier_id === supplier.id
        );

        const supplierReceivingInspections =
          receivingInspections.filter(
            (r) => r.supplier_id === supplier.id
          );

        const openNcmrs = supplierNcmrs.filter(
          (n) => n.status !== "closed"
        ).length;

        const openScars = supplierScars.filter(
          (s) => s.status !== "closed"
        ).length;

        const highCriticalIssues =
          supplierNcmrs.filter(
            (n) =>
              n.severity === "major" ||
              n.severity === "critical"
          ).length +
          supplierScars.filter(
            (s) =>
              s.risk_level === "high" ||
              s.risk_level === "critical"
          ).length;

        const rejectedLots =
          supplierReceivingInspections.filter(
            (r) => {
              const result = String(
                r.inspection_result || ""
              ).toLowerCase();

              return (
                result.includes("reject") ||
                result.includes("fail") ||
                result.includes("nonconform")
              );
            }
          ).length;

        const acceptedLots =
          supplierReceivingInspections.filter(
            (r) =>
              String(
                r.inspection_result || ""
              ).toLowerCase() === "accepted"
          ).length;

        const approvedInspections =
          supplierReceivingInspections.filter(
            (r) =>
              r.approval_status === "approved"
          ).length;

        const totalInspections =
          supplierReceivingInspections.length;

        const rejectRate =
          totalInspections > 0
            ? (
                (rejectedLots /
                  totalInspections) *
                100
              ).toFixed(1)
            : "0.0";

        const inspectionApprovalRate =
          totalInspections > 0
            ? (
                (approvedInspections /
                  totalInspections) *
                100
              ).toFixed(1)
            : "0.0";

        const recurringDefects =
          supplierNcmrs.length >= 3;

        const qualityScore =
          calculateQualityScore({
            totalNcmrs:
              supplierNcmrs.length,
            openNcmrs,
            totalScars:
              supplierScars.length,
            openScars,
            highCriticalIssues,
            supplierRisk:
              supplier.supplier_risk_level,
            supplierStatus:
              supplier.supplier_status,
            rejectRate:
              Number(rejectRate),
            recurringDefects,
          });

        return {
          supplier,
          totalNcmrs:
            supplierNcmrs.length,
          openNcmrs,
          totalScars:
            supplierScars.length,
          openScars,
          highCriticalIssues,
          qualityScore,
          rating:
            supplierGrade(qualityScore),
          rejectedLots,
          acceptedLots,
          rejectRate,
          inspectionApprovalRate,
          recurringDefects,
          totalInspections,
        };
      })
      .filter((row) => {
        if (!search.trim()) return true;

        const haystack = [
          row.supplier.supplier_name,
          row.supplier.supplier_number,
          row.supplier.supplier_status,
          row.supplier.supplier_risk_level,
          row.rating,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(
          search.toLowerCase()
        );
      })
      .sort(
        (a, b) =>
          a.qualityScore -
          b.qualityScore
      );
  }, [
    suppliers,
    ncmrs,
    scars,
    receivingInspections,
    search,
  ]);

  const excellentSuppliers =
    rows.filter(
      (r) => r.rating === "A"
    ).length;

  const atRiskSuppliers =
    rows.filter(
      (r) =>
        r.rating === "D" ||
        r.rating === "F"
    ).length;

  const criticalSuppliers =
    rows.filter(
      (r) =>
        String(
          r.supplier.supplier_risk_level || ""
        ).toLowerCase() ===
        "critical"
    ).length;

  const totalOpenScars =
    rows.reduce(
      (sum, row) =>
        sum + row.openScars,
      0
    );

  const averageRejectRate =
    rows.length > 0
      ? (
          rows.reduce(
            (sum, row) =>
              sum +
              Number(row.rejectRate),
            0
          ) / rows.length
        ).toFixed(1)
      : "0.0";

  const printScorecards = () => {
    window.print();
  };

  if (loading) {
    return (
      <main
        style={{
          padding: "24px",
          fontFamily: "Arial",
        }}
      >
        Loading supplier scorecards...
      </main>
    );
  }

  return (
    <main
      style={{
        padding: "24px",
        fontFamily:
          "Arial, sans-serif",
        background: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>
            SUPPLIER QUALITY INTELLIGENCE
          </div>

          <h1
            style={{
              marginBottom: "6px",
            }}
          >
            Supplier Quality Scorecards
          </h1>

          <p
            style={{
              color: "#4b5563",
              marginTop: 0,
            }}
          >
            Executive supplier quality
            performance, incoming
            quality intelligence,
            SCAR performance,
            NCMR recurrence,
            supplier governance,
            and operational risk
            visibility.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={printScorecards}
            style={primaryButtonStyle}
          >
            Print Scorecards
          </button>

          <Link href="/supplier-quality-dashboard">
            Supplier Dashboard
          </Link>

          <Link href="/scar/dashboard">
            Governance
          </Link>
        </div>
      </div>

      <section style={sectionStyle}>
        <h2
          style={{
            marginTop: 0,
          }}
        >
          Executive Supplier KPIs
        </h2>

        <div style={kpiGridStyle}>
          <KpiCard
            title="Total Suppliers"
            value={rows.length}
            color="#2563eb"
          />

          <KpiCard
            title="Excellent Suppliers"
            value={excellentSuppliers}
            color="#15803d"
          />

          <KpiCard
            title="At Risk Suppliers"
            value={atRiskSuppliers}
            color="#dc2626"
          />

          <KpiCard
            title="Critical Suppliers"
            value={criticalSuppliers}
            color="#991b1b"
          />

          <KpiCard
            title="Open SCARs"
            value={totalOpenScars}
            color="#7c3aed"
          />

          <KpiCard
            title="Average Reject Rate"
            value={`${averageRejectRate}%`}
            color={
              Number(
                averageRejectRate
              ) > 10
                ? "#dc2626"
                : "#15803d"
            }
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <h2
              style={{
                marginTop: 0,
              }}
            >
              Supplier Intelligence
              Scorecards
            </h2>

            <p
              style={{
                color: "#4b5563",
                marginTop: 0,
              }}
            >
              Weighted supplier
              intelligence based on
              receiving inspection
              performance, NCMRs,
              SCARs, recurrence,
              supplier risk,
              and governance status.
            </p>
          </div>

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search supplier"
            style={searchInputStyle}
          />
        </div>

        <div
          style={{
            overflowX: "auto",
          }}
        >
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>
                  Supplier
                </th>

                <th style={thStyle}>
                  Status
                </th>

                <th style={thStyle}>
                  Risk
                </th>

                <th style={thStyle}>
                  Score
                </th>

                <th style={thStyle}>
                  Grade
                </th>

                <th style={thStyle}>
                  Reject %
                </th>

                <th style={thStyle}>
                  Inspections
                </th>

                <th style={thStyle}>
                  Approval %
                </th>

                <th style={thStyle}>
                  NCMRs
                </th>

                <th style={thStyle}>
                  Open NCMRs
                </th>

                <th style={thStyle}>
                  SCARs
                </th>

                <th style={thStyle}>
                  Open SCARs
                </th>

                <th style={thStyle}>
                  Recurrence
                </th>

                <th style={thStyle}>
                  High/Critical
                </th>

                <th style={thStyle}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={
                    row.supplier.id
                  }
                  style={stripedRowStyle(
                    index
                  )}
                >
                  <td style={tdStyle}>
                    <strong>
                      {
                        row.supplier
                          .supplier_name
                      }
                    </strong>

                    <div
                      style={
                        subTextStyle
                      }
                    >
                      {row.supplier
                        .supplier_number ||
                        "N/A"}
                    </div>
                  </td>

                  <td style={tdStyle}>
                    <StatusBadge
                      value={
                        row.supplier
                          .supplier_status ||
                        "unknown"
                      }
                    />
                  </td>

                  <td style={tdStyle}>
                    <RiskBadge
                      risk={
                        row.supplier
                          .supplier_risk_level ||
                        "low"
                      }
                    />
                  </td>

                  <td style={tdStyle}>
                    <strong>
                      {
                        row.qualityScore
                      }
                    </strong>
                  </td>

                  <td style={tdStyle}>
                    <GradeBadge
                      grade={
                        row.rating
                      }
                    />
                  </td>

                  <td style={tdStyle}>
                    <RejectRateBadge
                      value={
                        row.rejectRate
                      }
                    />
                  </td>

                  <td style={tdStyle}>
                    {
                      row.totalInspections
                    }
                  </td>

                  <td style={tdStyle}>
                    {
                      row.inspectionApprovalRate
                    }
                    %
                  </td>

                  <td style={tdStyle}>
                    {
                      row.totalNcmrs
                    }
                  </td>

                  <td style={tdStyle}>
                    {
                      row.openNcmrs
                    }
                  </td>

                  <td style={tdStyle}>
                    {
                      row.totalScars
                    }
                  </td>

                  <td style={tdStyle}>
                    {
                      row.openScars
                    }
                  </td>

                  <td style={tdStyle}>
                    {row.recurringDefects ? (
                      <span
                        style={{
                          color:
                            "#dc2626",
                          fontWeight: 700,
                        }}
                      >
                        Recurring
                      </span>
                    ) : (
                      "Stable"
                    )}
                  </td>

                  <td style={tdStyle}>
                    {
                      row.highCriticalIssues
                    }
                  </td>

                  <td style={tdStyle}>
                    <div
                      style={{
                        display:
                          "grid",
                        gap: "6px",
                      }}
                    >
                      <Link
                        href={`/supplier-quality/scorecards/${row.supplier.id}`}
                      >
                        Open
                        Scorecard
                      </Link>

                      <Link
                        href={`/suppliers/${row.supplier.id}`}
                      >
                        Supplier
                        Profile
                      </Link>

                      <Link href="/supplier-quality/receiving-inspections">
                        Receiving
                        Inspections
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function calculateQualityScore(
  input: {
    totalNcmrs: number;
    openNcmrs: number;
    totalScars: number;
    openScars: number;
    highCriticalIssues: number;
    supplierRisk:
      | string
      | null;
    supplierStatus:
      | string
      | null;
    rejectRate: number;
    recurringDefects: boolean;
  }
) {
  let score = 100;

  score -=
    input.openNcmrs * 4;

  score -=
    input.totalNcmrs * 1.5;

  score -=
    input.openScars * 8;

  score -=
    input.totalScars * 3;

  score -=
    input.highCriticalIssues *
    6;

  score -=
    input.rejectRate * 0.8;

  if (
    input.recurringDefects
  ) {
    score -= 10;
  }

  if (
    input.supplierRisk ===
    "critical"
  )
    score -= 20;

  if (
    input.supplierRisk ===
    "high"
  )
    score -= 12;

  if (
    input.supplierRisk ===
    "medium"
  )
    score -= 5;

  if (
    input.supplierStatus ===
    "probation"
  )
    score -= 15;

  if (
    input.supplierStatus ===
    "conditional"
  )
    score -= 8;

  if (
    input.supplierStatus ===
    "disqualified"
  )
    score -= 40;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(score)
    )
  );
}

function supplierGrade(
  score: number
) {
  if (score >= 90)
    return "A";

  if (score >= 80)
    return "B";

  if (score >= 65)
    return "C";

  if (score >= 45)
    return "D";

  return "F";
}

function KpiCard({
  title,
  value,
  color,
}: {
  title: string;
  value:
    | string
    | number;
  color: string;
}) {
  return (
    <div
      style={{
        borderRadius: "14px",
        padding: "18px",
        background: "white",
        border:
          "1px solid #e5e7eb",
        borderLeft: `6px solid ${color}`,
        boxShadow:
          "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          color: "#6b7280",
          fontSize: "13px",
          fontWeight: 700,
          marginBottom: "8px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "30px",
          fontWeight: 800,
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function GradeBadge({
  grade,
}: {
  grade: string;
}) {
  const map: any = {
    A: {
      bg: "#dcfce7",
      color: "#166534",
    },
    B: {
      bg: "#dbeafe",
      color: "#1d4ed8",
    },
    C: {
      bg: "#fef3c7",
      color: "#92400e",
    },
    D: {
      bg: "#ffedd5",
      color: "#c2410c",
    },
    F: {
      bg: "#fee2e2",
      color: "#991b1b",
    },
  };

  return (
    <span
      style={{
        padding:
          "5px 10px",
        borderRadius:
          "999px",
        background:
          map[grade]?.bg,
        color:
          map[grade]
            ?.color,
        fontWeight: 800,
      }}
    >
      {grade}
    </span>
  );
}

function RiskBadge({
  risk,
}: {
  risk: string;
}) {
  const normalized =
    risk.toLowerCase();

  let background =
    "#dcfce7";
  let color = "#166534";

  if (
    normalized ===
    "medium"
  ) {
    background =
      "#fef3c7";
    color = "#92400e";
  }

  if (
    normalized ===
    "high"
  ) {
    background =
      "#ffedd5";
    color = "#c2410c";
  }

  if (
    normalized ===
    "critical"
  ) {
    background =
      "#fee2e2";
    color = "#991b1b";
  }

  return (
    <span
      style={{
        padding:
          "5px 10px",
        borderRadius:
          "999px",
        background,
        color,
        fontWeight: 700,
      }}
    >
      {risk}
    </span>
  );
}

function StatusBadge({
  value,
}: {
  value: string;
}) {
  return (
    <span
      style={{
        padding:
          "5px 10px",
        borderRadius:
          "999px",
        background:
          "#f3f4f6",
        color: "#374151",
        fontWeight: 700,
      }}
    >
      {value}
    </span>
  );
}

function RejectRateBadge({
  value,
}: {
  value: string;
}) {
  const numeric =
    Number(value);

  return (
    <span
      style={{
        color:
          numeric > 10
            ? "#dc2626"
            : "#15803d",
        fontWeight: 700,
      }}
    >
      {value}%
    </span>
  );
}

const headerStyle: React.CSSProperties =
  {
    display: "flex",
    justifyContent:
      "space-between",
    gap: "12px",
    alignItems:
      "flex-start",
    flexWrap: "wrap",
    marginBottom: "20px",
  };

const eyebrowStyle: React.CSSProperties =
  {
    fontSize: "12px",
    letterSpacing:
      "0.08em",
    color: "#6b7280",
    fontWeight: 800,
  };

const sectionStyle: React.CSSProperties =
  {
    border:
      "1px solid #d1d5db",
    borderRadius: "14px",
    padding: "18px",
    marginBottom: "20px",
    background: "white",
  };

const kpiGridStyle: React.CSSProperties =
  {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  };

const tableStyle: React.CSSProperties =
  {
    width: "100%",
    borderCollapse:
      "collapse",
    minWidth: "1650px",
  };

const thStyle: React.CSSProperties =
  {
    border:
      "1px solid #d1d5db",
    padding: "10px",
    background: "#f3f4f6",
    textAlign: "left",
    fontSize: "13px",
  };

const tdStyle: React.CSSProperties =
  {
    border:
      "1px solid #d1d5db",
    padding: "10px",
    fontSize: "13px",
    verticalAlign:
      "top",
  };

const searchInputStyle: React.CSSProperties =
  {
    padding: "10px",
    width: "300px",
    borderRadius: "8px",
    border:
      "1px solid #d1d5db",
  };

const subTextStyle: React.CSSProperties =
  {
    color: "#6b7280",
    fontSize: "12px",
    marginTop: "4px",
  };

const primaryButtonStyle: React.CSSProperties =
  {
    padding: "10px 14px",
    background: "#2563eb",
    color: "white",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
  };

const stripedRowStyle = (
  index: number
): React.CSSProperties => ({
  background:
    index % 2 === 0
      ? "#ffffff"
      : "#f9fafb",
});
