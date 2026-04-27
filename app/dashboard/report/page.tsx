"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function KpiReportPage() {
  const [ncmrs, setNcmrs] = useState<any[]>([]);
  const [capas, setCapas] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const ncmrRes = await supabase.from("ncmrs").select("*");
      const capaRes = await supabase.from("capas").select("*");

      if (ncmrRes.error) alert(ncmrRes.error.message);
      if (capaRes.error) alert(capaRes.error.message);

      setNcmrs(ncmrRes.data || []);
      setCapas(capaRes.data || []);
    };

    fetchData();
  }, []);

  const closedNcmrs = ncmrs.filter((x) => x.status === "closed");
  const closedCapas = capas.filter((x) => x.status === "closed");
  const openCapas = capas.filter((x) => x.status !== "closed");
  const supplierScars = capas.filter((x) => x.capa_type === "scar");

  const ncmrClosureRate =
    ncmrs.length > 0 ? ((closedNcmrs.length / ncmrs.length) * 100).toFixed(1) : "0.0";

  const capaClosureRate =
    capas.length > 0 ? ((closedCapas.length / capas.length) * 100).toFixed(1) : "0.0";

  return (
    <main style={{ padding: 30, fontFamily: "Arial, sans-serif" }}>
      <button onClick={() => window.print()} className="no-print">
        Print / Save as PDF
      </button>

      <h1>Monthly Quality KPI Summary</h1>
      <p><strong>Report Date:</strong> {new Date().toLocaleDateString()}</p>

      <h2>NCMR KPIs</h2>
      <p><strong>Total NCMRs:</strong> {ncmrs.length}</p>
      <p><strong>Closed NCMRs:</strong> {closedNcmrs.length}</p>
      <p><strong>NCMR Closure Rate:</strong> {ncmrClosureRate}%</p>
      <p><strong>Recurring NCMRs:</strong> {ncmrs.filter((x) => x.recurring_issue).length}</p>
      <p><strong>Supplier CAPA / SCAR Required NCMRs:</strong> {ncmrs.filter((x) => x.supplier_capa_required).length}</p>

      <h2>CAPA KPIs</h2>
      <p><strong>Total CAPAs:</strong> {capas.length}</p>
      <p><strong>Open CAPAs:</strong> {openCapas.length}</p>
      <p><strong>Closed CAPAs:</strong> {closedCapas.length}</p>
      <p><strong>CAPA Closure Rate:</strong> {capaClosureRate}%</p>
      <p><strong>Supplier SCARs:</strong> {supplierScars.length}</p>
      <p><strong>Not Effective CAPAs:</strong> {capas.filter((x) => x.effectiveness_rating === "not_effective").length}</p>
      <p><strong>Partially Effective CAPAs:</strong> {capas.filter((x) => x.effectiveness_rating === "partially_effective").length}</p>
      <p><strong>Effective CAPAs:</strong> {capas.filter((x) => x.effectiveness_rating === "effective").length}</p>

      <h2>Supplier Quality</h2>
      <ul>
        {Array.from(
          ncmrs.reduce((map, item) => {
            const supplier = item.supplier_name || "Unknown";
            if (supplier === "Unknown") return map;
            map.set(supplier, (map.get(supplier) || 0) + 1);
            return map;
          }, new Map<string, number>())
        )
          .sort((a: any, b: any) => b[1] - a[1])
          .slice(0, 10)
          .map(([supplier, count]: any) => (
            <li key={supplier}>
              {supplier}: {count} NCMR(s)
            </li>
          ))}
      </ul>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none;
          }
          body {
            color: black;
          }
        }
      `}</style>
    </main>
  );
}
