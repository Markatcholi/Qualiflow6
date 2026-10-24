"use client";

import TrainingMethodsManager from "./TrainingMethodsManager";
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Group = { id:string; group_name:string; description:string|null; is_active:boolean };
type Member = { id:string; training_group_id:string; user_email:string };

export default function TrainingConfigurationManager({ tenantId }:{ tenantId:string }) {
  const [groups,setGroups]=useState<Group[]>([]);
  const [members,setMembers]=useState<Member[]>([]);
  const [group,setGroup]=useState({group_name:"",description:""});
  const [member,setMember]=useState({training_group_id:"",user_email:""});
  const [busy,setBusy]=useState(false);

  const load=async()=>{
    const [g,gm]=await Promise.all([
      supabase.from("training_groups").select("*").eq("tenant_id",tenantId).order("group_name"),
      supabase.from("training_group_members").select("*").eq("tenant_id",tenantId).order("user_email"),
    ]);
    if(g.error) throw new Error(g.error.message); if(gm.error) throw new Error(gm.error.message);
    setGroups((g.data||[]) as Group[]); setMembers((gm.data||[]) as Member[]);
  };
  useEffect(()=>{ if(tenantId) load().catch(e=>alert(e.message)); },[tenantId]);

  const addGroup=async()=>{
    if(!group.group_name.trim()) return alert("Training group name is required.");
    setBusy(true); const {error}=await supabase.from("training_groups").insert({tenant_id:tenantId,group_name:group.group_name.trim(),description:group.description.trim()||null});
    setBusy(false); if(error) return alert(error.message); setGroup({group_name:"",description:""}); await load();
  };
  const addMember=async()=>{
    const email=member.user_email.trim().toLowerCase();
    if(!member.training_group_id||!email.includes("@")) return alert("Select a training group and enter a valid employee email.");
    setBusy(true); const {error}=await supabase.from("training_group_members").insert({tenant_id:tenantId,training_group_id:member.training_group_id,user_email:email});
    setBusy(false); if(error) return alert(error.message); setMember({...member,user_email:""}); await load();
  };
  const removeMember=async(id:string)=>{ if(!confirm("Remove this employee from the training group?")) return; const {error}=await supabase.from("training_group_members").delete().eq("id",id); if(error) return alert(error.message); await load(); };

  return <section style={card}>
    <h2 style={{marginTop:0}}>Training Configuration</h2>
    <p style={subtle}>Configure the training methods and reusable employee groups required by your Quality System. QualiSphere does not prescribe due dates or training populations.</p>
    <TrainingMethodsManager tenantId={tenantId}/>

    <hr style={{margin:"22px 0"}}/>
    <h3>Training Groups</h3>
    <div style={grid}>
      <input placeholder="Group name" value={group.group_name} onChange={e=>setGroup({...group,group_name:e.target.value})} style={input}/>
      <input placeholder="Description (optional)" value={group.description} onChange={e=>setGroup({...group,description:e.target.value})} style={input}/>
    </div>
    <button disabled={busy} onClick={addGroup} style={button}>Create Training Group</button>

    <h3 style={{marginTop:22}}>Group Membership</h3>
    <div style={grid}>
      <select value={member.training_group_id} onChange={e=>setMember({...member,training_group_id:e.target.value})} style={input}>
        <option value="">Select training group</option>{groups.filter(g=>g.is_active!==false).map(g=><option key={g.id} value={g.id}>{g.group_name}</option>)}
      </select>
      <input type="email" placeholder="Employee email" value={member.user_email} onChange={e=>setMember({...member,user_email:e.target.value})} style={input}/>
    </div>
    <button disabled={busy} onClick={addMember} style={button}>Add Employee to Group</button>
    {groups.map(g=><div key={g.id} style={{marginTop:14,padding:12,border:"1px solid #e5e7eb",borderRadius:8}}>
      <strong>{g.group_name}</strong>{g.description?<span style={subtle}> — {g.description}</span>:null}
      <div style={{marginTop:6}}>{members.filter(m=>m.training_group_id===g.id).length===0?<span style={subtle}>No members.</span>:members.filter(m=>m.training_group_id===g.id).map(m=><div key={m.id} style={{display:"flex",justifyContent:"space-between",gap:8}}><span>{m.user_email}</span><button onClick={()=>removeMember(m.id)} style={linkButton}>Remove</button></div>)}</div>
    </div>)}
  </section>;
}
const card:React.CSSProperties={background:"#fff",border:"1px solid #d1d5db",borderRadius:16,padding:20,marginBottom:20};
const subtle:React.CSSProperties={color:"#6b7280"};
const grid:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12};
const row:React.CSSProperties={display:"flex",gap:16,flexWrap:"wrap",margin:"8px 0 12px"};
const input:React.CSSProperties={width:"100%",padding:9,border:"1px solid #d1d5db",borderRadius:8,boxSizing:"border-box"};
const button:React.CSSProperties={background:"#2563eb",color:"#fff",border:0,borderRadius:8,padding:"10px 14px",fontWeight:700,cursor:"pointer"};
const linkButton:React.CSSProperties={background:"transparent",border:0,textDecoration:"underline",cursor:"pointer"};
