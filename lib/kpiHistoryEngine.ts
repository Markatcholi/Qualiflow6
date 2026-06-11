import { SupabaseClient } from "@supabase/supabase-js";

type KpiHistoryInput = {
  company_name: string;
  module_name?: string | null;
  kpi_key: string;
  kpi_name: string;
  kpi_source?: "default" | "custom";
  kpi_value?: number | string | null;
};

const toNumericValue = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const currentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export async function captureKpiHistory({
  supabase,
  kpis,
}: {
  supabase: SupabaseClient;
  kpis: KpiHistoryInput[];
}) {
  if (!kpis.length) return;

  const rows = kpis.map((kpi) => ({
    company_name: kpi.company_name,
    module_name: kpi.module_name || null,
    kpi_key: kpi.kpi_key,
    kpi_name: kpi.kpi_name,
    kpi_source: kpi.kpi_source || "default",
    kpi_value: toNumericValue(kpi.kpi_value),
    kpi_value_text:
      kpi.kpi_value === null || kpi.kpi_value === undefined
        ? null
        : String(kpi.kpi_value),
    captured_period: currentPeriod(),
  }));

  const { error } = await supabase.from("kpi_history").insert(rows);

  if (error) {
    console.warn(`Unable to capture KPI history: ${error.message}`);
  }
}

export async function fetchKpiHistory({
  supabase,
  companyName,
  kpiKey,
  months = 6,
}: {
  supabase: SupabaseClient;
  companyName: string;
  kpiKey: string;
  months?: number;
}) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const { data, error } = await supabase
    .from("kpi_history")
    .select("*")
    .eq("company_name", companyName)
    .eq("kpi_key", kpiKey)
    .gte("captured_at", since.toISOString())
    .order("captured_at", { ascending: true });

  if (error) {
    console.warn(`Unable to fetch KPI history: ${error.message}`);
    return [];
  }

  return data || [];
}
