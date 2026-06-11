import { SupabaseClient } from "@supabase/supabase-js";

export type CustomKpiDefinition = {
  id?: string;
  company_name: string;
  module_name: string;
  kpi_key: string;
  kpi_name: string;
  kpi_description?: string | null;
  kpi_category?: string | null;
  data_source?: string | null;
  calculation_type: string;
  filter_field?: string | null;
  filter_operator?: string | null;
  filter_value?: string | null;
  display_type?: string | null;
  executive_dashboard?: boolean | null;
  management_review?: boolean | null;
  display_order?: number | null;
  active?: boolean | null;
};

export type ConfiguredCustomKpi = {
  kpi_key: string;
  kpi_name: string;
  kpi_category: string | null;
  calculation_type: string | null;
  display_order: number | null;
  source: "custom";
};

export type CustomKpiDisplayValue = {
  value: string | number;
  subtitle?: string;
};

const MODULE_TABLE_MAP: Record<string, string> = {
  change_control: "change_controls",
  ncmr: "ncmrs",
  capa: "capas",
  audit: "audits",
  scar: "scars",
  document_control: "controlled_documents",
  training: "training_assignments",
  oos_oot: "oos_oot_investigations",
};

const normalize = (value: any) => String(value ?? "").trim().toLowerCase();

const matchesFilter = (record: any, definition: CustomKpiDefinition) => {
  const field = definition.filter_field?.trim();
  const operator = definition.filter_operator || "equals";
  const expected = normalize(definition.filter_value);

  if (!field) return true;

  const actual = normalize(record[field]);

  if (operator === "equals") return actual === expected;
  if (operator === "not_equals") return actual !== expected;
  if (operator === "contains") return actual.includes(expected);
  if (operator === "not_contains") return !actual.includes(expected);
  if (operator === "is_blank") return actual.length === 0;
  if (operator === "is_not_blank") return actual.length > 0;

  return actual === expected;
};

export async function fetchCustomKpiDefinitions({
  supabase,
  companyName,
  target,
  moduleName,
}: {
  supabase: SupabaseClient;
  companyName: string;
  target: "executive_dashboard" | "management_review";
  moduleName?: string;
}) {
  let query = supabase
    .from("custom_kpi_definitions")
    .select("*")
    .eq("company_name", companyName || "Default Company")
    .eq("active", true)
    .eq(target, true)
    .order("display_order", { ascending: true });

  if (moduleName) {
    query = query.eq("module_name", moduleName);
  }

  const { data, error } = await query;

  if (error) {
    console.warn(error.message);
    return [] as CustomKpiDefinition[];
  }

  return (data || []) as CustomKpiDefinition[];
}

export async function calculateCustomKpiValues({
  supabase,
  definitions,
}: {
  supabase: SupabaseClient;
  definitions: CustomKpiDefinition[];
}) {
  const values: Record<string, CustomKpiDisplayValue> = {};

  const definitionsByTable: Record<string, CustomKpiDefinition[]> = {};

  definitions.forEach((definition) => {
    const tableName =
      definition.data_source || MODULE_TABLE_MAP[definition.module_name];

    if (!tableName) return;

    if (!definitionsByTable[tableName]) {
      definitionsByTable[tableName] = [];
    }

    definitionsByTable[tableName].push(definition);
  });

  for (const [tableName, tableDefinitions] of Object.entries(definitionsByTable)) {
    const { data, error } = await supabase.from(tableName).select("*");

    if (error) {
      console.warn(`Unable to calculate custom KPI from ${tableName}: ${error.message}`);
      tableDefinitions.forEach((definition) => {
        values[definition.kpi_key] = {
          value: 0,
          subtitle: "Unable to calculate",
        };
      });
      continue;
    }

    const records = data || [];

    tableDefinitions.forEach((definition) => {
      const calculationType = definition.calculation_type || "count";

      if (calculationType !== "count") {
        values[definition.kpi_key] = {
          value: 0,
          subtitle: "Unsupported calculation type",
        };
        return;
      }

      const matchingRecords = records.filter((record: any) =>
        matchesFilter(record, definition),
      );

      values[definition.kpi_key] = {
        value: matchingRecords.length,
        subtitle: "Custom KPI",
      };
    });
  }

  return values;
}

export function mapCustomDefinitionsToConfiguredKpis(
  definitions: CustomKpiDefinition[],
): ConfiguredCustomKpi[] {
  return definitions
    .map((definition) => ({
      kpi_key: definition.kpi_key,
      kpi_name: definition.kpi_name,
      kpi_category: definition.kpi_category || "Custom",
      calculation_type: definition.calculation_type || "count",
      display_order: definition.display_order || 100,
      source: "custom" as const,
    }))
    .sort(
      (a, b) => Number(a.display_order || 100) - Number(b.display_order || 100),
    );
}
