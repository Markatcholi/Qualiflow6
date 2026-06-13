"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type DashboardMetric = {
  label: string;
  value: number | string;
};

export default function NcmrDashboardPage() {
  const [loading, setLoading] = useState(true);

  const [metrics, setMetrics] = useState<DashboardMetric[]>([
    { label: "Total NCMRs", value: 0 },
    { label: "Open NCMRs", value: 0 },
    { label: "Closed NCMRs", value: 0 },
    { label: "CAPA Evaluation Required", value: 0 },
    { label: "Recurring Issues", value: 0 },
    { label: "Supplier SCAR Required", value: 0 },
    { label: "Critical NCMRs", value: 0 },
  ]);

  const cardStyle: React.CSSProperties = {
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    padding: "16px",
    background: "white",
  };

  const loadDashboard = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("ncmrs")
      .select("*");

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const ncmrs = data || [];

    setMetrics([
      {
        label: "Total NCMRs",
        value: ncmrs.length,
      },
      {
        label: "Open NCMRs",
        value: ncmrs.filter(
          (item) => item.status !== "closed"
        ).length,
      },
      {
        label: "Closed NCMRs",
        value: ncmrs.filter(
          (item) => item.status === "closed"
        ).length,
      },
      {
        label: "CAPA Evaluation Required",
        value: ncmrs.filter(
          (item) => item.capa_required === true
        ).length,
      },
      {
        label: "Recurring Issues",
        value: ncmrs.filter(
          (item) => item.recurring_issue === true
        ).length,
      },
      {
        label: "Supplier SCAR Required",
        value: ncmrs.filter(
          (item) => item.supplier_capa_required === true
        ).length,
      },
      {
        label: "Critical NCMRs",
        value: ncmrs.filter(
          (item) => item.severity === "critical"
        ).length,
      },
    ]);

    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <main
      style={{
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>
            NCMR Dashboard
          </h1>

          <p
            style={{
              marginTop: "8px",
              color: "#6b7280",
            }}
          >
            NCMR performance metrics and quality indicators.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
          }}
        >
          <a
            href="/ncmrs"
            style={{
              padding: "10px 16px",
              background: "#2563eb",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            Back to NCMRs
          </a>
        </div>
      </div>

      {loading ? (
        <div>Loading dashboard...</div>
      ) : (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            {metrics.map((metric) => (
              <div
                key={metric.label}
                style={cardStyle}
              >
                <div
                  style={{
                    fontSize: "14px",
                    color: "#6b7280",
                    marginBottom: "8px",
                  }}
                >
                  {metric.label}
                </div>

                <div
                  style={{
                    fontSize: "32px",
                    fontWeight: "bold",
                  }}
                >
                  {metric.value}
                </div>
              </div>
            ))}
          </section>

          <section
            style={{
              border: "1px solid #d1d5db",
              borderRadius: "10px",
              padding: "20px",
              background: "white",
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              Dashboard Summary
            </h2>

            <p>
              This dashboard summarizes NCMR activity,
              recurrence trends, CAPA evaluation needs,
              supplier-related quality events, and
              critical nonconformances.
            </p>

            <p>
              Future enhancements:
            </p>

            <ul>
              <li>NCMR aging charts</li>
              <li>NCMRs by department</li>
              <li>NCMRs by defect category</li>
              <li>Monthly trend analysis</li>
              <li>CAPA conversion metrics</li>
              <li>Supplier quality trends</li>
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
