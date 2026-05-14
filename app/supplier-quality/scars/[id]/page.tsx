"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import {
  SectionCard,
  ActionToolbar,
  StatusBadge,
  FieldRow,
  FormField,
  ConfirmButton,
  primaryButtonStyle,
  successButtonStyle,
  dangerButtonStyle,
  standardInputStyle,
  standardTextareaStyle,
} from "../../../components/QualityWorkflowComponents";

export default function ScarDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [scar, setScar] = useState<any>(null);
  const [supplier, setSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [rootCause, setRootCause] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [supplierResponse, setSupplierResponse] = useState("");
  const [effectivenessVerification, setEffectivenessVerification] = useState("");
  const [status, setStatus] = useState("open");

  const fetchScar = async () => {
    const { data, error } = await supabase
      .from("scars")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setScar(data);
    setRootCause(data?.root_cause || "");
    setCorrectiveAction(data?.corrective_action || "");
    setSupplierResponse(data?.supplier_response || "");
    setEffectivenessVerification(data?.effectiveness_verification || "");
    setStatus(data?.status || "open");

    if (data?.supplier_id) {
      const supplierRes = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", data.supplier_id)
        .maybeSingle();

      if (!supplierRes.error) setSupplier(supplierRes.data || null);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (id) fetchScar();
  }, [id]);

  const saveScar = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { error } = await supabase
      .from("scars")
      .update({
        root_cause: rootCause,
        corrective_action: correctiveAction,
        supplier_response: supplierResponse,
        effectiveness_verification: effectivenessVerification,
        status,
        supplier_response_date: supplierResponse ? new Date().toISOString() : scar.supplier_response_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: "scar",
      entity_id: id,
      action: "scar_updated",
      details: `SCAR updated. Status: ${status}`,
      user_email: userEmail,
    });

    alert("SCAR saved.");
    fetchScar();
  };

  const closeScar = async () => {
    if (!rootCause.trim()) {
      alert("Root cause is required before SCAR closure.");
      return;
    }

    if (!correctiveAction.trim()) {
      alert("Corrective action is required before SCAR closure.");
      return;
    }

    if (!effectivenessVerification.trim()) {
      alert("Effectiveness verification is required before SCAR closure.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "unknown";

    const { error } = await supabase
      .from("scars")
      .update({
        root_cause: rootCause,
        corrective_action: correctiveAction,
        supplier_response: supplierResponse,
        effectiveness_verification: effectivenessVerification,
        status: "closed",
        closed_by: userEmail,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      entity_type: "scar",
      entity_id: id,
      action: "scar_closed",
      details: "SCAR closed with electronic signature confirmation.",
      user_email: userEmail,
    });

    alert("SCAR closed.");
    fetchScar();
  };

  if (loading) {
    return <main style={{ padding: "24px", fontFamily: "Arial" }}>Loading SCAR...</main>;
  }

  if (!scar) {
    return <main style={{ padding: "24px", fontFamily: "Arial" }}>SCAR not found.</main>;
  }

  const isClosed = scar.status === "closed";

  return (
    <main style={{ padding: "24px", fontFamily: "Arial" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        <div>
          <h1>{scar.scar_number || "SCAR"} — {scar.title || "Untitled SCAR"}</h1>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <StatusBadge status={scar.status || "open"} />
            <StatusBadge status={scar.risk_level || "risk not set"} />
            <StatusBadge status={scar.severity || "severity not set"} />
          </div>
        </div>

        <ActionToolbar>
          <Link href="/supplier-quality/scars">Back to SCARs</Link>
          {scar.supplier_id ? <Link href={`/suppliers/${scar.supplier_id}`}>Supplier Profile</Link> : null}
          {scar.linked_ncmr_id ? <Link href={`/ncmrs/${scar.linked_ncmr_id}`}>Linked NCMR</Link> : null}
        </ActionToolbar>
      </div>

      <SectionCard
        title="SCAR Summary"
        subtitle="Supplier linkage, risk level, source record, due date, and current status."
        defaultOpen={true}
      >
        <div style={gridStyle}>
          <FieldRow label="Supplier" value={scar.supplier_name} />
          <FieldRow label="Supplier Status" value={supplier?.supplier_status} />
          <FieldRow label="Supplier Risk" value={supplier?.supplier_risk_level} />
          <FieldRow label="Linked NCMR" value={scar.linked_ncmr_number} />
          <FieldRow label="Severity" value={scar.severity} />
          <FieldRow label="Risk Level" value={scar.risk_level} />
          <FieldRow label="Status" value={scar.status} />
          <FieldRow label="Due Date" value={scar.due_date} />
          <FieldRow label="Initiated By" value={scar.initiated_by} />
          <FieldRow label="Initiated At" value={scar.initiated_at} />
          <FieldRow label="Closed By" value={scar.closed_by} />
          <FieldRow label="Closed At" value={scar.closed_at} />
        </div>
      </SectionCard>

      <SectionCard
        title="Supplier Issue"
        subtitle="Original supplier issue summary and description that triggered the SCAR."
        defaultOpen={true}
      >
        <FieldRow label="Description" value={scar.description} />
        <FieldRow label="Issue Summary" value={scar.issue_summary} />
      </SectionCard>

      <SectionCard
        title="Supplier Response"
        subtitle="Document supplier response before quality review and root cause assessment."
        defaultOpen={!supplierResponse}
      >
        <FormField label="Supplier Response">
          <textarea
            value={supplierResponse}
            onChange={(e) => setSupplierResponse(e.target.value)}
            disabled={isClosed}
            rows={5}
            style={standardTextareaStyle}
          />
        </FormField>
      </SectionCard>

      <SectionCard
        title="Root Cause and Corrective Action"
        subtitle="Document root cause and supplier corrective action plan."
        defaultOpen={true}
      >
        <FormField label="Root Cause">
          <textarea
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            disabled={isClosed}
            rows={5}
            style={standardTextareaStyle}
          />
        </FormField>

        <FormField label="Corrective Action">
          <textarea
            value={correctiveAction}
            onChange={(e) => setCorrectiveAction(e.target.value)}
            disabled={isClosed}
            rows={5}
            style={standardTextareaStyle}
          />
        </FormField>
      </SectionCard>

      <SectionCard
        title="Effectiveness Verification and Closure"
        subtitle="Verify effectiveness, update status, save progress, or close the SCAR."
        defaultOpen={true}
      >
        <FormField label="Effectiveness Verification">
          <textarea
            value={effectivenessVerification}
            onChange={(e) => setEffectivenessVerification(e.target.value)}
            disabled={isClosed}
            rows={5}
            style={standardTextareaStyle}
          />
        </FormField>

        <FormField label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={isClosed}
            style={standardInputStyle}
          >
            <option value="open">Open</option>
            <option value="supplier_response_pending">Supplier Response Pending</option>
            <option value="quality_review">Quality Review</option>
            <option value="effectiveness_check">Effectiveness Check</option>
            <option value="closed">Closed</option>
          </select>
        </FormField>

        <ActionToolbar>
          <button
            type="button"
            onClick={saveScar}
            disabled={isClosed}
            style={primaryButtonStyle}
          >
            Save SCAR
          </button>

          <ConfirmButton
            confirmMessage="Close this SCAR with electronic signature confirmation?"
            onConfirm={closeScar}
            disabled={isClosed}
            style={successButtonStyle}
          >
            Close SCAR
          </ConfirmButton>

          {isClosed ? (
            <span style={{ color: "#166534", fontWeight: 600 }}>
              This SCAR is closed.
            </span>
          ) : null}
        </ActionToolbar>
      </SectionCard>
    </main>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "10px",
};
