"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

type Assignment = {
 id:string; tenant_id:string|null; assigned_to_email:string; department:string|null;
 training_title:string|null; training_category:string|null; status:string|null;
 due_date:string|null; training_completed_on:string|null; completed_at:string|null; created_at:string|null;
};
const completed = (s:string|null) => s==="completed" || s==="effectiveness_complete";
const waived = (s:string|null) => s==="waived";
const localDate = () => {
 const d=new Date();
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
};
const csvField=(value:unknown)=>{
 const s=String(value??"");
 const safe=/^[=+@\-\t\r]/.test(s)?"'"+s:s;
 return '"'+safe.replace(/"/g,'""')+'"';
};

export default function TrainingCompliancePage(){
 const [assignments,setAssignments]=useState<Assignment[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [authorized,setAuthorized]=useState(false);
 const [asOf,setAsOf]=useState(localDate());
 const [department,setDepartment]=useState("all");
 const [category,setCategory]=useState("all");
 const [filter,setFilter]=useState("all");
 useEffect(()=>{
  let mounted=true;
  (async()=>{
   try{
    const {data:auth,error:authError}=await supabase.auth.getUser();
    if(authError||!auth.user)throw new Error("Please sign in.");
    const {data:tenant,error:tenantError}=await supabase.rpc("qualisphere_resolve_training_tenant");
    if(tenantError||!tenant)throw new Error("No active tenant.");
    const {data:allowed,error:roleError}=await supabase.rpc("qualisphere_training_is_coordinator",{p_tenant:tenant});
    if(roleError||allowed!==true)throw new Error("This report is restricted to Training and Document Control Coordinators.");
    if(mounted)setAuthorized(true);
    const records:Assignment[]=[];
    for(let offset=0;offset<100000;offset+=1000){
     const {data,error:readError}=await supabase.from("training_assignments")
      .select("id,tenant_id,assigned_to_email,department,training_title,training_category,status,due_date,training_completed_on,completed_at,created_at")
      .eq("tenant_id",tenant).order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+999);
     if(readError)throw readError;
     records.push(...((data||[]) as Assignment[]));
     if(!data||data.length<1000)break;
    }
    if(mounted)setAssignments(records);
   }catch(e:unknown){if(mounted)setError(e instanceof Error?e.message:"Unable to load compliance report.");}
   finally{if(mounted)setLoading(false);}
  })();
  return()=>{mounted=false;};
 },[]);
 const departments=useMemo(()=>[...new Set(assignments.map(a=>a.department||"Unassigned"))].sort(),[assignments]);
 const categories=useMemo(()=>[...new Set(assignments.map(a=>a.training_category||"standard"))].sort(),[assignments]);
 const scoped=useMemo(()=>assignments.filter(a=>(department==="all"||(a.department||"Unassigned")===department)&&(category==="all"||(a.training_category||"standard")===category)),[assignments,department,category]);
 const classification=(a:Assignment)=>{
  if(completed(a.status))return "Completed";
  if(waived(a.status))return "Waived";
  if(a.due_date&&a.due_date<asOf)return "Overdue";
  if(a.due_date&&a.due_date<=new Date(Date.parse(asOf+"T00:00:00Z")+30*86400000).toISOString().slice(0,10))return "Due within 30 days";
  return "Open";
 };
 const visible=scoped.filter(a=>filter==="all"||classification(a)===filter);
 const total=scoped.length;
 const completeCount=scoped.filter(a=>completed(a.status)).length;
 const waivedCount=scoped.filter(a=>waived(a.status)).length;
 const overdue=scoped.filter(a=>classification(a)==="Overdue").length;
 const upcoming=scoped.filter(a=>classification(a)==="Due within 30 days").length;
 const byDepartment=departments.map(d=>{
  const rows=scoped.filter(a=>(a.department||"Unassigned")===d);
  const closed=rows.filter(a=>completed(a.status)||waived(a.status)).length;
  return {department:d,total:rows.length,closed,overdue:rows.filter(a=>classification(a)==="Overdue").length};
 }).filter(d=>d.total>0);
 const exportCsv=()=>{
  const lines=[
   ["Employee","Department","Training","Category","Status","Due date","Completed on","Classification"],
   ...visible.map(a=>[a.assigned_to_email,a.department,a.training_title,a.training_category,a.status,a.due_date,a.training_completed_on||a.completed_at?.slice(0,10),classification(a)])
  ];
  const blob=new Blob([lines.map(r=>r.map(csvField).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;anchor.download="training-compliance-"+asOf+".csv";anchor.click();
  URL.revokeObjectURL(url);
 };
 const cell={padding:"9px 12px",borderBottom:"1px solid #ddd",textAlign:"left" as const};
 return <main style={{maxWidth:1250,margin:"30px auto",padding:20}}>
  <Link href="/training">← Training Management</Link>
  <h1>Training Compliance Report</h1>
  <p>Coordinator-only, tenant-scoped training status and completion reporting. Waivers are shown separately from completions.</p>
  {loading&&<p>Loading training records…</p>}
  {error&&<p role="alert" style={{color:"crimson"}}>{error}</p>}
  {!loading&&authorized&&!error&&<>
   <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"end",marginBottom:20}}>
    <label>As of <input type="date" value={asOf} onChange={e=>setAsOf(e.target.value||localDate())}/></label>
    <label>Department <select value={department} onChange={e=>setDepartment(e.target.value)}><option value="all">All departments</option>{departments.map(d=><option key={d} value={d}>{d}</option>)}</select></label>
    <label>Category <select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
    <label>Classification <select value={filter} onChange={e=>setFilter(e.target.value)}>{["all","Completed","Waived","Overdue","Due within 30 days","Open"].map(c=><option key={c} value={c}>{c==="all"?"All":c}</option>)}</select></label>
    <button onClick={exportCsv}>Export filtered CSV</button>
   </div>
   <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:24}}>
    {([["Assignments",total],["Completed",completeCount],["Waived",waivedCount],["Overdue",overdue],["Due within 30 days",upcoming],["Closed rate",total?Math.round((completeCount+waivedCount)*100/total)+"%":"N/A"]] as const).map(([label,value])=><div key={label} style={{border:"1px solid #ccc",borderRadius:8,padding:16,minWidth:130}}><strong style={{display:"block",fontSize:24}}>{value}</strong>{label}</div>)}
   </div>
   <h2>Department summary</h2>
   <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Department","Assignments","Completed or waived","Overdue","Closed rate"].map(h=><th key={h} style={cell}>{h}</th>)}</tr></thead><tbody>{byDepartment.map(d=><tr key={d.department}><td style={cell}>{d.department}</td><td style={cell}>{d.total}</td><td style={cell}>{d.closed}</td><td style={cell}>{d.overdue}</td><td style={cell}>{Math.round(d.closed*100/d.total)}%</td></tr>)}</tbody></table></div>
   <h2>Training records ({visible.length})</h2>
   <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Employee","Department","Training","Category","Status","Due date","Completed","Classification"].map(h=><th key={h} style={cell}>{h}</th>)}</tr></thead><tbody>{visible.map(a=><tr key={a.id}>{[a.assigned_to_email,a.department||"Unassigned",a.training_title||"Training",a.training_category||"standard",a.status||"assigned",a.due_date||"—",a.training_completed_on||a.completed_at?.slice(0,10)||"—",classification(a)].map((v,i)=><td key={i} style={cell}>{v}</td>)}</tr>)}</tbody></table></div>
  </>}
 </main>;
}
