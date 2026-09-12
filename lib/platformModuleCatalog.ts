export type PlatformModuleDefinition = {
  code: string;
  label: string;
  group: "Quality Management" | "Analytics & Governance";
};

export const PLATFORM_MODULE_CATALOG: PlatformModuleDefinition[] = [
  { code: "capa", label: "CAPA", group: "Quality Management" },
  { code: "ncmr", label: "NCMR", group: "Quality Management" },
  { code: "change_control", label: "Change Control", group: "Quality Management" },
  { code: "controlled_documents", label: "Controlled Documents", group: "Quality Management" },
  { code: "training", label: "Training", group: "Quality Management" },
  { code: "scar", label: "SCAR", group: "Quality Management" },
  { code: "complaints", label: "Complaints", group: "Quality Management" },
  { code: "audit_management", label: "Audit Management", group: "Quality Management" },
  { code: "oos_oot", label: "OOS / OOT", group: "Quality Management" },
  { code: "suppliers", label: "Suppliers", group: "Quality Management" },
  { code: "equipment", label: "Equipment", group: "Quality Management" },
  { code: "executive_dashboard", label: "Executive Dashboard", group: "Analytics & Governance" },
  { code: "management_review", label: "Management Review", group: "Analytics & Governance" },
  { code: "kpi_reports", label: "KPI Reports", group: "Analytics & Governance" },
  { code: "audit_trail", label: "Audit Trail", group: "Analytics & Governance" },
];

export const PLATFORM_MODULE_CODES = PLATFORM_MODULE_CATALOG.map((module) => module.code);
