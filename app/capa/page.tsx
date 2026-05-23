"use client";

import { useEffect, useMemo, useState } from "react";
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

  severity?: string | null;
  recurrence_count?: number | null;
  effectiveness_result?: string | null;
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
      `CAPA closed with electronic signature.`
    );

    fetchData();
  };

  const updateStatus = async (
    item: Capa,
    status: string
  ) => {
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

  const filteredList = useMemo(() => {
    return list.filter((item) => {
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
        ? searchableText.includes(
            search.trim().toLowerCase()
          )
        : true;

      const matchesStatus = statusFilter
        ? item.status === statusFilter
        : true;

      const matchesSource = sourceFilter
        ? item.capa_source === sourceFilter
        : true;

      const matchesType = typeFilter
        ? item.capa_type === typeFilter
        : true;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSource &&
        matchesType
      );
    });
  }, [
    list,
    search,
    statusFilter,
    sourceFilter,
    typeFilter,
  ]);

  const overdueCapas = list.filter((x) => {
    return (
      x.status !== "closed" &&
      x.due_date &&
      x.due_date <
        new Date()
          .toISOString()
          .split("T")[0]
    );
  });

  const recurringCapas = list.filter(
    (x) =>
      (x.recurrence_count || 0) >= 2
  );

  const ineffectiveCapas = list.filter(
    (x) =>
      x.effectiveness_result ===
      "ineffective"
  );

  const criticalCapas = list.filter(
    (x) =>
      x.severity === "critical" ||
      x.severity === "high"
  );

  const capaHealth = getCapaHealth({
    overdue: overdueCapas.length,
    recurring: recurringCapas.length,
    ineffective:
      ineffectiveCapas.length,
    critical:
      criticalCapas.length,
  });

  const trendStatus = getTrendStatus(
    overdueCapas.length,
    recurringCapas.length
  );

  return (
    <main
      style={{
        padding: "24px",
        fontFamily:
          "Arial, sans-serif",
        background: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>
            CAPA INTELLIGENCE
          </div>

          <h1
            style={{
              marginBottom: "6px",
            }}
          >
            CAPA Program
          </h1>

          <p
            style={{
              color: "#4b5563",
              marginTop: 0,
            }}
          >
            Enterprise CAPA
            workflow, effectiveness,
            recurrence intelligence,
            and governance oversight.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <a
            href="/capa/intelligence"
            style={{
              ...backButtonStyle,
              background: "#2563eb",
            }}
          >
            Intelligence Dashboard
          </a>

          <a
            href="/dashboard"
            style={backButtonStyle}
          >
            Dashboard
          </a>
        </div>
      </div>

      <section style={healthBannerStyle}>
        <div>
          <div
            style={{
              fontSize: "13px",
              color: "#6b7280",
              fontWeight: 700,
            }}
          >
            CAPA PROGRAM STATUS
          </div>

          <div
            style={{
              fontSize: "28px",
              fontWeight: 800,
              color: capaHealth.color,
            }}
          >
            {capaHealth.label}
          </div>
        </div>

        <div
          style={{
            textAlign: "right",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              color: "#6b7280",
              fontWeight: 700,
            }}
          >
            TREND TRAJECTORY
          </div>

          <div
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color:
                trendStatus ===
                "Improving"
                  ? "#15803d"
                  : trendStatus ===
                    "Stable"
                  ? "#d97706"
                  : "#dc2626",
            }}
          >
            {trendStatus}
          </div>
        </div>
      </section>
<section style={sectionStyle}>
        <h2>Initiate Direct CAPA</h2>

        <div style={formGridStyle}>
          <div>
            <label>CAPA Title</label>

            <input
              value={title}
              onChange={(e) =>
                setTitle(
                  e.target.value
                )
              }
              placeholder="CAPA title"
              style={inputStyle}
            />
          </div>

          <div>
            <label>Owner</label>

            <input
              value={owner}
              onChange={(e) =>
                setOwner(
                  e.target.value
                )
              }
              placeholder="CAPA owner"
              style={inputStyle}
            />
          </div>

          <div>
            <label>Due Date</label>

            <input
              type="date"
              value={dueDate}
              onChange={(e) =>
                setDueDate(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label>CAPA Source</label>

            <select
              value={capaSource}
              onChange={(e) =>
                setCapaSource(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="direct">
                Direct
              </option>

              <option value="audit">
                Audit
              </option>

              <option value="complaint">
                Complaint
              </option>

              <option value="trend">
                Trend
              </option>

              <option value="management_review">
                Management Review
              </option>

              <option value="supplier_issue">
                Supplier Issue
              </option>

              <option value="process_issue">
                Process Issue
              </option>
            </select>
          </div>
        </div>

        <button
          onClick={createDirectCapa}
          style={primaryButtonStyle}
        >
          Create CAPA
        </button>
      </section>

      <section style={sectionStyle}>
        <h2>Search / Filters</h2>

        <div style={filterGridStyle}>
          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search CAPA"
            style={inputStyle}
          />

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value
              )
            }
            style={inputStyle}
          >
            <option value="">
              All Statuses
            </option>

            <option value="open">
              Open
            </option>

            <option value="in_progress">
              In Progress
            </option>

            <option value="effectiveness_check">
              Effectiveness
            </option>

            <option value="closed">
              Closed
            </option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) =>
              setSourceFilter(
                e.target.value
              )
            }
            style={inputStyle}
          >
            <option value="">
              All Sources
            </option>

            <option value="audit">
              Audit
            </option>

            <option value="complaint">
              Complaint
            </option>

            <option value="trend">
              Trend
            </option>

            <option value="supplier_issue">
              Supplier Issue
            </option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(
                e.target.value
              )
            }
            style={inputStyle}
          >
            <option value="">
              All CAPA Types
            </option>

            <option value="internal_capa">
              Internal CAPA
            </option>

            <option value="supplier_capa">
              Supplier CAPA
            </option>

            <option value="scar">
              SCAR
            </option>
          </select>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: "16px",
        }}
      >
        {filteredList.map((item) => {
          const isOverdue =
            item.status !== "closed" &&
            item.due_date &&
            item.due_date <
              new Date()
                .toISOString()
                .split("T")[0];

          const recurrenceDetected =
            (item.recurrence_count ||
              0) >= 2;

          const riskLevel =
            calculateRisk(item);

          const predictiveEscalation =
            getPredictiveEscalation(
              item
            );

          const effectivenessStatus =
            getEffectivenessStatus(
              item
            );

          return (
            <article
              key={item.id}
              style={{
                border:
                  isOverdue
                    ? "2px solid #dc2626"
                    : "1px solid #d1d5db",
                borderRadius: "14px",
                padding: "18px",
                background: "white",
                boxShadow:
                  "0 1px 4px rgba(0,0,0,0.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h3
                    style={{
                      marginBottom:
                        "6px",
                    }}
                  >
                    {item.capa_number ||
                      "CAPA-PENDING"}{" "}
                    —{" "}
                    {item.title ||
                      "Untitled CAPA"}
                  </h3>

                  <div
                    style={{
                      color:
                        "#4b5563",
                      fontSize:
                        "14px",
                    }}
                  >
                    Source:{" "}
                    {item.capa_source ||
                      "N/A"}{" "}
                    | Type:{" "}
                    {item.source_type ||
                      "N/A"}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <Badge
                    label={
                      item.status ||
                      "unknown"
                    }
                    color={
                      item.status ===
                      "closed"
                        ? "#15803d"
                        : item.status ===
                          "effectiveness_check"
                        ? "#7c3aed"
                        : "#2563eb"
                    }
                  />

                  <Badge
                    label={
                      riskLevel
                    }
                    color={getRiskColor(
                      riskLevel
                    )}
                  />

                  {recurrenceDetected ? (
                    <Badge
                      label="Recurring"
                      color="#dc2626"
                    />
                  ) : null}

                  {predictiveEscalation ? (
                    <Badge
                      label={
                        predictiveEscalation
                      }
                      color="#b91c1c"
                    />
                  ) : null}

                  {isOverdue ? (
                    <Badge
                      label="Overdue"
                      color="#991b1b"
                    />
                  ) : null}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "10px",
                  marginTop: "16px",
                  fontSize: "14px",
                }}
              >
                <div>
                  <strong>
                    Owner:
                  </strong>{" "}
                  {item.owner ||
                    "Not assigned"}
                </div>

                <div>
                  <strong>
                    Due Date:
                  </strong>{" "}
                  {item.due_date ||
                    "Not set"}
                </div>

                <div>
                  <strong>
                    Supplier:
                  </strong>{" "}
                  {item.supplier_name ||
                    "N/A"}
                </div>

                <div>
                  <strong>
                    Linked NCMR:
                  </strong>{" "}
                  {item.linked_ncmr_title ||
                    "None"}
                </div>

                <div>
                  <strong>
                    Effectiveness:
                  </strong>{" "}
                  {
                    effectivenessStatus
                  }
                </div>

                <div>
                  <strong>
                    Closed:
                  </strong>{" "}
                  {item.closed_at ||
                    "N/A"}
                </div>
              </div>

              {item.signed_by ? (
                <div
                  style={{
                    marginTop:
                      "14px",
                    padding: "12px",
                    background:
                      "#f9fafb",
                    borderRadius:
                      "10px",
                    fontSize:
                      "14px",
                  }}
                >
                  <strong>
                    Electronic Signature
                  </strong>

                  <div
                    style={{
                      marginTop:
                        "6px",
                    }}
                  >
                    Signed by:{" "}
                    {
                      item.signed_by
                    }
                  </div>

                  <div>
                    Signed at:{" "}
                    {
                      item.signed_at
                    }
                  </div>
                </div>
              ) : null}

              <div
                style={{
                  marginTop:
                    "16px",
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <a
                  href={`/capa/${item.id}`}
                  style={
                    primaryLinkStyle
                  }
                >
                  Open Workflow
                </a>

                <a
                  href={`/capa/${item.id}/report`}
                  target="_blank"
                  rel="noreferrer"
                  style={
                    secondaryLinkStyle
                  }
                >
                  CAPA Report
                </a>

                <button
                  onClick={() =>
                    updateStatus(
                      item,
                      "in_progress"
                    )
                  }
                >
                  In Progress
                </button>

                <button
                  onClick={() =>
                    updateStatus(
                      item,
                      "effectiveness_check"
                    )
                  }
                >
                  Effectiveness
                </button>

                <button
                  onClick={() =>
                    updateStatus(
                      item,
                      "closed"
                    )
                  }
                >
                  Close
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value:
    | string
    | number;
  color: string;
}) {
  return (
    <div
      style={{
        border:
          "1px solid #d1d5db",
        borderRadius: "12px",
        padding: "16px",
        background: "white",
        borderLeft: `6px solid ${color}`,
      }}
    >
      <div
        style={{
          fontSize: "13px",
          color: "#6b7280",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: 800,
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Badge({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span
      style={{
        background: color,
        color: "white",
        padding: "5px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

function calculateRisk(
  item: Capa
) {
  if (
    item.severity ===
    "critical"
  )
    return "Critical";

  if (
    item.severity === "high"
  )
    return "High";

  if (
    (item.recurrence_count ||
      0) >= 2
  )
    return "High";

  if (
    item.effectiveness_result ===
    "ineffective"
  )
    return "High";

  return "Medium";
}

function getRiskColor(
  risk: string
) {
  if (risk === "Critical")
    return "#991b1b";

  if (risk === "High")
    return "#dc2626";

  return "#d97706";
}

function getEffectivenessStatus(
  item: Capa
) {
  if (
    item.effectiveness_result ===
    "effective"
  )
    return "Effective";

  if (
    item.effectiveness_result ===
    "ineffective"
  )
    return "Ineffective";

  if (
    item.status ===
    "effectiveness_check"
  )
    return "Pending Review";

  return "Not Completed";
}

function getPredictiveEscalation(
  item: Capa
) {
  if (
    item.status === "closed"
  )
    return null;

  if (
    item.due_date &&
    item.due_date <
      new Date(
        Date.now() +
          1000 *
            60 *
            60 *
            24 *
            7
      )
        .toISOString()
        .split("T")[0]
  ) {
    return "Likely Overdue";
  }

  if (
    item.effectiveness_result ===
    "ineffective"
  ) {
    return "Likely Recurrence";
  }

  return null;
}

function getCapaHealth({
  overdue,
  recurring,
  ineffective,
  critical,
}: {
  overdue: number;
  recurring: number;
  ineffective: number;
  critical: number;
}) {
  const score =
    overdue +
    recurring +
    ineffective +
    critical;

  if (score <= 3) {
    return {
      label: "Controlled",
      color: "#15803d",
    };
  }

  if (score <= 7) {
    return {
      label: "Monitor",
      color: "#d97706",
    };
  }

  if (score <= 12) {
    return {
      label: "Elevated",
      color: "#dc2626",
    };
  }

  return {
    label: "Critical",
    color: "#991b1b",
  };
}

function getTrendStatus(
  overdue: number,
  recurring: number
) {
  const total =
    overdue + recurring;

  if (total <= 3)
    return "Improving";

  if (total <= 7)
    return "Stable";

  return "Worsening";
}

const headerStyle: React.CSSProperties =
  {
    display: "flex",
    justifyContent:
      "space-between",
    gap: "12px",
    flexWrap: "wrap",
    alignItems:
      "flex-start",
    marginBottom: "20px",
  };

const eyebrowStyle: React.CSSProperties =
  {
    fontSize: "12px",
    letterSpacing:
      "0.08em",
    color: "#6b7280",
    fontWeight: 800,
  };

const healthBannerStyle: React.CSSProperties =
  {
    background: "white",
    border:
      "1px solid #d1d5db",
    borderRadius: "16px",
    padding: "22px",
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    marginBottom: "20px",
  };

const summaryGridStyle: React.CSSProperties =
  {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
    marginBottom: "20px",
  };

const sectionStyle: React.CSSProperties =
  {
    border:
      "1px solid #d1d5db",
    borderRadius: "14px",
    padding: "18px",
    marginBottom: "20px",
    background: "white",
  };

const formGridStyle: React.CSSProperties =
  {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
    marginBottom: "14px",
  };

const filterGridStyle: React.CSSProperties =
  {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  };

const inputStyle: React.CSSProperties =
  {
    width: "100%",
    padding: "10px",
    borderRadius: "8px",
    border:
      "1px solid #d1d5db",
    marginTop: "6px",
  };

const primaryButtonStyle: React.CSSProperties =
  {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  };

const primaryLinkStyle: React.CSSProperties =
  {
    display: "inline-block",
    background: "#2563eb",
    color: "white",
    padding: "8px 12px",
    borderRadius: "8px",
    textDecoration: "none",
  };

const secondaryLinkStyle: React.CSSProperties =
  {
    display: "inline-block",
    background: "#15803d",
    color: "white",
    padding: "8px 12px",
    borderRadius: "8px",
    textDecoration: "none",
  };

const backButtonStyle: React.CSSProperties =
  {
    background: "#111827",
    color: "white",
    padding: "10px 14px",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: 700,
  };
