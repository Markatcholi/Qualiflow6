"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";
import DocumentTrainingAssignment from "../../../../../components/DocumentTrainingAssignment";
import { buildControlledDocumentStoragePath, CONTROLLED_DOCUMENT_BUCKET, resolveControlledDocumentFileUrl } from "../../../../../lib/controlledDocumentStorage";

type DocumentRow = { id:string; document_number:string; revision:string; title:string; file_path:string|null; file_url:string|null; release_pdf_file_path:string|null; release_pdf_file_url:string|null; status:string; effective_date:string|null };
type Requirement = { id:string; document_id:string; training_methods: { release_blocking:boolean; label:string } | { release_blocking:boolean; label:string }[] | null };
type Assignment = { id:string; document_id:string; training_requirement_id:string|null; status:string; release_blocking:boolean };
const card:React.CSSProperties={border:"1px solid #d9e0e8",borderRadius:10,padding:18,marginBottom:16,background:"#fff"};
const cell:React.CSSProperties={padding:"10px 8px",borderBottom:"1px solid #e2e8f0",textAlign:"left",verticalAlign:"top"};
export default function DciReleaseReadinessPage(){
 const {id}=useParams<{id:string}>();
 const [dci,setDci]=useState<{dci_number:string;status:string;release_strategy:string}|null>(null);
 const [docs,setDocs]=useState<DocumentRow[]>([]);
 const [requirements,setRequirements]=useState<Requirement[]>([]);
 const [assignments,setAssignments]=useState<Assignment[]>([]);
 const [tasks,setTasks]=useState<{task_type:string;status:string;implementation_verification_status:string|null}[]>([]);
 const [links,setLinks]=useState<Record<string,string|null>>({});
 const [pdfLinks,setPdfLinks]=useState<Record<string,string|null>>({});
 const [pdfFiles,setPdfFiles]=useState<Record<string,File|null>>({});
 const [uploading,setUploading]=useState<string|null>(null);
 const [uploadMessage,setUploadMessage]=useState("");
 const [pdfVerifications,setPdfVerifications]=useState<{document_id:string;pdf_storage_path:string;verified_by_email:string;verified_at:string}[]>([]);
 const [verificationComments,setVerificationComments]=useState<Record<string,string>>({});
 const [verifying,setVerifying]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [coordinatorEmail,setCoordinatorEmail]=useState("");
 const [tenantId,setTenantId]=useState("");
 const [selectedTrainingDoc,setSelectedTrainingDoc]=useState<string|null>(null);
 useEffect(()=>{let active=true;async function load(){
  setLoading(true);setError("");
  try{
   const auth=await supabase.auth.getUser();
   const email=String(auth.data.user?.email||"").trim().toLowerCase();
   if(!email)throw new Error("Document Control Coordinator sign-in required.");
   const d=await supabase.from("document_change_initiations").select("dci_number,status,release_strategy,tenant_id").eq("id",id).single();
   if(d.error)throw d.error;
   const membership=await supabase.from("tenant_memberships").select("user_email").eq("tenant_id",d.data.tenant_id).eq("user_email",email).eq("membership_status","active").maybeSingle();
   if(membership.error)throw membership.error;
   if(!membership.data)throw new Error("Access denied: active company membership required.");
   const [assigned,internal]=await Promise.all([
    supabase.from("tenant_user_role_assignments").select("customer_roles!inner(role_name,is_active)").eq("tenant_id",d.data.tenant_id).eq("user_email",email).eq("is_active",true),
    supabase.from("user_security_roles").select("role_code").eq("user_email",email).eq("role_code","document_control_coordinator")
   ]);
   const customerCoordinator=!assigned.error&&(assigned.data||[]).some((row:any)=>{const role=Array.isArray(row.customer_roles)?row.customer_roles[0]:row.customer_roles;return role?.is_active!==false&&String(role?.role_name||"").toLowerCase()==="document control coordinator";});
   const internalCoordinator=!internal.error&&(internal.data||[]).length>0;
   if(!customerCoordinator&&!internalCoordinator)throw new Error("Access denied: Document Control Coordinator role required.");
   if(active){setCoordinatorEmail(email);setTenantId(d.data.tenant_id);}
   const linkResult=await supabase.from("document_change_initiation_documents").select("document_id").eq("dci_id",id).order("sequence_no");
   if(linkResult.error)throw linkResult.error;
   const ids=(linkResult.data||[]).map(x=>x.document_id);
   const [docResult,reqResult,assignmentResult,taskResult,verificationResult]=await Promise.all([
    ids.length?supabase.from("controlled_documents").select("id,document_number,revision,title,file_path,file_url,release_pdf_file_path,release_pdf_file_url,status,effective_date").in("id",ids):Promise.resolve({data:[],error:null}),
    ids.length?supabase.from("document_training_requirements").select("id,document_id,training_methods(label,release_blocking)").in("document_id",ids):Promise.resolve({data:[],error:null}),
    ids.length?supabase.from("training_assignments").select("id,document_id,training_requirement_id,status,release_blocking").in("document_id",ids):Promise.resolve({data:[],error:null}),
    supabase.from("approval_tasks").select("task_type,status,implementation_verification_status").eq("entity_type","document_change_initiation").eq("entity_id",id).in("task_type",["dci_formal_approval","dci_post_approval_coordination","dci_post_approval_action"]).neq("status","cancelled"),
    supabase.from("dci_pdf_verifications").select("document_id,pdf_storage_path,verified_by_email,verified_at").eq("dci_id",id)
   ]);
   for(const result of [docResult,reqResult,assignmentResult,taskResult,verificationResult])if(result.error)throw result.error;
   const records=(docResult.data||[]) as DocumentRow[];
   const urls:Record<string,string|null>={};
   const pdfUrls:Record<string,string|null>={};
   await Promise.all(records.map(async doc=>{urls[doc.id]=await resolveControlledDocumentFileUrl({filePath:doc.file_path,legacyUrl:doc.file_url}).catch(()=>null);pdfUrls[doc.id]=await resolveControlledDocumentFileUrl({filePath:doc.release_pdf_file_path,legacyUrl:doc.release_pdf_file_url}).catch(()=>null);}));
   if(active){setDci(d.data);setDocs(ids.map(docId=>records.find(x=>x.id===docId)).filter((x):x is DocumentRow=>Boolean(x)));setRequirements((reqResult.data||[]) as Requirement[]);setAssignments((assignmentResult.data||[]) as Assignment[]);setTasks(taskResult.data||[]);setPdfVerifications(verificationResult.data||[]);setLinks(urls);setPdfLinks(pdfUrls);}
  }catch(e:any){if(active)setError(e.message||"Unable to load release readiness.");}
  finally{if(active)setLoading(false);}
 }if(id)void load();return()=>{active=false};},[id]);
 const uploadPdf=async(doc:DocumentRow)=>{
  const file=pdfFiles[doc.id];
  if(!file)return setUploadMessage("Choose a PDF file first.");
  if(!file.name.toLowerCase().endsWith(".pdf")||file.type&&file.type!=="application/pdf")return setUploadMessage("Only PDF files are accepted.");
  if(dci?.status!=="release_ready")return setUploadMessage("DCI must be release ready.");
  if(doc.release_pdf_file_path||doc.release_pdf_file_url)return setUploadMessage("A final PDF already exists. Replacement requires a controlled revision process.");
  setUploading(doc.id);setUploadMessage("");
  let path:string|null=null;
  try{
   const bytes=new Uint8Array(await file.slice(0,5).arrayBuffer());
   if(String.fromCharCode(...bytes)!=="%PDF-")throw new Error("The selected file is not a valid PDF.");
   path=await buildControlledDocumentStoragePath({documentNumber:doc.document_number,revision:doc.revision,area:"release-pdfs",fileName:`${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`});
   const upload=await supabase.storage.from(CONTROLLED_DOCUMENT_BUCKET).upload(path,file,{contentType:"application/pdf",upsert:false});
   if(upload.error)throw upload.error;
   const update=await supabase.from("controlled_documents").update({release_pdf_file_name:file.name,release_pdf_file_path:path,release_pdf_file_url:null,updated_at:new Date().toISOString()}).eq("id",doc.id).eq("tenant_id",tenantId).is("release_pdf_file_path",null).select("id");
   if(update.error)throw update.error;
   if(!update.data?.length)throw new Error("The PDF was not linked to the document. Check permissions or whether another PDF was attached.");
   setDocs(previous=>previous.map(d=>d.id===doc.id?{...d,release_pdf_file_path:path,release_pdf_file_url:null}:d));
   setPdfLinks(previous=>({...previous,[doc.id]:null}));
   setPdfFiles(previous=>({...previous,[doc.id]:null}));
   setUploadMessage(`PDF stored for ${doc.document_number} Rev ${doc.revision}. Open and inspect it before proceeding. Upload alone is not verification.`);
  }catch(e:any){
   if(path)await supabase.storage.from(CONTROLLED_DOCUMENT_BUCKET).remove([path]).catch(()=>{});
   setUploadMessage(e.message||"PDF upload failed.");
  }finally{setUploading(null);}
 };
 const verifyPdf=async(doc:DocumentRow)=>{
  if(!doc.release_pdf_file_path)return setUploadMessage("A stored final PDF is required.");
  setVerifying(doc.id);setUploadMessage("");
  const result=await supabase.rpc("qualisphere_verify_dci_pdf",{p_dci_id:id,p_document_id:doc.id,p_pdf_path:doc.release_pdf_file_path,p_comment:verificationComments[doc.id]||""});
  if(result.error)setUploadMessage(result.error.message);
  else{setPdfVerifications(p=>[...p.filter(v=>v.document_id!==doc.id),{document_id:doc.id,pdf_storage_path:doc.release_pdf_file_path!,verified_by_email:coordinatorEmail,verified_at:new Date().toISOString()}]);setUploadMessage(`PDF verification recorded for ${doc.document_number} Rev ${doc.revision}.`);}
  setVerifying(null);
 };
 const verifiedPdf=(doc:DocumentRow)=>pdfVerifications.find(v=>Boolean(doc.release_pdf_file_path)&&v.document_id===doc.id&&v.pdf_storage_path===doc.release_pdf_file_path);
 const approved=tasks.filter(t=>t.task_type==="dci_formal_approval");
 const actions=tasks.filter(t=>t.task_type==="dci_post_approval_action");
 const coordination=tasks.filter(t=>t.task_type==="dci_post_approval_coordination");
 const governanceReady=Boolean(dci?.status==="release_ready"&&approved.length>0&&approved.every(t=>t.status==="approved")&&coordination.some(t=>t.status==="completed")&&actions.every(t=>t.status==="completed"&&t.implementation_verification_status==="verified"));
 const check=(doc:DocumentRow)=>{
  const reqs=requirements.filter(r=>r.document_id===doc.id&&Boolean((Array.isArray(r.training_methods)?r.training_methods[0]:r.training_methods)?.release_blocking));
  const blocking=assignments.filter(a=>a.document_id===doc.id&&a.release_blocking);
  const unassigned=reqs.filter(r=>!blocking.some(a=>a.training_requirement_id===r.id)).length;
  const incomplete=blocking.filter(a=>!["completed","waived"].includes(a.status)).length;
  const master=Boolean(doc.file_path||doc.file_url);
  const pdf=Boolean(doc.release_pdf_file_path||doc.release_pdf_file_url);
  return {master,pdf,unassigned,incomplete,ready:master&&pdf&&Boolean(verifiedPdf(doc))&&unassigned===0&&incomplete===0};
 };
 const allReady=governanceReady&&docs.length>0&&docs.every(d=>check(d).ready);
 return <main style={{padding:28,maxWidth:1300,margin:"0 auto",fontFamily:"Arial, sans-serif"}}>
  <a href={`/documents/changes/${id}`}>← Back to DCI</a>
  <h1>DCI Release Readiness</h1>
  {loading?<p>Loading release package...</p>:error?<p role="alert">{error}</p>:<><p><strong>{dci?.dci_number}</strong> · {dci?.status.replaceAll("_"," ")} · {dci?.release_strategy} release</p>
   <section style={card}><h2>Package governance</h2><p>{governanceReady?"Complete — formal approvals and post-approval verification recorded.":"Not ready — release-ready status, formal approvals, and completed verified post-approval activities are required."}</p></section>
   <section style={card}><h2>Controlled documents and training</h2><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Document","Working master","Final PDF","Blocking training","Effective date","Readiness"].map(x=><th key={x} style={cell}>{x}</th>)}</tr></thead><tbody>{docs.map(doc=>{const c=check(doc);return <tr key={doc.id}><td style={cell}><strong>{doc.document_number} Rev {doc.revision}</strong><div>{doc.title}</div></td><td style={cell}>{c.master?<a href={links[doc.id]||`/documents/${doc.id}`} target="_blank" rel="noreferrer">View working master</a>:"Missing"}</td><td style={cell}>{c.pdf?(verifiedPdf(doc)?"Verified":"Verification pending"):"Not yet attached / generated"}</td><td style={cell}>{c.unassigned===0&&c.incomplete===0?"Satisfied":`${c.unassigned} unassigned; ${c.incomplete} incomplete`}</td><td style={cell}>{doc.effective_date||"To be set at release"}</td><td style={cell}>{c.ready?"Ready":"Action required"}</td></tr>})}</tbody></table></div></section>
   <section style={card}><h2>Training assignment management</h2><p>Assign required training through the existing Training module workflow. Blocking training must be completed or formally waived before release.</p>{docs.map(doc=><div key={doc.id} style={{marginBottom:14}}><button type="button" onClick={()=>setSelectedTrainingDoc(selectedTrainingDoc===doc.id?null:doc.id)} style={{padding:"8px 12px",cursor:"pointer"}}>{selectedTrainingDoc===doc.id?"Close training assignments":"Manage training — "+doc.document_number+" Rev "+doc.revision}</button>{selectedTrainingDoc===doc.id&&tenantId&&coordinatorEmail?<div style={{marginTop:12}}><DocumentTrainingAssignment documentId={doc.id} tenantId={tenantId} documentNumber={doc.document_number} revision={doc.revision} userEmail={coordinatorEmail} canCoordinate={true}/><p style={{fontSize:13}}>After assigning training, refresh this page to update the readiness summary.</p></div>:null}</div>)}</section>
   <section style={card}><h2>Final PDF preparation</h2><p>Upload the final PDF prepared from the approved working master. The original master remains unchanged. Automatic Office conversion is not yet enabled. After uploading, open the PDF and record coordinator verification. Uploading alone does not authorize release.</p>{uploadMessage?<p role="status">{uploadMessage}</p>:null}{docs.map(doc=><div key={doc.id} style={{borderTop:"1px solid #e2e8f0",padding:"12px 0"}}><strong>{doc.document_number} Rev {doc.revision}</strong> — {doc.title}<div style={{marginTop:8}}>{doc.release_pdf_file_path||doc.release_pdf_file_url?<><span>PDF uploaded. </span>{pdfLinks[doc.id]?<a href={pdfLinks[doc.id]||"#"} target="_blank" rel="noreferrer">Review PDF</a>:<button type="button" onClick={async()=>{const url=await resolveControlledDocumentFileUrl({filePath:doc.release_pdf_file_path,legacyUrl:doc.release_pdf_file_url});if(url)setPdfLinks(p=>({...p,[doc.id]:url}));else setUploadMessage("Unable to open the PDF.");}}>Open PDF</button>}{verifiedPdf(doc)?<span> · Verified by {verifiedPdf(doc)?.verified_by_email} on {new Date(verifiedPdf(doc)!.verified_at).toLocaleString()}</span>:<div style={{marginTop:8}}><label>Verification notes (confirm content, document number, revision and formatting) <input aria-label={`PDF verification notes for ${doc.document_number}`} value={verificationComments[doc.id]||""} onChange={e=>setVerificationComments(p=>({...p,[doc.id]:e.target.value}))} style={{width:"min(100%,550px)",padding:6}}/></label><button type="button" disabled={verifying!==null||(verificationComments[doc.id]||"").trim().length<8} onClick={()=>void verifyPdf(doc)} style={{marginLeft:8}}>{verifying===doc.id?"Recording...":"Verify final PDF"}</button></div>}</>:<><input aria-label={`Final PDF for ${doc.document_number}`} type="file" accept="application/pdf,.pdf" onChange={e=>setPdfFiles(p=>({...p,[doc.id]:e.target.files?.[0]||null}))}/><button type="button" disabled={uploading!==null||!pdfFiles[doc.id]} onClick={()=>void uploadPdf(doc)}>{uploading===doc.id?"Uploading...":"Upload final PDF"}</button></>}</div></div>)}</section>
   <section style={card}><h2>Release decision</h2><p><strong>{allReady?"Preliminary checks passed":"Release is not yet authorized"}</strong></p><p>This screen records PDF verification but does not convert Office files, publish controlled PDFs, supersede revisions, or release the DCI. The final release action will require coordinator authorization and server-side transactional checks.</p></section>
  </>}
 </main>;
}
