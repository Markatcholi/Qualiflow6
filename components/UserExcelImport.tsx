"use client";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";
type Row = { name:string; email:string; title:string; department:string; manager:string; status:string; error:string };
const cols=["Employee Name","Employee Email","Job Title","Department","Manager Email","Account Status"];
const emailOK=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export default function UserExcelImport({tenantId,onImported}:{tenantId:string;onImported:()=>Promise<void>|void}) {
 const fileRef=useRef<HTMLInputElement>(null);
 const [fileName,setFileName]=useState("");
 const [rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[overwrite,setOverwrite]=useState(false),[canImport,setCanImport]=useState(false);
 useEffect(()=>{let cancelled=false;setCanImport(false);if(!tenantId)return;void (async()=>{const auth=await supabase.auth.getUser();const email=auth.data.user?.email;if(!email)return;const {data,error}=await supabase.from("tenant_memberships").select("id").eq("tenant_id",tenantId).ilike("user_email",email).eq("membership_role","company_admin").eq("membership_status","active").maybeSingle();if(!cancelled)setCanImport(!error&&!!data);})();return()=>{cancelled=true;};},[tenantId]);
 const template=()=>{const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([cols,["Example Director","director@example.com","Director","Quality","TOP-LEVEL","inactive"],["Example Employee","employee@example.com","Quality Engineer","Quality","director@example.com","inactive"]]),"Employees");XLSX.writeFile(w,"QualiSphere_User_Import.xlsx");};
 const clearFile=()=>{setRows([]);setMessage("");setFileName("");setOverwrite(false);if(fileRef.current)fileRef.current.value="";};
 const upload=async(file?:File)=>{setRows([]);setMessage("");setFileName(file?.name||"");if(!file)return;try {
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
 const commit=async()=>{if(!tenantId||rows.some(r=>r.error)||!canImport)return;setBusy(true);setMessage("");try{
 const {data,error}=await supabase.rpc("qualisphere_import_employees",{p_tenant_id:tenantId,p_employees:rows.map(({name,email,title,department,manager})=>({name,email,title,department,manager})),p_overwrite:overwrite});
 if(error)throw error;
 setMessage(String(data)+" employee profiles imported atomically. New memberships are invited; no module roles were assigned.");
 setRows([]);await onImported();
 }catch(e){const err=e as {message?:string;code?:string;details?:string;hint?:string}|null;const detail=[err?.message,err?.code&&"Code: "+err.code,err?.details,err?.hint].filter(Boolean).join(" — ");setMessage("Import not completed: "+(detail||String(e))+". No partial employee batch was saved.");}finally{setBusy(false);}};
 return <section style={{padding:16,marginTop:20,border:"1px solid #cbd5e1",borderRadius:8}}><h3>Excel Bulk User Import</h3>{!canImport&&<p>Import requires active Company Administrator membership in this tenant.</p>}<p>All employee fields are required. Enter TOP-LEVEL for employees without a manager. Imported accounts remain inactive until separately authorized; importing does not assign module access roles.</p><button type="button" onClick={template}>Download Excel Template</button>{" "}<label>Import Excel File <input ref={fileRef} type="file" accept=".xlsx,.xls" disabled={busy} onClick={e=>{e.currentTarget.value="";}} onChange={e=>void upload(e.target.files?.[0])}/></label>{fileName&&<><span style={{marginLeft:8}}>Selected: {fileName}</span>{" "}<button type="button" disabled={busy} onClick={clearFile}>Remove File</button></>}{rows.length>0&&<><p>{rows.length} rows; {rows.filter(r=>r.error).length} errors</p><div style={{maxHeight:320,overflow:"auto"}}><table><thead><tr>{["Name","Email","Job Title","Department","Manager","Status","Validation"].map(x=><th key={x} style={{padding:8}}>{x}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{[r.name,r.email,r.title,r.department,r.manager,r.status,r.error||"Valid"].map((v,j)=><td key={j} style={{padding:8,borderTop:"1px solid #ddd"}}>{v}</td>)}</tr>)}</tbody></table></div><label><input type="checkbox" checked={overwrite} onChange={e=>setOverwrite(e.target.checked)}/> Update existing employees</label>{" "}<button type="button" disabled={busy||!canImport||rows.some(r=>r.error)} onClick={()=>void commit()}>{busy?"Importing...":"Confirm Import"}</button></>}{message&&<p role="status">{message}</p>}</section>;
}
