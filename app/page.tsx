export default function HomePage() {
  const capabilityGroups = [
    {
      title: "Quality Event Management",
      items: [
        "Nonconformance Management",
        "CAPA",
        "Change Control",
        "Supplier Quality / SCAR",
      ],
    },
    {
      title: "Document & Training Control",
      items: [
        "Controlled Documents",
        "Revision Workflows",
        "Training Assignments",
        "Read & Acknowledge",
      ],
    },
    {
      title: "Compliance & Governance",
      items: [
        "Audit Management",
        "Executive Dashboard",
        "Management Review",
        "Configurable KPI Reporting",
      ],
    },
  ];

  return (
    <main style={pageStyle}>
      <div style={techBackgroundStyle} />

      <section style={containerStyle}>
        <div style={topBarStyle}>
          <a href="/login" style={signinButtonStyle}>
            Sign In
          </a>

          <a href="/signup" style={createAccountButtonStyle}>
            Create Account
          </a>

          <a href="/login" style={requestDemoButtonStyle}>
            Request Demo
          </a>
        </div>

        <section style={heroStyle}>
          <div style={badgeStyle}>ENTERPRISE QUALITY MANAGEMENT SYSTEM</div>

          <h1 style={titleStyle}>QualiSphere</h1>

          <p style={subtitleStyle}>
            Connected quality workflows, configurable governance, audit-ready
            records, and management-review visibility for regulated industries.
          </p>

          <div style={pillRowStyle}>
            <span style={pillStyle}>Audit-ready</span>
            <span style={pillStyle}>Configurable</span>
            <span style={pillStyle}>Workflow-driven</span>
            <span style={pillStyle}>Executive visibility</span>
          </div>
        </section>

        <section style={capabilityPanelStyle}>
          {capabilityGroups.map((group) => (
            <div key={group.title} style={capabilitySectionStyle}>
              <h2 style={capabilityTitleStyle}>{group.title}</h2>

              <div style={capabilityListStyle}>
                {group.items.map((item) => (
                  <div key={item} style={capabilityItemStyle}>
                    <span style={checkStyle}>✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section style={valueStatementStyle}>
          <h2 style={{ margin: "0 0 12px 0" }}>Built for quality leaders</h2>
          <p style={{ margin: 0, color: "#475569", lineHeight: "28px" }}>
            QualiSphere helps regulated companies connect quality events,
            approvals, document changes, training, supplier quality, audits, and
            management review into one controlled quality ecosystem.
          </p>
        </section>

        <footer style={footerStyle}>
          <div>Built for regulated industries. Designed for quality leaders.</div>
          <div>© {new Date().getFullYear()} QualiSphere. All Rights Reserved.</div>
        </footer>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  position: "relative",
  minHeight: "100vh",
  overflow: "hidden",
  background:
    "linear-gradient(135deg, #f8fafc 0%, #eef2ff 48%, #f8fafc 100%)",
  fontFamily: "Arial, sans-serif",
  color: "#0f172a",
  padding: "36px 24px",
};

const techBackgroundStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage: `
    radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.20), transparent 28%),
    radial-gradient(circle at 80% 15%, rgba(14, 165, 233, 0.16), transparent 24%),
    radial-gradient(circle at 50% 80%, rgba(59, 130, 246, 0.14), transparent 30%),
    linear-gradient(90deg, rgba(37,99,235,0.05) 1px, transparent 1px),
    linear-gradient(0deg, rgba(37,99,235,0.05) 1px, transparent 1px)
  `,
  backgroundSize: "auto, auto, auto, 52px 52px, 52px 52px",
  opacity: 1,
  pointerEvents: "none",
};

const containerStyle: React.CSSProperties = {
  position: "relative",
  maxWidth: "1120px",
  margin: "0 auto",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "48px",
};

const signinButtonStyle: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.86)",
  color: "#111827",
  padding: "12px 22px",
  borderRadius: "999px",
  textDecoration: "none",
  fontWeight: 800,
  border: "1px solid rgba(148,163,184,0.55)",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
};

const createAccountButtonStyle: React.CSSProperties = {
  backgroundColor: "#2563eb",
  color: "#ffffff",
  padding: "12px 22px",
  borderRadius: "999px",
  textDecoration: "none",
  fontWeight: 800,
  boxShadow: "0 12px 28px rgba(37, 99, 235, 0.22)",
};

const requestDemoButtonStyle: React.CSSProperties = {
  backgroundColor: "#111827",
  color: "#ffffff",
  padding: "12px 22px",
  borderRadius: "999px",
  textDecoration: "none",
  fontWeight: 800,
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.22)",
};

const heroStyle: React.CSSProperties = {
  textAlign: "center",
  maxWidth: "880px",
  margin: "0 auto 48px auto",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.18em",
  color: "#2563eb",
  background: "rgba(239, 246, 255, 0.88)",
  border: "1px solid #bfdbfe",
  borderRadius: "999px",
  padding: "8px 14px",
  marginBottom: "18px",
};

const titleStyle: React.CSSProperties = {
  fontSize: "clamp(46px, 8vw, 82px)",
  lineHeight: 1,
  fontWeight: 950,
  margin: "0 0 20px 0",
  color: "#0f172a",
  letterSpacing: "-0.06em",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "22px",
  lineHeight: "34px",
  color: "#334155",
  margin: "0 auto",
  maxWidth: "780px",
};

const pillRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginTop: "28px",
};

const pillStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.86)",
  border: "1px solid #dbeafe",
  color: "#1e40af",
  borderRadius: "999px",
  padding: "8px 12px",
  fontWeight: 800,
  fontSize: "13px",
  boxShadow: "0 8px 20px rgba(37,99,235,0.08)",
};

const capabilityPanelStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "20px",
  background: "rgba(255,255,255,0.72)",
  border: "1px solid rgba(148,163,184,0.35)",
  borderRadius: "30px",
  padding: "24px",
  boxShadow: "0 24px 70px rgba(15, 23, 42, 0.12)",
  backdropFilter: "blur(14px)",
};

const capabilitySectionStyle: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(239,246,255,0.65))",
  border: "1px solid rgba(191,219,254,0.8)",
  borderRadius: "24px",
  padding: "26px",
};

const capabilityTitleStyle: React.CSSProperties = {
  margin: "0 0 18px 0",
  fontSize: "22px",
  color: "#0f172a",
};

const capabilityListStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
};

const capabilityItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  color: "#334155",
  fontWeight: 700,
};

const checkStyle: React.CSSProperties = {
  width: "24px",
  height: "24px",
  borderRadius: "999px",
  background: "#dbeafe",
  color: "#1d4ed8",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  flexShrink: 0,
};

const valueStatementStyle: React.CSSProperties = {
  marginTop: "28px",
  background: "rgba(255,255,255,0.82)",
  border: "1px solid rgba(226,232,240,0.9)",
  borderRadius: "24px",
  padding: "30px",
  textAlign: "center",
  boxShadow: "0 12px 35px rgba(15,23,42,0.07)",
};

const footerStyle: React.CSSProperties = {
  marginTop: "36px",
  textAlign: "center",
  color: "#64748b",
  fontSize: "14px",
  lineHeight: "24px",
};
