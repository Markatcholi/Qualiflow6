type ConfiguredKpi = {
  kpi_key: string;
  kpi_name: string;
};

type KpiDisplayValue = {
  value: string | number;
  subtitle?: string;
  distribution?: {
    label: string;
    count: number;
  }[];
};

interface Props {
  configuredKpis: ConfiguredKpi[];
  values: Record<string, KpiDisplayValue>;
  title?: string;
}

export default function ChangeControlKpiSection({
  configuredKpis,
  values,
  title = "Change Control Performance",
}: Props) {
  if (configuredKpis.length === 0) return null;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <h2>{title}</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 16,
          marginTop: 16,
        }}
      >
        {configuredKpis.map((kpi) => {
          const metric = values[kpi.kpi_key];

          return (
            <div
              key={kpi.kpi_key}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  marginBottom: 8,
                }}
              >
                {kpi.kpi_name}
              </div>

              {metric?.distribution ? (
                <div>
                  {metric.distribution.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 700,
                    }}
                  >
                    {metric?.value ?? 0}
                  </div>

                  {metric?.subtitle && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                      }}
                    >
                      {metric.subtitle}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
