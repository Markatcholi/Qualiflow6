"use client";

import { useEffect, useState } from "react";

export default function RegisterCompanyPage() {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDemo(params.get("intent") === "demo");
  }, []);

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={eyebrowStyle}>QUALISPHERE COMPANY ONBOARDING</div>
        <h1 style={titleStyle}>{demo ? "Request a QualiSphere Demo" : "Register Your Company"}</h1>
        <p style={subtleStyle}>
          {demo
            ? "This is the company-level entry point for organizations evaluating QualiSphere."
            : "QualiSphere accounts are created for companies, not as open individual sign-ups. The initial company registrant becomes the proposed Company Administrator after the company is approved and provisioned."}
        </p>

        <div style={noticeStyle}>
          <strong>Controlled onboarding:</strong> The public registration submission workflow is the next commercialization step. Individual self-registration has been disabled so users can only enter QualiSphere through an approved company membership.
        </div>

        <div style={flowStyle}>
          <FlowStep number="1" text="Company registration" />
          <FlowStep number="2" text="QualiSphere review / activation" />
          <FlowStep number="3" text="Initial Company Administrator" />
          <FlowStep number="4" text="Company Admin provisions users" />
        </div>

        <div style={actionsStyle}>
          <a href="/" style={secondaryStyle}>Back to Home</a>
          <a href="/login" style={primaryStyle}>Existing Company Sign In</a>
        </div>
      </section>
    </main>
  );
}

function FlowStep({ number, text }: { number: string; text: string }) {
  return <div style={stepStyle}><span style={numberStyle}>{number}</span><span>{text}</span></div>;
}

const pageStyle: React.CSSProperties = { minHeight:"100vh", display:"flex", justifyContent:"center", alignItems:"center", padding:24, background:"linear-gradient(135deg,#eef2ff,#f8fafc)", fontFamily:"Arial, sans-serif", color:"#0f172a" };
const cardStyle: React.CSSProperties = { width:"100%", maxWidth:760, background:"white", border:"1px solid #dbeafe", borderRadius:24, padding:32, boxShadow:"0 20px 60px rgba(15,23,42,0.12)" };
const eyebrowStyle: React.CSSProperties = { color:"#2563eb", fontSize:12, fontWeight:900, letterSpacing:"0.14em" };
const titleStyle: React.CSSProperties = { margin:"8px 0", fontSize:38 };
const subtleStyle: React.CSSProperties = { color:"#475569", lineHeight:1.6, fontSize:17 };
const noticeStyle: React.CSSProperties = { background:"#eff6ff", border:"1px solid #bfdbfe", color:"#1e3a8a", padding:16, borderRadius:12, lineHeight:1.5, margin:"22px 0" };
const flowStyle: React.CSSProperties = { display:"grid", gap:10, marginBottom:24 };
const stepStyle: React.CSSProperties = { display:"flex", alignItems:"center", gap:12, padding:12, border:"1px solid #e2e8f0", borderRadius:10, background:"#f8fafc", fontWeight:700 };
const numberStyle: React.CSSProperties = { width:28, height:28, borderRadius:999, display:"inline-flex", alignItems:"center", justifyContent:"center", background:"#dbeafe", color:"#1d4ed8", fontWeight:900 };
const actionsStyle: React.CSSProperties = { display:"flex", justifyContent:"flex-end", gap:12, flexWrap:"wrap" };
const primaryStyle: React.CSSProperties = { background:"#2563eb", color:"white", textDecoration:"none", padding:"11px 16px", borderRadius:10, fontWeight:800 };
const secondaryStyle: React.CSSProperties = { background:"white", color:"#0f172a", textDecoration:"none", padding:"11px 16px", borderRadius:10, border:"1px solid #cbd5e1", fontWeight:800 };
