"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "../../../../../../lib/supabaseClient";

export default function AuditFindingTaskPage() {
  const params = useParams<{ id: string; findingId: string }>();
  const search = useSearchParams();
  const taskId = search.get("taskId") || "";
  const [audit,setAudit]=useState<any>(null);
  const [finding,setFinding]=useState<any>(null);
  const [task,setTask]=useState<any>(null);
  const [email,setEmail]=useState("");
  const [response,setResponse]=useState({auditee_response:"",correction:"",corrective_action:""});
  const [message,setMessage]=useState("");
  const [verificationNotes,setVerificationNotes]=useState("");
  const [escalationJustification,setEscalationJustification]=useState("");

  const load=async()=>{
    const {data:user}=await supabase.auth.getUser();
    const current=String(user?.user?.email||"").toLowerCase(); setEmail(current);
    if(!current||!taskId) return setMessage("A valid signed-in task assignment is required.");
    const {data:t,error:te}=await supabase.from("approval_tasks").select("*").eq("id",taskId).eq("entity_type","audit_finding").eq("entity_id",params.findingId).eq("assigned_to_email",current).maybeSingle();
    if(te||!t) return setMessage("This Audit Finding task is not assigned to the logged-in user.");
    setTask(t);
    const {data:f,error:fe}=await supabase.from("audit_findings").select("*").eq("id",params.findingId).eq("audit_id",params.id).maybeSingle();
    if(fe||!f) return setMessage("Audit Finding is not available in your active company.");
    setFinding(f); setResponse({auditee_response:f.auditee_response||"",correction:f.correction||"",corrective_action:f.corrective_action||""});
    setVerificationNotes(f.verification_notes||""); setEscalationJustification(f.escalation_justification||"");
    const {data:a}=await supabase.from("audits").select("id,audit_number,audit_title,audit_type,audit_scope,audit_criteria,lead_auditor,lead_auditor_email,tenant_id").eq("id",params.id).eq("tenant_id",f.tenant_id).maybeSingle();
    setAudit(a);
  };
  useEffect(()=>{void load();},[params.id,params.findingId,taskId]);

  const submit=async()=>{
    if(!task||task.status!=="pending") return setMessage("This task is no longer pending.");
    if(task.task_type!=="audit_finding_response") return setMessage("This task is not a Finding Response assignment.");
    if(!response.auditee_response.trim()||!response.correction.trim()) return setMessage("Auditee Response and Correction / Immediate Action are required.");
    if(finding.finding_severity!=="observation"&&!response.corrective_action.trim()) return setMessage("Corrective Action is required for Minor and Major Findings.");
    const now=new Date().toISOString();
    const {error}=await supabase.from("audit_findings").update({auditee_response:response.auditee_response.trim(),correction:response.correction.trim(),corrective_action:response.corrective_action.trim()||null,finding_status:"response_submitted"}).eq("id",finding.id).eq("tenant_id",finding.tenant_id);
    if(error)return setMessage(error.message);
    await supabase.from("approval_tasks").update({status:"completed",completed_by:email,completed_at:now,completion_comment:"Finding response submitted for Lead Auditor verification."}).eq("id",task.id).eq("assigned_to_email",email);
    const verifier=String(audit?.lead_auditor_email||"").toLowerCase();
    if(!verifier)return setMessage("Response saved, but Lead Auditor Email is missing. Contact the Audit Owner.");
    const {data:existing}=await supabase.from("approval_tasks").select("id").eq("entity_type","audit_finding").eq("entity_id",finding.id).eq("task_type","audit_finding_verification").eq("status","pending").maybeSingle();
    if(!existing){const {error:ve}=await supabase.from("approval_tasks").insert({entity_type:"audit_finding",entity_id:finding.id,task_type:"audit_finding_verification",required_function:"Lead Auditor",assigned_to_email:verifier,assigned_by_email:email,status:"pending",due_date:finding.response_due_date||null,record_number:audit.audit_number,task_title:`Audit Finding Verification — ${audit.audit_number}`,task_instructions:`Review the submitted response, correction, corrective action, and escalation evaluation for finding: ${finding.finding_title}.`});if(ve)return setMessage(ve.message);}
    await supabase.rpc("qualisphere_add_audit_log",{p_entity_type:"audit_finding",p_entity_id:finding.id,p_action:"audit_finding_response_submitted",p_details:`Finding response submitted by assigned Finding Owner ${email} for Lead Auditor verification.`});
    setMessage("Response submitted for Lead Auditor verification."); await load();
  };

  const saveEscalationJustification=async()=>{
    if(!task||task.task_type!=="audit_finding_verification"||task.status!=="pending") return setMessage("Only the assigned pending Lead Auditor verification task can update escalation evaluation.");
    const {error}=await supabase.from("audit_findings").update({escalation_justification:escalationJustification.trim()||null}).eq("id",finding.id).eq("tenant_id",finding.tenant_id);
    if(error)return setMessage(error.message);
    await supabase.rpc("qualisphere_add_audit_log",{p_entity_type:"audit_finding",p_entity_id:finding.id,p_action:"audit_finding_escalation_evaluation_updated",p_details:`Escalation evaluation updated by assigned Lead Auditor ${email}.`});
    setMessage("Escalation evaluation saved."); await load();
  };

  const verify=async(decision:"accept"|"return")=>{
    if(!task||task.task_type!=="audit_finding_verification"||task.status!=="pending") return setMessage("This verification task is no longer pending.");
    if(finding.finding_status!=="response_submitted") return setMessage("A submitted Finding Response is required before verification.");
    const notes=verificationNotes.trim(); if(!notes)return setMessage("Verification Notes are required.");
    const escalationComplete=!!finding.linked_scar_id||!!finding.linked_capa_id||!!String(finding.escalation_justification||"").trim();
    if(finding.finding_severity==="major"&&!escalationComplete)return setMessage("Major Finding requires linked CAPA/SCAR or a saved risk-based justification before verification.");
    const now=new Date().toISOString();
    const update=decision==="accept"?{verification_notes:notes,verified_by:email,verified_at:now,finding_status:"closed",closed_at:now}:{verification_notes:notes,verified_by:null,verified_at:null,finding_status:"returned_for_action",closed_at:null};
    const {error}=await supabase.from("audit_findings").update(update).eq("id",finding.id).eq("tenant_id",finding.tenant_id); if(error)return setMessage(error.message);
    const {error:taskError}=await supabase.from("approval_tasks").update({status:decision==="accept"?"completed":"rejected",approver_comment:notes,signed_by:email,signed_at:now,signature_meaning:decision==="accept"?"Audit finding response verified and accepted.":"Audit finding response returned for additional action."}).eq("id",task.id).eq("assigned_to_email",email); if(taskError)return setMessage(taskError.message);
    if(decision==="return"){
      const owner=String(finding.finding_owner||"").trim().toLowerCase();
      if(!owner)return setMessage("Finding returned, but Finding Owner email is missing.");
      const {data:existing}=await supabase.from("approval_tasks").select("id").eq("entity_type","audit_finding").eq("entity_id",finding.id).eq("task_type","audit_finding_response").eq("status","pending").maybeSingle();
      if(!existing){const {error:re}=await supabase.from("approval_tasks").insert({entity_type:"audit_finding",entity_id:finding.id,task_type:"audit_finding_response",required_function:"Finding Owner",assigned_to_email:owner,assigned_by_email:email,status:"pending",due_date:finding.response_due_date||null,record_number:audit.audit_number,task_title:`Audit Finding Response — ${audit.audit_number}`,task_instructions:`Finding returned by Lead Auditor for additional action. Verification notes: ${notes}`});if(re)return setMessage(re.message);}
    }
    await supabase.rpc("qualisphere_add_audit_log",{p_entity_type:"audit_finding",p_entity_id:finding.id,p_action:decision==="accept"?"audit_finding_verified_closed":"audit_finding_returned_for_action",p_details:decision==="accept"?`Finding verified and closed by ${email}. Verification: ${notes}`:`Finding returned for additional action by ${email}. Verification: ${notes}`});
    setMessage(decision==="accept"?"Finding verified and closed.":"Finding returned to the Finding Owner for additional action."); await load();
  };

  if(!task||!finding||!audit)return <main style={page}><h1>Audit Finding Task</h1><p>{message||"Loading assigned finding..."}</p></main>;
  const responseTask=task.task_type==="audit_finding_response";
  return <main style={page}>
    <a href="/my-approval-tasks">← Back to My Workspace</a>
    <h1>Audit Finding Task</h1>
    <section style={card}><h2>{audit.audit_number} — {audit.audit_title}</h2><p><b>Audit Type:</b> {audit.audit_type||"N/A"}</p><p><b>Audit Scope:</b> {audit.audit_scope||"N/A"}</p><p><b>Audit Criteria:</b> {audit.audit_criteria||"N/A"}</p><p><b>Lead Auditor:</b> {audit.lead_auditor||"N/A"}</p></section>
    <section style={card}><h2>{finding.finding_title}</h2><p><b>Classification:</b> {finding.finding_severity}</p><p><b>Requirement / Clause:</b> {finding.clause_reference}</p><p><b>Objective Evidence:</b> {finding.evidence}</p><p><b>Finding:</b> {finding.finding_description}</p><p><b>Finding Owner:</b> {finding.finding_owner}</p><p><b>Response Due:</b> {finding.response_due_date||"N/A"}</p></section>
    {responseTask?<section style={card}><h2>Finding Response / Corrective Action</h2><label>Auditee Response</label><textarea style={field} rows={4} disabled={task.status!=="pending"} value={response.auditee_response} onChange={e=>setResponse({...response,auditee_response:e.target.value})}/><label>Correction / Immediate Action</label><textarea style={field} rows={4} disabled={task.status!=="pending"} value={response.correction} onChange={e=>setResponse({...response,correction:e.target.value})}/><label>Corrective Action{finding.finding_severity==="observation"?" (Optional for Observation)":""}</label><textarea style={field} rows={4} disabled={task.status!=="pending"} value={response.corrective_action} onChange={e=>setResponse({...response,corrective_action:e.target.value})}/>{task.status==="pending"?<button onClick={submit} style={button}>Submit Response for Verification</button>:<p><b>Status:</b> {task.status}</p>}</section>:<><section style={card}><h2>Submitted Finding Response</h2><p><b>Auditee Response:</b> {finding.auditee_response||"N/A"}</p><p><b>Correction / Immediate Action:</b> {finding.correction||"N/A"}</p><p><b>Corrective Action:</b> {finding.corrective_action||"N/A"}</p></section><section style={card}><h2>Escalation Evaluation</h2><p><b>Linked SCAR:</b> {finding.linked_scar_id||"Not opened"}</p><p><b>Linked CAPA:</b> {finding.linked_capa_id||"Not opened"}</p><label>Risk-Based Justification if SCAR/CAPA is Not Opened</label><textarea style={field} rows={4} disabled={task.status!=="pending"} value={escalationJustification} onChange={e=>setEscalationJustification(e.target.value)}/>{task.status==="pending"&&<button onClick={saveEscalationJustification}>Save Escalation Justification</button>}<p style={{fontSize:13,color:"#475569"}}>Major Findings require linked CAPA/SCAR or saved risk-based justification before verification. CAPA/SCAR initiation remains available from the owned Audit workflow.</p></section><section style={card}><h2>Finding Verification</h2><label>Verification Notes</label><textarea style={field} rows={4} disabled={task.status!=="pending"} value={verificationNotes} onChange={e=>setVerificationNotes(e.target.value)}/>{task.status==="pending"?<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button onClick={()=>verify("accept")} style={button}>Accept & Close Finding</button><button onClick={()=>verify("return")}>Return for Additional Action</button></div>:<p><b>Status:</b> {task.status}</p>}</section></>}
    {message&&<p><b>{message}</b></p>}
  </main>;
}
const page:React.CSSProperties={maxWidth:1000,margin:"0 auto",padding:24,fontFamily:"Arial, sans-serif"};
const card:React.CSSProperties={border:"1px solid #dbe3ee",borderRadius:12,padding:18,marginTop:16,background:"#fff"};
const field:React.CSSProperties={display:"block",width:"100%",boxSizing:"border-box",padding:10,margin:"6px 0 14px",border:"1px solid #cbd5e1",borderRadius:8};
const button:React.CSSProperties={background:"#2563eb",color:"#fff",border:0,borderRadius:8,padding:"10px 14px",fontWeight:800,cursor:"pointer"};
