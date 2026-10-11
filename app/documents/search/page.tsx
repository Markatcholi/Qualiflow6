"use client";
import {useEffect,useMemo,useState} from "react";
import {supabase} from "../../../lib/supabaseClient";
import {resolveControlledDocumentFileUrl} from "../../../lib/controlledDocumentStorage";

type Doc={id:string;document_number:string;title:string;revision:string;status:string;document_type:string|null;owner_email:string|null;effective_date:string|null;controlled_copy_file_path:string|null;controlled_copy_file_url:string|null;file_path:string|null;file_url:string|null;release_pdf_file_path:string|null;release_pdf_file_url:string|null};
export default function SearchDocuments(){
 const [query,setQuery]=useState("");
 const [status,setStatus]=useState("all");
 const [owner,setOwner]=useState("");
 const [revision,setRevision]=useState("");
 const [docType,setDocType]=useState("");
 const [docs,setDocs]=useState<Doc[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [opening,setOpening]=useState<string|null>(null);
 useEffect(()=>{let active=true;(async()=>{try{
  const auth=await supabase.auth.getUser();const email=String(auth.data.user?.email||"").toLowerCase();if(!email)throw new Error("Sign in to search controlled documents.");
  const tenant=await supabase.rpc("qualisphere_current_controlled_documents_tenant");
  if(tenant.error||!tenant.data)throw new Error(tenant.error?.message||"Select an active Company Account.");
  const tenantId=String(tenant.data);
  const response=await supabase.from("controlled_documents")
   .select("id,document_number,title,revision,status,document_type,owner_email,effective_date,controlled_copy_file_path,controlled_copy_file_url,file_path,file_url,release_pdf_file_path,release_pdf_file_url")
   .eq("tenant_id",tenantId).order("document_number");
  if(response.error)throw response.error;
  if(active)setDocs(response.data||[]);
 }catch(e:any){if(active)setError(e.message||"Unable to search documents.");}finally{if(active)setLoading(false);}})();return()=>{active=false};},[]);
 const today=new Date().toLocaleDateString("en-CA");
 const results=useMemo(()=>docs.filter(d=>{
  if(status==="release"&&!(d.status==="release"&&!!d.effective_date&&d.effective_date<=today))return false;
  if(status==="nonrelease"&&d.status==="release")return false;
  return (!query.trim()||(d.document_number+" "+d.title).toLowerCase().includes(query.trim().toLowerCase()))
  &&(!owner.trim()||String(d.owner_email||"").toLowerCase().includes(owner.trim().toLowerCase()))
  &&(!revision.trim()||d.revision.toLowerCase().includes(revision.trim().toLowerCase()))
  &&(!docType||d.document_type===docType);
 }),[docs,query,status,owner,revision,docType,today]);
 const hasFilter=Boolean(query.trim()||owner.trim()||revision.trim()||docType||status!=="all");
 const open=async(doc:Doc)=>{setOpening(doc.id);setError("");try{
  const released=doc.status==="release";
  const url=await resolveControlledDocumentFileUrl({filePath:released?(doc.controlled_copy_file_path||doc.release_pdf_file_path):doc.file_path,legacyUrl:released?(doc.controlled_copy_file_url||doc.release_pdf_file_url):doc.file_url});
  if(!url)throw new Error("No viewable file is available for this revision.");
  window.open(url,"_blank","noopener,noreferrer");
 }catch(e:any){setError(e.message||"Unable to open document.");}finally{setOpening(null);}};
 const fieldStyle={padding:10,border:"1px solid #cbd5e1",borderRadius:7,width:"100%",boxSizing:"border-box" as const};
 return <main style={{maxWidth:1150,margin:"30px auto",padding:24,fontFamily:"Arial,sans-serif"}}>
 <a href="/workspace">← My Workspace</a><h1>Search Controlled Documents</h1>
 <p>Search documents by number, title, status, owner, revision and type. All document statuses are searchable. Viewing a document does not grant editing or approval authority.</p>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
  <label>Document Number / Title<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Document number or title" style={fieldStyle}/></label>
  <label>Status<select value={status} onChange={e=>setStatus(e.target.value)} style={fieldStyle}><option value="all">All statuses</option><option value="release">Released (effective)</option><option value="nonrelease">Not Released</option></select></label>
  <label>Document Owner<input value={owner} onChange={e=>setOwner(e.target.value)} placeholder="Owner email" style={fieldStyle}/></label>
  <label>Revision<input value={revision} onChange={e=>setRevision(e.target.value)} placeholder="Revision" style={fieldStyle}/></label>
  <label>Document Type<select value={docType} onChange={e=>setDocType(e.target.value)} style={fieldStyle}><option value="">All types</option>{Array.from(new Set(docs.map(d=>d.document_type).filter((v):v is string=>Boolean(v)))).sort().map(v=><option key={v} value={v}>{v}</option>)}</select></label>
 </div>
 {error?<p role="alert" style={{color:"#b91c1c"}}>{error}</p>:null}
 {loading?<p>Loading documents...</p>:!hasFilter?<p>Enter a search criterion or select a status to view results.</p>:results.length===0?<p>No matching documents found.</p>:<div style={{overflowX:"auto",marginTop:22}}><p>{results.length} matching document(s)</p><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Document","Title","Owner","Status","Type","Effective Date","Action"].map(h=><th key={h} align="left">{h}</th>)}</tr></thead><tbody>{results.map(d=><tr key={d.id} style={{borderTop:"1px solid #e2e8f0"}}><td style={{padding:10}}>{d.document_number} Rev {d.revision}</td><td>{d.title}</td><td>{d.owner_email||"—"}</td><td>{d.status==="release"?"Released":d.status.replaceAll("_"," ")}</td><td>{d.document_type||"—"}</td><td>{d.effective_date||"—"}</td><td>{(d.status==="release"?(d.controlled_copy_file_path||d.controlled_copy_file_url||d.release_pdf_file_path||d.release_pdf_file_url):(d.file_path||d.file_url))?<button type="button" disabled={opening===d.id} onClick={()=>void open(d)}>{opening===d.id?"Opening...":"View Document"}</button>:<a href={`/documents?search=${encodeURIComponent(d.document_number)}`}>View in Repository</a>}</td></tr>)}</tbody></table></div>}
 </main>;
}
