"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Capa = {
  id: string;
  capa_number: string | null;

  title: string | null;
  status: string | null;

  owner: string | null;
  due_date: string | null;

  effectiveness_check: string | null;

  approved_by: string | null;
  approved_at: string | null;

  closed_at: string | null;

  signature_meaning: string | null;
  signed_by: string | null;
  signed_at: string | null;

  linked_ncmr_title: string | null;

  source_type: string | null;
  capa_source: string | null;

  capa_type: string | null;
  supplier_name: string | null;

  scar_required: boolean | null;
};

export default function CapaPage() {
  const [list, setList] = useState<Capa[]>([]);
  const [userRole, setUserRole] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [capaSource, setCapaSource] = useState("direct");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const fetchUserRole = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";
    setUserEmail(email);

    if (!email) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", email)
      .maybeSingle();

    setUserRole(data?.role || "");
  };

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("capas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setList((data as Capa[]) || []);
  };

  const addAuditLog = async (
    entityType: string,
    entityId: string,
    action: string,
    details: string
  ) => {
    await supabase.from("audit_logs").insert({
      entity_type: entityType,
      entity_id: entityId,
      action,
      details,
      user_email: userEmail || "unknown",
    });
  };

  const createDirectCapa = async () => {
    if (!title) {
      alert("CAPA title is required.");
      return;
    }

    const { data, error } = await supabase
      .from("capas")
      .insert({
        title,
        owner,
        due_date: dueDate || null,
        status: "open",
        source_type: "direct",
        capa_source: capaSource,
        linked_ncmr_title: null,
        ncmr_id: null,
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "capa",
      data.id,
      "created",
      `Direct CAPA created: ${title}`
    );

    setTitle("");
    setOwner("");
    setDueDate("");
    setCapaSource("direct");
    fetchData();
  };

  const closeCapaWithSignature = async (item: Capa) => {
    if (!item.effectiveness_check) {
      alert("Complete effectiveness check before closing.");
      return;
    }

    if (userRole !== "approver") {
      alert("Only an approver can close CAPA.");
      return;
    }

    const confirmIntent = window.confirm(
      "Electronic Signature:\n\nBy selecting OK, I confirm that I have reviewed this CAPA, the effectiveness check is complete, and I approve closure."
    );

    if (!confirmIntent) return;

    const signatureMeaning =
      "I have reviewed this CAPA, confirmed effectiveness check completion, and approve closure.";

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("capas")
      .update({
        status: "closed",
        approved_by: userEmail,
        approved_at: now,
        signed_by: userEmail,
        signed_at: now,
        signature_meaning: signatureMeaning,
        closed_at: now,
      })
      .eq("id", item.id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "capa",
      item.id,
      "electronic_signature",
      `CAPA closed with electronic signature. Meaning: ${signatureMeaning}`
    );

    fetchData();
  };

  const updateStatus = async (item: Capa, status: string) => {
    if (status === "closed") {
      await closeCapaWithSignature(item);
      return;
    }

    const { error } = await supabase
      .from("capas")
      .update({
        status,
        closed_at: null,
      })
      .eq("id", item.id);

    if (error) {
      alert(error.message);
      return;
    }

    await addAuditLog(
      "capa",
      item.id,
      "status_changed",
      `CAPA status changed to ${status}`
    );

    fetchData();
  };

  useEffect(() => {
    fetchUserRole();
    fetchData();
  }, []);

  const summaryCardStyle: React.CSSProperties = {
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    padding: "14px",
    background: "#f9fafb",
  };

  const summaryLabelStyle: React.CSSProperties = {
    fontSize: "13px",
    color: "#4b5563",
    marginBottom: "4px",
  };

  const summaryValueStyle: React.CSSProperties = {
    fontSize: "24px",
    fontWeight: "bold",
  };

  const badgeStyle: React.CSSProperties = {
    color: "white",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
  };

  const filteredList = list.filter((item) => {
    const searchableText = [
      item.capa_number,
      item.title,
      item.owner,
      item.linked_ncmr_title,
      item.capa_source,
      item.source_type,
      item.capa_type,
      item.supplier_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = search
      ? searchableText.includes(search.trim().toLowerCase())
      : true;

    const matchesStatus = statusFilter ? item.status === statusFilter : true;
    const matchesSource = sourceFilter ? item.capa_source === sourceFilter : true;
    const matchesType = typeFilter ? item.capa_type === typeFilter : true;

    return matchesSearch && matchesStatus && matchesSource && matchesType;
  });

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>CAPA Records</h1>

      <p><strong>Logged-in Email:</strong> {userEmail || "none"}</p>
      <p><strong>Your Role:</strong> {userRole || "none"}</p>

      <section style={{ border: "1px solid #ccc", padding: "15px", marginBottom: "20px" }}>
        <h2>Initiate Direct CAPA</h2>

        <div style={{ marginBottom: "10px" }}>
          <label>CAPA Title</label><br />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="CAPA title"
            style={{ width: "100%", maxWidth: "500px", padding: "8px" }}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Owner</label><br />
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="CAPA owner"
            style={{ width: "100%", maxWidth: "400px", padding: "8px" }}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Due Date</label><br />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ padding: "8px" }}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>CAPA Source</label><br />
          <select
            value={capaSource}
            onChange={(e) => setCapaSource(e.target.value)}
            style={{ padding: "8px", minWidth: "220px" }}
          >
            <option value="direct">Direct</option>
            <option value="audit">Audit</option>
            <option value="complaint">Complaint</option>
            <option value="trend">Trend</option>
            <option value="management_review">Management Review</option>
            <option value="supplier_issue">Supplier Issue</option>
            <option value="process_issue">Process Issue</option>
          </select>
        </div>

        <button onClick={createDirectCapa}>Create Direct CAPA</button>
      </section>

      <h2>Existing CAPAs</h2>

      <section style={{ border: "1px solid #ccc", padding: "15px", marginBottom: "20px", borderRadius: "8px" }}>
        <h3>Search / Filters</h3>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, CAPA number, owner, supplier, NCMR"
          style={{ padding: "8px", width: "100%", maxWidth: "650px", marginRight: "10px", marginBottom: "8px" }}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "8px", marginRight: "10px", marginBottom: "8px" }}
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="effectiveness_check">Effectiveness Check</option>
          <option value="closed">Closed</option>
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          style={{ padding: "8px", marginRight: "10px", marginBottom: "8px" }}
        >
          <option value="">All Sources</option>
          <option value="direct">Direct</option>
          <option value="audit">Audit</option>
          <option value="complaint">Complaint</option>
          <option value="trend">Trend</option>
          <option value="management_review">Management Review</option>
          <option value="supplier_issue">Supplier Issue</option>
          <option value="Supplier recurrence">Supplier Recurrence</option>
          <option value="Recurring NCMR">Recurring NCMR</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ padding: "8px", marginRight: "10px", marginBottom: "8px" }}
        >
          <option value="">All CAPA Types</option>
          <option value="internal_capa">Internal CAPA</option>
          <option value="supplier_capa">Supplier CAPA</option>
          <option value="scar">SCAR</option>
        </select>

        <button
          onClick={() => {
            setSearch("");
            setStatusFilter("");
            setSourceFilter("");
            setTypeFilter("");
          }}
        >
          Clear Filters
        </button>

        <div style={{ marginTop: "10px", fontSize: "14px", color: "#4b5563" }}>
          Showing {filteredList.length} of {list.length} CAPA record(s)
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Total CAPAs</div>
          <div style={summaryValueStyle}>{list.length}</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Open / Active</div>
          <div style={summaryValueStyle}>{list.filter((x) => x.status !== "closed").length}</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Closed</div>
          <div style={summaryValueStyle}>{list.filter((x) => x.status === "closed").length}</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>SCARs</div>
          <div style={summaryValueStyle}>{list.filter((x) => x.capa_type === "scar" || x.scar_required).length}</div>
        </div>
      </section>

      {list.length === 0 ? (
        <p>No CAPA records yet.</p>
      ) : filteredList.length === 0 ? (
        <p>No CAPA records match the selected filters.</p>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {filteredList.map((item) => {
            const statusColor =
              item.status === "closed"
                ? "#16a34a"
                : item.status === "open"
                ? "#2563eb"
                : item.status === "effectiveness_check"
                ? "#7c3aed"
                : "#f59e0b";

            const isOverdue =
              item.status !== "closed" &&
              item.due_date &&
              item.due_date < new Date().toISOString().split("T")[0];

            return (
              <article
                key={item.id}
                style={{
                  border: isOverdue ? "2px solid #dc2626" : "1px solid #d1d5db",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h3 style={{ margin: "0 0 6px 0" }}>
                      {item.capa_number || "CAPA-PENDING"} — {item.title || "Untitled CAPA"}
                    </h3>
                    <div style={{ color: "#4b5563", fontSize: "14px" }}>
                      Source: {item.capa_source || "N/A"} | Type: {item.source_type || "N/A"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ ...badgeStyle, background: statusColor }}>
                      {item.status || "unknown"}
                    </span>
                    {isOverdue ? (
                      <span style={{ ...badgeStyle, background: "#dc2626" }}>Overdue</span>
                    ) : null}
                    {(item.capa_type === "scar" || item.scar_required) ? (
                      <span style={{ ...badgeStyle, background: "#7c3aed" }}>SCAR</span>
                    ) : null}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "8px",
                    marginTop: "14px",
                    fontSize: "14px",
                  }}
                >
                  <div><strong>Owner:</strong> {item.owner || "Not assigned"}</div>
                  <div><strong>Due Date:</strong> {item.due_date || "Not set"}</div>
                  <div><strong>Linked NCMR:</strong> {item.linked_ncmr_title || "None"}</div>
                  <div><strong>Supplier:</strong> {item.supplier_name || "N/A"}</div>
                  <div><strong>Effectiveness:</strong> {item.effectiveness_check ? "Completed" : "Not done"}</div>
                  <div><strong>Closed At:</strong> {item.closed_at || "N/A"}</div>
                </div>

                {item.signed_by ? (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "10px",
                      background: "#f9fafb",
                      borderRadius: "8px",
                      fontSize: "14px",
                    }}
                  >
                    <strong>Electronic Signature:</strong><br />
                    Signed by: {item.signed_by}<br />
                    Signed at: {item.signed_at}<br />
                    Meaning: {item.signature_meaning}
                  </div>
                ) : null}

                <div style={{ marginTop: "14px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <a
                    href={`/capa/${item.id}`}
                    style={{
                      display: "inline-block",
                      background: "#2563eb",
                      color: "white",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      textDecoration: "none",
                    }}
                  >
                    Open Workflow
                  </a>

                  <a
                    href={`/capa/${item.id}/report`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-block",
                      background: "#3b82f6",
                      color: "white",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      textDecoration: "none",
                    }}
                  >
                    CAPA Report
                  </a>

                  <button onClick={() => updateStatus(item, "in_progress")}>
                    In Progress
                  </button>

                  <button onClick={() => updateStatus(item, "effectiveness_check")}>
                    Effectiveness
                  </button>

                  <button onClick={() => updateStatus(item, "closed")}>
                    Close with E-Signature
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <br />
      <a href="/dashboard">Back to Dashboard</a>
    </main>
  );
}
