"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import * as XLSX from "xlsx";

const REQUIRED_HEADERS = ["Equipment Name","Number Source","Current Equipment State"];
const allowedStates = ["Existing Released / In Use","Not Yet Released","Out of Service","Retired"];
const allowedNumberSources = ["Customer Assigned","QualiSphere Generated"];
const yesNo = ["Yes","No"];

type RowResult = {
  rowNumber:number;
  raw:any;
  normalized:any;
  status:"ready"|"warning"|"error";
  messages:string[];
};

function txt(v:any){ return String(v ?? "").trim(); }
function bool(v:any){ return txt(v).toLowerCase()==="yes"; }
function isoDate(v:any){
  if(!v) return null;
  if(v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0,10);
  if(typeof v==="number"){
    const d=XLSX.SSF.parse_date_code(v);
    if(d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const d=new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0,10);
}
function slug(v:string){ return v.toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,""); }

export default function EquipmentBulkImportPage(){
  const [tenantId,setTenantId]=useState("");
  const [email,setEmail]=useState("");
  const [role,setRole]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [rows,setRows]=useState<RowResult[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [approver,setApprover]=useState("");
  const [batch,setBatch]=useState<any>(null);

  useEffect(()=>{ void initialize(); },[]);

  async function initialize(){
    const {data:u}=await supabase.auth.getUser();
    const userEmail=(u?.user?.email||"").toLowerCase();
    setEmail(userEmail);

    // Resolve tenant from an Equipment record owned/created by current user, then formal governance membership.
    const {data:eq}=await supabase.from("equipment").select("tenant_id,owner_email,created_by").limit(50);
    const mine=(eq||[]).find((r:any)=>[r.owner_email,r.created_by].filter(Boolean).map((x:any)=>String(x).toLowerCase()).includes(userEmail));
    const fallbackTenant=mine?.tenant_id || (eq||[])[0]?.tenant_id || "";
    setTenantId(fallbackTenant);
    if(fallbackTenant){
      const {data:m}=await supabase.from("equipment_governance_members").select("role")
        .eq("tenant_id",fallbackTenant).eq("user_email",userEmail).eq("is_active",true).maybeSingle();
      setRole(m?.role || (mine ? "coordinator" : "viewer"));
    }
  }

  async function readWorkbook(f:File){
    setMessage(""); setRows([]); setBatch(null); setFile(f);
    const data=await f.arrayBuffer();
    const wb=XLSX.read(data,{type:"array",cellDates:true});
    const ws=wb.Sheets["Equipment Import"] || wb.Sheets[wb.SheetNames[0]];
    if(!ws){ setMessage("No worksheet was found."); return; }
    const json=XLSX.utils.sheet_to_json(ws,{defval:"",raw:true}) as any[];
    const headers=(XLSX.utils.sheet_to_json(ws,{header:1,range:0,blankrows:false})[0]||[]) as string[];
    const missing=REQUIRED_HEADERS.filter(h=>!headers.includes(h));
    if(missing.length){ setMessage(`Template mismatch. Missing: ${missing.join(", ")}`); return; }

    const seen=new Set<string>();
    const validated:RowResult[]=json.filter(r=>Object.values(r).some(v=>txt(v)!=="")).map((r,i)=>{
      const messages:string[]=[];
      const errors:string[]=[];
      const warnings:string[]=[];
      const number=txt(r["Equipment Number"]);
      const source=txt(r["Number Source"]);
      const state=txt(r["Current Equipment State"]);
      const name=txt(r["Equipment Name"]);

      if(!name) errors.push("Equipment Name is required.");
      if(!allowedNumberSources.includes(source)) errors.push("Number Source is invalid.");
      if(source==="Customer Assigned"&&!number) errors.push("Equipment Number is required for Customer Assigned numbering.");
      if(!allowedStates.includes(state)) errors.push("Current Equipment State is invalid.");
      if(number){
        const key=number.toLowerCase();
        if(seen.has(key)) errors.push("Duplicate Equipment Number within workbook.");
        seen.add(key);
      }
      ["Calibration Required","Preventive Maintenance Required","Qualification Required","IQ Applicable","OQ Applicable","PQ Applicable"].forEach(k=>{
        if(txt(r[k]) && !yesNo.includes(txt(r[k]))) errors.push(`${k} must be Yes or No.`);
      });
      if(state==="Existing Released / In Use"){
        if(txt(r["Equipment Status"])!=="Active") warnings.push("Existing Released / In Use normally uses Equipment Status = Active.");
        if(txt(r["Use Status"])!=="Available for Use") warnings.push("Existing Released / In Use normally uses Use Status = Available for Use.");
      }
      if(state==="Not Yet Released" && txt(r["Use Status"])==="Available for Use"){
        errors.push("Not Yet Released equipment cannot be Available for Use.");
      }
      if(bool(r["Qualification Required"]) && txt(r["Qualification Status"])==="Qualified"){
        if(!txt(r["Qualification Protocol / Document Number"]) && !txt(r["Qualification Report / Document Number"]))
          warnings.push("Qualified equipment has no qualification document reference.");
      }

      messages.push(...errors,...warnings);
      const normalized={
        equipment_number:number||null,
        number_source:source==="QualiSphere Generated"?"qualisphere_generated":"customer_assigned",
        equipment_name:name,
        equipment_type:txt(r["Equipment Type"])||null,
        manufacturer:txt(r["Manufacturer"])||null,
        model:txt(r["Model"])||null,
        serial_number:txt(r["Serial Number"])||null,
        asset_number:txt(r["Asset Number"])||null,
        department:txt(r["Department"])||null,
        site_location:txt(r["Site / Location"])||null,
        owner_email:txt(r["Equipment Owner Email"])||null,
        description:txt(r["Description"])||null,
        migration_state:state,
        lifecycle_phase:slug(txt(r["Lifecycle Phase"])),
        equipment_status:slug(txt(r["Equipment Status"])),
        use_status:slug(txt(r["Use Status"])),
        specification_document_number:txt(r["Specification Document Number"])||null,
        specification_revision:txt(r["Specification Revision"])||null,
        calibration_required:bool(r["Calibration Required"]),
        last_calibration_date:isoDate(r["Last Calibration Date"]),
        next_calibration_due_date:isoDate(r["Next Calibration Due Date"]),
        calibration_certificate_number:txt(r["Calibration Certificate Number"])||null,
        preventive_maintenance_required:bool(r["Preventive Maintenance Required"]),
        last_pm_date:isoDate(r["Last PM Date"]),
        next_pm_due_date:isoDate(r["Next PM Due Date"]),
        qualification_required:bool(r["Qualification Required"]),
        qualification_status:txt(r["Qualification Status"])||null,
        qualification_type:txt(r["Qualification Type"])||null,
        iq_applicable:bool(r["IQ Applicable"]),
        oq_applicable:bool(r["OQ Applicable"]),
        pq_applicable:bool(r["PQ Applicable"]),
        qualification_protocol_number:txt(r["Qualification Protocol / Document Number"])||null,
        qualification_protocol_revision:txt(r["Qualification Protocol Revision"])||null,
        qualification_report_number:txt(r["Qualification Report / Document Number"])||null,
        qualification_report_revision:txt(r["Qualification Report Revision"])||null,
        qualification_date:isoDate(r["Qualification Date"]),
        next_requalification_date:isoDate(r["Next Requalification Date"]),
        document_control_link:txt(r["Document Control Link"])||null,
        migration_notes:txt(r["Migration Notes"])||null
      };
      return {rowNumber:i+2,raw:r,normalized,status:errors.length?"error":warnings.length?"warning":"ready",messages};
    });
    setRows(validated);
  }

  async function stageBatch(){
    if(!file||!tenantId||!email){ setMessage("User/tenant context is not ready."); return; }
    if(rows.some(r=>r.status==="error")){ setMessage("Resolve spreadsheet errors before staging the batch."); return; }
    setBusy(true); setMessage("");
    try{
      const {data:num,error:numErr}=await supabase.rpc("next_equipment_import_batch_number");
      if(numErr) throw numErr;
      const counts={
        total_rows:rows.length,
        ready_rows:rows.filter(r=>r.status==="ready").length,
        warning_rows:rows.filter(r=>r.status==="warning").length,
        error_rows:rows.filter(r=>r.status==="error").length
      };
      const {data:b,error:bErr}=await supabase.from("equipment_import_batches").insert({
        tenant_id:tenantId,batch_number:num,source_file_name:file.name,status:"validated",
        created_by:email,...counts
      }).select("*").single();
      if(bErr) throw bErr;
      const payload=rows.map(r=>({
        batch_id:b.id,tenant_id:tenantId,row_number:r.rowNumber,raw_data:r.raw,
        normalized_data:r.normalized,validation_status:r.status,validation_messages:r.messages
      }));
      const {error:rErr}=await supabase.from("equipment_import_rows").insert(payload);
      if(rErr) throw rErr;
      setBatch(b); setMessage(`Batch ${b.batch_number} staged successfully.`);
    }catch(e:any){ setMessage(e?.message||"Unable to stage import batch."); }
    finally{ setBusy(false); }
  }

  async function submitApproval(){
    if(!batch) return;
    const a=approver.trim().toLowerCase();
    if(!a||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)){ setMessage("Enter a valid migration approver email."); return; }
    setBusy(true);
    const {data,error}=await supabase.from("equipment_import_batches").update({
      status:"pending_approval",submitted_by:email,submitted_at:new Date().toISOString(),approver_email:a
    }).eq("id",batch.id).select("*").single();
    setBusy(false);
    if(error){setMessage(error.message);return;}
    setBatch(data); setMessage(`Batch ${data.batch_number} submitted for migration approval.`);
  }

  const ready=rows.filter(r=>r.status==="ready").length;
  const warnings=rows.filter(r=>r.status==="warning").length;
  const errors=rows.filter(r=>r.status==="error").length;
  const canImport=["coordinator","quality_approver","admin"].includes(role);

  return <main style={{maxWidth:1450,margin:"0 auto",padding:"28px 24px 60px",fontFamily:"Arial, sans-serif",color:"#0f172a"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",marginBottom:22}}>
      <div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:6}}>Equipment Management</div>
        <h1 style={{margin:0,fontSize:30}}>Equipment Bulk Import</h1>
        <p style={{color:"#64748b",maxWidth:900}}>Stage, validate, and govern migration of released, not-yet-released, out-of-service, and retired equipment in one workbook.</p>
      </div>
      <Link href="/equipment" style={{textDecoration:"none",padding:"10px 14px",border:"1px solid #cbd5e1",borderRadius:8,color:"#0f172a"}}>Equipment Registry</Link>
    </div>

    {!canImport ? <div style={alertStyle}>Your Equipment role is read-only. Bulk import requires Coordinator, Quality Approver, or Admin access.</div> : null}

    <section style={cardStyle}>
      <h2 style={h2}>1. Upload & Validate Excel</h2>
      <input type="file" accept=".xlsx,.xls" disabled={!canImport||busy} onChange={e=>e.target.files?.[0]&&void readWorkbook(e.target.files[0])}/>
      <div style={{marginTop:10,fontSize:13,color:"#64748b"}}>Use the approved QualiSphere Equipment Bulk Import Template. Validation occurs before anything is written to Equipment Master.</div>
    </section>

    {rows.length>0 && <section style={cardStyle}>
      <h2 style={h2}>2. Validation Preview</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(140px,1fr))",gap:10,marginBottom:14}}>
        <Metric label="Rows" value={rows.length}/>
        <Metric label="Ready" value={ready}/>
        <Metric label="Warnings" value={warnings}/>
        <Metric label="Errors" value={errors}/>
      </div>
      <div style={{overflowX:"auto",maxHeight:500,border:"1px solid #e2e8f0",borderRadius:10}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr>{["Row","Equipment Number","Equipment Name","Imported State","Validation","Messages"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(r=><tr key={r.rowNumber}>
            <td style={td}>{r.rowNumber}</td><td style={td}>{r.normalized.equipment_number||"Auto"}</td>
            <td style={td}>{r.normalized.equipment_name}</td><td style={td}>{r.normalized.migration_state}</td>
            <td style={td}><strong>{r.status.toUpperCase()}</strong></td><td style={td}>{r.messages.join(" • ")||"Ready to stage"}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!batch && <div style={{display:"flex",justifyContent:"flex-end",marginTop:14}}>
        <button style={primary} disabled={!canImport||busy||errors>0} onClick={()=>void stageBatch()}>{busy?"Staging...":"Stage Validated Import Batch"}</button>
      </div>}
    </section>}

    {batch && <section style={cardStyle}>
      <h2 style={h2}>3. Migration Batch Governance</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(180px,1fr))",gap:12,marginBottom:14}}>
        <Metric label="Batch" value={batch.batch_number}/><Metric label="Status" value={String(batch.status).replaceAll("_"," ")}/><Metric label="Source" value={batch.source_file_name}/>
      </div>
      {batch.status==="validated" && <>
        <label style={{display:"block",fontSize:13,fontWeight:700,marginBottom:6}}>Equipment Migration Quality Approver</label>
        <input value={approver} onChange={e=>setApprover(e.target.value)} placeholder="approver@company.com" style={{width:"100%",maxWidth:480,padding:"10px 12px",border:"1px solid #cbd5e1",borderRadius:8}}/>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:14}}>
          <button style={primary} disabled={busy} onClick={()=>void submitApproval()}>Submit Migration Batch for Approval</button>
        </div>
      </>}
      {batch.status==="pending_approval" && <div style={alertStyle}>Pending migration approval by {batch.approver_email}. Batch approval accepts the accuracy of the migrated states; it does not release Not Yet Released equipment.</div>}
    </section>}

    {message && <div style={{...alertStyle,marginTop:14}}>{message}</div>}
  </main>;
}

