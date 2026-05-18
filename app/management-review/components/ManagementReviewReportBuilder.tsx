"use client";

export type ReportConfig = {
  executiveSummary: boolean;
  capaPerformance: boolean;
  capaEffectiveness: boolean;
  scarPerformance: boolean;
  supplierQuality: boolean;
  auditPerformance: boolean;
  oosPerformance: boolean;
  escalationQueues: boolean;
  trendCharts: boolean;
  executiveNotifications: boolean;
  recurrenceAnalysis: boolean;
};

export default function ManagementReviewReportBuilder({
  config,
  setConfig,
}: {
  config: ReportConfig;
  setConfig: React.Dispatch<React.SetStateAction<ReportConfig>>;
}) {
  const toggle = (key: keyof ReportConfig) => {
    setConfig((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <section
      style={{
        border: "1px solid #d1d5db",
        borderRadius: "10px",
        padding: "20px",
        background: "white",
        marginBottom: "20px",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Management Review Report Builder</h2>

      <p style={{ color: "#4b5563" }}>
        Select which sections should appear in the generated management review report.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "12px",
          marginTop: "16px",
        }}
      >
        <Checkbox label="Executive Summary" checked={config.executiveSummary} onChange={() => toggle("executiveSummary")} />

        <Checkbox label="CAPA Performance" checked={config.capaPerformance} onChange={() => toggle("capaPerformance")} />

        <Checkbox label="CAPA Effectiveness" checked={config.capaEffectiveness} onChange={() => toggle("capaEffectiveness")} />

        <Checkbox label="SCAR Performance" checked={config.scarPerformance} onChange={() => toggle("scarPerformance")} />

        <Checkbox label="Supplier Quality" checked={config.supplierQuality} onChange={() => toggle("supplierQuality")} />

        <Checkbox label="Audit Performance" checked={config.auditPerformance} onChange={() => toggle("auditPerformance")} />

        <Checkbox label="OOS/OOT Performance" checked={config.oosPerformance} onChange={() => toggle("oosPerformance")} />

        <Checkbox label="Escalation Queues" checked={config.escalationQueues} onChange={() => toggle("escalationQueues")} />

        <Checkbox label="Trend Charts" checked={config.trendCharts} onChange={() => toggle("trendCharts")} />

        <Checkbox label="Executive Notifications" checked={config.executiveNotifications} onChange={() => toggle("executiveNotifications")} />

        <Checkbox label="Recurrence Analysis" checked={config.recurrenceAnalysis} onChange={() => toggle("recurrenceAnalysis")} />
      </div>
    </section>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px",
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        background: checked ? "#eff6ff" : "white",
        cursor: "pointer",
      }}
    >
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
