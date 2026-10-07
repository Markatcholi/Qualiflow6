"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { buildControlledDocumentStoragePath, resolveControlledDocumentFileUrl, CONTROLLED_DOCUMENT_BUCKET } from "../../../../lib/controlledDocumentStorage";
import DocumentImpactAssessment from "../../../../components/DocumentImpactAssessment";

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
  const [activeImpactAreaCount, setActiveImpactAreaCount] = useState(0);
  const [expandedAssessments,setExpandedAssessments]=useState<Record<string,boolean>>({});
  const [editingId, setEditingId] = useState<string|null>(null);
  const [editDoc, setEditDoc] = useState({document_number:"",title:"",document_type:"SOP",revision:"A",department:"",process_area:"",owner_email:"",change_description:"",change_rationale:""});
  const [editPrimaryFile,setEditPrimaryFile]=useState<File|null>(null);
  const [editAdditionalFiles,setEditAdditionalFiles]=useState<File[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [mode, setMode] = useState<"new"|"revision"|"reinstatement"|null>(null);
  const [saving, setSaving] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [proposedRevision, setProposedRevision] = useState("");
  const [newDoc, setNewDoc] = useState({ document_number:"", title:"", document_type:"SOP", revision:"A", department:"", process_area:"", owner_email:"", change_description:"", change_rationale:"" });
  const [newPrimaryFile,setNewPrimaryFile]=useState<File|null>(null);
  const [newAdditionalFiles,setNewAdditionalFiles]=useState<File[]>([]);
  const [autoGeneratingNumber,setAutoGeneratingNumber]=useState(false);

  const load = async () => {
    const user = await supabase.auth.getUser(); setUserEmail(user.data?.user?.email || "");
    const [d,links,r] = await Promise.all([
      supabase.from("document_change_initiations").select("*").eq("id",id).single(),
      supabase.from("document_change_initiation_documents").select("id,change_type,sequence_no,source_document_id,document_id").eq("dci_id",id).order("created_at"),
      supabase.from("controlled_documents").select("id,document_number,title,document_type,revision,status,department,process_area,file_name,file_path,file_url,owner_email,effective_date").in("status",["release","effective","obsolete"]).order("document_number"),
    ]);
    if (d.error) return alert(d.error.message);
    setDci(d.data);
    const areaCountRes=await supabase.from("md_document_impact_areas").select("id",{count:"exact",head:true}).eq("tenant_id",d.data.tenant_id).eq("is_active",true);
    if(!areaCountRes.error) setActiveImpactAreaCount(areaCountRes.count||0);
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

  const prepareNewDocument = async () => {
    setMode("new");
    setAutoGeneratingNumber(true);
    const number=await supabase.rpc("generate_document_number",{p_document_type:"SOP"});
    setAutoGeneratingNumber(false);
    if(number.error) return alert(number.error.message);
    setNewDoc({document_number:String(number.data||""),title:"",document_type:"SOP",revision:"A",department:"",process_area:"",owner_email:userEmail,change_description:"",change_rationale:""});
    setNewPrimaryFile(null); setNewAdditionalFiles([]);
  };

  const changeNewDocumentType = async (document_type:string) => {
    setNewDoc(prev=>({...prev,document_type,document_number:""}));
    setAutoGeneratingNumber(true);
    const number=await supabase.rpc("generate_document_number",{p_document_type:document_type});
    setAutoGeneratingNumber(false);
    if(number.error) return alert(number.error.message);
    setNewDoc(prev=>({...prev,document_type,document_number:String(number.data||"")}));
  };

  const addNew = async () => {
    if(!newDoc.title.trim()) return alert("Document title is required.");
    setSaving(true);
    try {
      if(!newDoc.document_number.trim()) throw new Error("Document number is required.");
      let primary:{file_name:string|null,file_path:string|null}={file_name:null,file_path:null};
      if(newPrimaryFile){
        const filePath=await buildControlledDocumentStoragePath({documentNumber:newDoc.document_number,revision:newDoc.revision||"A",area:"working",fileName:`${Date.now()}_${newPrimaryFile.name}`});
        const up=await supabase.storage.from(CONTROLLED_DOCUMENT_BUCKET).upload(filePath,newPrimaryFile); if(up.error) throw new Error(up.error.message);
        primary={file_name:newPrimaryFile.name,file_path:filePath};
      }
      const created = await supabase.from("controlled_documents").insert({
        document_number:newDoc.document_number.trim(), title:newDoc.title.trim(), document_type:newDoc.document_type, revision:newDoc.revision.trim()||"A",
        status:"draft", department:newDoc.department||null, process_area:newDoc.process_area||null, owner_email:newDoc.owner_email||userEmail, created_by:userEmail, dci_id:id,
        file_name:primary.file_name,file_path:primary.file_path,file_url:null,change_summary:newDoc.change_description||null,change_rationale:newDoc.change_rationale||null,
        read_ack_required:false, training_required:false
      }).select("id").single();
      if(created.error) throw new Error(created.error.message);
      const linked = await supabase.from("document_change_initiation_documents").insert({
        dci_id:id, document_id:created.data.id, change_type:"new", sequence_no:children.length+1, created_by:userEmail
      });
      if(linked.error) throw new Error(linked.error.message);
      if(newAdditionalFiles.length){
        const tenant=await supabase.rpc("qualisphere_current_controlled_documents_tenant"); if(tenant.error) throw new Error(tenant.error.message);
        for(const file of newAdditionalFiles){
          const filePath=await buildControlledDocumentStoragePath({documentNumber:newDoc.document_number,revision:newDoc.revision||"A",area:"dci-supporting",fileName:`${Date.now()}_${file.name}`});
          const up=await supabase.storage.from(CONTROLLED_DOCUMENT_BUCKET).upload(filePath,file); if(up.error) throw new Error(up.error.message);
          const ins=await supabase.from("document_change_document_files").insert({tenant_id:tenant.data,dci_id:id,document_id:created.data.id,file_name:file.name,file_path:filePath,uploaded_by:userEmail}); if(ins.error) throw new Error(ins.error.message);
        }
      }
      setMode(null); setNewDoc({document_number:"",title:"",document_type:"SOP",revision:"A",department:"",process_area:"",owner_email:"",change_description:"",change_rationale:""}); setNewPrimaryFile(null); setNewAdditionalFiles([]); await load();
    } catch(e:any){ alert(e.message || "Unable to add new document."); } finally { setSaving(false); }
  };

  const openEdit = async (doc:Doc) => {
    const details=await supabase.from("controlled_documents").select("document_number,title,document_type,revision,department,process_area,owner_email,change_summary,change_rationale").eq("id",doc.id).single();
    if(details.error) return alert(details.error.message);
    const x:any=details.data;
    setEditDoc({document_number:x.document_number||"",title:x.title||"",document_type:x.document_type||"SOP",revision:x.revision||"A",department:x.department||"",process_area:x.process_area||"",owner_email:x.owner_email||"",change_description:x.change_summary||"",change_rationale:x.change_rationale||""});
    setEditPrimaryFile(null); setEditAdditionalFiles([]); setEditingId(doc.id);
  };

  const saveEdit = async (documentId:string) => {
    if(!editDoc.title.trim() || !editDoc.revision.trim()) return alert("Title and revision are required.");
    setSaving(true);
    try {
      const current=children.find(x=>x.document_id===documentId)?.document;
      if(!current) throw new Error("Document not found.");
      const updates:any={title:editDoc.title.trim(),revision:editDoc.revision.trim(),department:editDoc.department||null,process_area:editDoc.process_area||null,owner_email:editDoc.owner_email||userEmail,change_summary:editDoc.change_description||null,change_rationale:editDoc.change_rationale||null,updated_at:new Date().toISOString()};
      if(editPrimaryFile){
        const filePath=await buildControlledDocumentStoragePath({documentNumber:current.document_number,revision:editDoc.revision,area:"working",fileName:`${Date.now()}_${editPrimaryFile.name}`});
        const up=await supabase.storage.from(CONTROLLED_DOCUMENT_BUCKET).upload(filePath,editPrimaryFile); if(up.error) throw new Error(up.error.message);
        updates.file_name=editPrimaryFile.name; updates.file_path=filePath; updates.file_url=null; updates.working_file_name=editPrimaryFile.name;
      }
      const {error}=await supabase.from("controlled_documents").update(updates).eq("id",documentId); if(error) throw new Error(error.message);
      if(editAdditionalFiles.length){
        const tenant=await supabase.rpc("qualisphere_current_controlled_documents_tenant"); if(tenant.error) throw new Error(tenant.error.message);
        for(const file of editAdditionalFiles){
          const filePath=await buildControlledDocumentStoragePath({documentNumber:current.document_number,revision:editDoc.revision,area:"dci-supporting",fileName:`${Date.now()}_${file.name}`});
          const up=await supabase.storage.from(CONTROLLED_DOCUMENT_BUCKET).upload(filePath,file); if(up.error) throw new Error(up.error.message);
          const ins=await supabase.from("document_change_document_files").insert({tenant_id:tenant.data,dci_id:id,document_id:documentId,file_name:file.name,file_path:filePath,uploaded_by:userEmail}); if(ins.error) throw new Error(ins.error.message);
        }
      }
      setEditingId(null); setEditPrimaryFile(null); setEditAdditionalFiles([]); await load();
    } catch(e:any){alert(e.message||"Unable to update document.");} finally{setSaving(false);}
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

  const refreshImpactCounts = async () => {
    const ids=children.map(x=>x.document_id).filter(Boolean);
    if(!ids.length){setImpactCounts({});return;}
    const impactRes=await supabase.from("document_impact_assessments").select("document_id,is_impacted").in("document_id",ids);
    if(impactRes.error) return;
    const counts:Record<string,number>={}; (impactRes.data||[]).forEach((x:any)=>{if(x.is_impacted!==null) counts[x.document_id]=(counts[x.document_id]||0)+1;}); setImpactCounts(counts);
  };

  const toggleAssessment = async (documentId:string) => {
    const opening=!expandedAssessments[documentId];
    setExpandedAssessments(prev=>({...prev,[documentId]:opening}));
    if(!opening) await refreshImpactCounts();
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
        {editable&&<div style={{display:"flex",gap:8}}><button style={secondaryButton} onClick={prepareNewDocument}>Add New Document</button><button style={secondaryButton} onClick={()=>setMode("revision")}>Add Revision</button><button style={secondaryButton} onClick={()=>setMode("reinstatement")}>Reinstate Obsolete</button></div>}
      </div>

      {mode==="new"&&<div style={subcard}><h3>Create New Document</h3>
        <div style={{color:"#667085",marginBottom:12}}>Create the controlled document directly in this DCI. The document number is assigned automatically from the selected document type.</div>
        <div style={two}>
          <div><label style={label}>Document Type</label><select style={input} value={newDoc.document_type} onChange={e=>changeNewDocumentType(e.target.value)}>{["SOP","Work Instruction","Form","Policy","Specification","Protocol","Report","Template","Other"].map(x=><option key={x}>{x}</option>)}</select></div>
          <div><label style={label}>Document Number</label><input style={input} value={autoGeneratingNumber?"Generating...":newDoc.document_number} readOnly/></div>
          <div><label style={label}>Title *</label><input style={input} value={newDoc.title} onChange={e=>setNewDoc({...newDoc,title:e.target.value})}/></div>
          <div><label style={label}>Revision</label><input style={input} value={newDoc.revision} onChange={e=>setNewDoc({...newDoc,revision:e.target.value})}/></div>
          <div><label style={label}>Department</label><input style={input} value={newDoc.department} onChange={e=>setNewDoc({...newDoc,department:e.target.value})}/></div>
          <div><label style={label}>Process Area</label><input style={input} value={newDoc.process_area} onChange={e=>setNewDoc({...newDoc,process_area:e.target.value})}/></div>
          <div><label style={label}>Owner Email</label><input type="email" style={input} value={newDoc.owner_email} onChange={e=>setNewDoc({...newDoc,owner_email:e.target.value})}/></div>
        </div>
        <label style={label}>Change Description</label><textarea style={input} rows={3} value={newDoc.change_description} onChange={e=>setNewDoc({...newDoc,change_description:e.target.value})}/>
        <label style={label}>Change Rationale / Justification</label><textarea style={input} rows={3} value={newDoc.change_rationale} onChange={e=>setNewDoc({...newDoc,change_rationale:e.target.value})}/>
        <label style={label}>Markup / Redline</label><input type="file" style={input} onChange={e=>setNewPrimaryFile(e.target.files?.[0]||null)}/>
        <label style={label}>Additional Files (Optional)</label><input type="file" multiple style={input} onChange={e=>setNewAdditionalFiles(Array.from(e.target.files||[]))}/>
        <div style={{display:"flex",gap:8}}><button disabled={saving||autoGeneratingNumber} onClick={addNew} style={primary}>Create & Add to {dci.dci_number}</button><button onClick={()=>setMode(null)} style={secondaryButton}>Cancel</button></div>
      </div>}

      {editingId&&<div style={subcard}><h3>Edit Document</h3>
        <div style={{color:"#667085",marginBottom:12}}>Update the document creation information and manage its Markup / Redline and optional additional files.</div>
        <div style={two}>
          <div><label style={label}>Document Type</label><input style={input} value={editDoc.document_type} readOnly/></div>
          <div><label style={label}>Document Number</label><input style={input} value={editDoc.document_number} readOnly/></div>
          <div><label style={label}>Title *</label><input style={input} value={editDoc.title} onChange={e=>setEditDoc({...editDoc,title:e.target.value})}/></div>
          <div><label style={label}>Revision</label><input style={input} value={editDoc.revision} onChange={e=>setEditDoc({...editDoc,revision:e.target.value})}/></div>
          <div><label style={label}>Department</label><input style={input} value={editDoc.department} onChange={e=>setEditDoc({...editDoc,department:e.target.value})}/></div>
          <div><label style={label}>Process Area</label><input style={input} value={editDoc.process_area} onChange={e=>setEditDoc({...editDoc,process_area:e.target.value})}/></div>
          <div><label style={label}>Owner Email</label><input type="email" style={input} value={editDoc.owner_email} onChange={e=>setEditDoc({...editDoc,owner_email:e.target.value})}/></div>
        </div>
        <label style={label}>Change Description</label><textarea style={input} rows={3} value={editDoc.change_description} onChange={e=>setEditDoc({...editDoc,change_description:e.target.value})}/>
        <label style={label}>Change Rationale / Justification</label><textarea style={input} rows={3} value={editDoc.change_rationale} onChange={e=>setEditDoc({...editDoc,change_rationale:e.target.value})}/>
        <label style={label}>Replace Markup / Redline (Optional)</label><input type="file" style={input} onChange={e=>setEditPrimaryFile(e.target.files?.[0]||null)}/>
        <label style={label}>Add Additional Files (Optional)</label><input type="file" multiple style={input} onChange={e=>setEditAdditionalFiles(Array.from(e.target.files||[]))}/>
        <div style={{display:"flex",gap:8}}><button disabled={saving} onClick={()=>saveEdit(editingId)} style={primary}>{saving?"Saving...":"Save Document"}</button><button onClick={()=>{setEditingId(null);setEditPrimaryFile(null);setEditAdditionalFiles([]);}} style={secondaryButton}>Cancel</button></div>
      </div>}

      {(mode==="revision"||mode==="reinstatement")&&<div style={subcard}><h3>{mode==="revision"?"Add Existing Document Revision":"Reinstate Obsolete Document"}</h3>
        <label style={label}>Source Document</label><select style={input} value={sourceId} onChange={e=>setSourceId(e.target.value)}><option value="">Select...</option>
          {released.filter(x=>mode==="reinstatement"?x.status==="obsolete":(x.status==="release"||x.status==="effective")).map(x=><option key={x.id} value={x.id}>{x.document_number} Rev {x.revision} — {x.title}</option>)}
        </select>
        <label style={label}>Proposed New Revision *</label><input style={input} value={proposedRevision} onChange={e=>setProposedRevision(e.target.value)} placeholder="e.g. D"/>
        <div style={{display:"flex",gap:8}}><button disabled={saving} onClick={addExisting} style={primary}>Add to {dci.dci_number}</button><button onClick={()=>setMode(null)} style={secondaryButton}>Cancel</button></div>
      </div>}

      {children.length===0?<p style={{color:"#667085"}}>No affected documents have been added yet.</p>:<div style={{overflowX:"auto",marginTop:18}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{["Action","Document Number","Current Rev","New Rev","Document Title","Document Type","Markup / Redline","Additional Files","Remove Doc"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead>
        <tbody>{children.map(child=>{const d=child.document;const source=released.find(x=>x.id===child.source_document_id);return <tr key={child.id}>
          <td style={td}>{d&&editable?<button style={secondaryButton} onClick={()=>openEdit(d)}>Edit</button>:"—"}</td>
          <td style={td}>{d?<a href={`/documents/${d.id}`} style={{fontWeight:800,color:"#1d4ed8",textDecoration:"underline"}}>{d.document_number}</a>:"Unavailable"}</td>
          <td style={td}>{child.change_type==="new"?"—":source?.revision||"—"}</td>
          <td style={td}>{d?.revision||"—"}</td>
          <td style={td}>{d?.title||"—"}</td>
          <td style={td}>{d?.document_type||"—"}</td>
          <td style={td}>{d?(d.resolved_file_url?<a href={d.resolved_file_url} target="_blank" rel="noreferrer">{d.file_name||"Open Markup / Redline"}</a>:<span style={{color:"#667085"}}>No file uploaded</span>):"—"}</td>
          <td style={td}>{d?<div>{additionalFiles.filter(x=>x.document_id===d.id).map(x=><div key={x.id} style={{marginBottom:5}}>{x.signed_url?<a href={x.signed_url} target="_blank" rel="noreferrer">{x.file_name}</a>:x.file_name}</div>)}</div>:"—"}</td>
          <td style={td}>{d&&editable?<button style={danger} onClick={()=>removeDocument(child)}>Remove Doc</button>:"—"}</td>
        </tr>})}</tbody>
      </table></div>}
    </section>

    <section style={card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
        <div><h2 style={{margin:"0 0 4px"}}>Impact Assessment</h2>
          <div style={{color:"#667085"}}>Assess each affected document independently. During Collaboration, active collaborators may update these assessments. All active Company Account impact areas must be complete before Collaboration can be closed.</div>
        </div>
        {children.length>0&&<div style={{fontSize:13,fontWeight:700,color:Object.values(impactCounts).length>0&&children.filter(x=>x.document).every(x=>(impactCounts[x.document_id]||0)===activeImpactAreaCount)?"#18794e":"#8a5a00"}}>
          {children.filter(x=>x.document).filter(x=>(impactCounts[x.document_id]||0)===activeImpactAreaCount).length} of {children.filter(x=>x.document).length} Complete
        </div>}
      </div>
      {children.length===0?<p style={{color:"#667085"}}>Add affected documents first.</p>:<div style={{marginTop:18}}>
        {children.map(child=>{const d=child.document;if(!d)return null;const count=impactCounts[d.id]||0;const complete=count===activeImpactAreaCount;const expanded=Boolean(expandedAssessments[d.id]);return <div key={child.id} style={{border:"1px solid #d9e0e8",borderRadius:9,marginBottom:12,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"minmax(120px,0.8fr) 70px minmax(220px,1.7fr) minmax(120px,1fr) minmax(145px,1fr) 105px 150px",gap:10,alignItems:"center",padding:"12px 14px",background:"#fff"}}>
            <div><a href={`/documents/${d.id}`} style={{fontWeight:800,color:"#1d4ed8",textDecoration:"underline"}}>{d.document_number}</a></div>
            <div>{d.revision}</div>
            <div>{d.title}</div>
            <div>{d.document_type||"—"}</div>
            <div><strong>{count}/{activeImpactAreaCount}</strong> areas assessed</div>
            <div><span style={{display:"inline-block",padding:"4px 9px",borderRadius:999,fontSize:12,fontWeight:800,background:complete?"#e9f7ef":"#fff4d6",color:complete?"#18794e":"#8a5a00"}}>{complete?"Complete":count===0?"Not Started":"In Progress"}</span></div>
            <div><button type="button" style={secondaryButton} onClick={()=>toggleAssessment(d.id)}>{expanded?"Collapse Assessment":complete?"Review Assessment":"Open Assessment"}</button></div>
          </div>
          {expanded&&<div style={{padding:"0 14px 14px",background:"#f8fafc",borderTop:"1px solid #edf0f4"}}>
            <DocumentImpactAssessment documentId={d.id} tenantId={dci.tenant_id} documentNumber={d.document_number} revision={d.revision} status={d.status} userEmail={userEmail} canManage={editable} />
          </div>}
        </div>})}
      </div>}
      {children.length>0&&children.filter(x=>x.document).every(x=>(impactCounts[x.document_id]||0)===activeImpactAreaCount)&&<div style={{marginTop:14,padding:"10px 12px",border:"1px solid #b7ddc7",borderRadius:7,background:"#f3fbf6",color:"#18794e",fontWeight:700}}>Impact Assessment complete for all affected documents. The DCI is ready for the next workflow stage.</div>}
    </section>

    <section style={card}>
      <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap"}}>
        <div><h2 style={{margin:"0 0 4px"}}>DCI Collaboration</h2><div style={{color:"#667085"}}>Collaborators review the complete DCI package: all affected documents, Markup / Redlines, supporting files, Impact Assessments, and anticipated dispositions.</div></div>
        {(dci.status==="collaboration"||children.length>0&&children.filter(x=>x.document).every(x=>(impactCounts[x.document_id]||0)===activeImpactAreaCount))
          ? <a href={`/documents/changes/${id}/collaboration`} style={primary}>Open DCI Collaboration</a>
          : <span style={{color:"#8a5a00",fontWeight:700}}>Complete all Impact Assessments before starting the first Collaboration round.</span>}
      </div>
    </section>

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