function Metric({label,value}:{label:string,value:any}){return <div style={{border:"1px solid #e2e8f0",borderRadius:10,padding:12,background:"#f8fafc"}}><div style={{fontSize:12,color:"#64748b"}}>{label}</div><div style={{fontSize:18,fontWeight:800,marginTop:3,textTransform:"capitalize"}}>{value}</div></div>}
const cardStyle:React.CSSProperties={border:"1px solid #e2e8f0",borderRadius:14,padding:18,marginBottom:16,background:"#fff",boxShadow:"0 1px 2px rgba(15,23,42,.04)"};
const h2:React.CSSProperties={fontSize:18,margin:"0 0 14px"};
const primary:React.CSSProperties={border:0,borderRadius:8,padding:"10px 15px",background:"#1d4ed8",color:"#fff",fontWeight:700,cursor:"pointer"};
const alertStyle:React.CSSProperties={border:"1px solid #bfdbfe",background:"#eff6ff",color:"#1e3a8a",borderRadius:10,padding:12};
const th:React.CSSProperties={textAlign:"left",padding:10,background:"#f8fafc",borderBottom:"1px solid #e2e8f0",position:"sticky",top:0};
const td:React.CSSProperties={padding:10,borderBottom:"1px solid #f1f5f9",verticalAlign:"top"};
