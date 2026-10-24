"use client";
import {useEffect,useState} from "react";
import TrainingMethodsManager from "./TrainingMethodsManager";
import {supabase} from "../lib/supabaseClient";
import {MatrixRequirement,TrainingEmployee,trainingAudienceMatches,trainingAssignmentState} from "../lib/trainingMatrix";

type Employee=TrainingEmployee & {full_name:string|null};
type Doc={id:string;document_number:string;title:string;revision:string;status:string};
type Method={id:string;label:string;acknowledgement_required:boolean;evidence_required:boolean};
type Existing={document_id:string|null;assigned_to_email:string;status:string|null;source_document_revision:string|null};
type Candidate={key:string;doc:Doc;employee:Employee;state:string};
export default function TrainingMatrixAssignment({onAssigned}:{onAssigned:()=>void}) {
 const [showMethods,setShowMethods]=useState(false);
 const [tenant,setTenant]=useState("");const [rows,setRows]=useState<MatrixRequirement[]>([]);
 const [employees,setEmployees]=useState<Employee[]>([]);const [docs,setDocs]=useState<Doc[]>([]);
 const [methods,setMethods]=useState<Method[]>([]);const [existing,setExisting]=useState<Existing[]>([]);
 const [mode,setMode]=useState("procedure");const [procedure,setProcedure]=useState("");const [employee,setEmployee]=useState("");
 const [method,setMethod]=useState("");const [frequency,setFrequency]=useState("one_time");
 const [months,setMonths]=useState("12");const [basis,setBasis]=useState("completion");const [due,setDue]=useState("");
 const [preview,setPreview]=useState<Candidate[]|null>(null);const [selected,setSelected]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 const load=async()=>{
  const t=await supabase.rpc("qualisphere_resolve_training_tenant");if(t.error)throw t.error;if(!t.data)throw new Error("Select a company first.");setTenant(t.data);
  const [r,e,d,m,a]=await Promise.all([
   supabase.from("training_matrix").select("role_name,department,document_number,required_training").eq("tenant_id",t.data).eq("required_training",true),
   supabase.from("employee_profiles").select("user_email,full_name,role_name,department,active").eq("tenant_id",t.data).eq("active",true).order("user_email"),
   supabase.from("controlled_documents").select("id,document_number,title,revision,status").eq("tenant_id",t.data).in("status",["effective","release"]).order("document_number"),
   supabase.from("training_methods").select("id,label,acknowledgement_required,evidence_required").eq("tenant_id",t.data).eq("is_active",true).order("label"),
   supabase.from("training_assignments").select("document_id,assigned_to_email,status,source_document_revision").eq("tenant_id",t.data)
  ]);for(const result of [r,e,d,m,a])if(result.error)throw result.error;
  setRows(r.data||[]);setEmployees(e.data||[]);setDocs(d.data||[]);setMethods(m.data||[]);setExisting(a.data||[]);
  return {rows:(r.data||[]) as MatrixRequirement[],employees:(e.data||[]) as Employee[],docs:(d.data||[]) as Doc[],existing:(a.data||[]) as Existing[]};
 };
 useEffect(()=>{void load().catch(e=>setMessage(e.message));},[]);
 const refreshMethods=async(selectedId?:string)=>{
  const r=await supabase.from("training_methods").select("id,label,acknowledgement_required,evidence_required").eq("tenant_id",tenant).eq("is_active",true).order("label");
  if(r.error){setMessage(r.error.message);return;}setMethods(r.data||[]);setMethod(current=>selectedId&&r.data?.some(m=>m.id===selectedId)?selectedId:r.data?.some(m=>m.id===current)?current:"");
 };
 const invalidate=()=>{setPreview(null);setSelected([]);setMessage("");};
 const find=async()=>{
  setBusy(true);setMessage("");try{
   const fresh=await load();const candidates:Candidate[]=[];
   for(const doc of fresh.docs.filter(d=>mode==="employee"||d.id===procedure))for(const person of fresh.employees.filter(e=>mode==="procedure"||e.user_email===employee)){
    if(trainingAudienceMatches(fresh.rows,doc.document_number,person))candidates.push({key:`${doc.id}:${person.user_email}`,doc,employee:person,state:trainingAssignmentState(fresh.existing,doc.id,doc.revision,person.user_email)});
   }
   setPreview(candidates);setSelected(candidates.filter(c=>c.state==="Needs assignment").map(c=>c.key));
  }catch(e:any){setMessage(e.message);}finally{setBusy(false);}
 };
 const assign=async()=>{
  if(busy||!preview)return;const targets=preview.filter(c=>selected.includes(c.key)&&c.state==="Needs assignment");
  if(!targets.length||!method||!due)return setMessage("Select employees, a training method, and a due date.");
  if(frequency==="recurring"&&(!Number.isInteger(Number(months))||Number(months)<1||Number(months)>120))return setMessage("Recurrence must be 1–120 months.");
  setBusy(true);setMessage("");try{
   const result=await supabase.rpc("qualisphere_assign_training_matrix",{p_targets:targets.map(c=>({document_id:c.doc.id,user_email:c.employee.user_email})),p_method:method,p_due:due,p_months:frequency==="recurring"?Number(months):null,p_basis:basis});
   if(result.error)throw result.error;
   const count=Number(result.data||0);invalidate();await load();onAssigned();setMessage(`${count} assignment(s) created. Existing or no-longer-eligible selections were skipped. Run Find again to refresh the preview.`);
  }catch(e:any){setMessage(e.message);}finally{setBusy(false);}
 };
 return <section style={card}>
  <h2 style={{marginTop:0}}>Assign Training From Matrix</h2>
  <button type="button" disabled={!tenant||busy} onClick={()=>setShowMethods(!showMethods)}>{showMethods?"Close Method Settings":"Manage Training Methods"}</button>
  {showMethods&&tenant&&<TrainingMethodsManager tenantId={tenant} onChanged={id=>void refreshMethods(id)}/>}
  <p>Find required employees for one procedure, or required procedures for one employee. Review the list before assigning.</p>
  <div style={grid}>
   <label>Find by<select disabled={busy} value={mode} onChange={e=>{setMode(e.target.value);invalidate();}} style={input}><option value="procedure">Procedure</option><option value="employee">Employee</option></select></label>
   {mode==="procedure"?<label>Released procedure<select disabled={busy} value={procedure} onChange={e=>{setProcedure(e.target.value);invalidate();}} style={input}><option value="">Select procedure</option>{docs.map(d=><option key={d.id} value={d.id}>{d.document_number} — {d.title} — Rev {d.revision}</option>)}</select></label>:<label>Employee<select disabled={busy} value={employee} onChange={e=>{setEmployee(e.target.value);invalidate();}} style={input}><option value="">Select active employee</option>{employees.map(e=><option key={e.user_email} value={e.user_email}>{e.full_name||e.user_email} — {e.department} / {e.role_name}</option>)}</select></label>}
  </div>
  <button disabled={busy||!tenant||(mode==="procedure"?!procedure:!employee)} onClick={()=>void find()} style={button}>{busy?"Working…":mode==="procedure"?"Find Required Employees":"Find Required Training"}</button>
  {preview&&<>
   <p>{preview.length} matching requirement(s) · {preview.filter(c=>c.state==="Needs assignment").length} need assignment</p>
   <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th>Select</th><th>Employee</th><th>Procedure / revision</th><th>Status</th></tr></thead><tbody>{preview.map(c=><tr key={c.key}><td><input aria-label={`Assign ${c.doc.document_number} to ${c.employee.user_email}`} type="checkbox" disabled={busy||c.state!=="Needs assignment"} checked={selected.includes(c.key)} onChange={e=>setSelected(e.target.checked?[...selected,c.key]:selected.filter(k=>k!==c.key))}/></td><td>{c.employee.full_name||c.employee.user_email}<br/>{c.employee.department} / {c.employee.role_name}</td><td>{c.doc.document_number} — Rev {c.doc.revision}</td><td>{c.state}</td></tr>)}</tbody></table></div>
   <div style={{...grid,marginTop:16}}>
    <label>Training method<select disabled={busy} value={method} onChange={e=>setMethod(e.target.value)} style={input}><option value="">Select configured method</option>{methods.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
    <label>Frequency<select disabled={busy} value={frequency} onChange={e=>setFrequency(e.target.value)} style={input}><option value="one_time">One-time</option><option value="recurring">Recurring</option></select></label>
    <label>Due date<input disabled={busy} type="date" value={due} onChange={e=>setDue(e.target.value)} style={input}/></label>
    {frequency==="recurring"&&<><label>Repeat every (months)<input disabled={busy} type="number" min={1} max={120} value={months} onChange={e=>setMonths(e.target.value)} style={input}/></label><label>Recurrence basis<select disabled={busy} value={basis} onChange={e=>setBasis(e.target.value)} style={input}><option value="completion">Last completion date</option><option value="calendar">Fixed calendar schedule</option></select></label></>}
   </div>
   {method&&<p>Completion: {methods.find(m=>m.id===method)?.evidence_required?"training evidence attachment":"electronic acknowledgement"}{methods.find(m=>m.id===method)?.evidence_required&&methods.find(m=>m.id===method)?.acknowledgement_required?" and electronic acknowledgement":""}. External signed certifications can still be recorded in the <a href="/training/certifications">Certification Register</a>.</p>}
   <button disabled={busy||!method||!due||!selected.length} onClick={()=>void assign()} style={button}>Assign {selected.length} Selected</button>
  </>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
const card:React.CSSProperties={background:"white",border:"1px solid #d1d5db",borderRadius:16,padding:20,marginBottom:20};
const grid:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14};
const input:React.CSSProperties={display:"block",width:"100%",padding:9,margin:"6px 0 12px",border:"1px solid #cbd5e1",borderRadius:8};
const button:React.CSSProperties={background:"#2563eb",color:"white",padding:"10px 14px",border:0,borderRadius:8,cursor:"pointer"};
