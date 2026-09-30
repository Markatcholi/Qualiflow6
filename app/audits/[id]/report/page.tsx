"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

export default function AuditReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [audit, setAudit] = useState<any>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      const tenantId = typeof window !== "undefined"
        ? window.localStorage.getItem("qualisphere_active_tenant_id") || ""
        : "";
      if (!tenantId) {
        setLoading(false);
        return;
      }

      const auditRes = await supabase
        .from("audits")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      const findingRes = await supabase
        .from("audit_findings")
        .select("*")
        .eq("audit_id", id)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true });

      if (auditRes.error) {
        alert(auditRes.error.message);
        setLoading(false);
        return;
      }

      if (findingRes.error) {
        alert(findingRes.error.message);
        setLoading(false);
        return;
      }

      setAudit(auditRes.data);
      setFindings(findingRes.data || []);

      const tenantRes = await supabase.from("tenants").select("company_name,default_timezone").eq("id", tenantId).maybeSingle();
      setTenant(tenantRes.data);
      const findingIds = (findingRes.data || []).map((f:any) => f.id);
      const auditTaskRes = await supabase.from("approval_tasks").select("*").eq("entity_type","audit").eq("entity_id",id).order("created_at",{ascending:true});
      let findingTaskRows:any[] = [];
      if (findingIds.length) {
        const findingTaskRes = await supabase.from("approval_tasks").select("*").eq("entity_type","audit_finding").in("entity_id",findingIds).order("created_at",{ascending:true});
        findingTaskRows = findingTaskRes.data || [];
      }
      setTasks([...(auditTaskRes.data || []), ...findingTaskRows]);

      const logRes = await supabase
        .from("audit_logs")
        .select("*")
        .eq("entity_id", id)
        .order("created_at", { ascending: true });

      let findingLogRows:any[] = [];
      const findingIdsForLogs = (findingRes.data || []).map((f:any) => f.id);
      if (findingIdsForLogs.length) {
        const findingLogRes = await supabase.from("audit_logs").select("*").eq("tenant_id",tenantId).in("entity_id",findingIdsForLogs).order("created_at",{ascending:true});
        findingLogRows = findingLogRes.data || [];
      }
      if (!logRes.error) setAuditLogs([...(logRes.data || []), ...findingLogRows].sort((a:any,b:any)=>String(a.created_at).localeCompare(String(b.created_at))));

      setLoading(false);
    };

    if (id) fetchReport();
  }, [id]);

  const timezone = tenant?.default_timezone || "UTC";
  const formatDate = (value: any) => {
    if (!value) return "N/A";
    const raw = String(value);
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
    const d = dateOnly ? new Date(raw + "T12:00:00Z") : new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: dateOnly ? "UTC" : timezone, day:"2-digit", month:"short", year:"numeric" }).formatToParts(d);
    const get = (type:string) => parts.find(p=>p.type===type)?.value || "";
    return get("day") + "-" + get("month") + "-" + get("year");
  };
  const formatDateTime = (value: any) => {
    if (!value) return "N/A";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const date = formatDate(value);
    const time = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour:"numeric", minute:"2-digit", timeZoneName:"short" }).format(d);
    return date + " " + time;
  };
  const openAttachment = async (a:any) => {
    const {data,error}=await supabase.storage.from("audit-evidence").createSignedUrl(a.storage_path,300);
    if(error) return alert(error.message);
    window.open(data.signedUrl,"_blank","noopener,noreferrer");
  };
  const AttachmentList=({items}:{items:any})=>{
    const rows=Array.isArray(items)?items:[];
    if(!rows.length)return <p>N/A</p>;
    return <div>{rows.map((a:any,i:number)=><div key={i} style={{marginBottom:6}}><button className="no-print" onClick={()=>void openAttachment(a)}>{a.file_name||"Open attachment"}</button><span className="print-only">{a.file_name||a.storage_path}</span>{a.uploaded_by&&<span> — uploaded by {a.uploaded_by} {a.uploaded_at?formatDateTime(a.uploaded_at):""}</span>}</div>)}</div>;
  };
  const workflowLabel = (value:any) => {
    const v=String(value||"");
    const labels:Record<string,string>={internal_audit:"Internal Audit",supplier_audit:"Supplier Audit",process_audit:"Process Audit",qms_audit:"QMS Audit",regulatory_audit:"Regulatory Audit",completed:"Accepted",rejected:"Returned for Additional Action",observation:"Observation",minor:"Minor",major:"Major",closed:"Closed",approved:"Approved",pending:"Pending"};
    return labels[v] || v.replace(/_/g," ").replace(/\b\w/g,m=>m.toUpperCase());
  };

  if (loading) return <main style={{ padding: "20px" }}>Loading audit report...</main>;
  if (!audit) return <main style={{ padding: "20px" }}>Audit record not found.</main>;

  return (
    <main style={pageStyle}>
      <div className="no-print" style={{ marginBottom: "18px" }}>
        <button onClick={() => window.print()} style={{ padding: "8px 12px", marginRight: "10px" }}>
          Print / Save as PDF
        </button>
        <Link href={`/audits/${id}`}>Back to Audit</Link>
      </div>

      <header style={headerStyle}>
        <div>
          <div style={{fontSize:"12px",fontWeight:800,letterSpacing:"1px"}}>QUALISPHERE CONTROLLED QUALITY RECORD</div>
          <h1 style={{ margin: 0 }}>Audit Controlled Record</h1>
          <div><strong>Company:</strong> {displayValue(tenant?.company_name)}</div>
          <div><strong>Audit Number:</strong> {displayValue(audit.audit_number || "AUD-PENDING")}</div>
          <div><strong>Record ID:</strong> {displayValue(audit.id)}</div>
          <div><strong>Status:</strong> {displayValue(audit.status)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div><strong>Generated:</strong> {formatDateTime(new Date().toISOString())}</div>
          <div><strong>QMS Record Type:</strong> Audit Report</div>
          <div><strong>Print Use:</strong> Audit / controlled record review</div>
        </div>
      </header>

      <section style={sectionStyle}>
        <h2>1. Audit Planning</h2>
        <div style={gridStyle}>
          <Field label="Audit Number" value={audit.audit_number} />
          <Field label="Audit Title" value={audit.audit_title} />
          <Field label="Audit Type" value={workflowLabel(audit.audit_type)} />
          <Field label="Audit Owner / Lead Auditor" value={audit.lead_auditor || audit.owner_email || audit.auditor} />
          <Field label="Lead Auditor Email" value={audit.lead_auditor_email || audit.owner_email} />
          <Field label="Audit Team" value={audit.audit_team} />
          <Field label="Planned Start" value={formatDate(audit.scheduled_start_date || audit.audit_date)} />
          <Field label="Planned End" value={formatDate(audit.scheduled_end_date)} />
          <Field label="Status" value={workflowLabel(audit.status)} />
          <Field label="Created At" value={formatDateTime(audit.created_at)} />
        </div>
        <Field label="Audit Objectives" value={audit.audit_objectives} />
        <Field label="Audit Scope" value={audit.audit_scope} />
        <Field label="Audit Criteria / Requirements" value={audit.audit_criteria} />
      </section>

      <section style={sectionStyle}>
        <h2>2. Audit Execution</h2>
        <div style={gridStyle}><Field label="Actual Start" value={formatDate(audit.actual_start_date)} /><Field label="Actual End" value={formatDate(audit.actual_end_date)} /></div>
        <Field label="Execution Notes / Evidence Reviewed" value={audit.execution_notes} />
        <h3>Audit Execution Evidence Attachments</h3><AttachmentList items={audit.execution_attachments}/>
      </section>

      <section style={sectionStyle}>
        <h2>3. Findings Summary</h2>
        <div style={gridStyle}>
          <Field label="Total Findings" value={findings.length} />
          <Field label="Minor Findings" value={findings.filter((f) => f.finding_severity === "minor").length} />
          <Field label="Major Findings" value={findings.filter((f) => f.finding_severity === "major").length} />
          <Field label="Observations" value={findings.filter((f) => f.finding_severity === "observation").length} />
          <Field label="Open Findings" value={findings.filter((f) => f.finding_status !== "closed").length} />
          <Field label="Closed Findings" value={findings.filter((f) => f.finding_status === "closed").length} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>4. Audit Findings — Response, Escalation & Verification</h2>
        {findings.length === 0 ? (
          <p>No findings recorded.</p>
        ) : (
          findings.map((finding, index) => (
            <section key={finding.id} style={{ ...sectionStyle, marginTop: "10px" }}>
              <h3>Finding {index + 1}: {finding.finding_title}</h3>
              <Field label="Finding Description" value={finding.finding_description} />
              <Field label="Classification" value={workflowLabel(finding.finding_severity)} />
              <Field label="Clause / Requirement Reference" value={finding.clause_reference} />
              <Field label="Objective Evidence" value={finding.evidence} />
              <h4>Finding Objective Evidence Attachments</h4><AttachmentList items={finding.finding_attachments}/>
              <Field label="Finding Owner" value={finding.finding_owner} />
              <Field label="Response Due Date" value={formatDate(finding.response_due_date)} />
              <Field label="Auditee Response" value={finding.auditee_response} />
              <Field label="Correction / Immediate Action" value={finding.correction} />
              <Field label="Corrective Action" value={finding.corrective_action} />
              <h4>Finding Response / Corrective Action Evidence</h4><AttachmentList items={finding.response_attachments}/>
              <Field label="Linked CAPA" value={finding.linked_capa_id} />
              <Field label="Linked SCAR" value={finding.linked_scar_id} />
              <Field label="Risk-Based Escalation Justification" value={finding.escalation_justification} />
              <h4>Response Verification History</h4>
              {tasks.filter((t:any)=>t.entity_type==="audit_finding"&&t.entity_id===finding.id&&t.task_type==="audit_finding_verification").map((t:any,n:number)=><div key={t.id} style={signatureStyle}><strong>Verification Cycle {n+1}</strong><Field label="Lead Auditor" value={t.assigned_to_email}/><Field label="Decision" value={workflowLabel(t.status)}/><Field label="Decision Date" value={formatDateTime(t.signed_at || t.completed_at)}/><Field label="Verification Notes" value={t.approver_comment}/><Field label="Signature Meaning" value={t.signature_meaning}/></div>)}
              <Field label="Final Verification Notes" value={finding.verification_notes} />
              <Field label="Final Verified By" value={finding.verified_by} />
              <Field label="Final Verified At" value={formatDateTime(finding.verified_at)} />
              <Field label="Finding Status" value={finding.finding_status} />
              <Field label="Closed At" value={formatDateTime(finding.closed_at)} />
              <Field label="Created At" value={formatDateTime(finding.created_at)} />
            </section>
          ))
        )}
      </section>

      <section style={sectionStyle}>
        <h2>5. Audit Closure Approval / Electronic Signature</h2>
        <div style={signatureStyle}>
          <Field label="Closure Approval Status" value={workflowLabel(audit.closure_approval_status)} />
          <Field label="Closure Submitted By" value={audit.closure_submitted_by} />
          <Field label="Closure Submitted At" value={formatDateTime(audit.closure_submitted_at)} />
          <Field label="Closure Approver" value={audit.closure_approver_email} />
          <Field label="Closed By" value={audit.closed_by} />
          <Field label="Closed At" value={formatDateTime(audit.closed_at)} />
          <Field label="Signed By" value={audit.signed_by} />
          <Field label="Signed At" value={formatDateTime(audit.signed_at)} />
          <Field label="Signature Email Entered" value={audit.signature_email_entered} />
          <Field label="Signature Meaning" value={audit.signature_meaning} />
          <Field label="Authentication Method" value="Active authenticated session with email re-entry confirmation" />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>6. Complete Audit Trail — Audit & Findings</h2>
        {auditLogs.length === 0 ? (
          <p>No audit log entries found for this audit report.</p>
        ) : (
          auditLogs.map((log) => (
            <div key={log.id} style={{ borderTop: "1px solid #ddd", paddingTop: "8px", marginTop: "8px" }}>
              <Field label="Date / Time" value={formatDateTime(log.created_at)} />
              <Field label="User" value={log.user_email} />
              <Field label="Action" value={log.action} />
              <Field label="Details" value={log.details} />
            </div>
          ))
        )}
      </section>

      <footer className="print-footer">
        Audit Controlled Record | {audit.audit_number || audit.id} | Generated {formatDateTime(new Date().toISOString())}
      </footer>

      <style jsx global>{`
        .print-only { display: none; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: inline !important; }

          body {
            color: black;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          main {
            padding: 18px !important;
          }

          section {
            page-break-inside: avoid;
          }

          .print-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            font-size: 10px;
            border-top: 1px solid #999;
            padding: 6px 20px;
            background: white;
          }
        }

        @page {
          margin: 0.75in;
        }
      `}</style>
    </main>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <strong>{label}:</strong> {displayValue(value)}
    </div>
  );
}

function displayValue(input: any) {
  return input === null || input === undefined || input === "" ? "N/A" : String(input);
}

const pageStyle: React.CSSProperties = {
  padding: "36px",
  fontFamily: "Arial, sans-serif",
  color: "#111",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  borderBottom: "2px solid #111",
  paddingBottom: "14px",
  marginBottom: "18px",
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "14px",
  marginTop: "16px",
  background: "#fff",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "8px",
};

const signatureStyle: React.CSSProperties = {
  border: "1px solid #94a3b8",
  borderRadius: "8px",
  padding: "12px",
  marginTop: "10px",
  background: "#f8fafc",
};
