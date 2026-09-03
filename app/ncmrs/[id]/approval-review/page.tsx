"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { SectionCard } from "../../../components/QualityWorkflowComponents";

type Decision = "approved" | "rejected";

export default function NcmrMrbApprovalReviewPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const taskId = searchParams.get("taskId") || "";

  const [record, setRecord] = useState<any>(null);
  const [task, setTask] = useState<any>(null);
  const [affectedItems, setAffectedItems] = useState<any[]>([]);
  const [collaborationThread, setCollaborationThread] = useState<any>(null);
  const [collaborationComments, setCollaborationComments] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [reviewerComment, setReviewerComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const normalizedUserEmail = normalizeEmail(userEmail);
  const normalizedAssigneeEmail = normalizeEmail(task?.assigned_to_email);
  const isAssignedReviewer =
    Boolean(normalizedUserEmail) &&
    normalizedUserEmail === normalizedAssigneeEmail;
  const isPending = String(task?.status || "").toLowerCase() === "pending";

  const preMrbAttachments = useMemo(() => {
    const attachments: Array<{
      source: string;
      name: string;
      url: string;
      uploadedBy?: string;
      uploadedAt?: string;
    }> = [];

    const addAttachments = (
      source: string,
      values: any,
      fallbackUploadedBy?: string,
      fallbackUploadedAt?: string
    ) => {
      if (!Array.isArray(values)) return;

      values.forEach((attachment: any, index: number) => {
        const url =
          attachment?.url ||
          attachment?.public_url ||
          attachment?.publicUrl ||
          attachment?.file_url ||
          attachment?.download_url ||
          "";

        if (!url) return;

        attachments.push({
          source,
          name:
            attachment?.name ||
            attachment?.file_name ||
            attachment?.filename ||
            `Attachment ${index + 1}`,
          url,
          uploadedBy:
            attachment?.uploaded_by ||
            attachment?.created_by ||
            fallbackUploadedBy ||
            "",
          uploadedAt:
            attachment?.uploaded_at ||
            attachment?.created_at ||
            fallbackUploadedAt ||
            "",
        });
      });
    };

    addAttachments(
      "Initiation",
      record?.initiation_attachments,
      record?.created_by || record?.owner_email || record?.owner,
      record?.created_at
    );

    addAttachments(
      "Investigation / Root Cause",
      record?.investigation_attachments,
      record?.investigator,
      record?.updated_at
    );

    collaborationComments.forEach((comment: any) => {
      addAttachments(
        "Collaboration",
        comment?.attachments,
        comment?.created_by,
        comment?.created_at
      );
    });

    const seen = new Set<string>();

    return attachments.filter((attachment) => {
      const key = `${attachment.source}|${attachment.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [record, collaborationComments]);

  const load = async () => {
    setLoading(true);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw new Error(userError.message);

      const email = normalizeEmail(userData?.user?.email);
      setUserEmail(email);

      if (!email) throw new Error("You must be logged in to review this MRB.");

      const [recordResult, taskResult, affectedResult] = await Promise.all([
        supabase.from("ncmrs").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("approval_tasks")
          .select("*")
          .eq("id", taskId)
          .eq("entity_type", "ncmr")
          .eq("entity_id", id)
          .maybeSingle(),
        supabase
          .from("ncmr_affected_items")
          .select("*")
          .eq("ncmr_id", id)
          .order("created_at", { ascending: true }),
      ]);

      if (recordResult.error) throw new Error(recordResult.error.message);
      if (taskResult.error) throw new Error(taskResult.error.message);
      if (affectedResult.error) throw new Error(affectedResult.error.message);
      if (!recordResult.data) throw new Error("NCMR record not found.");
      if (!taskResult.data) throw new Error("MRB approval task not found.");

      const loadedTask = taskResult.data;

      if (
        !["mrb_approval", "ncmr_mrb_approval", "ncmr_mrb_review"].includes(
          String(loadedTask.task_type || "")
        )
      ) {
        throw new Error("This task is not an MRB approval task.");
      }

      if (
        normalizeEmail(loadedTask.assigned_to_email) !==
        normalizeEmail(email)
      ) {
        throw new Error(
          "This MRB approval task is assigned to another reviewer."
        );
      }

      setRecord(recordResult.data);
      setTask(loadedTask);
      setAffectedItems(affectedResult.data || []);
      setReviewerComment(loadedTask.approver_comment || "");

      const { data: threadData, error: threadError } = await supabase
        .from("collaboration_threads")
        .select("*")
        .eq("module", "ncmr")
        .eq("record_id", id)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (threadError) {
        console.warn(
          "Unable to load pre-MRB collaboration thread:",
          threadError.message
        );
      } else if (threadData) {
        setCollaborationThread(threadData);

        const { data: commentData, error: commentError } = await supabase
          .from("collaboration_comments")
          .select("*")
          .eq("thread_id", threadData.id)
          .order("created_at", { ascending: true });

        if (commentError) {
          console.warn(
            "Unable to load pre-MRB collaboration attachments:",
            commentError.message
          );
        } else {
          setCollaborationComments(commentData || []);
        }
      }
    } catch (error: any) {
      alert(error?.message || "Unable to load the MRB review package.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && taskId) {
      load();
    } else {
      setLoading(false);
    }
  }, [id, taskId]);

  const addAuditLog = async (action: string, details: string) => {
    await supabase.from("audit_logs").insert({
      entity_type: "ncmr",
      entity_id: id,
      action,
      details,
      user_email: userEmail || "unknown",
    });
  };

  const notifyOwner = async (
    notificationType: string,
    title: string,
    message: string,
    severity: string
  ) => {
    const ownerEmail = normalizeEmail(
      record?.owner_email || record?.owner || record?.created_by
    );

    if (!ownerEmail) return;

    await supabase.from("notifications").insert({
      user_email: ownerEmail,
      assigned_role: "NCMR Owner",
      notification_type: notificationType,
      title,
      message,
      related_module: "ncmr",
      related_record_id: id,
      related_url: `/ncmrs/${id}`,
      severity,
      read_status: false,
      created_by: userEmail || null,
      delivery_frequency: "immediate",
      delivery_status: "in_app",
    });
  };


  const closeRejectedMrbApprovalCycle = async () => {
    const { error: reviewerConfigurationError } = await supabase
      .from("ncmr_mrb_reviewers")
      .update({
        approval_status: "configured",
        updated_at: new Date().toISOString(),
      })
      .eq("ncmr_id", id);

    if (reviewerConfigurationError) {
      throw new Error(reviewerConfigurationError.message);
    }

    await addAuditLog(
      "mrb_approval_cycle_returned",
      `MRB approval cycle returned to the owner after rejection by ${userEmail}. Remaining pending reviewer tasks were cancelled by the governed MRB decision RPC. Rejection rationale: ${reviewerComment.trim()}.`
    );
  };

  const completeMrbIfReady = async () => {
    const { data: currentTasks, error } = await supabase.rpc(
      "ncmr_get_mrb_approval_tasks",
      {
        p_ncmr_id: id,
      }
    );

    if (error) throw new Error(error.message);

    const requiredTasks = (currentTasks || [])
      .filter((item: any) => item.required !== false)
      .filter(
        (item: any) =>
          !["cancelled", "obsolete"].includes(
            String(item.status || "").toLowerCase()
          )
      );

    if (requiredTasks.length === 0) return;

    const hasRejection = requiredTasks.some(
      (item: any) => String(item.status || "").toLowerCase() === "rejected"
    );

    if (hasRejection) return;

    const allApproved = requiredTasks.every(
      (item: any) => String(item.status || "").toLowerCase() === "approved"
    );

    if (!allApproved) return;

    const now = new Date().toISOString();
    const reviewerEmails = requiredTasks
      .map((item: any) => normalizeEmail(item.assigned_to_email))
      .filter(Boolean);

    const { error: updateError } = await supabase
      .from("ncmrs")
      .update({
        mrb_approved_by:
          reviewerEmails.join(", ") || "All Required MRB Reviewers",
        mrb_approved_at: now,
        mrb_signature_email_entered:
          reviewerEmails.join(", ") || "all_required_reviewers",
        mrb_signature_meaning:
          "MRB Approval: all required reviewers approved the submitted MRB package with electronic approval records.",
        review_status: "approved",
      })
      .eq("id", id);

    if (updateError) throw new Error(updateError.message);

    await addAuditLog(
      "mrb_approval_completed",
      `MRB approval completed after all required reviewers approved: ${reviewerEmails.join(", ")}.`
    );

    await notifyOwner(
      "ncmr_mrb_approved",
      `MRB approved: ${record?.ncmr_number || "NCMR"}`,
      `All required reviewers approved the MRB package. Implementation is now available.`,
      "success"
    );
  };

  const submitDecision = async (decision: Decision) => {
    if (!task || !record) return;

    if (!isAssignedReviewer) {
      alert("This task is not assigned to the logged-in reviewer.");
      return;
    }

    if (!isPending) {
      alert("This MRB approval task has already been completed.");
      return;
    }

    if (decision === "rejected" && !reviewerComment.trim()) {
      alert("A rejection rationale is required.");
      return;
    }

    const verb = decision === "approved" ? "approve" : "reject";
    const confirmed = window.confirm(
      `Electronic Signature:\n\nI ${verb} this MRB review package. My decision, identity, timestamp, and comment will become part of the official quality record.`
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const { data: decisionResult, error: taskError } = await supabase.rpc(
        "ncmr_decide_mrb_approval_task",
        {
          p_task_id: task.id,
          p_decision: decision,
          p_comment: reviewerComment.trim() || null,
        }
      );

      if (taskError) throw new Error(taskError.message);

      await addAuditLog(
        `mrb_approval_task_${decision}`,
        `${task.required_function || "MRB reviewer"} ${decision} by ${userEmail}. Reviewer comment: ${reviewerComment.trim() || "N/A"}.`
      );

      if (decision === "rejected") {
        await closeRejectedMrbApprovalCycle();

        const { error: recordUpdateError } = await supabase
          .from("ncmrs")
          .update({
            review_status: "rejected",
            mrb_approved_by: null,
            mrb_approved_at: null,
            mrb_signature_email_entered: null,
            mrb_signature_meaning: null,
          })
          .eq("id", id);

        if (recordUpdateError) {
          throw new Error(recordUpdateError.message);
        }

        await notifyOwner(
          "ncmr_mrb_rejected",
          `MRB review rejected: ${record?.ncmr_number || "NCMR"}`,
          `${userEmail} rejected the MRB package. Rationale: ${reviewerComment.trim()}. The approval cycle has been returned for revision and resubmission.`,
          "high"
        );
      } else if (decisionResult?.all_required_approved) {
        await completeMrbIfReady();
      }

      alert(`MRB review ${decision}.`);
      window.location.href = "/workspace";
    } catch (error: any) {
      alert(error?.message || `Unable to ${verb} the MRB package.`);
      setSubmitting(false);
    }
  };

  const formatRiskLabel = (value: any) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return "Not Assessed";
    if (normalized === "no_risk") return "No Risk";
    return normalized.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getFinalEffectiveRiskForReview = () => {
    if (record?.risk_determination === "no_risk" || record?.risk_level === "no_risk") {
      return "no_risk";
    }

    if (record?.risk_override_enabled && record?.risk_override_level) {
      return record.risk_override_level;
    }

    return record?.risk_level || record?.risk_rating || "";
  };

  const getRiskBasedCapaSignalForReview = () => {
    const effectiveRisk = getFinalEffectiveRiskForReview();
    if (!effectiveRisk) return "Risk Not Assessed";
    return `${formatRiskLabel(effectiveRisk)} Risk`.replace("No Risk Risk", "No Risk");
  };

  const getCapaGovernanceReview = () => {
    const effectiveRisk = getFinalEffectiveRiskForReview();
    const hasRecurrence =
      record?.recurring_issue === true ||
      String(record?.recurrence_reason || "").toLowerCase().includes("recurr");

    const storedOutcome = String(record?.capa_evaluation_outcome || "").trim();

    return {
      outcome: storedOutcome || (record?.capa_required ? "required" : record?.capa_recommended ? "recommended" : "not_required"),
      label: formatCapaEvaluationOutcomeForReview(
        storedOutcome || (record?.capa_required ? "required" : record?.capa_recommended ? "recommended" : "not_required")
      ),
      rationale:
        record?.capa_evaluation_rationale ||
        "CAPA governance decision rationale was not documented.",
      signal: `Final Effective Risk: ${formatRiskLabel(effectiveRisk)}. ${
        hasRecurrence ? "Recurring NCMR detected." : "No recurrence detected."
      }`,
    };
  };

  const formatCapaEvaluationOutcomeForReview = (
    outcome: string | null | undefined
  ) => {
    switch (outcome) {
      case "required":
        return "CAPA Required";
      case "recommended":
        return "CAPA Recommended";
      case "not_required":
        return "CAPA Not Required";
      case "capa_opened":
        return "CAPA Opened";
      case "not_opened_with_justification":
        return "CAPA Not Opened - Justification Documented";
      default:
        return outcome ? formatValue(outcome) : "CAPA Not Assessed";
    }
  };

  const evaluateScarGovernanceForReview = () => {
    const supplierPartRecorded =
      Boolean(record?.product_part_number) ||
      affectedItems.some((item: any) => Boolean(item.product_part_number));

    const supplierRecurrence =
      record?.recurring_issue === true ||
      record?.supplier_capa_required === true ||
      record?.supplier_scar_required === true ||
      String(record?.recurrence_reason || "")
        .toLowerCase()
        .includes("recurr") ||
      String(record?.supplier_capa_reason || "")
        .toLowerCase()
        .includes("recurr") ||
      String(record?.supplier_scar_reason || "")
        .toLowerCase()
        .includes("recurr") ||
      String(record?.scar_reason || "")
        .toLowerCase()
        .includes("recurr");

    const triggers = [
      `${supplierPartRecorded ? "✓" : "✗"} Supplier Part Recorded`,
      `${supplierRecurrence ? "✓" : "✗"} Supplier Recurrence Detected`,
    ];

    if (supplierPartRecorded && supplierRecurrence) {
      return {
        label: "SCAR Recommended",
        rationale:
          "SCAR is recommended because supplier part has been recorded and supplier recurrence has been detected.",
        triggers,
      };
    }

    return {
      label: "SCAR Not Required",
      rationale:
        "SCAR is not automatically required because both supplier governance criteria have not been met. Supplier Part Recorded and Supplier Recurrence Detected are required for an automatic SCAR recommendation.",
      triggers,
    };
  };

  if (loading) {
    return <main style={pageStyle}>Loading MRB review package...</main>;
  }

  if (!record || !task) {
    return (
      <main style={pageStyle}>
        <h1>MRB Review Package</h1>
        <p>The requested review package could not be loaded.</p>
        <Link href="/workspace">Back to My Workspace</Link>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>QUALISPHERE ENTERPRISE APPROVAL ENGINE</div>
          <h1 style={{ margin: "6px 0" }}>MRB Review Package</h1>
          <p style={mutedStyle}>
            Locked, read-only presentation of the NCMR content submitted by the
            owner through the MRB approval gate.
          </p>
        </div>

        <div style={headerActionStyle}>
          <StatusBadge value={task.status || "pending"} />
          <Link href="/workspace" style={secondaryLinkStyle}>
            Back to My Workspace
          </Link>
        </div>
      </header>

      <section style={summaryGridStyle}>
        <Summary label="NCMR" value={record.ncmr_number || id} />
        <Summary label="Reviewer" value={task.assigned_to_email || "N/A"} />
        <Summary
          label="Function / Job Title"
          value={task.required_function || "MRB Approval"}
        />
        <Summary label="Approve By" value={task.due_date || "Not set"} />
      </section>

      <div style={lockedBannerStyle}>
        <strong>Submitted MRB Package — Read Only</strong>
        <div style={{ marginTop: "4px" }}>
          The fields below mirror the owner workflow through MRB Approval.
          Reviewer changes are not permitted.
        </div>
      </div>

      <div style={ownerSummaryStyle}>
        <h2 style={{ marginTop: 0 }}>Record Summary</h2>
        <p style={readOnlyNoticeStyle}>
          Record summary is locked for MRB review.
        </p>

        <div style={ownerGridStyle}>
          <OwnerField label="Issue Description" value={record.issue_description} multiline />
          <OwnerField label="Owner" value={record.owner_email || record.owner} />
          
          <OwnerField label="Status" value={record.status} />
          <OwnerField label="Severity" value={record.severity} />
          <OwnerField
            label="Final Effective Risk"
            value={formatRiskLabel(getFinalEffectiveRiskForReview())}
          />
        </div>
      </div>

      <SectionCard
        title="1. Initiation"
        subtitle="Submitted affected materials and initiation information."
        defaultOpen={true}
      >
        <p style={readOnlyNoticeStyle}>
          This section is the locked version of the initiation information
          submitted by the NCMR owner.
        </p>

        <div style={ownerGridStyle}>
          <OwnerField label="Issue Description" value={record.issue_description} multiline />
          <OwnerField label="Source of Detection" value={record.source_of_detection} />
          <OwnerField label="Department" value={record.department} />
          <OwnerField label="Date Detected" value={formatDateTime(record.date_detected)} />
          <OwnerField label="Site / Location" value={record.site_location} />
          <OwnerField label="Immediate Correction" value={record.immediate_correction} multiline />
          <OwnerField label="NCMR Owner" value={record.owner_email || record.owner} />
        </div>

        <h3>Affected Materials / Multiple Parts and Lots</h3>

        {affectedItems.length === 0 ? (
          <p>No affected material items were recorded.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {affectedItems.map((item, index) => (
              <div key={item.id || index} style={ownerItemCardStyle}>
                <h4 style={{ marginTop: 0 }}>Affected Item {index + 1}</h4>

                <div style={ownerGridStyle}>
                  <OwnerField label="Part Number" value={item.product_part_number} />
                  <OwnerField label="Part Description" value={item.part_description} />
                  <OwnerField label="Part Revision" value={item.part_revision} />
                  <OwnerField label="Lot Number" value={item.lot_number} />
                  <OwnerField label="Work Order" value={item.workorder_number} />
                  <OwnerField label="Quantity Affected" value={item.quantity_affected} />
                  <OwnerField
                    label="Quantity Quarantined"
                    value={item.quarantined_quantity}
                  />
                  <OwnerField label="Defect Category" value={item.defect_category} />
                  <OwnerField label="Defect Subcategory" value={item.defect_subcategory} />
                </div>
              </div>
            ))}
          </div>
        )}

        {(record?.supplier_name || record?.supplier_lot || record?.purchase_order_number) ? (
          <>
            <h3>Supplier Information (If Applicable)</h3>
            <div style={ownerGridStyle}>
              <OwnerField label="Supplier Name" value={record.supplier_name} />
              <OwnerField label="Supplier Lot" value={record.supplier_lot} />
              <OwnerField label="Purchase Order Number" value={record.purchase_order_number} />
            </div>
          </>
        ) : null}
      </SectionCard>

      <SectionCard
        title="2. Containment"
        subtitle="Submitted containment action and completion evidence."
        defaultOpen={true}
      >
        <OwnerField
          label="Containment Action"
          value={record.containment_action}
          multiline
        />

        <div style={ownerGridStyle}>
          <OwnerField
            label="Containment Completed By"
            value={record.containment_completed_by}
          />
          <OwnerField
            label="Containment Completed At"
            value={formatDateTime(record.containment_completed_at)}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="3. Investigation / Root Cause"
        subtitle="Submitted investigator, problem statement, investigation summary, and root cause."
        defaultOpen={true}
      >
        <OwnerField label="Investigator" value={record.investigator} />
        <OwnerField
          label="Problem Statement"
          value={record.problem_description}
          multiline
        />
        <OwnerField
          label="Investigation Summary"
          value={record.investigation_summary}
          multiline
        />
        <OwnerField
          label="Root Cause Category"
          value={record.root_cause_category}
        />
        <OwnerField label="Root Cause Summary" value={record.root_cause} multiline />
      </SectionCard>

      <SectionCard
        title="4. Correction"
        subtitle="Submitted correction proposal."
        defaultOpen={true}
      >
        <OwnerField
          label="Correction Proposal"
          value={record.correction_action_proposal}
          multiline
        />
      </SectionCard>

      <SectionCard
        title="5. Corrective Action"
        subtitle="Submitted corrective-action proposal / justification."
        defaultOpen={true}
      >
        <OwnerField
          label="Corrective Action Proposal / Justification"
          value={record.corrective_action}
          multiline
        />
      </SectionCard>

      <SectionCard
        title="6. Risk Assessment"
        subtitle="Submitted Risk Determination and Final Effective Risk."
        defaultOpen={true}
      >
        <OwnerField
          label="Risk Determination"
          value={
            record?.risk_determination === "no_risk"
              ? "No Risk"
              : record?.risk_determination === "overall_residual_risk"
                ? "Overall/Residual Risk"
                : record?.risk_level === "no_risk"
                  ? "No Risk"
                  : "Overall/Residual Risk"
          }
        />

        {record?.risk_determination === "no_risk" || record?.risk_level === "no_risk" ? (
          <OwnerField
            label="No Risk Justification"
            value={record?.no_risk_justification}
            multiline
          />
        ) : (
          <>
            <div style={ownerGridStyle}>
              <OwnerField
                label="Risk Assessment Method"
                value={record?.risk_assessment_method || "automatic"}
              />
              <OwnerField label="Severity" value={record?.severity} />
              <OwnerField label="Occurrence" value={record?.occurrence_rating} />
              <OwnerField label="Detection" value={record?.detection_rating} />
              <OwnerField
                label="Calculated / Manual Overall Risk"
                value={formatRiskLabel(record?.risk_level)}
              />
              <OwnerField
                label="Override Calculated Risk?"
                value={record?.risk_override_enabled ? "Yes" : "No"}
              />
            </div>

            {record?.risk_override_enabled ? (
              <div style={ownerGridStyle}>
                <OwnerField
                  label="Override Risk Level"
                  value={formatRiskLabel(record?.risk_override_level)}
                />
                <OwnerField
                  label="Risk Override Justification"
                  value={record?.risk_override_justification}
                  multiline
                />
              </div>
            ) : null}
          </>
        )}

        <OwnerField
          label="Risk Assessment Notes (Optional)"
          value={record?.risk_assessment}
          multiline
        />

        <div style={riskResultPanelStyle}>
          <strong>Final Effective Risk:</strong>{" "}
          {formatRiskLabel(getFinalEffectiveRiskForReview())}
        </div>

        <div style={riskSignalPanelStyle}>
          <strong>CAPA Governance Signal:</strong>{" "}
          {getRiskBasedCapaSignalForReview()}
        </div>
      </SectionCard>
      <SectionCard
        title="7. Product Disposition"
        subtitle="Submitted overall and item-level disposition decisions."
        defaultOpen={true}
      >
        <OwnerField
          label="Overall Product Disposition"
          value={record.product_disposition || record.disposition}
        />
        <OwnerField
          label="Overall Disposition Justification"
          value={record.disposition_justification}
          multiline
        />

        <h3>Affected Item Dispositions</h3>
        {affectedItems.map((item, index) => (
          <div key={item.id || index} style={ownerItemCardStyle}>
            <h4 style={{ marginTop: 0 }}>Affected Item {index + 1}</h4>
            <div style={ownerGridStyle}>
              <OwnerField label="Part Number" value={item.product_part_number} />
              <OwnerField label="Lot Number" value={item.lot_number} />
              <OwnerField
                label="Item Disposition"
                value={item.product_disposition}
              />
              <OwnerField
                label="Quantity Accepted"
                value={item.quantity_accepted}
              />
              <OwnerField
                label="Quantity Rejected"
                value={item.quantity_rejected}
              />
            </div>
            <OwnerField
              label="Disposition Justification"
              value={item.disposition_justification}
              multiline
            />
            {String(item.product_disposition || "").toLowerCase() === "rework" ? (
              <div style={ownerGridStyle}>
                <OwnerField
                  label="Final Disposition After Rework"
                  value={item.final_disposition_after_rework}
                />
                <OwnerField
                  label="Final Rework Quantity Accepted"
                  value={item.final_rework_quantity_accepted}
                />
                <OwnerField
                  label="Final Rework Quantity Rejected"
                  value={item.final_rework_quantity_rejected}
                />
              </div>
            ) : null}
          </div>
        ))}
      </SectionCard>

      <SectionCard
        title="8. CAPA Governance"
        subtitle={
          record?.linked_capa_id || record?.capa_id
            ? "Complete: linked CAPA exists."
            : record?.capa_not_required_justification
              ? "Complete: CAPA no-open justification documented."
              : "Submitted CAPA governance decision."
        }
        defaultOpen={true}
      >
        {(() => {
          const evaluation = getCapaGovernanceReview();

          return (
            <>
              <div style={governancePanelStyle}>
                <h3 style={{ marginTop: 0 }}>Governance Decision Support</h3>
                <p style={governanceHelpStyle}>
                  CAPA decisions are supported by the governance signal and documented quality judgment.
                </p>

                <div style={governanceGridStyle}>
                  <div>
                    <strong>Governance Decision:</strong>{" "}
                    <GovernanceBadge value={evaluation.label} />
                  </div>

                  <div>
                    <strong>Rationale:</strong>{" "}
                    {evaluation.rationale}
                  </div>

                  <div>
                    <strong>CAPA Governance Signal:</strong>{" "}
                    {evaluation.signal}
                  </div>

                  <div>
                    <strong>Configuration Control:</strong>{" "}
                    Controlled customer CAPA governance configuration applied.
                  </div>
                </div>
              </div>

              {record?.linked_capa_id || record?.capa_id ? (
                <div style={linkedRecordPanelStyle}>
                  <strong>Linked CAPA:</strong>{" "}
                  <Link href={`/capa/${record?.linked_capa_id || record?.capa_id}`}>
                    Open Linked CAPA
                  </Link>
                </div>
              ) : (
                <OwnerField
                  label="Risk-Based Justification if CAPA is Not Opened"
                  value={
                    record?.capa_not_required_justification ||
                    record?.capa_decision_justification ||
                    record?.capa_justification
                  }
                  multiline
                />
              )}

              {record?.capa_not_required_justification ? (
                <div style={savedJustificationStyle}>
                  <strong>Saved No-CAPA Justification:</strong>{" "}
                  {record.capa_not_required_justification}
                </div>
              ) : null}
            </>
          );
        })()}
      </SectionCard>
      <SectionCard
        title="9. Supplier / SCAR Governance"
        subtitle={
          record?.linked_scar_id
            ? "Complete: linked SCAR exists for supplier governance."
            : record?.scar_justification
              ? "Complete: no-SCAR justification documented."
              : "Evaluate SCAR using supplier part recorded and supplier recurrence detected."
        }
        defaultOpen={true}
      >
        {(() => {
          const evaluation = evaluateScarGovernanceForReview();

          return (
            <>
              <div style={governancePanelStyle}>
                <h3 style={{ marginTop: 0 }}>Supplier Governance</h3>
                <p style={governanceHelpStyle}>
                  SCAR should be created through supplier risk-based decision
                  making, not automatic supplier linkage alone.
                </p>

                <div style={governanceGridStyle}>
                  <div>
                    <strong>Governance Decision:</strong>{" "}
                    <GovernanceBadge value={evaluation.label} />
                  </div>

                  <div>
                    <strong>Rationale:</strong> {evaluation.rationale}
                  </div>

                  <div style={signalPanelStyle}>
                    <strong>SCAR Governance Signal</strong>
                    <ul style={{ marginBottom: 0 }}>
                      {evaluation.triggers.map(
                        (trigger: string, index: number) => (
                          <li key={index}>{trigger}</li>
                        )
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              {record?.linked_scar_id ? (
                <div style={linkedRecordPanelStyle}>
                  <strong>Linked SCAR:</strong>{" "}
                  <Link
                    href={`/supplier-quality/scars/${record.linked_scar_id}`}
                  >
                    Open Linked SCAR
                  </Link>
                </div>
              ) : (
                <>
                  <div style={disabledActionRowStyle}>
                    <button type="button" disabled>
                      Create Linked SCAR
                    </button>
                  </div>

                  <OwnerField
                    label="Risk-Based Justification if SCAR is Not Opened"
                    value={record?.scar_justification}
                    multiline
                  />

                  <button type="button" disabled>
                    Save SCAR Justification
                  </button>
                </>
              )}

              {record?.scar_justification ? (
                <div style={savedJustificationStyle}>
                  <strong>Saved SCAR Justification:</strong>{" "}
                  {record.scar_justification}
                </div>
              ) : null}
            </>
          );
        })()}
      </SectionCard>

      <SectionCard
        title="10. Pre-MRB Supporting Evidence"
        subtitle="Read-only attachments and collaboration evidence available to the reviewer before the MRB decision."
        defaultOpen={true}
      >
        <p style={readOnlyNoticeStyle}>
          This package includes supporting files available before MRB review.
          Reviewers may open the evidence but cannot add, replace, or delete it.
        </p>

        {preMrbAttachments.length === 0 ? (
          <div style={emptyEvidenceStyle}>
            No pre-MRB supporting attachments were recorded.
          </div>
        ) : (
          <div style={attachmentListStyle}>
            {preMrbAttachments.map((attachment, index) => (
              <div
                key={`${attachment.source}-${attachment.url}-${index}`}
                style={attachmentCardStyle}
              >
                <div>
                  <div style={attachmentSourceStyle}>{attachment.source}</div>
                  <div style={attachmentNameStyle}>{attachment.name}</div>

                  {attachment.uploadedBy || attachment.uploadedAt ? (
                    <div style={attachmentMetaStyle}>
                      {attachment.uploadedBy
                        ? `Added by ${attachment.uploadedBy}`
                        : ""}
                      {attachment.uploadedBy && attachment.uploadedAt
                        ? " • "
                        : ""}
                      {attachment.uploadedAt
                        ? formatDateTime(attachment.uploadedAt)
                        : ""}
                    </div>
                  ) : null}
                </div>

                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  style={openAttachmentStyle}
                >
                  Open Attachment
                </a>
              </div>
            ))}
          </div>
        )}

        {collaborationThread ? (
          <div style={collaborationEvidenceStyle}>
            <div>
              <strong>Pre-MRB Collaboration History</strong>
              <div style={{ ...readOnlyNoticeStyle, marginTop: "4px" }}>
                Open the read-only collaboration thread to review comments,
                participants, and supporting attachments.
              </div>
            </div>

            <Link
              href={`/ncmrs/${id}/collaboration`}
              target="_blank"
              style={secondaryLinkStyle}
            >
              Open Collaboration History
            </Link>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="11. MRB Approval"
        subtitle="Reviewer decision for the submitted MRB package."
        defaultOpen={true}
      >
        <div style={decisionNoticeStyle}>
          Review the locked content and all pre-MRB supporting evidence above.
          Downstream implementation, post-MRB evidence, rework execution,
          verification, and closure are not part of this approval package.
        </div>

        <label style={labelStyle}>Reviewer Comment</label>
        <textarea
          value={reviewerComment}
          onChange={(event) => setReviewerComment(event.target.value)}
          rows={5}
          disabled={!isPending || submitting}
          placeholder="Enter approval comments or the required rejection rationale."
          style={textareaStyle}
        />

        {isPending ? (
          <div style={buttonRowStyle}>
            <button
              type="button"
              onClick={() => submitDecision("approved")}
              disabled={submitting}
              style={approveButtonStyle}
            >
              {submitting ? "Submitting..." : "Approve MRB"}
            </button>

            <button
              type="button"
              onClick={() => submitDecision("rejected")}
              disabled={submitting}
              style={rejectButtonStyle}
            >
              Reject MRB
            </button>
          </div>
        ) : (
          <div style={completedPanelStyle}>
            <strong>Decision:</strong> {formatValue(task.status)}
            <br />
            <strong>Signed By:</strong> {task.signed_by || "N/A"}
            <br />
            <strong>Decision Date:</strong> {formatDateTime(task.signed_at)}
            <br />
            <strong>Comment:</strong> {task.approver_comment || "N/A"}
          </div>
        )}
      </SectionCard>
    </main>
  );
}

function OwnerField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: any;
  multiline?: boolean;
}) {
  const displayValue =
    value === null || value === undefined || value === ""
      ? "N/A"
      : String(value);

  return (
    <div style={{ marginBottom: "12px" }}>
      <label style={{ fontWeight: 700 }}>{label}</label>
      <br />
      {multiline ? (
        <textarea
          value={displayValue}
          readOnly
          disabled
          rows={4}
          style={ownerTextareaStyle}
        />
      ) : (
        <input
          value={displayValue}
          readOnly
          disabled
          style={ownerInputStyle}
        />
      )}
    </div>
  );
}


function Summary({ label, value }: { label: string; value: any }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{formatValue(value)}</div>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const normalized = String(value || "pending").toLowerCase();

  return (
    <span
      style={{
        ...badgeStyle,
        background:
          normalized === "approved"
            ? "#dcfce7"
            : normalized === "rejected"
              ? "#fee2e2"
              : "#fef3c7",
        color:
          normalized === "approved"
            ? "#166534"
            : normalized === "rejected"
              ? "#991b1b"
              : "#92400e",
      }}
    >
      {formatValue(value)}
    </span>
  );
}

function GovernanceBadge({ value }: { value: string }) {
  return (
    <span style={governanceBadgeStyle}>
      {value || "Not Assessed"}
    </span>
  );
}

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function formatValue(value: any) {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDateTime(value: any) {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "24px",
  background: "#f8fafc",
  color: "#111827",
  fontFamily: "Arial, sans-serif",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
  marginBottom: "18px",
};

const headerActionStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#2563eb",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.12em",
};

const mutedStyle: React.CSSProperties = {
  color: "#64748b",
  lineHeight: 1.5,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};

const summaryCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
  padding: "14px",
};

const summaryLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const summaryValueStyle: React.CSSProperties = {
  marginTop: "6px",
  fontWeight: 900,
  wordBreak: "break-word",
};

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: "14px",
  padding: "18px",
  marginBottom: "16px",
  boxShadow: "0 4px 18px rgba(15,23,42,0.04)",
};

const fieldGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "12px",
};

const fieldStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "12px",
  background: "#f8fafc",
};

const wideFieldStyle: React.CSSProperties = {
  ...fieldStyle,
  gridColumn: "1 / -1",
};

const fieldLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const fieldValueStyle: React.CSSProperties = {
  marginTop: "6px",
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const itemCardStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "12px",
  background: "#ffffff",
  gridColumn: "1 / -1",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 900,
  marginBottom: "6px",
  gridColumn: "1 / -1",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "120px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "10px",
  boxSizing: "border-box",
  gridColumn: "1 / -1",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  gridColumn: "1 / -1",
};

const approveButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "9px",
  background: "#15803d",
  color: "#ffffff",
  padding: "10px 15px",
  fontWeight: 900,
  cursor: "pointer",
};

const rejectButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "9px",
  background: "#b91c1c",
  color: "#ffffff",
  padding: "10px 15px",
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryLinkStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#334155",
  padding: "9px 13px",
  fontWeight: 900,
  textDecoration: "none",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: "999px",
  padding: "6px 10px",
  fontWeight: 900,
};


const lockedBannerStyle: React.CSSProperties = {
  border: "1px solid #93c5fd",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: "10px",
  padding: "12px",
  marginBottom: "16px",
};

const ownerSummaryStyle: React.CSSProperties = {
  marginBottom: "20px",
  padding: "12px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  background: "#ffffff",
};

const readOnlyNoticeStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "14px",
};

const ownerGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const ownerItemCardStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "12px",
  background: "#ffffff",
};

const ownerInputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "600px",
  padding: "8px",
  boxSizing: "border-box",
  color: "#111827",
  background: "#f3f4f6",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  opacity: 1,
};

const ownerTextareaStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  padding: "8px",
  boxSizing: "border-box",
  color: "#111827",
  background: "#f3f4f6",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  opacity: 1,
  resize: "vertical",
};

const decisionNoticeStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: "8px",
  padding: "10px",
  marginBottom: "14px",
  lineHeight: 1.5,
};

const riskResultPanelStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#f8fafc",
  borderRadius: "8px",
  padding: "10px 12px",
  marginTop: "12px",
  marginBottom: "12px",
  maxWidth: "850px",
};

const riskSignalPanelStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: "8px",
  padding: "12px",
  marginTop: "12px",
  marginBottom: "12px",
  maxWidth: "850px",
};

const governancePanelStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "12px",
  background: "#f9fafb",
  marginBottom: "14px",
};

const governanceHelpStyle: React.CSSProperties = {
  color: "#4b5563",
  fontSize: "14px",
};

const governanceGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
  maxWidth: "900px",
};

const governanceBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  border: "1px solid #d1d5db",
  borderRadius: "999px",
  padding: "3px 10px",
  fontSize: "12px",
  fontWeight: 700,
  background: "#ffffff",
};

const signalPanelStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  padding: "12px",
  borderRadius: "8px",
  marginTop: "4px",
};

const linkedRecordPanelStyle: React.CSSProperties = {
  border: "1px solid #86efac",
  background: "#f0fdf4",
  borderRadius: "10px",
  padding: "12px",
  marginBottom: "14px",
};

const disabledActionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginBottom: "14px",
};

const savedJustificationStyle: React.CSSProperties = {
  marginTop: "12px",
  color: "#374151",
};

const attachmentListStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
};

const attachmentCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "14px",
  flexWrap: "wrap",
  border: "1px solid #dbe3ee",
  borderRadius: "10px",
  padding: "12px",
  background: "#f8fafc",
};

const attachmentSourceStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const attachmentNameStyle: React.CSSProperties = {
  marginTop: "4px",
  fontWeight: 900,
  wordBreak: "break-word",
};

const attachmentMetaStyle: React.CSSProperties = {
  marginTop: "4px",
  color: "#64748b",
  fontSize: "12px",
};

const openAttachmentStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "8px",
  background: "#2563eb",
  color: "#ffffff",
  padding: "8px 12px",
  fontWeight: 900,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const emptyEvidenceStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "12px",
  background: "#f8fafc",
  color: "#64748b",
};

const collaborationEvidenceStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginTop: "14px",
  border: "1px solid #bfdbfe",
  borderRadius: "10px",
  padding: "12px",
  background: "#eff6ff",
};

const completedPanelStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "12px",
  background: "#f8fafc",
  lineHeight: 1.65,
};
