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
  age_date_field?: string | null;
  close_date_field?: string | null;
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
  complaint: "complaints",
  ncmr: "ncmrs",
  capa: "capas",
  audit: "audits",
  scar: "scars",
  document_control: "controlled_documents",
  training: "training_assignments",
  oos_oot: "oos_oot_investigations",
};

/**
 * Older custom KPI records may have data_source saved as the module name
 * instead of the real database table name.
 *
 * Example:
 *   data_source = "change_control"
 * Actual table:
 *   change_controls
 *
 * This resolver maps both module_name and data_source to the correct table.
 */
const resolveTableName = (definition: CustomKpiDefinition) => {
  const dataSource = definition.data_source?.trim();
  const moduleName = definition.module_name?.trim();

  if (dataSource && MODULE_TABLE_MAP[dataSource]) {
    return MODULE_TABLE_MAP[dataSource];
  }

  if (moduleName && MODULE_TABLE_MAP[moduleName]) {
    return MODULE_TABLE_MAP[moduleName];
  }

  if (dataSource) {
    return dataSource;
  }

  return moduleName || "";
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

const daysBetween = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  return (
    (endDate.getTime() - startDate.getTime()) /
    (1000 * 60 * 60 * 24)
  );
};

const getOpenAgeRecords = ({
  records,
  ageField,
  closeField,
}: {
  records: any[];
  ageField: string;
  closeField: string;
}) => {
  return records.filter((record: any) => {
    const hasAgeDate = Boolean(record[ageField]);
    const isClosed = Boolean(record[closeField]);

    return hasAgeDate && !isClosed;
  });
};

