export default function HomePage() {
  const modules = [
    {
      title: "Nonconformance Management",
      description: "Nonconformance, MRB, disposition, and closure workflows.",
    },
    {
      title: "CAPA",
      description: "Corrective and preventive action management with effectiveness tracking.",
    },
    {
      title: "Change Control",
      description: "Risk-based change planning, approval, implementation, and verification.",
    },
    {
      title: "Document Control",
      description: "Controlled documents, revision workflows, release, and training.",
    },
    {
      title: "Supplier Quality",
      description: "Supplier oversight, SCARs, supplier CAPA, and performance visibility.",
    },
    {
      title: "Audit Management",
      description: "Internal, external, supplier audits, findings, and action tracking.",
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #dbeafe 0, transparent 32%), linear-gradient(135deg, #f8fafc 0%, #eef2ff 45%, #f8fafc 100%)",
        fontFamily: "Arial, sans-serif",
        padding: "36px 24px",
        color: "#0f172a",
      }}
    >
      <section
        style={{
          maxWidth: "1120px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "48px",
          }}
        >
          <a
            href="/login"
            style={{
              backgroundColor: "#111827",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "999px",
              textDecoration: "none",
              fontWeight: 700,
              boxShadow: "0 10px 24px rgba(15, 23, 42, 0.18)",
            }}
          >
            Login
          </a>
        </div>

        <div
          style={{
            textAlign: "center",
            maxWidth: "850px",
            margin: "0 auto 48px auto",
          }}
        >
          <div
            style={{
              display: "inline-block",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.18em",
              color: "#2563eb",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "999px",
              padding: "8px 14px",
              marginBottom: "18px",
            }}
          >
            ENTERPRISE QUALITY MANAGEMENT SYSTEM
          </div>

          <h1
            style={{
              fontSize: "clamp(44px, 7vw, 76px)",
              lineHeight: 1,
              fontWeight: 900,
              margin: "0 0 20px 0",
              color: "#0f172a",
              letterSpacing: "-0.05em",
            }}
          >
            QualiSphere
          </h1>

          <p
            style={{
              fontSize: "22px",
              lineHeight: "34px",
              color: "#334155",
              margin: "0 auto",
              maxWidth: "760px",
            }}
          >
            Integrated enterprise quality management for regulated companies
            that need connected workflows, configurable governance, and
            audit-ready records.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginTop: "28px",
            }}
          >
            <span style={pillStyle}>Audit-ready</span>
            <span style={pillStyle}>Configurable</span>
            <span style={pillStyle}>Workflow-driven</span>
            <span style={pillStyle}>Management-review ready</span>
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.78)",
            border: "1px solid rgba(148,163,184,0.35)",
            borderRadius: "28px",
            padding: "24px",
            boxShadow: "0 24px 70px rgba(15, 23, 42, 0.12)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "18px",
            }}
          >
            {modules.map((module) => (
              <div
                key={module.title}
                style={{
                  backgroundColor: "#ffffff",
                  padding: "24px",
                  borderRadius: "20px",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 8px 22px rgba(15,23,42,0.06)",
                  textAlign: "left",
                  minHeight: "145px",
                }}
              >
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "12px",
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    marginBottom: "16px",
                  }}
                />
                <h3
                  style={{
                    margin: "0 0 10px 0",
                    fontSize: "20px",
                    color: "#0f172a",
                  }}
                >
                  {module.title}
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: "#475569",
                    lineHeight: "24px",
                  }}
                >
                  {module.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <footer
          style={{
            marginTop: "36px",
            textAlign: "center",
            color: "#64748b",
            fontSize: "14px",
          }}
        >
          © {new Date().getFullYear()} QualiSphere. All Rights Reserved.
        </footer>
      </section>
    </main>
  );
}

const pillStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbeafe",
  color: "#1e40af",
  borderRadius: "999px",
  padding: "8px 12px",
  fontWeight: 700,
  fontSize: "13px",
};
