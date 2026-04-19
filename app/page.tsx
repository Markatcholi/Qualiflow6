export default function HomePage() {
  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>QualiFlow</h1>
      <p>Welcome to your Quality Management SaaS.</p>

      <div style={{ marginTop: "20px" }}>
        <a href="/dashboard" style={{ marginRight: "10px" }}>
          Go to Dashboard
        </a>

        <a href="/login">
          Login
        </a>
      </div>
    </main>
  );
}
