export const NCMR_RECORD_STRUCTURE = {
  module: "NCMR",
  sections: [
    {
      key: "initiation",
      title: "1. Initiation",
      elements: [
        { type: "field", source: "record", key: "issue_description", label: "Issue Description" },
        { type: "field", source: "record", key: "source_of_detection", label: "Source of Detection", format: "label" },
        { type: "field", source: "record", key: "department", label: "Department", format: "label" },
        { type: "field", source: "record", key: "date_detected", label: "Date Detected", format: "date" },
        { type: "field", source: "record", key: "site_location", label: "Site / Location" },
        { type: "field", source: "record", key: "immediate_correction", label: "Immediate Correction" },
        {
          type: "attachment_list",
          source: "record",
          key: "initiation_attachments",
          label: "Initiation Supporting Attachments",
        },
        {
          type: "table",
          source: "affected_items",
          view: "affected_materials",
          label: "Affected Materials / Multiple Parts and Lots",
        },
      ],
    },
    {
      key: "containment",
      title: "2. Containment",
      elements: [
        { type: "field", source: "record", key: "containment_action", label: "Containment Action" },
        { type: "field", source: "record", key: "containment_owner", label: "Containment Owner" },
        { type: "field", source: "record", key: "material_status", label: "Material Status", format: "label" },
        { type: "field", source: "record", key: "quarantined_quantity", label: "Quarantined Quantity" },
        { type: "field", source: "record", key: "containment_completed_by", label: "Containment Completed By" },
        { type: "field", source: "record", key: "containment_completed_at", label: "Containment Completed At", format: "datetime" },
      ],
    },
    {
      key: "investigation",
      title: "3. Investigation / Root Cause Summary",
      elements: [
        { type: "field", source: "record", key: "investigator", label: "Investigator" },
        { type: "field", source: "record", key: "problem_description", label: "Problem Description" },
        { type: "field", source: "record", key: "investigation_summary", label: "Investigation Summary" },
        { type: "field", source: "record", key: "root_cause_category", label: "Root Cause Category", format: "label" },
        { type: "field", source: "record", key: "root_cause", label: "Root Cause Summary" },
      ],
    },
    {
      key: "correction",
      title: "4. Correction",
      elements: [
        { type: "field", source: "record", key: "correction_action_proposal", label: "Correction Proposal" },
      ],
    },
    {
      key: "corrective_action",
      title: "5. Corrective Action",
      elements: [
        { type: "field", source: "record", key: "corrective_action", label: "Corrective Action Proposal / Justification" },
      ],
    },
    {
      key: "risk",
      title: "6. Risk Assessment",
      elements: [
        { type: "field", source: "record", key: "risk_assessment_method", label: "Risk Assessment Method", format: "label" },
        { type: "field", source: "record", key: "severity", label: "Severity", format: "label" },
        { type: "field", source: "record", key: "occurrence_rating", label: "Occurrence", format: "label" },
        { type: "field", source: "record", key: "detection_rating", label: "Detection", format: "label" },
        { type: "field", source: "record", key: "risk_level", label: "Risk Level", format: "label" },
        { type: "field", source: "record", key: "risk_assessment", label: "Risk Assessment Notes" },
      ],
    },
    {
      key: "disposition",
      title: "7. Product Disposition",
      elements: [
        {
          type: "field",
          source: "record",
          key: "product_disposition",
          fallback_key: "disposition",
          label: "Overall Product Disposition",
          format: "label",
        },
        { type: "field", source: "record", key: "disposition_justification", label: "Overall Disposition Justification" },
        { type: "table", source: "affected_items", view: "disposition", label: "Disposition by Affected Item" },
      ],
    },
    {
      key: "capa",
      title: "8. CAPA Governance",
      elements: [
        { type: "frozen_value", key: "capa_governance_decision", label: "Governance Decision" },
        { type: "frozen_value", key: "capa_governance_rationale", label: "Rationale" },
        { type: "frozen_value", key: "capa_governance_signal", label: "CAPA Governance Signal" },
        { type: "field", source: "record", key: "capa_not_required_justification", label: "Risk-Based Justification if CAPA Is Not Opened" },
      ],
    },
    {
      key: "scar",
      title: "9. Supplier / SCAR Governance",
      elements: [
        { type: "frozen_value", key: "scar_governance_decision", label: "Governance Decision" },
        { type: "frozen_value", key: "scar_governance_rationale", label: "Rationale" },
        { type: "frozen_value", key: "scar_governance_signal", label: "SCAR Governance Signal" },
        { type: "field", source: "record", key: "scar_justification", label: "Saved SCAR Justification" },
      ],
    },
    {
      key: "mrb",
      title: "10. MRB Approval History",
      elements: [
        {
          type: "mrb_history",
          source: "audit_logs",
          label: "MRB Approval Cycle History",
        },
      ],
    },
    {
      key: "disposition_implementation",
      title: "11. Disposition Implementation",
      elements: [
        {
          type: "table",
          source: "affected_items",
          view: "disposition_implementation",
          label: "Disposition Implementation",
        },
        {
          type: "task_table",
          source: "approval_tasks",
          task_types: ["rework_task"],
          label: "Rework Execution",
        },
      ],
    },
    {
      key: "implementation",
      title: "12. Correction / Corrective Action Implementation",
      elements: [
        {
          type: "task_table",
          source: "approval_tasks",
          task_types: ["correction_task", "corrective_action_task"],
          label: "Implementation Tasks",
          detailed: true,
        },
      ],
    },
    {
      key: "evidence",
      title: "13. Evidence",
      elements: [
        { type: "field", source: "record", key: "evidence_url", label: "Evidence URL" },
        { type: "field", source: "record", key: "evidence_notes", label: "Evidence Notes" },
      ],
    },
    {
      key: "closure",
      title: "14. Closure",
      elements: [
        { type: "field", source: "record", key: "status", label: "Closure Status", format: "label" },
        { type: "field", source: "record", key: "ncmr_closed_by", fallback_key: "closed_by", label: "Closed By" },
        { type: "field", source: "record", key: "closed_at", fallback_key: "closure_date", label: "Closed At", format: "datetime" },
      ],
    },
    {
      key: "audit",
      title: "NCMR Timeline / Activity Feed",
      elements: [
        { type: "audit_table", source: "audit_logs", label: "Audit History" },
      ],
    },
  ],
} as const;

export const NCMR_FROZEN_LITERAL_VALUES = {};
