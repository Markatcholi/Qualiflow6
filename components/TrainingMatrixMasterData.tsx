"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type MatrixRow = { id:string; role_name:string|null; department:string|null; document_number:string; required_training:boolean|null; effectiveness_required:boolean|null };
export default function TrainingMatrixMasterData({tenantId}:{tenantId:string}) {
 const [rows,setRows]=useState<MatrixRow[]>([]);
 const [role,setRole]=useState("");
 const [department,setDepartment]=useState("");
 const [documentNumber,setDocumentNumber]=useState("");
 const [required,setRequired]=useState(true);
 const [effectiveness,setEffectiveness]=useState(false);
 const [message,setMessage]=useState("");
 const [saving,setSaving]=useState(false);
 const load=async()=>{const {data,error}=await supabase.from("training_matrix").select("id,role_name,department,document_number,required_training,effectiveness_required").eq("tenant_id",tenantId).order("document_number");if(error)setMessage(error.message);else setRows((data||[]) as MatrixRow[]);};
 useEffect(()=>{void load();},[tenantId]);
 const add=async()=>{
  if(!role.trim()&&!department.trim()){setMessage("Role or department is required.");return;}
  if(!documentNumber.trim()){setMessage("Document number is required.");return;}
  setSaving(true);setMessage("");
  const {error}=await supabase.from("training_matrix").insert({tenant_id:tenantId,role_name:role.trim()||null,department:department.trim()||null,document_number:documentNumber.trim(),required_training:required,effectiveness_required:effectiveness});
  setSaving(false);if(error){setMessage(error.message);return;}
  setRole("");setDepartment("");setDocumentNumber("");await load();setMessage("Training matrix requirement added.");
 };
 return <section style={{border:"1px solid #d1d5db",borderRadius:10,padding:18,marginTop:20}}>
  <h2>Training Matrix</h2>
  <p>Define customer-specific required training by role, department and controlled document. Existing Training Management auto-assignment continues to use this same matrix.</p>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>
   <label>Role<input value={role} onChange={e=>setRole(e.target.value)} style={{display:"block",width:"100%"}} /></label>
   <label>Department<input value={department} onChange={e=>setDepartment(e.target.value)} style={{display:"block",width:"100%"}} /></label>
   <label>Document Number<input value={documentNumber} onChange={e=>setDocumentNumber(e.target.value)} style={{display:"block",width:"100%"}} /></label>
  </div>
  <div style={{display:"flex",gap:20,margin:"12px 0"}}>
   <label><input type="checkbox" checked={required} onChange={e=>setRequired(e.target.checked)} /> Required Training</label>
   <label><input type="checkbox" checked={effectiveness} onChange={e=>setEffectiveness(e.target.checked)} /> Effectiveness Required</label>
  </div>
  <button type="button" disabled={saving} onClick={add}>{saving?"Saving...":"Add Matrix Row"}</button>
  {message?<p role="status">{message}</p>:null}
  <ul>{rows.map(row=><li key={row.id}>{row.role_name||"Any Role"} / {row.department||"Any Department"} → {row.document_number}{row.effectiveness_required?" | Effectiveness Required":""}</li>)}</ul>
 </section>;
}
