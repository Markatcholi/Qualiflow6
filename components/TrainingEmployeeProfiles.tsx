"use client";
import {useEffect,useMemo,useState} from "react";
import {supabase} from "../lib/supabaseClient";

type Employee={id:string;tenant_id:string;user_email:string;full_name:string|null;role_name:string|null;department:string|null;manager_email:string|null;active:boolean|null};
const empty={user_email:"",full_name:"",role_name:"",department:"",manager_email:""};
export default function TrainingEmployeeProfiles({onChanged}:{onChanged:()=>void}) {
 const [tenant,setTenant]=useState("");const [employees,setEmployees]=useState<Employee[]>([]);
 const [roles,setRoles]=useState<string[]>([]);const [departments,setDepartments]=useState<string[]>([]);
 const [editing,setEditing]=useState<Employee|null>(null);const [form,setForm]=useState(empty);
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [search,setSearch]=useState("");const [filter,setFilter]=useState("active");
 const norm=(v:string|null)=>String(v||"").trim().toLowerCase();
 const load=async()=>{
  const t=await supabase.rpc("qualisphere_resolve_training_tenant");if(t.error)throw t.error;if(!t.data)throw new Error("Select a company first.");
  const allowed=await supabase.rpc("qualisphere_training_is_coordinator",{p_tenant:t.data});if(allowed.error)throw allowed.error;if(!allowed.data)throw new Error("Training coordinator permission required.");
  setTenant(t.data);
  const [e,m,d]=await Promise.all([
   supabase.from("employee_profiles").select("*").eq("tenant_id",t.data).order("user_email"),
   supabase.from("training_matrix").select("role_name,department").eq("tenant_id",t.data),
   supabase.from("md_departments").select("label").eq("tenant_id",t.data)
  ]);for(const r of [e,m,d])if(r.error)throw r.error;
  setEmployees(e.data||[]);
  setRoles(Array.from(new Set([...(e.data||[]).map(e=>e.role_name),...(m.data||[]).map(r=>r.role_name)].filter(Boolean))).sort() as string[]);
  setDepartments(Array.from(new Set([...(e.data||[]).map(e=>e.department),...(m.data||[]).map(r=>r.department),...(d.data||[]).map(r=>r.label)].filter(Boolean))).sort() as string[]);
 };
 useEffect(()=>{void load().catch(e=>setMessage(e.message));},[]);
 const clear=()=>{setEditing(null);setForm(empty);};
 const edit=(employee:Employee)=>{setEditing(employee);setForm({user_email:employee.user_email,full_name:employee.full_name||"",role_name:employee.role_name||"",department:employee.department||"",manager_email:employee.manager_email||""});setMessage("");};
 const save=async()=>{
  if(busy||!tenant)return;
  const email=norm(form.user_email),manager=norm(form.manager_email);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return setMessage("Enter a valid employee email.");
  if(manager&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manager))return setMessage("Enter a valid manager email, or leave it blank.");
  if(manager===email)return setMessage("An employee cannot be their own manager.");
  if(employees.some(e=>e.id!==editing?.id&&norm(e.user_email)===email))return setMessage("This employee already exists. Use Edit on their profile, or Reactivate it if inactive.");
  const payload={user_email:email,full_name:form.full_name.trim()||null,role_name:form.role_name.trim()||null,department:form.department.trim()||null,manager_email:manager||null};
  setBusy(true);setMessage("");try{
   const result=editing?await supabase.from("employee_profiles").update(payload).eq("id",editing.id).eq("tenant_id",tenant).select("id"):await supabase.from("employee_profiles").insert({...payload,tenant_id:tenant,active:true}).select("id");
   if(result.error)throw result.error;if(!result.data?.length)throw new Error("The profile was not saved. Refresh and check your permissions.");
   const edited=!!editing;clear();await load();onChanged();setMessage(edited?"Employee profile updated. Existing assignments and completions were preserved.":"Employee profile added.");
  }catch(e:any){setMessage(e.message);}finally{setBusy(false);}
 };
 const changeActive=async(employee:Employee)=>{
  const active=employee.active!==true;
  if(!confirm(`${active?"Reactivate":"Deactivate"} ${employee.user_email}? ${active?"They will become eligible for future matrix assignments.":"They will be excluded from future matrix assignments. Existing training records and account access are not changed."}`))return;
  setBusy(true);setMessage("");try{
   const result=await supabase.from("employee_profiles").update({active}).eq("tenant_id",tenant).eq("id",employee.id).select("id");
   if(result.error)throw result.error;if(!result.data?.length)throw new Error("The profile was not updated.");
   if(editing?.id===employee.id)clear();await load();onChanged();setMessage(`Employee ${active?"reactivated":"deactivated"}.`);
  }catch(e:any){setMessage(e.message);}finally{setBusy(false);}
 };
 const remove=async(employee:Employee)=>{
  if(!confirm(`Permanently delete the unused training profile for ${employee.user_email}? Profiles linked to training or group records cannot be deleted; deactivate those instead. This does not delete the person's account.`))return;
  setBusy(true);setMessage("");try{
   const result=await supabase.from("employee_profiles").delete().eq("tenant_id",tenant).eq("id",employee.id).select("id");
   if(result.error)throw result.error;if(!result.data?.length)throw new Error("The profile was not deleted. Refresh and check your permissions.");
   if(editing?.id===employee.id)clear();await load();onChanged();setMessage("Unused employee training profile deleted.");
  }catch(e:any){setMessage(e.message);}finally{setBusy(false);}
 };
 const visible=useMemo(()=>employees.filter(e=>(filter==="all"||(filter==="active"?e.active===true:e.active!==true))&&[e.user_email,e.full_name,e.role_name,e.department,e.manager_email].some(value=>norm(value).includes(norm(search)))),[employees,filter,search]);
 return <section style={card}>
  <h2 style={{marginTop:0}}>Employee Profiles</h2>
  <p>Manage the employee roles and departments used by the training matrix. Profile changes do not rewrite existing training records.</p>
  <h3>{editing?`Edit Employee — ${editing.user_email}`:"Add Employee"}</h3>
  <fieldset disabled={busy} style={{border:0,padding:0}}>
   <div style={grid}>
    <label>Employee Email<input type="email" value={form.user_email} onChange={e=>setForm({...form,user_email:e.target.value})} style={input}/></label>
    <label>Full Name<input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} style={input}/></label>
    <label>Training Role<input list="employee-training-role-options" value={form.role_name} onChange={e=>setForm({...form,role_name:e.target.value})} placeholder="Select or enter role" style={input}/><datalist id="employee-training-role-options">{roles.map(r=><option key={r} value={r}/>)}</datalist></label>
    <label>Department<input list="employee-department-options" value={form.department} onChange={e=>setForm({...form,department:e.target.value})} placeholder="Select or enter department" style={input}/><datalist id="employee-department-options">{departments.map(d=><option key={d} value={d}/>)}</datalist></label>
    <label>Manager Email<input type="email" value={form.manager_email} onChange={e=>setForm({...form,manager_email:e.target.value})} style={input}/></label>
   </div>
   {editing&&<p>Email can be corrected only while the profile has no linked training or group records. Use Deactivate for an employee who has left.</p>}
   <button type="button" disabled={!tenant||busy} onClick={()=>void save()} style={button}>{busy?"Saving…":editing?"Save Changes":"Add Employee"}</button>
   {editing&&<button type="button" onClick={clear}>Cancel Edit</button>}
  </fieldset>
  {message&&<p role="status">{message}</p>}
  <div style={{...grid,marginTop:22}}>
   <label>Search Employees<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, email, role, department or manager" style={input}/></label>
   <label>Status<select value={filter} onChange={e=>setFilter(e.target.value)} style={input}><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All Employees</option></select></label>
  </div>
  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Employee","Training Role","Department","Manager","Status","Actions"].map(h=><th key={h} style={cell}>{h}</th>)}</tr></thead><tbody>
   {visible.map(employee=><tr key={employee.id}><td style={cell}>{employee.full_name||"Name not entered"}<br/>{employee.user_email}</td><td style={cell}>{employee.role_name||"Not set"}</td><td style={cell}>{employee.department||"Not set"}</td><td style={cell}>{employee.manager_email||"Not set"}</td><td style={cell}>{employee.active===true?"Active":"Inactive"}</td><td style={cell}><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button disabled={busy} onClick={()=>edit(employee)}>Edit</button><button disabled={busy} onClick={()=>void changeActive(employee)}>{employee.active===true?"Deactivate":"Reactivate"}</button><button disabled={busy} onClick={()=>void remove(employee)}>Delete Unused Profile</button></div></td></tr>)}
   {!visible.length&&<tr><td colSpan={6} style={cell}>No employee profiles match these filters.</td></tr>}
  </tbody></table></div>
 </section>;
}
const card:React.CSSProperties={background:"white",border:"1px solid #d1d5db",borderRadius:16,padding:20,marginBottom:20};
const grid:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14};
const input:React.CSSProperties={display:"block",width:"100%",boxSizing:"border-box",padding:9,margin:"6px 0 12px",border:"1px solid #cbd5e1",borderRadius:8};
const button:React.CSSProperties={background:"#2563eb",color:"white",padding:"10px 14px",border:0,borderRadius:8,marginRight:10};
const cell:React.CSSProperties={textAlign:"left",padding:10,borderBottom:"1px solid #e5e7eb",verticalAlign:"top"};
