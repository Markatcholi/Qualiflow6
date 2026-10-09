"use client";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import {supabase} from "../../../../../lib/supabaseClient";

export default function DciPostApprovalPage(){
 const {id}=useParams<{id:string}>();
 const [dci,setDci]=useState<any>(null),[coordination,setCoordination]=useState<any>(null),[approvals,setApprovals]=useState<any[]>([]),[actions,setActions]=useState<any[]>([]),[docs,setDocs]=useState<any[]>([]),[users,setUsers]=useState<string[]>([]),[email,setEmail]=useState(""),[busy,setBusy]=useState(false);
 const [draft,setDraft]=useState({documentId:"",activity:"",assignee:"",dueDate:"",instructions:""});
 const load=async()=>{const auth=await supabase.auth.getUser();const me=String(auth.data.user?.email||"").toLowerCase();setEmail(me);
 const d=await supabase.from("document_change_initiations").select("*").eq("id",id).single();if(d.error){alert(d.error.message);return;}setDci(d.data);
 const [tasks,links,members]=await Promise.all([
 supabase.from("approval_tasks").select("*").eq("entity_type","document_change_initiation").eq("entity_id",id).in("task_type",["dci_formal_approval","dci_post_approval_coordination","dci_post_approval_action"]).order("created_at"),
 supabase.from("document_change_initiation_documents").select("document_id").eq("dci_id",id).order("sequence_no"),
 supabase.from("tenant_memberships").select("user_email").eq("tenant_id",d.data.tenant_id).eq("membership_status","active")]);
 if(tasks.error){alert(tasks.error.message);return;}const all=tasks.data||[];
 setApprovals(all.filter((t:any)=>t.task_type==="dci_formal_approval"&&t.status!=="cancelled"));
 setCoordination(all.find((t:any)=>t.task_type==="dci_post_approval_coordination"&&t.status==="pending")||null);
 setActions(all.filter((t:any)=>t.task_type==="dci_post_approval_action"&&t.status!=="cancelled"));
 setUsers((members.data||[]).map((m:any)=>String(m.user_email||"").toLowerCase()));
 const ids=(links.data||[]).map((x:any)=>x.document_id);if(ids.length){const result=await supabase.from("controlled_documents").select("id,document_number,revision,title").in("id",ids);if(!result.error)setDocs(ids.map((docId:string)=>(result.data||[]).find((x:any)=>x.id===docId)).filter(Boolean));}
 };
 useEffect(()=>{if(id)void load()},[id]);
 const claimed=coordination?.assigned_to_email?.toLowerCase()===email;
 const assign=async()=>{if(!claimed)return alert("Claim the coordinator task first.");if(!draft.documentId||!draft.activity.trim()||!draft.assignee||!draft.dueDate||!draft.instructions.trim())return alert("Complete all activity assignment fields.");
 if(approvals.length===0||approvals.some(a=>a.status!=="approved"))return alert("All formal approvals must be complete.");
 setBusy(true);try{const r=await supabase.from("approval_tasks").insert({entity_type:"document_change_initiation",entity_id:id,task_type:"dci_post_approval_action",task_title:draft.activity.trim(),required_function:"Post-Approval Activity",assigned_to_email:draft.assignee,assigned_by_email:email,status:"pending",due_date:draft.dueDate,comments:`Document: ${docs.find(x=>x.id===draft.documentId)?.document_number||draft.documentId} | ${draft.instructions.trim()}`,record_number:dci.dci_number});if(r.error)throw new Error(r.error.message);
 await supabase.rpc("qualisphere_add_audit_log",{p_entity_type:"document_change_initiation",p_entity_id:id,p_action:"post_approval_activity_assigned",p_details:`${email} assigned ${draft.activity.trim()} to ${draft.assignee} for ${docs.find(x=>x.id===draft.documentId)?.document_number||draft.documentId}`});
 setDraft({documentId:"",activity:"",assignee:"",dueDate:"",instructions:""});await load();}catch(e:any){alert(e.message||"Unable to assign activity.");}finally{setBusy(false);}};
 if(!dci)return <main style={page}>Loading DCI post-approval package...</main>;
 return <main style={page}><a href="/workspace">← My Workspace</a><h1>{dci.dci_number} — Post-Approval Activities</h1><p>Document Control coordinates activities after formal approval. Document release remains blocked until required activities are completed and verified.</p>
 <section style={card}><h2>Formal Approval Record</h2>{approvals.map(a=><p key={a.id}><strong>{a.assigned_to_email}</strong> — {a.status} {a.signed_at?"· "+new Date(a.signed_at).toLocaleString():""}</p>)}</section>
 <section style={card}><h2>Coordinator Assignment</h2><p>{coordination?.assigned_to_email?"Claimed by "+coordination.assigned_to_email:"Not yet claimed"}</p>{!coordination&&<p>No pending coordinator task is available.</p>}{coordination&&!coordination.assigned_to_email&&<p>Claim the shared task in My Workspace before assigning activities.</p>}</section>
 <section style={card}><h2>Affected Documents</h2>{docs.map(d=><p key={d.id}>{d.document_number} Rev {d.revision} — {d.title}</p>)}</section>
 <section style={card}><h2>Post-Approval Activity Assignments</h2>{actions.length===0?<p>No activities assigned yet.</p>:actions.map(a=><p key={a.id}><strong>{a.task_title}</strong> — {a.assigned_to_email} · {a.status} · Due {a.due_date||"—"}<br/>{a.comments}</p>)}
 {claimed&&<div style={{display:"grid",gap:10,maxWidth:650}}>
 <label>Document<select style={input} value={draft.documentId} onChange={e=>setDraft(v=>({...v,documentId:e.target.value}))}><option value="">Select document</option>{docs.map(d=><option key={d.id} value={d.id}>{d.document_number} Rev {d.revision}</option>)}</select></label>
 <label>Required activity<input style={input} placeholder="Validation, TMV, product disposition..." value={draft.activity} onChange={e=>setDraft(v=>({...v,activity:e.target.value}))}/></label>
 <label>Assigned to<select style={input} value={draft.assignee} onChange={e=>setDraft(v=>({...v,assignee:e.target.value}))}><option value="">Select user</option>{users.map(u=><option key={u} value={u}>{u}</option>)}</select></label>
 <label>Due date<input type="date" style={input} value={draft.dueDate} onChange={e=>setDraft(v=>({...v,dueDate:e.target.value}))}/></label>
 <label>Instructions<textarea style={input} rows={4} value={draft.instructions} onChange={e=>setDraft(v=>({...v,instructions:e.target.value}))}/></label>
 <button style={button} disabled={busy} onClick={assign}>Assign Post-Approval Activity</button>
 </div>}</section></main>;
}
const page:React.CSSProperties={padding:28,maxWidth:1100,margin:"0 auto",fontFamily:"Arial, sans-serif",color:"#0f172a"};
const card:React.CSSProperties={padding:20,marginBottom:16,border:"1px solid #d1d5db",borderRadius:12};
const input:React.CSSProperties={display:"block",width:"100%",boxSizing:"border-box",padding:10,marginTop:6,border:"1px solid #cbd5e1",borderRadius:6};
const button:React.CSSProperties={padding:12,background:"#172033",color:"#fff",border:0,borderRadius:6,fontWeight:700,cursor:"pointer"};
