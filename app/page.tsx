export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f8fafc",
        fontFamily: "Arial, sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "2px",
            color: "#64748b",
            marginBottom: "12px",
          }}
        >
          ENTERPRISE QUALITY MANAGEMENT SYSTEM
        </div>

        <h1
          style={{
            fontSize: "56px",
            fontWeight: 800,
            marginBottom: "20px",
            color: "#0f172a",
          }}
        >
          QualiSphere
        </h1>

        <p
          style={{
            fontSize: "20px",
            lineHeight: "32px",
            color: "#475569",
            maxWidth: "700px",
            margin: "0 auto 40px auto",
          }}
        >
          Integrated Enterprise Quality Management for Medical Devices,
          Life Sciences, Manufacturing, and Other Regulated Industries.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "16px",
            marginBottom: "60px",
          }}
        >
          <a
            href="/login"
            style={{
              backgroundColor: "#2563eb",
              color: "#ffffff",
              padding: "14px 28px",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: 600,
              display: "inline-block",
            }}
          >
            Login
          </a>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
            marginTop: "30px",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            <h3>Nonconformance Management</h3>
            <p>Nonconformance Management and MRB Workflow</p>
          </div>

          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            <h3>CAPA</h3>
            <p>Corrective and Preventive Action Management</p>
          </div>

          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            <h3>Change Control</h3>
            <p>Risk-Based Change Management</p>
          </div>

          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            <h3>Document Control</h3>
            <p>Controlled Documents and Training Management</p>
          </div>

          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            <h3>Supplier Quality</h3>
            <p>Supplier Corrective Action Requests (SCAR)</p>
          </div>

          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            <h3>Audit Management</h3>
            <p>Internal, External, and Supplier Audits</p>
          </div>
        </div>

        <div
          style={{
            marginTop: "60px",
            color: "#64748b",
            fontSize: "14px",
          }}
        >
          © {new Date().getFullYear()} QualiSphere. All Rights Reserved.
        </div>
      </div>
    </main>
  );
}
