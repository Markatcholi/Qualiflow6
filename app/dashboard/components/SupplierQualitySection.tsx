"use client";
import { DashboardSection, KpiCard, SupplierCount, getStatusColor, gridStyle } from "./DashboardComponents";

export default function SupplierQualitySection({
  supplierScarRequired,
  openSupplierCapas,
  openScars,
  topSuppliers,
}: {
  supplierScarRequired: number; openSupplierCapas: number; openScars: number; topSuppliers: SupplierCount[];
}) {
  return (
    <DashboardSection title="Supplier Quality">
      <div style={gridStyle}>
        <KpiCard title="Supplier CAPA / SCAR Required NCMRs" value={supplierScarRequired} color={getStatusColor(supplierScarRequired, "warning")} />
        <KpiCard title="Open Supplier CAPAs" value={openSupplierCapas} color={getStatusColor(openSupplierCapas, "warning")} />
        <KpiCard title="Open SCARs" value={openScars} color={getStatusColor(openScars, "warning")} />
      </div>
      <div style={{ marginTop: "12px" }}>
        <strong>Top Suppliers by NCMR Count</strong>
        {topSuppliers.length === 0 ? (
          <p>No supplier NCMR data yet.</p>
        ) : (
          <ol>
            {topSuppliers.map((item) => (
              <li key={item.supplier}>{item.supplier}: {item.count}</li>
            ))}
          </ol>
        )}
      </div>
    </DashboardSection>
  );
}
