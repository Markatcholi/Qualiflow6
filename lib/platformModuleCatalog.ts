export type PlatformModuleDefinition = {
  code: string;
  label: string;
  group: "Quality Management" | "Analytics & Governance";
  supportsApprovalMatrix?: boolean;
};

export const PLATFORM_MODULE_CATALOG: PlatformModuleDefinition[] = [
  { code: "capa", label: "CAPA", group: "Quality Management", supportsApprovalMatrix: true },
  { code: "ncmr", label: "NCMR", group: "Quality Management", supportsApprovalMatrix: true },
  { code: "change_control", label: "Change Control", group: "Quality Management", supportsApprovalMatrix: true },
  { code: "controlled_documents", label: "Controlled Documents", group: "Quality Management", supportsApprovalMatrix: true },
  { code: "training", label: "Training", group: "Quality Management", supportsApprovalMatrix: true },
  { code: "scar", label: "SCAR", group: "Quality Management", supportsApprovalMatrix: true },
  { code: "complaints", label: "Complaints", group: "Quality Management", supportsApprovalMatrix: true },
  { code: "audit_management", label: "Audit Management", group: "Quality Management", supportsApprovalMatrix: true },
  { code: "oos_oot", label: "OOS / OOT", group: "Quality Management", supportsApprovalMatrix: true },
  { code: "suppliers", label: "Suppliers", group: "Quality Management", supportsApprovalMatrix: true },
  { code: "equipment", label: "Equipment", group: "Quality Management", supportsApprovalMatrix: true },
  { code: "executive_dashboard", label: "Executive Dashboard", group: "Analytics & Governance" },
  { code: "management_review", label: "Management Review", group: "Analytics & Governance", supportsApprovalMatrix: true },
  { code: "kpi_reports", label: "KPI Reports", group: "Analytics & Governance" },
  { code: "audit_trail", label: "Audit Trail", group: "Analytics & Governance" },
];

export const PLATFORM_MODULE_CODES = PLATFORM_MODULE_CATALOG.map((module) => module.code);

export const APPROVAL_MATRIX_MODULE_CATALOG = PLATFORM_MODULE_CATALOG.filter(
  (module) => module.supportsApprovalMatrix === true
);
