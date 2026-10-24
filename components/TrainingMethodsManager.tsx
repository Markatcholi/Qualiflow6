"use client";
import {useEffect,useState} from "react";
import {supabase} from "../lib/supabaseClient";

type Method={id:string;label:string;release_blocking:boolean;acknowledgement_required:boolean;evidence_required:boolean;is_active:boolean};
const empty={label:"",release_blocking:false,acknowledgement_required:true,evidence_required:false};
export default function TrainingMethodsManager({tenantId,onChanged}:{tenantId:string;onChanged?:(id?:string)=>void}){
 const [methods,setMethods]=useState<Method[]>([]);const [form,setForm]=useState(empty);const [editing,setEditing]=useState<Method|null>(null);
 const [busy,setBusy]=useState(false);const [allowed,setAllowed]=useState(false);const [message,setMessage]=useState("");const [showInactive,setShowInactive]=useState(false);
 const load=async()=>{
  const permission=await supabase.rpc("qualisphere_training_is_coordinator",{p_tenant:tenantId});if(permission.error)throw permission.error;setAllowed(permission.data===true);
  const result=await supabase.from("training_methods").select("id,label,release_blocking,acknowledgement_required,evidence_required,is_active").eq("tenant_id",tenantId).order("label");if(result.error)throw result.error;setMethods(result.data||[]);
 };
 useEffect(()=>{setMethods([]);setAllowed(false);setEditing(null);setForm(empty);if(tenantId)void load().catch(e=>setMessage(e.message));},[tenantId]);
 const clear=()=>{setEditing(null);setForm(empty);};
 const save=async()=>{
  if(busy||!allowed)return;if(!form.label.trim())return setMessage("Enter a method name, for example Read and Acknowledge.");
  if(!form.acknowledgement_required&&!form.evidence_required)return setMessage("Select acknowledgement, completion evidence, or both.");
  setBusy(true);setMessage("");try{
   const r=await supabase.rpc("qualisphere_save_training_method",{p_tenant:tenantId,p_id:editing?.id||null,p_label:form.label.trim(),p_release_blocking:form.release_blocking,p_acknowledgement_required:form.acknowledgement_required,p_evidence_required:form.evidence_required});
   if(r.error)throw r.error;const wasEditing=!!editing;clear();await load();onChanged?.(r.data?.id);
   setMessage(r.data?.versioned?"Updated method saved for new training. The previous settings remain linked to existing records.":wasEditing?"Training method updated.":"Training method added and available for assignment.");
  }catch(e:any){setMessage(e.message);}finally{setBusy(false);}
 };
 const toggle=async(method:Method)=>{
  if(!confirm(`${method.is_active?"Deactivate":"Reactivate"} “${method.label}”? Existing training records will be preserved.`))return;
  setBusy(true);setMessage("");try{
   if(!method.is_active&&methods.some(m=>m.is_active&&m.id!==method.id&&m.label.trim().toLowerCase()===method.label.trim().toLowerCase()))throw new Error("An active method already uses this name. Edit that method or give this one a different name first.");
   const r=await supabase.from("training_methods").update({is_active:!method.is_active,updated_at:new Date().toISOString()}).eq("tenant_id",tenantId).eq("id",method.id).select("id");if(r.error)throw r.error;if(!r.data?.length)throw new Error("Method was not updated. Check your permissions.");
   if(editing?.id===method.id)clear();await load();onChanged?.();setMessage(method.is_active?"Method removed from new assignment choices. Existing records are preserved.":"Method reactivated.");
  }catch(e:any){setMessage(e.message);}finally{setBusy(false);}
 };
 const remove=async(method:Method)=>{
  if(!confirm(`Permanently delete unused method “${method.label}”? Methods linked to training records cannot be deleted; deactivate those instead.`))return;
  setBusy(true);setMessage("");try{
   const r=await supabase.from("training_methods").delete().eq("tenant_id",tenantId).eq("id",method.id).select("id");if(r.error)throw r.error;if(!r.data?.length)throw new Error("Method was not deleted. Check your permissions.");
   if(editing?.id===method.id)clear();await load();onChanged?.();setMessage("Unused method deleted.");
  }catch(e:any){setMessage(e.message);}finally{setBusy(false);}
 };
 return <section style={{border:"1px solid #cbd5e1",borderRadius:10,padding:16,margin:"14px 0"}}>
  <h3 style={{marginTop:0}}>Manage Training Methods</h3>
  <p>Add your company’s methods, such as Read and Acknowledge, Classroom Training, or Certification. Frequency is selected separately when assigning training.</p>
  {allowed?<fieldset disabled={busy} style={{border:0,padding:0}}>
   <label>{editing?"Edit method name":"New method name"}<input value={form.label} onChange={e=>setForm({...form,label:e.target.value})} placeholder="e.g. Read and Acknowledge" style={input}/></label>
   <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:14}}>
    <label><input type="checkbox" checked={form.acknowledgement_required} onChange={e=>setForm({...form,acknowledgement_required:e.target.checked})}/> Electronic acknowledgement required</label>
    <label><input type="checkbox" checked={form.evidence_required} onChange={e=>setForm({...form,evidence_required:e.target.checked})}/> Completion evidence attachment required</label>
    <label><input type="checkbox" checked={form.release_blocking} onChange={e=>setForm({...form,release_blocking:e.target.checked})}/> Prerequisite: complete before document release</label>
   </div>
   <button disabled={busy} onClick={()=>void save()} style={button}>{busy?"Saving…":editing?"Save Method Changes":"Add Training Method"}</button>{editing&&<button onClick={clear}>Cancel Edit</button>}
   {editing&&<p>Changes to completion requirements apply to future training. Existing linked records retain their original settings.</p>}
  </fieldset>:<p>Training or Document Control Coordinator permission is required to manage methods.</p>}
  <label style={{display:"block",marginTop:16}}><input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)}/> Show inactive methods</label>
  {methods.filter(m=>showInactive||m.is_active).map(m=><div key={m.id} style={{padding:"12px 0",borderBottom:"1px solid #e5e7eb"}}>
   <strong>{m.label}</strong> — {m.is_active?"Active":"Inactive"}
   <div>{[m.acknowledgement_required&&"Electronic acknowledgement",m.evidence_required&&"Evidence attachment",m.release_blocking&&"Release prerequisite"].filter(Boolean).join(" · ")}</div>
   {allowed&&<div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}><button disabled={busy} onClick={()=>{setEditing(m);setForm({label:m.label,release_blocking:m.release_blocking,acknowledgement_required:m.acknowledgement_required,evidence_required:m.evidence_required});setMessage("");}}>Edit</button><button disabled={busy} onClick={()=>void toggle(m)}>{m.is_active?"Deactivate":"Reactivate"}</button><button disabled={busy} onClick={()=>void remove(m)}>Delete Unused Method</button></div>}
  </div>)}
  {!methods.length&&<p>No training methods configured yet.</p>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
const input:React.CSSProperties={display:"block",width:"100%",boxSizing:"border-box",padding:9,margin:"6px 0 14px",border:"1px solid #cbd5e1",borderRadius:7};
const button:React.CSSProperties={background:"#2563eb",color:"white",padding:"10px 14px",border:0,borderRadius:7,marginRight:8};