const updateKpiCalculationStatus = async ({
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

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("custom_kpi_definitions")
    .update({
      validation_status: status === "success" ? "valid" : "invalid",
      validation_message: message,
      last_calculated_at: now,
      last_calculation_status: status,
      last_calculation_message: message,
    })
    .eq("id", definition.id);

  if (error) {
    console.warn(`Unable to update KPI calculation status: ${error.message}`);
  }
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
    const tableName = resolveTableName(definition);

    if (!tableName) {
      values[definition.kpi_key] = {
        value: 0,
        subtitle: "Missing data source",
      };
      return;
    }

    if (!definitionsByTable[tableName]) {
      definitionsByTable[tableName] = [];
    }

    definitionsByTable[tableName].push(definition);
  });

  for (const [tableName, tableDefinitions] of Object.entries(definitionsByTable)) {
    const { data, error } = await supabase.from(tableName).select("*");

    if (error) {
      const message = `Unable to calculate custom KPI from ${tableName}: ${error.message}`;
      console.warn(message);

      for (const definition of tableDefinitions) {
        values[definition.kpi_key] = {
          value: 0,
          subtitle: "Unable to calculate",
        };

        await updateKpiCalculationStatus({
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
      const calculationType = definition.calculation_type || "count";
      const field = definition.filter_field?.trim();

      if (field && records.length > 0 && !(field in records[0])) {
        const message = `Field '${field}' was not found in table '${tableName}'. Use the database column name, not the UI label.`;

        values[definition.kpi_key] = {
          value: 0,
          subtitle: "Invalid filter field",
        };

        await updateKpiCalculationStatus({
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

      if (calculationType === "count") {
        values[definition.kpi_key] = {
          value: matchingRecords.length,
          subtitle: "Custom KPI",
        };

        await updateKpiCalculationStatus({
          supabase,
          definition,
          status: "success",
          message: `Calculated successfully from ${tableName}.`,
        });

        continue;
      }

      if (calculationType === "average_open_age") {
        const ageField = definition.age_date_field || "created_at";
        const closeField = definition.close_date_field || "closed_at";

        if (records.length > 0 && !(ageField in records[0])) {
          const message = `Age date field '${ageField}' was not found in table '${tableName}'.`;

          values[definition.kpi_key] = {
            value: 0,
            subtitle: "Invalid age field",
          };

          await updateKpiCalculationStatus({
            supabase,
            definition,
            status: "failed",
            message,
          });

          continue;
        }

        const openRecords = getOpenAgeRecords({
          records: matchingRecords,
          ageField,
          closeField,
        });

        const ages = openRecords
          .map((record: any) =>
            daysBetween(record[ageField], new Date().toISOString()),
          )
          .filter((age): age is number => age !== null && age >= 0);

        const average =
          ages.length > 0
            ? ages.reduce((sum, age) => sum + age, 0) / ages.length
            : 0;

        values[definition.kpi_key] = {
          value: Number(average.toFixed(1)),
          subtitle: "Days",
        };

        await updateKpiCalculationStatus({
          supabase,
          definition,
          status: "success",
          message: `Calculated average open age from ${tableName}.`,
        });

        continue;
      }

      if (calculationType === "average_closure_time") {
        const startField = definition.age_date_field || "created_at";
        const endField = definition.close_date_field || "closed_at";

        if (records.length > 0 && !(startField in records[0])) {
          const message = `Start date field '${startField}' was not found in table '${tableName}'.`;

          values[definition.kpi_key] = {
            value: 0,
            subtitle: "Invalid start field",
          };

          await updateKpiCalculationStatus({
            supabase,
            definition,
            status: "failed",
            message,
          });

          continue;
        }

        if (records.length > 0 && !(endField in records[0])) {
          const message = `Close date field '${endField}' was not found in table '${tableName}'.`;

          values[definition.kpi_key] = {
            value: 0,
            subtitle: "Invalid close field",
          };

          await updateKpiCalculationStatus({
            supabase,
            definition,
            status: "failed",
            message,
          });

          continue;
        }

        const durations = matchingRecords
          .filter((record: any) => record[startField] && record[endField])
          .map((record: any) => daysBetween(record[startField], record[endField]))
          .filter((duration): duration is number => duration !== null && duration >= 0);

        const average =
          durations.length > 0
            ? durations.reduce((sum, duration) => sum + duration, 0) /
              durations.length
            : 0;

        values[definition.kpi_key] = {
          value: Number(average.toFixed(1)),
          subtitle: "Days",
        };

        await updateKpiCalculationStatus({
          supabase,
          definition,
          status: "success",
          message: `Calculated average closure time from ${tableName}.`,
        });

        continue;
      }

      if (calculationType === "max_age") {
        const ageField = definition.age_date_field || "created_at";
        const closeField = definition.close_date_field || "closed_at";

        if (records.length > 0 && !(ageField in records[0])) {
          const message = `Age date field '${ageField}' was not found in table '${tableName}'.`;

          values[definition.kpi_key] = {
            value: 0,
            subtitle: "Invalid age field",
          };

          await updateKpiCalculationStatus({
            supabase,
            definition,
            status: "failed",
            message,
          });

          continue;
        }

        const openRecords = getOpenAgeRecords({
          records: matchingRecords,
          ageField,
          closeField,
        });

        const ages = openRecords
          .map((record: any) =>
            daysBetween(record[ageField], new Date().toISOString()),
          )
          .filter((age): age is number => age !== null && age >= 0);

        const maxAge = ages.length > 0 ? Math.max(...ages) : 0;

        values[definition.kpi_key] = {
          value: Number(maxAge.toFixed(1)),
          subtitle: "Days",
        };

        await updateKpiCalculationStatus({
          supabase,
          definition,
          status: "success",
          message: `Calculated max age from ${tableName}.`,
        });

        continue;
      }

      const message = `Unsupported calculation type: ${calculationType}`;

      values[definition.kpi_key] = {
        value: 0,
        subtitle: "Unsupported calculation type",
      };

      await updateKpiCalculationStatus({
        supabase,
        definition,
        status: "failed",
        message,
      });
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
