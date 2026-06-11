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
  validation_status?: string | null;
  validation_message?: string | null;
  last_calculated_at?: string | null;
  last_calculation_status?: string | null;
  last_calculation_message?: string | null;
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

const SUPPORTED_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "is_blank",
  "is_not_blank",
];

const normalize = (value: any) => String(value ?? "").trim().toLowerCase();

const getTableName = (definition: CustomKpiDefinition) =>
  definition.data_source || MODULE_TABLE_MAP[definition.module_name];

const updateCalculationStatus = async ({
  supabase,
  definition,
  status,
  message,
}: {
  supabase: SupabaseClient;
  definition: CustomKpiDefinition;
  status: "success" | "failed";
  message: string;
}) => {
  if (!definition.id) return;

  const updatePayload: any = {
    last_calculated_at: new Date().toISOString(),
    last_calculation_status: status,
    last_calculation_message: message,
  };

  if (status === "success") {
    updatePayload.validation_status = "valid";
    updatePayload.validation_message = null;
  } else {
    updatePayload.validation_status = "invalid";
    updatePayload.validation_message = message;
  }

  const { error } = await supabase
    .from("custom_kpi_definitions")
    .update(updatePayload)
    .eq("id", definition.id);

  if (error) {
    console.warn(`Unable to update KPI status for ${definition.kpi_key}: ${error.message}`);
  }
};

const validateDefinition = (definition: CustomKpiDefinition) => {
  const tableName = getTableName(definition);

  if (!tableName) {
    return `No data source is configured for module '${definition.module_name}'.`;
  }

  if ((definition.calculation_type || "count") !== "count") {
    return `Unsupported calculation type '${definition.calculation_type}'. Only 'count' is currently supported.`;
  }

  const operator = definition.filter_operator || "equals";

  if (!SUPPORTED_OPERATORS.includes(operator)) {
    return `Unsupported filter operator '${operator}'.`;
  }

  if (
    operator !== "is_blank" &&
    operator !== "is_not_blank" &&
    definition.filter_field?.trim() &&
    !String(definition.filter_value ?? "").trim()
  ) {
    return "Filter value is required when a filter field is provided.";
  }

  return null;
};

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

  const validDefinitionsByTable: Record<string, CustomKpiDefinition[]> = {};

  for (const definition of definitions) {
    const validationMessage = validateDefinition(definition);
    const tableName = getTableName(definition);

    if (validationMessage || !tableName) {
      const message = validationMessage || "Unable to determine KPI data source.";

      values[definition.kpi_key] = {
        value: 0,
        subtitle: message,
      };

      await updateCalculationStatus({
        supabase,
        definition,
        status: "failed",
        message,
      });

      continue;
    }

    if (!validDefinitionsByTable[tableName]) {
      validDefinitionsByTable[tableName] = [];
    }

    validDefinitionsByTable[tableName].push(definition);
  }

  for (const [tableName, tableDefinitions] of Object.entries(validDefinitionsByTable)) {
    const { data, error } = await supabase.from(tableName).select("*");

    if (error) {
      const message = `Unable to calculate custom KPI from ${tableName}: ${error.message}`;
      console.warn(message);

      for (const definition of tableDefinitions) {
        values[definition.kpi_key] = {
          value: 0,
          subtitle: "Unable to calculate",
        };

        await updateCalculationStatus({
          supabase,
          definition,
          status: "failed",
          message,
        });
      }

      continue;
    }

    const records = data || [];

    for (const definition of tableDefinitions) {
      try {
        const calculationType = definition.calculation_type || "count";

        if (calculationType !== "count") {
          const message = `Unsupported calculation type '${calculationType}'.`;

          values[definition.kpi_key] = {
            value: 0,
            subtitle: "Unsupported calculation type",
          };

          await updateCalculationStatus({
            supabase,
            definition,
            status: "failed",
            message,
          });

          continue;
        }

        const matchingRecords = records.filter((record: any) =>
          matchesFilter(record, definition),
        );

        values[definition.kpi_key] = {
          value: matchingRecords.length,
          subtitle: "Custom KPI",
        };

        await updateCalculationStatus({
          supabase,
          definition,
          status: "success",
          message: `Calculated successfully from ${tableName}.`,
        });
      } catch (error: any) {
        const message = error?.message || "Unexpected error calculating custom KPI.";

        values[definition.kpi_key] = {
          value: 0,
          subtitle: "Unable to calculate",
        };

        await updateCalculationStatus({
          supabase,
          definition,
          status: "failed",
          message,
        });
      }
    }
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
