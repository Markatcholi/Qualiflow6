"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";
type Row = { name:string; email:string; title:string; department:string; manager:string; status:string; error:string };
const cols=["Employee Name","Employee Email","Job Title","Department","Manager Email","Account Status"];
const emailOK=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export default function UserExcelImport({tenantId,onImported}:{tenantId:string;onImported:()=>Promise<void>|void}) {
 const [rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[overwrite,setOverwrite]=useState(false);
 const template=()=>{const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([cols,["Example Director","director@example.com","Director","Quality","TOP-LEVEL","inactive"],["Example Employee","employee@example.com","Quality Engineer","Quality","director@example.com","inactive"]]),"Employees");XLSX.writeFile(w,"QualiSphere_User_Import.xlsx");};
 const upload=async(file?:File)=>{setRows([]);setMessage("");if(!file)return;try {
 const w=XLSX.read(await file.arrayBuffer(),{type:"array"}),s=w.Sheets[w.SheetNames[0]];if(!s)throw Error("Workbook has no worksheet");
 const raw=XLSX.utils.sheet_to_json<Record<string,unknown>>(s,{defval:""}),first=XLSX.utils.sheet_to_json<string[]>(s,{header:1})[0]||[];
 if(cols.some(c=>!first.includes(c)))throw Error("Use the downloaded template with all required column headings");
 if(!raw.length)throw Error("No employee rows found");
 const val=(v:unknown)=>String(v??"").trim();
 const data:Row[]=raw.map(r=>({name:val(r[cols[0]]),email:val(r[cols[1]]).toLowerCase(),title:val(r[cols[2]]),department:val(r[cols[3]]),manager:val(r[cols[4]]).toLowerCase(),status:val(r[cols[5]]).toLowerCase()||"inactive",error:""}));
 const counts=new Map<string,number>();data.forEach(r=>counts.set(r.email,(counts.get(r.email)||0)+1));
 const graph=new Map(data.map(r=>[r.email,r.manager]));
 data.forEach(r=>{const errors:string[]=[];if(!r.name||!r.email||!r.title||!r.department||!r.manager)errors.push("Required field missing");if(!emailOK(r.email))errors.push("Invalid email");if(counts.get(r.email)!>1)errors.push("Duplicate email");if(r.manager===r.email)errors.push("Self-manager");if(r.manager!=="top-level"&&!emailOK(r.manager))errors.push("Invalid manager");if(!["active","inactive"].includes(r.status))errors.push("Invalid status");const seen=new Set([r.email]);let next=r.manager;while(next&&next!=="top-level"&&graph.has(next)){if(seen.has(next)){errors.push("Manager cycle");break;}seen.add(next);next=graph.get(next)!;}r.error=errors.join("; ");});
 setRows(data);
 }catch(e){setMessage(e instanceof Error?e.message:"Could not read file");}};
 const commit=async()=>{if(!tenantId||rows.some(r=>r.error))return;setBusy(true);setMessage("");try{
 const [m,p]=await Promise.all([supabase.from("tenant_memberships").select("user_email").eq("tenant_id",tenantId),supabase.from("employee_profiles").select("user_email,manager_email").eq("tenant_id",tenantId)]);
 if(m.error)throw m.error;if(p.error)throw p.error;
 const members=new Set((m.data||[]).map(x=>String(x.user_email).toLowerCase())),existing=new Set((p.data||[]).map(x=>String(x.user_email).toLowerCase())),all=new Set([...members,...rows.map(r=>r.email)]);
 if(!overwrite&&rows.some(r=>existing.has(r.email)))throw Error("Existing profiles found; enable Update existing employees to proceed");
 for(const r of rows)if(r.manager!=="top-level"&&!all.has(r.manager))throw Error("Manager "+r.manager+" must be a tenant member or included in workbook");
 const graph=new Map((p.data||[]).map(x=>[String(x.user_email).toLowerCase(),String(x.manager_email||"").toLowerCase()]));rows.forEach(r=>graph.set(r.email,r.manager==="top-level"?"":r.manager));
 for(const r of rows){const seen=new Set<string>();let e=r.email;while(e){if(seen.has(e))throw Error("Manager cycle involving "+r.email);seen.add(e);e=graph.get(e)||"";}}
 for(const r of rows){
 if(!members.has(r.email)){const x=await supabase.from("tenant_memberships").insert({tenant_id:tenantId,user_email:r.email,membership_role:"member",membership_status:"invited"});if(x.error)throw Error(r.email+": "+x.error.message);}
 const x=await supabase.from("employee_profiles").upsert({tenant_id:tenantId,user_email:r.email,full_name:r.name,department:r.department,manager_email:r.manager==="top-level"?null:r.manager,active:false},{onConflict:"tenant_id,user_email"});if(x.error)throw Error(r.email+": "+x.error.message);
 const y=await supabase.from("tenant_user_profiles").upsert({tenant_id:tenantId,user_email:r.email,job_title:r.title,department:r.department,account_status:"inactive"},{onConflict:"tenant_id,user_email"});if(y.error)throw Error(r.email+": "+y.error.message);
 }
 setMessage(rows.length+" profiles imported. New tenant memberships are invited. No access roles assigned.");setRows([]);await onImported();
 }catch(e){setMessage("Import stopped: "+(e instanceof Error?e.message:"Unknown error")+". Earlier rows may already have saved; review before retrying.");}finally{setBusy(false);}};
 return <section style={{padding:16,marginTop:20,border:"1px solid #cbd5e1",borderRadius:8}}><h3>Excel Bulk User Import</h3><p>All employee fields are required. Enter TOP-LEVEL for employees without a manager. Imported accounts remain inactive until separately authorized; importing does not assign module access roles.</p><button type="button" onClick={template}>Download Excel Template</button>{" "}<label>Import Excel File <input type="file" accept=".xlsx,.xls" disabled={busy} onChange={e=>void upload(e.target.files?.[0])}/></label>{rows.length>0&&<><p>{rows.length} rows; {rows.filter(r=>r.error).length} errors</p><div style={{maxHeight:320,overflow:"auto"}}><table><thead><tr>{["Name","Email","Job Title","Department","Manager","Status","Validation"].map(x=><th key={x} style={{padding:8}}>{x}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{[r.name,r.email,r.title,r.department,r.manager,r.status,r.error||"Valid"].map((v,j)=><td key={j} style={{padding:8,borderTop:"1px solid #ddd"}}>{v}</td>)}</tr>)}</tbody></table></div><label><input type="checkbox" checked={overwrite} onChange={e=>setOverwrite(e.target.checked)}/> Update existing employees</label>{" "}<button type="button" disabled={busy||rows.some(r=>r.error)} onClick={()=>void commit()}>{busy?"Importing...":"Confirm Import"}</button></>}{message&&<p role="status">{message}</p>}</section>;
}
