"use client";

import { DashboardSection } from "./DashboardComponents";

export default function QuickActionsSection() {
  return (
    <DashboardSection title="Quick Actions">
      <a href="/ncmrs">NCMRs</a>{" | "}
      <a href="/capa">CAPAs</a>{" | "}
      <a href="/oos-oot">OOS/OOT</a>{" | "}
      <a href="/audits">Audits</a>{" | "}
      <a href="/management-review">Management Review</a>{" | "}
      <a href="/management-review/print">Create MR Report</a>{" | "}
      <a href="/audit">Audit Trail</a>{" | "}
      <a href="/admin/master-data">Admin Master Data</a>
    </DashboardSection>
  );
}
