"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type TrendItem = {
  label: string;
  count: number;
};

export default function DashboardPage() {
  const [ncmrOpen, setNcmrOpen] = useState(0);
  const [ncmrInvestigation, setNcmrInvestigation] = useState(0);
  const [capaOpen, setCapaOpen] = useState(0);
  const [capaOverdue, setCapaOverdue] = useState(0);

  const [ncmrTotal, setNcmrTotal] = useState(0);
  const [ncmrClosed, setNcmrClosed] = useState(0);
  const [capaTotal, setCapaTotal] = useState(0);
  const [capaClosed, setCapaClosed] = useState(0);

  const [avgNcmrCloseDays, setAvgNcmrCloseDays] = useState("0.0");
  const [avgCapaCloseDays, setAvgCapaCloseDays] = useState("0.0");

  const [capaOverdueRate, setCapaOverdueRate] = useState("0.0");
  const [capaDueSoon, setCapaDueSoon] = useState(0);

  const [ncmrTrend, setNcmrTrend] = useState<TrendItem[]>([]);
  const [capaTrend, setCapaTrend] = useState<TrendItem[]>([]);

  const getLast6Months = () => {
    const months: { key: string; label: string }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${year}-${month}`;
      const label = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
      months.push({ key, label });
    }

    return months;
  };

  const buildTrend = (items: any[]) => {
    const months = getLast6Months();
    const counts: Record<string, number> = {};

    months.forEach((m) => {
      counts[m.key] = 0;
    });

    items.forEach((item) => {
      if (!item.created_at) return;
      const d = new Date(item.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (counts[key] !== undefined) {
        counts[key] += 1;
      }
    });

    return months.map((m) => ({
      label: m.label,
      count: counts[m.key],
    }));
  };

  const fetchData = async () => {
    const { data: ncmrAllData, error: ncmrAllError } = await supabase
      .from("ncmrs")
      .select("*");

    if (ncmrAllError) {
      alert(ncmrAllError.message);
      return;
    }

    const allNcmrs = ncmrAllData || [];
    setNcmrTotal(allNcmrs.length);

    const closedNcmrs = allNcmrs.filter((item: any) => item.status === "closed");
    setNcmrClosed(closedNcmrs.length);

    const openNcmrs = allNcmrs.filter((item: any) => item.status === "open");
    setNcmrOpen(openNcmrs.length);

    const investigationNcmrs = allNcmrs.filter(
      (item: any) => item.status === "investigation"
    );
    setNcmrInvestigation(investigationNcmrs.length);

    const ncmrDurations = closedNcmrs
      .filter((item: any) => item.created_at && item.closed_at)
      .map((item: any) => {
        const created = new Date(item.created_at).getTime();
        const closed = new Date(item.closed_at).getTime();
        return (closed - created) / (1000 * 60 * 60 * 24);
      });

    if (ncmrDurations.length > 0) {
      const avg =
        ncmrDurations.reduce((sum: number, d: number) => sum + d, 0) /
        ncmrDurations.length;
      setAvgNcmrCloseDays(avg.toFixed(1));
    } else {
      setAvgNcmrCloseDays("0.0");
    }

    setNcmrTrend(buildTrend(allNcmrs));

    const { data: capaAllData, error: capaAllError } = await supabase
      .from("capas")
      .select("*");

    if (capaAllError) {
      alert(capaAllError.message);
      return;
    }

    const allCapas = capaAllData || [];
    setCapaTotal(allCapas.length);

    const closedCapas = allCapas.filter((item: any) => item.status === "closed");
    setCapaClosed(closedCapas.length);

    const activeCapas = allCapas.filter((item: any) => item.status !== "closed");
    setCapaOpen(activeCapas.length);

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const overdueCapas = activeCapas.filter((item: any) => {
      return item.due_date && item.due_date < todayStr;
    });
    setCapaOverdue(overdueCapas.length);

    const overdueRate =
      activeCapas.length > 0
        ? ((overdueCapas.length / activeCapas.length) * 100).toFixed(1)
        : "0.0";
    setCapaOverdueRate(overdueRate);

    const next7 = new Date();
    next7.setDate(today.getDate() + 7);
    const next7Str = next7.toISOString().split("T")[0];

    const dueSoonCapas = activeCapas.filter((item: any) => {
      return item.due_date && item.due_date >= todayStr && item.due_date <= next7Str;
    });
    setCapaDueSoon(dueSoonCapas.length);

    const capaDurations = closedCapas
      .filter((item: any) => item.created_at && item.closed_at)
      .map((item: any) => {
        const created = new Date(item.created_at).getTime();
        const closed = new Date(item.closed_at).getTime();
        return (closed - created) / (1000 * 60 * 60 * 24);
      });

    if (capaDurations.length > 0) {
      const avg =
        capaDurations.reduce((sum: number, d: number) => sum + d, 0) /
        capaDurations.length;
      setAvgCapaCloseDays(avg.toFixed(1));
    } else {
      setAvgCapaCloseDays("0.0");
    }

    setCapaTrend(buildTrend(allCapas));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const ncmrClosureRate =
    ncmrTotal > 0 ? ((ncmrClosed / ncmrTotal) * 100).toFixed(1) : "0.0";

  const capaClosureRate =
    capaTotal > 0 ? ((capaClosed / capaTotal) * 100).toFixed(1) : "0.0";

  const renderTrend = (title: string, data: TrendItem[]) => {
    const max = Math.max(...data.map((d) => d.count), 1);

    return (
      <div style={{ padding: "15px", border: "1px solid #ccc" }}>
        <strong>{title}</strong>
        <div style={{ marginTop: "10px" }}>
          {data.map((item) => (
            <div key={item.label} style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "14px", marginBottom: "4px" }}>
                {item.label}: {item.count}
              </div>
              <div
                style={{
                  background: "#eee",
                  height: "12px",
                  width: "100%",
                  maxWidth: "300px",
                }}
              >
                <div
                  style={{
                    background: "#3b82f6",
                    height: "12px",
                    width: `${(item.count / max) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Quality Dashboard</h1>

      <div style={{ display: "grid", gap: "15px", maxWidth: "700px" }}>
        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>Total NCMRs:</strong> {ncmrTotal}
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>Open NCMRs:</strong> {ncmrOpen}
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>NCMRs in Investigation:</strong> {ncmrInvestigation}
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>Closed NCMRs:</strong> {ncmrClosed}
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>NCMR Closure Rate:</strong> {ncmrClosureRate}%
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>Average NCMR Close Time:</strong> {avgNcmrCloseDays} days
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>Total CAPAs:</strong> {capaTotal}
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>Active CAPAs:</strong> {capaOpen}
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>Closed CAPAs:</strong> {capaClosed}
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>CAPA Closure Rate:</strong> {capaClosureRate}%
        </div>

        <div style={{ padding: "15px", border: "1px solid #ccc" }}>
          <strong>Average CAPA Close Time:</strong> {avgCapaCloseDays} days
        </div>

        <div style={{ padding: "15px", border: "1px solid red" }}>
          <strong>Overdue CAPAs:</strong> {capaOverdue}
        </div>

        <div style={{ padding: "15px", border: "1px solid #cc8800" }}>
          <strong>Overdue CAPA Rate:</strong> {capaOverdueRate}%
        </div>

        <div style={{ padding: "15px", border: "1px solid #cc8800" }}>
          <strong>CAPAs Due in Next 7 Days:</strong> {capaDueSoon}
        </div>

        {renderTrend("NCMR Monthly Trend (Last 6 Months)", ncmrTrend)}
        {renderTrend("CAPA Monthly Trend (Last 6 Months)", capaTrend)}
      </div>

      <div style={{ marginTop: "20px" }}>
        <a href="/ncmrs">Go to NCMRs</a>
        {" | "}
        <a href="/capa">Go to CAPAs</a>
        {" | "}
        <a href="/audit">Go to Audit Trail</a>
        {" | "}
        <a href="/admin/master-data">Admin Master Data</a>
      </div>
    </main>
  );
}
