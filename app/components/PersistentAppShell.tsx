"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Entry = { name: string; href: string; code?: string; children?: Entry[] };
const quality: Entry[] = [
  { name: "CAPA", href: "/capa", code: "capa" },
  { name: "NCMR", href: "/ncmrs", code: "ncmr" },
  { name: "Change Control", href: "/change-control", code: "change_control" },
  { name: "Controlled Documents", href: "/documents", code: "controlled_documents", children: [
    { name: "Search Documents", href: "/documents/search" },
    { name: "Document Repository", href: "/documents" },
    { name: "Search DCI", href: "/documents/changes" },
    { name: "Initiate DCI", href: "/documents/changes?intent=new" },
    { name: "Documents Dashboard", href: "/documents/dashboard" }
  ] },
  { name: "Training", href: "/training", code: "training", children: [
    { name: "Overview", href: "/training?section=overview" },
    { name: "Training Assignments", href: "/training?section=assignments" },
    { name: "Certification Register", href: "/training/certifications" },
    { name: "Training Administration", href: "/training?section=administration" },
    { name: "Generate Due Training", href: "/training?section=due" },
    { name: "Employee Profiles", href: "/training?section=employees" },
    { name: "Compliance Report", href: "/training/compliance" },
    { name: "Training Intelligence", href: "/training/dashboard" },
    { name: "Signature History", href: "/training?section=history" }
  ] },
  { name: "SCAR", href: "/supplier-quality/scars", code: "scar" },
  { name: "Complaints", href: "/complaints", code: "complaints" },
  { name: "Audit Management", href: "/audits", code: "audit_management" },
  { name: "OOS / OOT", href: "/oos-oot", code: "oos_oot" },
  { name: "Suppliers", href: "/suppliers", code: "suppliers" },
  { name: "Equipment", href: "/equipment", code: "equipment" }
];
const analytics: Entry[] = [
  { name: "Executive Dashboard", href: "/dashboard", code: "executive_dashboard" },
  { name: "Management Review", href: "/management-review", code: "management_review" },
  { name: "KPI Reports", href: "/kpi-reports", code: "kpi_reports" },
  { name: "Audit Trail", href: "/audit", code: "audit_trail" }
];
const aliases: Record<string,string[]> = {
  ncmr:["ncmr","ncmrs"], change_control:["change_control","change"],
  controlled_documents:["controlled_documents","document_control","documents"],
  training:["training","training_management"], scar:["scar","scars","supplier_quality"],
  complaints:["complaints","complaint"], audit_management:["audit_management","audits","audit"],
  oos_oot:["oos_oot","oos","oot"], suppliers:["suppliers","supplier_management"],
  equipment:["equipment","equipment_management"],
  executive_dashboard:["executive_dashboard","dashboard","analytics"],
  management_review:["management_review","management_reviews","analytics"],
  kpi_reports:["kpi_reports","kpi","analytics"], audit_trail:["audit_trail","audit_log","analytics"]
};
const linkStyle: React.CSSProperties = { display:"block", padding:"7px 9px", borderRadius:6, color:"#111827", textDecoration:"none", fontSize:14 };
export default function PersistentAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string,boolean>>({});
  const [visible, setVisible] = useState(false);
  const [internal, setInternal] = useState(false);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [coordinator, setCoordinator] = useState(false);
  const [docManager, setDocManager] = useState(false);
  const [companyAdmin, setCompanyAdmin] = useState(false);
  const [legacyInternalAdmin, setLegacyInternalAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const publicPage = pathname === "/" || pathname === "/login" || pathname.startsWith("/signup") || pathname.startsWith("/sign-up") || pathname.startsWith("/auth/") || pathname.startsWith("/platform-admin") || pathname.startsWith("/admin/companies");
  useEffect(() => {
    if (publicPage) return;
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const email = auth.user?.email;
      if (!email) { if (!cancelled) { setVisible(false); setLoaded(true); } return; }
      const storedTenant = window.localStorage.getItem("qualisphere_active_tenant_id");
      let q = supabase.from("tenant_memberships").select("tenant_id,tenants(is_internal,status)").ilike("user_email",email).eq("membership_status","active");
      if (storedTenant) q = q.eq("tenant_id",storedTenant);
      const membership = await q;
      const rows = (membership.data || []).filter((m:any) => {
        const t = Array.isArray(m.tenants) ? m.tenants[0] : m.tenants;
        return t?.status === "active";
      });
      const m:any = rows.length === 1 ? rows[0] : null;
      if (!m) { if (!cancelled) { setVisible(false); setLoaded(true); } return; }
      const t = Array.isArray(m.tenants) ? m.tenants[0] : m.tenants;
      const tenant = String(m.tenant_id);
      const [access,training,roles,admin,legacy] = await Promise.all([
        supabase.from("tenant_module_access").select("module_code,is_enabled").eq("tenant_id",tenant),
        supabase.rpc("qualisphere_training_is_coordinator",{p_tenant:tenant}),
        supabase.from("tenant_user_role_assignments").select("customer_roles(role_name,is_active)").eq("tenant_id",tenant).ilike("user_email",email).eq("is_active",true),
        supabase.rpc("qualisphere_is_company_admin",{p_tenant_id:tenant}),
        supabase.from("user_roles").select("role").eq("user_email",email).maybeSingle()
      ]);
      if (cancelled) return;
      setInternal(t?.is_internal === true);
      setEnabled(new Set((access.data || []).filter((x:any)=>x.is_enabled).map((x:any)=>String(x.module_code).toLowerCase())));
      setCoordinator(training.data === true);
      setCompanyAdmin(admin.data === true);
      const legacyRole = String(legacy.data?.role || "").toLowerCase().replace(/_/g," ").trim();
      setLegacyInternalAdmin(["admin","administrator","coordinator","approver","vp quality","quality manager"].includes(legacyRole));
      setDocManager((roles.data || []).some((x:any)=>{
        const role = Array.isArray(x.customer_roles) ? x.customer_roles[0] : x.customer_roles;
        return role?.is_active !== false && /document control|vp quality|vice president.*quality/i.test(String(role?.role_name || ""));
      }));
      setVisible(true); setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [pathname, publicPage]);
  useEffect(() => {
    if (pathname.startsWith("/training")) setExpanded(x=>({...x,Training:true}));
    if (pathname.startsWith("/documents")) setExpanded(x=>({...x,"Controlled Documents":true}));
    if (pathname === "/company-administration" || pathname.startsWith("/company-administration/") || ["/admin/master-data", "/approval-matrix", "/admin/company-settings"].includes(pathname)) {
      setExpanded(x=>({...x,Administration:true}));
    }
  },[pathname]);
  const administration: Entry[] = internal && legacyInternalAdmin
    ? [
        { name: "Master Data", href: "/admin/master-data" },
        { name: "Approval Matrix", href: "/approval-matrix" },
        { name: "Company Settings", href: "/admin/company-settings" }
      ]
    : companyAdmin
      ? [
          { name: "Company Administration", href: "/company-administration" },
          { name: "Admin Master Data", href: "/company-administration/master-data" },
          { name: "Approval Matrix", href: "/company-administration/approval-matrix" },
          { name: "Company Settings", href: "/company-administration/settings" },
          { name: "NCMR Risk & CAPA Governance", href: "/company-administration/ncmr-risk-governance" }
        ]
      : [];
  const allowed = (e:Entry) => !e.code || internal || (aliases[e.code] || [e.code]).some(code=>enabled.has(code));
  const childAllowed = (parent:string,e:Entry) => {
    if (parent==="Training" && ["Certification Register","Training Administration","Generate Due Training","Employee Profiles","Compliance Report","Training Intelligence","Signature History"].includes(e.name)) return coordinator;
    if (parent==="Controlled Documents" && e.name==="Documents Dashboard") return docManager;
    return true;
  };
  const renderEntries = (entries:Entry[]) => entries.filter(allowed).map(e=><div key={e.name}>
    {e.children ? <div style={{display:"flex",alignItems:"center"}}>
      <button type="button" aria-label={`Toggle ${e.name}`} aria-expanded={!!expanded[e.name]} onClick={()=>setExpanded(x=>({...x,[e.name]:!x[e.name]}))} style={{border:0,background:"none",cursor:"pointer",padding:"7px 4px"}}>{expanded[e.name]?"▾":"▸"}</button>
      <a href={e.href} style={{...linkStyle,fontWeight:600,flex:1}}>{e.name}</a>
    </div> : <a href={e.href} style={{...linkStyle,background:pathname===e.href?"#dbeafe":undefined}}>{e.name}</a>}
    {e.children && expanded[e.name] ? <div style={{paddingLeft:19}}>{e.children.filter(x=>childAllowed(e.name,x)).map(x=><a key={x.href} href={x.href} style={{...linkStyle,fontSize:13,background:pathname===x.href?"#dbeafe":undefined}}>{x.name}</a>)}</div> : null}
  </div>);
  if (publicPage || !loaded || !visible) return <>{children}</>;
  return <div style={{display:"flex",alignItems:"flex-start",gap:16}}>
    <aside aria-label="QualiSphere module navigation" style={{width:collapsed?54:246,flexShrink:0,position:"sticky",top:0,height:"calc(100vh - 64px)",overflowY:"auto",borderRight:"1px solid #d1d5db",background:"#f9fafb",padding:collapsed?7:12,boxSizing:"border-box"}}>
      <button type="button" onClick={()=>setCollapsed(x=>!x)} aria-label={collapsed?"Expand module navigation":"Collapse module navigation"} style={{border:"1px solid #cbd5e1",borderRadius:6,background:"white",padding:7,cursor:"pointer",marginBottom:12}}>{collapsed?"☰":"☰ Modules"}</button>
      {!collapsed && <>
        <a href="/workspace" style={{...linkStyle,fontWeight:700}}>My Workspace</a>
        <h3 style={{fontSize:13,margin:"18px 8px 8px"}}>Quality Management</h3>
        {renderEntries(quality)}
        <h3 style={{fontSize:13,margin:"18px 8px 8px"}}>Analytics</h3>
        {renderEntries(analytics)}
        {administration.length > 0 && <>
          <button type="button" aria-expanded={!!expanded.Administration} aria-controls="administration-navigation" onClick={()=>setExpanded(x=>({...x,Administration:!x.Administration}))} style={{...linkStyle,display:"flex",alignItems:"center",gap:8,width:"100%",border:0,background:"none",cursor:"pointer",fontWeight:600,textAlign:"left",marginTop:18}}>
            <span aria-hidden="true">{expanded.Administration?"▾":"▸"}</span>
            Administration
          </button>
          {expanded.Administration && <div id="administration-navigation" style={{paddingLeft:19}}>{renderEntries(administration)}</div>}
        </>}
      </>}
    </aside>
    <div style={{flex:"1 1 0",minWidth:0}}>{children}</div>
  </div>;
}
