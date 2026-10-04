"use client";

import React,{useEffect,useState} from "react";
import {supabase} from "../lib/supabaseClient";

type Method={id:string;label:string;release_blocking:boolean;acknowledgement_required:boolean;evidence_required:boolean};
type Req={id:string;rationale:string|null;training_method_id:string;training_methods?:Method|Method[]|null};
type Group={id:string;group_name:string};
type Member={training_group_id:string;user_email:string};
type Assignment={id:string;training_requirement_id:string|null;training_group_id:string|null;assigned_to_email:string;status:string|null;due_date:string|null;release_blocking:boolean};

export default function DocumentTrainingAssignment({documentId,tenantId,documentNumber,revision,userEmail,canCoordinate}:{documentId:string;tenantId:string;documentNumber:string;revision:string;userEmail:string;canCoordinate:boolean}){
 const [reqs,setReqs]=useState<Req[]>([]),[groups,setGroups]=useState<Group[]>([]),[members,setMembers]=useState<Member[]>([]),[assignments,setAssignments]=useState<Assignment[]>([]);
 const [forms,setForms]=useState<Record<string,{groupId:string;dueDate:string}>>({}); const [busy,setBusy]=useState(false);
 const load=async()=>{
  const [r,g,m,a]=await Promise.all([
   supabase.from("document_training_requirements").select("id,rationale,training_method_id,training_methods(id,label,release_blocking,acknowledgement_required,evidence_required)").eq("document_id",documentId).order("created_at"),
   supabase.from("training_groups").select("id,group_name").eq("tenant_id",tenantId).eq("is_active",true).order("group_name"),
   supabase.from("training_group_members").select("training_group_id,user_email").eq("tenant_id",tenantId),
   supabase.from("training_assignments").select("id,training_requirement_id,training_group_id,assigned_to_email,status,due_date,release_blocking").eq("document_id",documentId)
  ]);
  if(r.error)throw new Error(r.error.message);if(g.error)throw new Error(g.error.message);if(m.error)throw new Error(m.error.message);if(a.error)throw new Error(a.error.message);
  setReqs((r.data||[]) as Req[]);setGroups((g.data||[]) as Group[]);setMembers((m.data||[]) as Member[]);setAssignments((a.data||[]) as Assignment[]);
 };
 useEffect(()=>{load().catch(e=>alert(e.message))},[documentId,tenantId]);
 const methodFor=(r:Req)=>Array.isArray(r.training_methods)?r.training_methods[0]:r.training_methods;
 const patch=(id:string,p:Partial<{groupId:string;dueDate:string}>)=>setForms(f=>({...f,[id]:{groupId:f[id]?.groupId||"",dueDate:f[id]?.dueDate||"",...p}}));
 const assign=async(r:Req)=>{
  const form=forms[r.id]||{groupId:"",dueDate:""}; if(!form.groupId)return alert("Select a training group.");
  const selected=groups.find(g=>g.id===form.groupId); const groupMembers=members.filter(m=>m.training_group_id===form.groupId);
  if(groupMembers.length===0)return alert("The selected training group has no members.");
  const method=methodFor(r); if(!method)return alert("Training method configuration is unavailable.");
  const existing=new Set(assignments.filter(a=>a.training_requirement_id===r.id&&a.training_group_id===form.groupId).map(a=>a.assigned_to_email.toLowerCase()));
  const rows=groupMembers.filter(m=>!existing.has(m.user_email.toLowerCase())).map(m=>({
   tenant_id:tenantId,document_id:documentId,training_requirement_id:r.id,training_group_id:form.groupId,training_method_id:method.id,
   assigned_to_email:m.user_email.toLowerCase(),assigned_by_email:userEmail||"unknown",assignment_source:"controlled_document_post_approval",
   training_title:`${method.label} — ${documentNumber} Rev ${revision}`,training_description:r.rationale||`${method.label} required for controlled document ${documentNumber} Rev ${revision}.`,
   due_date:form.dueDate||null,status:"assigned",acknowledgement_required:method.acknowledgement_required,effectiveness_required:false,supervisor_verification_required:false,release_blocking:method.release_blocking
  }));
  if(rows.length===0)return alert("This training group is already assigned to this requirement.");
  setBusy(true);const {error}=await supabase.from("training_assignments").insert(rows);setBusy(false);if(error)return alert(error.message);await load();
 };
 if(reqs.length===0)return <p style={subtle}>No training requirements were identified in Impact Assessment.</p>;
 return <div style={{display:"grid",gap:14}}>
  {reqs.map(r=>{const method=methodFor(r);const related=assignments.filter(a=>a.training_requirement_id===r.id);return <div key={r.id} style={card}>
   <div><strong>{method?.label||"Training"}</strong> — {method?.release_blocking?"Must be completed before release":"May remain open after release"}<div style={subtle}>{r.rationale}</div></div>
   {related.length>0?<div style={summary}>{related.length} individual assignment(s) created · {related.filter(a=>a.status==="completed"||a.status==="waived").length} completed/waived</div>:null}
   {canCoordinate?<div style={grid}><label style={label}>Training Group<select value={forms[r.id]?.groupId||""} onChange={e=>patch(r.id,{groupId:e.target.value})} style={input}><option value="">Select configured group</option>{groups.map(g=><option key={g.id} value={g.id}>{g.group_name}</option>)}</select></label><label style={label}>Due Date (optional)<input type="date" value={forms[r.id]?.dueDate||""} onChange={e=>patch(r.id,{dueDate:e.target.value})} style={input}/></label><button disabled={busy} onClick={()=>assign(r)} style={button}>Assign Training</button></div>:null}
  </div>})}
 </div>
}
const subtle:React.CSSProperties={color:"#64748b",fontSize:13};
const card:React.CSSProperties={border:"1px solid #dbe3ec",borderRadius:10,padding:12};
const summary:React.CSSProperties={marginTop:8,padding:8,background:"#f8fafc",borderRadius:7,fontSize:13};
const grid:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10,marginTop:10,alignItems:"end"};
const label:React.CSSProperties={fontWeight:700,display:"grid",gap:5};
const input:React.CSSProperties={width:"100%",padding:9,border:"1px solid #cbd5e1",borderRadius:7,boxSizing:"border-box"};
const button:React.CSSProperties={background:"#172033",color:"#fff",border:0,borderRadius:7,padding:"10px 14px",fontWeight:700,cursor:"pointer"};
