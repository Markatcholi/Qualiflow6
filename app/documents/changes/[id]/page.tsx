"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { buildControlledDocumentStoragePath, resolveControlledDocumentFileUrl, CONTROLLED_DOCUMENT_BUCKET } from "../../../../lib/controlledDocumentStorage";

type Doc = {
  id: string; document_number: string; title: string; document_type: string | null; revision: string; status: string;
  department: string | null; process_area: string | null; file_name: string | null; file_path: string | null; file_url: string | null;
  owner_email: string | null; effective_date: string | null; resolved_file_url?: string | null;
};
type AdditionalFile = { id:string; document_id:string; file_name:string; file_path:string; signed_url?:string|null };
type Child = { id: string; change_type: "new"|"revision"|"reinstatement"; sequence_no: number; source_document_id: string | null; document_id: string; document: Doc | null };

export default function DciWorkspacePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [dci, setDci] = useState<any>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [released, setReleased] = useState<Doc[]>([]);
  const [additionalFiles, setAdditionalFiles] = useState<AdditionalFile[]>([]);
  const [impactCounts, setImpactCounts] = useState<Record<string,number>>({});
  const [editingId, setEditingId] = useState<string|null>(null);
  const [editDoc, setEditDoc] = useState({title:"",revision:""});
  const [uploadingFor, setUploadingFor] = useState<string|null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [mode, setMode] = useState<"new"|"revision"|"reinstatement"|null>(null);
  const [saving, setSaving] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [proposedRevision, setProposedRevision] = useState("");
  const [newDoc, setNewDoc] = useState({ title:"", document_type:"SOP", revision:"A", department:"", process_area:"" });

  const load = async () => {
    const user = await supabase.auth.getUser(); setUserEmail(user.data?.user?.email || "");
    const [d,links,r] = await Promise.all([
      supabase.from("document_change_initiations").select("*").eq("id",id).single(),
      supabase.from("document_change_initiation_documents").select("id,change_type,sequence_no,source_document_id,document_id").eq("dci_id",id).order("created_at"),
      supabase.from("controlled_documents").select("id,document_number,title,document_type,revision,status,department,process_area,file_name,file_path,file_url,owner_email,effective_date").in("status",["release","effective","obsolete"]).order("document_number"),
    ]);
    if (d.error) return alert(d.error.message);
    setDci(d.data);
    if (links.error) {
      alert(links.error.message);
      setChildren([]);
    } else {
      const linkRows = links.data || [];
      const ids = linkRows.map((row: any) => row.document_id).filter(Boolean);
      let docs: Doc[] = [];
      if (ids.length) {
        const docResult = await supabase
          .from("controlled_documents")
          .select("id,document_number,title,document_type,revision,status,department,process_area,file_name,file_path,file_url,owner_email,effective_date")
          .in("id", ids);
        if (docResult.error) alert(docResult.error.message);
        else docs = (docResult.data as Doc[]) || [];
      }
      const resolvedDocs = await Promise.all(docs.map(async doc => ({...doc, resolved_file_url: await resolveControlledDocumentFileUrl({filePath:doc.file_path,legacyUrl:doc.file_url}).catch(()=>doc.file_url)})));
      const byId = new Map(resolvedDocs.map(doc => [doc.id, doc]));
      setChildren(linkRows.map((row: any) => ({ ...row, document: byId.get(row.document_id) || null })) as Child[]);
      if (ids.length) {
        const [filesRes, impactRes] = await Promise.all([
          supabase.from("document_change_document_files").select("id,document_id,file_name,file_path").eq("dci_id",id).in("document_id",ids).order("created_at"),
          supabase.from("document_impact_assessments").select("document_id,is_impacted").in("document_id",ids)
        ]);
        if (!filesRes.error) {
          const signed = await Promise.all((filesRes.data||[]).map(async (x:any)=>({...x,signed_url:await resolveControlledDocumentFileUrl({filePath:x.file_path}).catch(()=>null)})));
          setAdditionalFiles(signed);
        }
        if (!impactRes.error) {
          const counts:Record<string,number>={}; (impactRes.data||[]).forEach((x:any)=>{if(x.is_impacted!==null) counts[x.document_id]=(counts[x.document_id]||0)+1;}); setImpactCounts(counts);
        }
      }
    }
    if (!r.error) setReleased((r.data as Doc[]) || []);
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
        created_by:userEmail, change_required:true, superseded_document_id:source.id, dci_id:id,
      }).select("id").single();
      if(created.error) throw new Error(created.error.message);
      const linked = await supabase.from("document_change_initiation_documents").insert({
        dci_id:id, document_id:created.data.id, source_document_id:source.id, change_type:mode, sequence_no:children.length+1, created_by:userEmail
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
        status:"draft", department:newDoc.department||null, process_area:newDoc.process_area||null, owner_email:userEmail, created_by:userEmail, dci_id:id,
        read_ack_required:false, training_required:false
      }).select("id").single();
      if(created.error) throw new Error(created.error.message);
      const linked = await supabase.from("document_change_initiation_documents").insert({
        dci_id:id, document_id:created.data.id, change_type:"new", sequence_no:children.length+1, created_by:userEmail
      });
      if(linked.error) throw new Error(linked.error.message);
      setMode(null); setNewDoc({title:"",document_type:"SOP",revision:"A",department:"",process_area:""}); await load();
    } catch(e:any){ alert(e.message || "Unable to add new document."); } finally { setSaving(false); }
  };

  const saveEdit = async (documentId:string) => {
    if(!editDoc.title.trim() || !editDoc.revision.trim()) return alert("Title and revision are required.");
    const {error}=await supabase.from("controlled_documents").update({title:editDoc.title.trim(),revision:editDoc.revision.trim(),updated_at:new Date().toISOString()}).eq("id",documentId);
    if(error) return alert(error.message); setEditingId(null); await load();
  };

  const removeDocument = async (child:Child) => {
    if(!editable || !child.document) return;
    if(!window.confirm(`Remove ${child.document.document_number} Rev ${child.document.revision} from this DCI? The released source document, if any, will not be changed.`)) return;
    const {error:linkError}=await supabase.from("document_change_initiation_documents").delete().eq("id",child.id);
    if(linkError) return alert(linkError.message);
    const {error:docError}=await supabase.from("controlled_documents").delete().eq("id",child.document_id).eq("status","draft").eq("dci_id",id);
    if(docError) return alert(docError.message);
    await load();
  };

  const uploadPrimary = async (doc:Doc,file:File) => {
    setUploadingFor(doc.id);
    try {
      const path=await buildControlledDocumentStoragePath({documentNumber:doc.document_number,revision:doc.revision,area:"working",fileName:file.name});
      const up=await supabase.storage.from(CONTROLLED_DOCUMENT_BUCKET).upload(path,file,{upsert:true}); if(up.error) throw new Error(up.error.message);
      const u=await supabase.from("controlled_documents").update({file_name:file.name,file_path:path,file_url:null,working_file_name:file.name,updated_at:new Date().toISOString()}).eq("id",doc.id);
      if(u.error) throw new Error(u.error.message); await load();
    } catch(e:any){alert(e.message);} finally{setUploadingFor(null);}
  };

  const uploadAdditional = async (doc:Doc,file:File) => {
    setUploadingFor(doc.id);
    try {
      const path=await buildControlledDocumentStoragePath({documentNumber:doc.document_number,revision:doc.revision,area:"dci-supporting",fileName:`${Date.now()}_${file.name}`});
      const up=await supabase.storage.from(CONTROLLED_DOCUMENT_BUCKET).upload(path,file); if(up.error) throw new Error(up.error.message);
      const tenant=await supabase.rpc("qualisphere_current_controlled_documents_tenant"); if(tenant.error) throw new Error(tenant.error.message);
      const ins=await supabase.from("document_change_document_files").insert({tenant_id:tenant.data,dci_id:id,document_id:doc.id,file_name:file.name,file_path:path,uploaded_by:userEmail});
      if(ins.error) throw new Error(ins.error.message); await load();
    } catch(e:any){alert(e.message);} finally{setUploadingFor(null);}
  };

  const withdraw = async () => {
    if(!dci || dci.status==="released") return;
    const reason = window.prompt("Withdrawal reason (required):");
    if(!reason?.trim()) return;
    if(!window.confirm(`Withdraw ${dci.dci_number}? The record and completed history will be retained.`)) return;
    const now=new Date().toISOString();
    const u=await supabase.from("document_change_initiations").update({status:"withdrawn",withdrawn_reason:reason.trim(),withdrawn_by:userEmail,withdrawn_at:now,updated_at:now}).eq("id",id);
    if(u.error) return alert(u.error.message);
    await supabase.from("approval_tasks").update({status:"cancelled"}).eq("entity_type","document_change_initiation").eq("entity_id",id).eq("status","pending");
    await load();
  };

  if(!dci) return <main style={{padding:28}}>Loading DCI...</main>;
  const editable=dci.status==="draft";

  return <main style={{padding:28,maxWidth:1320,margin:"0 auto",fontFamily:"Arial, sans-serif"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start",marginBottom:18}}>
      <div><div style={{fontSize:12,fontWeight:800,letterSpacing:1.2,color:"#536274"}}>DOCUMENT CHANGE INITIATION</div>
        <h1 style={{margin:"6px 0"}}>{dci.dci_number}{dci.title ? ` — ${dci.title}` : ""}</h1>
        <div style={{color:"#667085"}}>Owner: {dci.owner_email} · Status: <strong>{String(dci.status).replaceAll("_"," ")}</strong> · {dci.release_strategy} release</div>
      </div>
      <div style={{display:"flex",gap:8}}><a href="/documents/changes" style={secondary}>DCI Register</a>{editable&&<button onClick={withdraw} style={danger}>Withdraw DCI</button>}</div>
    </div>

    <section style={card}>
      <h2 style={{marginTop:0}}>Change Package</h2>
      <div style={two}><div><strong>Change Description</strong><p>{dci.change_description}</p></div><div><strong>Change Justification</strong><p>{dci.change_justification}</p></div></div>
    </section>

    <section style={card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
        <div><h2 style={{margin:"0 0 4px"}}>Affected Documents</h2><div style={{color:"#667085"}}>Each document has its own proposed revision and Impact Assessment. The DCI will be collaborated and formally approved as one package.</div></div>
        {editable&&<div style={{display:"flex",gap:8}}><button style={secondaryButton} onClick={()=>setMode("new")}>Add New Document</button><button style={secondaryButton} onClick={()=>setMode("revision")}>Add Revision</button><button style={secondaryButton} onClick={()=>setMode("reinstatement")}>Reinstate Obsolete</button></div>}
      </div>

      {mode==="new"&&<div style={subcard}><h3>Add New Document</h3>
        <label style={label}>Title *</label><input style={input} value={newDoc.title} onChange={e=>setNewDoc({...newDoc,title:e.target.value})}/>
        <div style={two}><div><label style={label}>Document Type</label><select style={input} value={newDoc.document_type} onChange={e=>setNewDoc({...newDoc,document_type:e.target.value})}>{["SOP","Work Instruction","Form","Policy","Specification","Protocol","Report","Template","Other"].map(x=><option key={x}>{x}</option>)}</select></div>
        <div><label style={label}>Initial Revision</label><input style={input} value={newDoc.revision} onChange={e=>setNewDoc({...newDoc,revision:e.target.value})}/></div></div>
        <div style={{display:"flex",gap:8}}><button disabled={saving} onClick={addNew} style={primary}>Add to {dci.dci_number}</button><button onClick={()=>setMode(null)} style={secondaryButton}>Cancel</button></div>
      </div>}

      {(mode==="revision"||mode==="reinstatement")&&<div style={subcard}><h3>{mode==="revision"?"Add Existing Document Revision":"Reinstate Obsolete Document"}</h3>
        <label style={label}>Source Document</label><select style={input} value={sourceId} onChange={e=>setSourceId(e.target.value)}><option value="">Select...</option>
          {released.filter(x=>mode==="reinstatement"?x.status==="obsolete":(x.status==="release"||x.status==="effective")).map(x=><option key={x.id} value={x.id}>{x.document_number} Rev {x.revision} — {x.title}</option>)}
        </select>
        <label style={label}>Proposed New Revision *</label><input style={input} value={proposedRevision} onChange={e=>setProposedRevision(e.target.value)} placeholder="e.g. D"/>
        <div style={{display:"flex",gap:8}}><button disabled={saving} onClick={addExisting} style={primary}>Add to {dci.dci_number}</button><button onClick={()=>setMode(null)} style={secondaryButton}>Cancel</button></div>
      </div>}

      {children.length===0?<p style={{color:"#667085"}}>No affected documents have been added yet.</p>:<div style={{overflowX:"auto",marginTop:18}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{["#","Document","Change","Revision","Document File","Additional Files (Optional)","Actions"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead>
        <tbody>{children.map((child,i)=>{const d=child.document; return <tr key={child.id}>
          <td style={td}>{i+1}</td>
          <td style={td}>{d ? (editingId===d.id?<input style={input} value={editDoc.title} onChange={e=>setEditDoc({...editDoc,title:e.target.value})}/>:<><strong>{d.document_number}</strong><br/><span style={{color:"#667085"}}>{d.title}</span></>) : <strong>Document unavailable</strong>}</td>
          <td style={td}>{child.change_type}</td>
          <td style={td}>{d ? (editingId===d.id?<input style={{...input,width:90}} value={editDoc.revision} onChange={e=>setEditDoc({...editDoc,revision:e.target.value})}/>:d.revision) : "—"}</td>
          <td style={td}>{d ? <><div>{d.resolved_file_url?<a style={secondary} href={d.resolved_file_url} target="_blank" rel="noreferrer">Open Document</a>:<span style={{color:"#667085"}}>No document uploaded</span>}</div>{editable&&<label style={{...secondaryButton,marginTop:6}}>Edit / Replace<input type="file" hidden disabled={uploadingFor===d.id} onChange={e=>{const file=e.target.files?.[0];if(file)uploadPrimary(d,file);}}/></label>}</>:"—"}</td>
          <td style={td}>{d?<><div>{additionalFiles.filter(x=>x.document_id===d.id).map(x=><div key={x.id} style={{marginBottom:5}}>{x.signed_url?<a href={x.signed_url} target="_blank" rel="noreferrer">{x.file_name}</a>:x.file_name}</div>)}</div>{editable&&<label style={secondaryButton}>Add File<input type="file" hidden disabled={uploadingFor===d.id} onChange={e=>{const file=e.target.files?.[0];if(file)uploadAdditional(d,file);}}/></label>}</>:"—"}</td>
          <td style={td}>{d&&editable?(editingId===d.id?<><button style={primary} onClick={()=>saveEdit(d.id)}>Save</button> <button style={secondaryButton} onClick={()=>setEditingId(null)}>Cancel</button></>:<><button style={secondaryButton} onClick={()=>{setEditingId(d.id);setEditDoc({title:d.title,revision:d.revision});}}>Edit</button> <button style={danger} onClick={()=>removeDocument(child)}>Remove</button></>):"—"}</td>
        </tr>})}</tbody>
      </table></div>}
    </section>

    <section style={card}>
      <h2 style={{marginTop:0}}>Impact Assessment</h2>
      <p style={{color:"#667085"}}>Complete the Impact Assessment independently for each affected document before the DCI advances to collaboration.</p>
      {children.length===0?<p style={{color:"#667085"}}>Add affected documents first.</p>:children.map(child=>{const d=child.document;if(!d)return null;const count=impactCounts[d.id]||0;return <div key={child.id} style={{...subcard,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
        <div><strong>{d.document_number} Rev {d.revision} — {d.title}</strong><div style={{color:"#667085",fontSize:13}}>Impact Assessment: {count===10?"Complete":`${count}/10 areas assessed`}</div></div>
        <a style={secondary} href={`/documents/${d.id}`}>Open Impact Assessment</a>
      </div>})}


    <section style={card}>
      <h2 style={{marginTop:0}}>DCI Review & Approval</h2>
      <p style={{marginBottom:0,color:"#667085"}}><strong>Package rule:</strong> collaborators and formal approvers review every affected document on this DCI. A collaboration or formal approval decision applies to the complete DCI package, not to individual documents.</p>
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
