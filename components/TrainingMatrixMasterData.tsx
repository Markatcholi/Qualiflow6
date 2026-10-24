"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { MatrixRequirement, normalizeTrainingValue as norm } from "../lib/trainingMatrix";

type Audience = { department: string; roles: string[] };
type Procedure = { document_number: string; title: string };
export default function TrainingMatrixMasterData({tenantId}:{tenantId:string}) {
 const [rows,setRows]=useState<MatrixRequirement[]>([]);
 const [procedures,setProcedures]=useState<Procedure[]>([]);
 const [employees,setEmployees]=useState<{department:string;role_name:string}[]>([]);
 const [departmentOptions,setDepartmentOptions]=useState<string[]>([]);
 const [documentNumber,setDocumentNumber]=useState("");
 const [allEmployees,setAllEmployees]=useState(false);
 const [audiences,setAudiences]=useState<Audience[]>([]);
 const [department,setDepartment]=useState("");
 const [message,setMessage]=useState("");
 const [saving,setSaving]=useState(false);
 const load=async()=>{
  const [m,d,e,departments]=await Promise.all([
   supabase.from("training_matrix").select("id,role_name,department,document_number,required_training").eq("tenant_id",tenantId).order("document_number"),
   supabase.from("controlled_documents").select("document_number,title").eq("tenant_id",tenantId).order("document_number"),
   supabase.from("employee_profiles").select("department,role_name").eq("tenant_id",tenantId).eq("active",true),
   supabase.from("md_departments").select("label").eq("tenant_id",tenantId).order("label")
  ]);
  for(const r of [m,d,e,departments]) if(r.error) throw r.error;
  setRows(m.data||[]);setProcedures(d.data||[]);setEmployees(e.data||[]);setDepartmentOptions((departments.data||[]).map(x=>x.label));
 };
 useEffect(()=>{setRows([]);setDocumentNumber("");setAudiences([]);setAllEmployees(false);void load().catch(e=>setMessage(e.message));},[tenantId]);
 const grouped=useMemo(()=>Array.from(new Set(rows.filter(r=>r.required_training).map(r=>r.document_number))).filter(Boolean).sort(),[rows]);
 const unique=(values:string[])=>Array.from(new Map(values.filter(Boolean).map(v=>[norm(v),v])).values()).sort();
 const departments=unique([...departmentOptions,...employees.map(e=>e.department),...rows.map(r=>r.department)]);
 const procedureOptions=Array.from(new Map([...procedures,...rows.map(r=>({document_number:r.document_number,title:""}))].filter(d=>d.document_number).map(d=>[d.document_number,d])).values());
 const edit=(number:string)=>{
  const selected=rows.filter(r=>norm(r.document_number)===norm(number)&&r.required_training);
  setDocumentNumber(number);setAllEmployees(selected.some(r=>!norm(r.department)&&!norm(r.role_name)));
  setAudiences(unique(selected.map(r=>r.department||"")).map(dep=>({department:dep,roles:selected.some(r=>norm(r.department)===norm(dep)&&!norm(r.role_name))?[]:unique(selected.filter(r=>norm(r.department)===norm(dep)).map(r=>r.role_name))})));
  // Preserve legacy role-only rows, which apply across departments.
  if(selected.some(r=>!norm(r.department)&&norm(r.role_name))) setAudiences(a=>[...a,{department:"",roles:unique(selected.filter(r=>!norm(r.department)).map(r=>r.role_name))}]);
  setMessage("");
 };
 const save=async(disable=false)=>{
  if(!documentNumber)return setMessage("Select a procedure.");
  if(!disable&&!allEmployees&&!audiences.length)return setMessage("Add at least one department, or select All employees.");
  setSaving(true);setMessage("");
  try{
   const targets=disable?[]:allEmployees?[{department:null,role_name:null}]:audiences.flatMap(a=>a.roles.length?a.roles.map(role=>({department:a.department||null,role_name:role})):[{department:a.department||null,role_name:null}]);
   const {error}=await supabase.rpc("qualisphere_save_training_matrix_audience",{p_document_number:documentNumber,p_targets:targets});
   if(error)throw error;await load();setMessage(disable?"Requirement disabled. Existing training records are preserved.":"Procedure audience saved. Use Training Management to review and assign training.");
  }catch(e:any){setMessage(e.message);}finally{setSaving(false);}
 };
 return <section style={card}>
  <h2 style={{marginTop:0}}>Training Matrix</h2>
  <p>Choose a procedure, then the employees who require it. Training is assigned separately by a coordinator.</p>
  <label>Procedure<select disabled={saving} value={documentNumber} onChange={e=>{setDocumentNumber(e.target.value);setAudiences([]);setAllEmployees(false);if(e.target.value)edit(e.target.value);}} style={input}><option value="">Select procedure</option>{procedureOptions.map(d=><option key={d.document_number} value={d.document_number}>{d.document_number}{d.title?` — ${d.title}`:""}</option>)}</select></label>
  <label><input disabled={saving} type="checkbox" checked={allEmployees} onChange={e=>setAllEmployees(e.target.checked)}/> All active employees in this company</label>
  {!allEmployees&&<>
   <div style={{display:"flex",gap:10,margin:"14px 0"}}><select aria-label="Add department" value={department} onChange={e=>setDepartment(e.target.value)} style={input}><option value="">Select department</option>{departments.map(d=><option key={d} value={d}>{d}</option>)}</select><button disabled={saving||!department} onClick={()=>{if(!audiences.some(a=>norm(a.department)===norm(department)))setAudiences([...audiences,{department,roles:[]}]);setDepartment("");}}>Add Department</button></div>
   {audiences.map((a,index)=>{const roles=unique([...employees.filter(e=>!a.department||norm(e.department)===norm(a.department)).map(e=>e.role_name),...a.roles]);return <fieldset key={index} disabled={saving} style={{marginBottom:10,border:"1px solid #d1d5db"}}><legend>{a.department||"All departments (existing mapping)"}</legend>
    <label><input type="checkbox" checked={!a.roles.length} onChange={()=>setAudiences(audiences.map((x,i)=>i===index?{...x,roles:[]}:x))}/> All roles in this department</label>
    <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:10}}>{roles.map(role=><label key={role}><input type="checkbox" checked={a.roles.includes(role)} onChange={e=>setAudiences(audiences.map((x,i)=>i===index?{...x,roles:e.target.checked?[...x.roles,role]:x.roles.filter(r=>r!==role)}:x))}/>{role}</label>)}</div>
    <button onClick={()=>setAudiences(audiences.filter((_,i)=>i!==index))}>Remove Department</button>
   </fieldset>;})}
  </>}
  <p>Role choices come from employee profiles. No roles selected within a department means all its roles.</p>
  <button disabled={saving} onClick={()=>void save()} style={button}>{saving?"Saving…":"Save Procedure Audience"}</button>
  {documentNumber&&rows.some(r=>norm(r.document_number)===norm(documentNumber)&&r.required_training)&&<button disabled={saving} onClick={()=>void save(true)}>Disable Requirement</button>}
  {message&&<p role="status">{message}</p>}
  <h3>Configured Procedures</h3>
  {!grouped.length&&<p>No required procedures configured.</p>}
  {grouped.map(number=>{const selected=rows.filter(r=>r.document_number===number&&r.required_training);return <details key={number} style={{padding:10,borderBottom:"1px solid #e5e7eb"}}><summary>{number} — {selected.some(r=>!norm(r.role_name)&&!norm(r.department))?"All employees":`${selected.length} audience mapping(s)`}</summary><ul>{selected.map(r=><li key={r.id}>{r.department||"All departments"} → {r.role_name||"All roles"}</li>)}</ul><button disabled={saving} onClick={()=>edit(number)}>Edit Audience</button></details>;})}
 </section>;
}
const card:React.CSSProperties={background:"white",border:"1px solid #d1d5db",borderRadius:12,padding:20,marginTop:20};
const input:React.CSSProperties={display:"block",width:"100%",padding:9,border:"1px solid #cbd5e1",borderRadius:7,margin:"6px 0 12px"};
const button:React.CSSProperties={background:"#2563eb",color:"white",padding:"10px 14px",border:0,borderRadius:7,marginRight:10};
