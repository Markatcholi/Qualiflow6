"use client";

import React,{useEffect,useMemo,useState} from "react";
import {supabase} from "../lib/supabaseClient";

type Method={id:string;label:string;release_blocking:boolean;is_active:boolean};
type Req={id:string;training_method_id:string;rationale:string|null;training_methods?:Method|Method[]|null};

export default function DocumentTrainingRequirements({documentId,tenantId,userEmail,editable}:{documentId:string;tenantId:string;userEmail:string;editable:boolean}){
 const [methods,setMethods]=useState<Method[]>([]); const [reqs,setReqs]=useState<Req[]>([]);
 const [methodId,setMethodId]=useState(""); const [rationale,setRationale]=useState(""); const [busy,setBusy]=useState(false);
 const load=async()=>{
  const [m,r]=await Promise.all([
   supabase.from("training_methods").select("id,label,release_blocking,is_active").eq("tenant_id",tenantId).eq("is_active",true).order("label"),
   supabase.from("document_training_requirements").select("id,training_method_id,rationale,training_methods(id,label,release_blocking,is_active)").eq("document_id",documentId).order("created_at")
  ]);
  if(m.error)throw new Error(m.error.message); if(r.error)throw new Error(r.error.message);
  setMethods((m.data||[]) as Method[]); setReqs((r.data||[]) as Req[]);
 };
 useEffect(()=>{load().catch(e=>alert(e.message))},[documentId,tenantId]);
 const add=async()=>{
  if(!methodId)return alert("Select a training method."); if(!rationale.trim())return alert("Training rationale / scope is required.");
  setBusy(true);
  const impact=await supabase.from("document_impact_assessments").select("id").eq("document_id",documentId).eq("impact_area","training").maybeSingle();
  const {error}=await supabase.from("document_training_requirements").insert({tenant_id:tenantId,document_id:documentId,impact_assessment_id:impact.data?.id||null,training_method_id:methodId,rationale:rationale.trim(),created_by:userEmail});
  setBusy(false); if(error)return alert(error.message); setMethodId("");setRationale("");await load();
 };
 const remove=async(id:string)=>{if(!confirm("Remove this training requirement?"))return;const {error}=await supabase.from("document_training_requirements").delete().eq("id",id);if(error)return alert(error.message);await load()};
 const methodFor=(r:Req)=>{const joined=Array.isArray(r.training_methods)?r.training_methods[0]:r.training_methods;return joined||methods.find(m=>m.id===r.training_method_id)};
 return <div style={{marginTop:14,padding:14,background:"#f8fafc",border:"1px solid #dbe3ec",borderRadius:10}}>
  <strong>Training Requirements</strong>
  <p style={subtle}>Define the training requirement here. Document Control will select the configured training group(s) and due date after formal approval.</p>
  {reqs.length===0?<p style={subtle}>No training requirements defined.</p>:reqs.map(r=>{const m=methodFor(r);return <div key={r.id} style={item}><div><strong>{m?.label||"Training"}</strong> <span style={badge}>{m?.release_blocking?"Release prerequisite":"Post-release completion permitted"}</span><div>{r.rationale}</div></div>{editable?<button onClick={()=>remove(r.id)} style={removeButton}>Remove</button>:null}</div>})}
  {editable?<><div style={grid}><select value={methodId} onChange={e=>setMethodId(e.target.value)} style={input}><option value="">Select configured training method</option>{methods.map(m=><option key={m.id} value={m.id}>{m.label}{m.release_blocking?" — release prerequisite":""}</option>)}</select><textarea value={rationale} onChange={e=>setRationale(e.target.value)} rows={2} placeholder="Training rationale / scope" style={input}/></div><button disabled={busy} onClick={add} style={button}>Add Training Requirement</button>{methods.length===0?<p style={warning}>No active training methods are configured. Configure them in Training Management first.</p>:null}</>:null}
 </div>
}
const subtle:React.CSSProperties={color:"#64748b",fontSize:13};
const item:React.CSSProperties={display:"flex",justifyContent:"space-between",gap:12,padding:"10px 0",borderTop:"1px solid #e5e7eb"};
const badge:React.CSSProperties={fontSize:12,color:"#475569",marginLeft:6};
const grid:React.CSSProperties={display:"grid",gridTemplateColumns:"minmax(220px,1fr) minmax(280px,2fr)",gap:10,marginTop:10};
const input:React.CSSProperties={width:"100%",padding:9,border:"1px solid #cbd5e1",borderRadius:7,boxSizing:"border-box"};
const button:React.CSSProperties={marginTop:10,background:"#172033",color:"#fff",border:0,borderRadius:7,padding:"9px 13px",fontWeight:700,cursor:"pointer"};
const removeButton:React.CSSProperties={background:"transparent",border:0,textDecoration:"underline",cursor:"pointer"};
const warning:React.CSSProperties={color:"#92400e",fontSize:12};
