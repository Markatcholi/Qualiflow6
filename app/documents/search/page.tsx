"use client";
import {useEffect,useState} from "react";
import {supabase} from "../../../lib/supabaseClient";
import {resolveControlledDocumentFileUrl} from "../../../lib/controlledDocumentStorage";

type Doc={id:string;document_number:string;title:string;revision:string;effective_date:string|null;controlled_copy_file_path:string|null;controlled_copy_file_url:string|null};
export default function SearchDocuments(){
 const [query,setQuery]=useState("");
 const [docs,setDocs]=useState<Doc[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [opening,setOpening]=useState<string|null>(null);
 useEffect(()=>{let active=true;(async()=>{try{
  const auth=await supabase.auth.getUser();if(!auth.data.user)throw new Error("Sign in to search controlled documents.");
  const tenant=await supabase.rpc("qualisphere_current_controlled_documents_tenant");
  if(tenant.error||!tenant.data)throw new Error(tenant.error?.message||"Select an active Company Account.");
  const response=await supabase.from("controlled_documents")
   .select("id,document_number,title,revision,effective_date,controlled_copy_file_path,controlled_copy_file_url")
   .eq("tenant_id",tenant.data).eq("status","release").order("document_number");
  if(response.error)throw response.error;
  const today=new Date().toLocaleDateString("en-CA");
  if(active)setDocs((response.data||[]).filter(d=>Boolean(d.effective_date)&&String(d.effective_date)<=today&&Boolean(d.controlled_copy_file_path||d.controlled_copy_file_url)));
 }catch(e:any){if(active)setError(e.message||"Unable to search documents.");}finally{if(active)setLoading(false);}})();return()=>{active=false};},[]);
 const results=query.trim()?docs.filter(d=>(d.document_number+" "+d.title+" "+d.revision).toLowerCase().includes(query.trim().toLowerCase())):[];
 const open=async(doc:Doc)=>{setOpening(doc.id);setError("");try{const url=await resolveControlledDocumentFileUrl({filePath:doc.controlled_copy_file_path,legacyUrl:doc.controlled_copy_file_url});if(!url)throw new Error("Controlled copy unavailable.");window.open(url,"_blank","noopener,noreferrer");}catch(e:any){setError(e.message||"Unable to open document.");}finally{setOpening(null);}};
 return <main style={{maxWidth:1050,margin:"30px auto",padding:24,fontFamily:"Arial,sans-serif"}}>
 <a href="/workspace">← My Workspace</a><h1>Search Controlled Documents</h1>
 <p>Find currently effective, released controlled copies. Draft, obsolete, superseded and future-effective documents are excluded.</p>
 <input aria-label="Search controlled documents" autoFocus placeholder="Enter document number, title, or revision" value={query} onChange={e=>setQuery(e.target.value)} style={{width:"100%",padding:13,border:"1px solid #cbd5e1",borderRadius:8,boxSizing:"border-box"}}/>
 {error?<p role="alert" style={{color:"#b91c1c"}}>{error}</p>:null}
 {loading?<p>Loading documents...</p>:!query.trim()?<p>Enter a search term to find a controlled document.</p>:results.length===0?<p>No matching effective controlled documents found.</p>:<table style={{width:"100%",marginTop:20,borderCollapse:"collapse"}}><thead><tr><th align="left">Document</th><th align="left">Title</th><th align="left">Effective date</th><th align="left">Action</th></tr></thead><tbody>{results.map(d=><tr key={d.id} style={{borderTop:"1px solid #e2e8f0"}}><td style={{padding:10}}>{d.document_number} Rev {d.revision}</td><td>{d.title}</td><td>{d.effective_date}</td><td><button type="button" disabled={opening===d.id} onClick={()=>void open(d)}>{opening===d.id?"Opening...":"Open Controlled Copy"}</button></td></tr>)}</tbody></table>}
 </main>;
}
