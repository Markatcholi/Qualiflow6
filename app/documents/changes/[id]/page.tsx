"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

type Doc = {
  id: string; document_number: string; title: string; document_type: string | null; revision: string; status: string;
  department: string | null; process_area: string | null; file_name: string | null; file_path: string | null; file_url: string | null;
  owner_email: string | null; effective_date: string | null;
};
type Child = { id: string; change_type: "new"|"revision"|"reinstatement"; sequence_no: number; source_document_id: string | null; document_id: string; controlled_documents: Doc | Doc[] | null };

const unwrap = (v: Doc | Doc[] | null) => Array.isArray(v) ? v[0] || null : v;

export default function DicWorkspacePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [dic, setDic] = useState<any>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [released, setReleased] = useState<Doc[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [mode, setMode] = useState<"new"|"revision"|"reinstatement"|null>(null);
  const [saving, setSaving] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [proposedRevision, setProposedRevision] = useState("");
  const [newDoc, setNewDoc] = useState({ title:"", document_type:"SOP", revision:"A", department:"", process_area:"" });

  const load = async () => {
    const user = await supabase.auth.getUser(); setUserEmail(user.data?.user?.email || "");
    const [d,c,r] = await Promise.all([
      supabase.from("document_change_initiations").select("*").eq("id",id).single(),
      supabase.from("document_change_initiation_documents").select("id,change_type,sequence_no,source_document_id,document_id,controlled_documents(id,document_number,title,document_type,revision,status,department,process_area,file_name,file_path,file_url,owner_email,effective_date)").eq("dic_id",id).order("sequence_no"),
      supabase.from("controlled_documents").select("id,document_number,title,document_type,revision,status,department,process_area,file_name,file_path,file_url,owner_email,effective_date").in("status",["release","effective","obsolete"]).order("document_number"),
    ]);
    if (d.error) return alert(d.error.message);
    setDic(d.data); if (!c.error) setChildren((c.data as unknown as Child[]) || []); if (!r.error) setReleased((r.data as Doc[]) || []);
  };
  useEffect(()=>{ if(id) load(); },[id]);

  const currentIds = useMemo(()=>new Set(children.map(x=>x.document_id)),[children]);

  const addExisting = async () => {
    const source = released.find(x=>x.id===sourceId);
    if (!source) return alert("Select a source document.");
    if (!proposedRevision.trim()) return alert("Enter the proposed revision.");
    setSaving(true);
    try {
      const created = await supabase.from("controlled_documents").insert({
        document_number: source.document_number, title: source.title, document_type: source.document_type,
        revision: proposedRevision.trim(), status:"draft", department:source.department, process_area:source.process_area,
        file_name:source.file_name, file_path:source.file_path, file_url:source.file_url, owner_email:userEmail,
        created_by:userEmail, change_required:true, superseded_document_id:source.id, dic_id:id,
      }).select("id").single();
      if(created.error) throw new Error(created.error.message);
      const linked = await supabase.from("document_change_initiation_documents").insert({
        dic_id:id, document_id:created.data.id, source_document_id:source.id, change_type:mode, sequence_no:children.length+1, created_by:userEmail
      });
      if(linked.error) throw new Error(linked.error.message);
      setMode(null); setSourceId(""); setProposedRevision(""); await load();
    } catch(e:any){ alert(e.message || "Unable to add document."); } finally { setSaving(false); }
  };

  const addNew = async () => {
    if(!newDoc.title.trim()) return alert("Document title is required.");
    setSaving(true);
    try {
      const number = await supabase.rpc("generate_document_number",{p_document_type:newDoc.document_type});
      if(number.error) throw new Error(number.error.message);
      const created = await supabase.from("controlled_documents").insert({
        document_number:number.data, title:newDoc.title.trim(), document_type:newDoc.document_type, revision:newDoc.revision.trim()||"A",
        status:"draft", department:newDoc.department||null, process_area:newDoc.process_area||null, owner_email:userEmail, created_by:userEmail, dic_id:id,
        read_ack_required:false, training_required:false
      }).select("id").single();
      if(created.error) throw new Error(created.error.message);
      const linked = await supabase.from("document_change_initiation_documents").insert({
        dic_id:id, document_id:created.data.id, change_type:"new", sequence_no:children.length+1, created_by:userEmail
      });
      if(linked.error) throw new Error(linked.error.message);
      setMode(null); setNewDoc({title:"",document_type:"SOP",revision:"A",department:"",process_area:""}); await load();
    } catch(e:any){ alert(e.message || "Unable to add new document."); } finally { setSaving(false); }
  };

  const withdraw = async () => {
    if(!dic || dic.status==="released") return;
    const reason = window.prompt("Withdrawal reason (required):");
    if(!reason?.trim()) return;
    if(!window.confirm(`Withdraw ${dic.dic_number}? The record and completed history will be retained.`)) return;
    const now=new Date().toISOString();
    const u=await supabase.from("document_change_initiations").update({status:"withdrawn",withdrawn_reason:reason.trim(),withdrawn_by:userEmail,withdrawn_at:now,updated_at:now}).eq("id",id);
    if(u.error) return alert(u.error.message);
    await supabase.from("approval_tasks").update({status:"cancelled"}).eq("entity_type","document_change_initiation").eq("entity_id",id).eq("status","pending");
    await load();
  };

  if(!dic) return <main style={{padding:28}}>Loading DIC...</main>;
  const editable=dic.status==="draft";

  return <main style={{padding:28,maxWidth:1320,margin:"0 auto",fontFamily:"Arial, sans-serif"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start",marginBottom:18}}>
      <div><div style={{fontSize:12,fontWeight:800,letterSpacing:1.2,color:"#536274"}}>DOCUMENT CHANGE INITIATION</div>
        <h1 style={{margin:"6px 0"}}>{dic.dic_number}{dic.title ? ` — ${dic.title}` : ""}</h1>
        <div style={{color:"#667085"}}>Owner: {dic.owner_email} · Status: <strong>{String(dic.status).replaceAll("_"," ")}</strong> · {dic.release_strategy} release</div>
      </div>
      <div style={{display:"flex",gap:8}}><a href="/documents/changes" style={secondary}>DIC Register</a>{editable&&<button onClick={withdraw} style={danger}>Withdraw DIC</button>}</div>
    </div>

    <section style={card}>
      <h2 style={{marginTop:0}}>Change Package</h2>
      <div style={two}><div><strong>Change Description</strong><p>{dic.change_description}</p></div><div><strong>Change Justification</strong><p>{dic.change_justification}</p></div></div>
    </section>

    <section style={card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
        <div><h2 style={{margin:"0 0 4px"}}>Affected Documents</h2><div style={{color:"#667085"}}>Each document has its own proposed revision and Impact Assessment. The DIC will be collaborated and formally approved as one package.</div></div>
        {editable&&<div style={{display:"flex",gap:8}}><button style={secondaryButton} onClick={()=>setMode("new")}>Add New Document</button><button style={secondaryButton} onClick={()=>setMode("revision")}>Add Revision</button><button style={secondaryButton} onClick={()=>setMode("reinstatement")}>Reinstate Obsolete</button></div>}
      </div>

      {mode==="new"&&<div style={subcard}><h3>Add New Document</h3>
        <label style={label}>Title *</label><input style={input} value={newDoc.title} onChange={e=>setNewDoc({...newDoc,title:e.target.value})}/>
        <div style={two}><div><label style={label}>Document Type</label><select style={input} value={newDoc.document_type} onChange={e=>setNewDoc({...newDoc,document_type:e.target.value})}>{["SOP","Work Instruction","Form","Policy","Specification","Protocol","Report","Template","Other"].map(x=><option key={x}>{x}</option>)}</select></div>
        <div><label style={label}>Initial Revision</label><input style={input} value={newDoc.revision} onChange={e=>setNewDoc({...newDoc,revision:e.target.value})}/></div></div>
        <div style={{display:"flex",gap:8}}><button disabled={saving} onClick={addNew} style={primary}>Add to {dic.dic_number}</button><button onClick={()=>setMode(null)} style={secondaryButton}>Cancel</button></div>
      </div>}

      {(mode==="revision"||mode==="reinstatement")&&<div style={subcard}><h3>{mode==="revision"?"Add Existing Document Revision":"Reinstate Obsolete Document"}</h3>
        <label style={label}>Source Document</label><select style={input} value={sourceId} onChange={e=>setSourceId(e.target.value)}><option value="">Select...</option>
          {released.filter(x=>mode==="reinstatement"?x.status==="obsolete":(x.status==="release"||x.status==="effective")).map(x=><option key={x.id} value={x.id}>{x.document_number} Rev {x.revision} — {x.title}</option>)}
        </select>
        <label style={label}>Proposed New Revision *</label><input style={input} value={proposedRevision} onChange={e=>setProposedRevision(e.target.value)} placeholder="e.g. D"/>
        <div style={{display:"flex",gap:8}}><button disabled={saving} onClick={addExisting} style={primary}>Add to {dic.dic_number}</button><button onClick={()=>setMode(null)} style={secondaryButton}>Cancel</button></div>
      </div>}

      {children.length===0?<p style={{color:"#667085"}}>No affected documents have been added yet.</p>:<div style={{overflowX:"auto",marginTop:18}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{["#","Document","Change","Proposed Revision","Document Status","Impact Assessment / Workflow"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead>
        <tbody>{children.map((child,i)=>{const d=unwrap(child.controlled_documents); if(!d)return null; return <tr key={child.id}>
          <td style={td}>{i+1}</td><td style={td}><strong>{d.document_number}</strong><br/><span style={{color:"#667085"}}>{d.title}</span></td>
          <td style={td}>{child.change_type}</td><td style={td}>{d.revision}</td><td style={td}>{d.status}</td>
          <td style={td}><a style={secondary} href={`/documents/${d.id}`}>Open Document Assessment</a></td>
        </tr>})}</tbody>
      </table></div>}
    </section>

    <section style={card}>
      <h2 style={{marginTop:0}}>DIC Review & Approval</h2>
      <p style={{marginBottom:0,color:"#667085"}}><strong>Package rule:</strong> collaborators and formal approvers review every affected document on this DIC. A collaboration or formal approval decision applies to the complete DIC package, not to individual documents.</p>
    </section>
  </main>;
}

const card:React.CSSProperties={border:"1px solid #d9e0e8",borderRadius:10,padding:20,marginBottom:18,background:"#fff"};
const subcard:React.CSSProperties={marginTop:18,padding:16,border:"1px solid #d9e0e8",borderRadius:8,background:"#f8fafc"};
const two:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:18};
const input:React.CSSProperties={width:"100%",boxSizing:"border-box",padding:"10px 11px",border:"1px solid #c8d1dc",borderRadius:6,marginBottom:10};
const label:React.CSSProperties={display:"block",fontWeight:700,margin:"8px 0 6px"};
const primary:React.CSSProperties={border:0,borderRadius:6,padding:"10px 14px",background:"#172033",color:"#fff",fontWeight:700,cursor:"pointer"};
const secondary:React.CSSProperties={border:"1px solid #aab5c2",borderRadius:6,padding:"9px 12px",background:"#fff",color:"#172033",fontWeight:700,textDecoration:"none",display:"inline-block"};
const secondaryButton:React.CSSProperties={...secondary,cursor:"pointer"};
const danger:React.CSSProperties={...primary,background:"#fff",color:"#9f1d20",border:"1px solid #d8a1a3"};
const th:React.CSSProperties={textAlign:"left",padding:"10px 8px",borderBottom:"1px solid #d9e0e8",fontSize:12,color:"#536274"};
const td:React.CSSProperties={padding:"12px 8px",borderBottom:"1px solid #edf0f4",verticalAlign:"top"};
