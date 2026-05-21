"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function CapaWorkflowPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("capas")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setItem(data || null);
    setLoading(false);
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const updateField = async (
    field: string,
    value: any
  ) => {
    if (!item) return;

    if (isLocked) {
      alert(
        "This CAPA record is locked and cannot be edited."
      );
      return;
    }

    setItem((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveChanges = async () => {
    if (!item) return;

    if (isLocked) {
      alert(
        "This CAPA record is locked."
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("capas")
      .update({
        problem_statement:
          item.problem_statement,
        risk_assessment:
          item.risk_assessment,
        investigation:
          item.investigation,
        root_cause:
          item.root_cause,
        correction:
          item.correction,
        corrective_action:
          item.corrective_action,
        implementation:
          item.implementation,
        effectiveness_plan:
          item.effectiveness_plan,
        effectiveness_result:
          item.effectiveness_result,
        effectiveness_check:
          item.effectiveness_check,
        owner: item.owner,
        due_date: item.due_date,
        status: item.status,
      })
      .eq("id", item.id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("CAPA workflow saved.");
    fetchData();
  };

  const printWorkflow = () => {
    window.print();
  };

  if (loading) {
    return (
      <main
        style={{
          padding: "24px",
          fontFamily: "Arial",
        }}
      >
        Loading CAPA workflow...
      </main>
    );
  }

  if (!item) {
    return (
      <main
        style={{
          padding: "24px",
          fontFamily: "Arial",
        }}
      >
        CAPA not found.
      </main>
    );
  }

  const isLocked =
    item.status === "closed" ||
    item.locked === true;

  const recurrenceDetected =
    (item.recurrence_count || 0) >=
    2;

  const predictiveEscalation =
    getPredictiveEscalation(item);

  const riskLevel =
    calculateRisk(item);

  const capaHealth =
    getWorkflowHealth(
      riskLevel,
      recurrenceDetected,
      item.effectiveness_result
    );

  const stages = [
    {
      label: "Initiation",
      completed:
        !!item.title,
    },
    {
      label: "Investigation",
      completed:
        !!item.investigation,
    },
    {
      label: "Root Cause",
      completed:
        !!item.root_cause,
    },
    {
      label: "Correction",
      completed:
        !!item.correction,
    },
    {
      label:
        "Corrective Action",
      completed:
        !!item.corrective_action,
    },
    {
      label:
        "Implementation",
      completed:
        !!item.implementation,
    },
    {
      label:
        "Effectiveness Plan",
      completed:
        !!item.effectiveness_plan,
    },
    {
      label:
        "Effectiveness Review",
      completed:
        !!item.effectiveness_result,
    },
  ];

  return (
    <main
      style={{
        padding: "24px",
        background: "#f8fafc",
        minHeight: "100vh",
        fontFamily:
          "Arial, sans-serif",
      }}
    >
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>
            CONTROLLED CAPA
            WORKFLOW
          </div>

          <h1
            style={{
              marginBottom: "6px",
            }}
          >
            {item.capa_number ||
              "CAPA-PENDING"}
          </h1>

          <p
            style={{
              marginTop: 0,
              color: "#4b5563",
            }}
          >
            Controlled corrective
            and preventive action
            execution record.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={printWorkflow}
            style={
              secondaryButtonStyle
            }
          >
            Print Workflow
          </button>

          {!isLocked ? (
            <button
              onClick={
                saveChanges
              }
              style={
                primaryButtonStyle
              }
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>
          ) : null}

          <Link
            href="/capa"
            style={
              backButtonStyle
            }
          >
            Back
          </Link>
        </div>
      </div>

      <section
        style={{
          ...healthBannerStyle,
          borderLeft: `8px solid ${capaHealth.color}`,
        }}
      >
        <div>
          <div
            style={bannerLabelStyle}
          >
            CAPA HEALTH STATUS
          </div>

          <div
            style={{
              fontSize: "30px",
              fontWeight: 800,
              color:
                capaHealth.color,
            }}
          >
            {capaHealth.label}
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
            color="#2563eb"
          />

          <Badge
            label={riskLevel}
            color={getRiskColor(
              riskLevel
            )}
          />

          {recurrenceDetected ? (
            <Badge
              label="Recurring Signal"
              color="#dc2626"
            />
          ) : null}

          {predictiveEscalation ? (
            <Badge
              label={
                predictiveEscalation
              }
              color="#991b1b"
            />
          ) : null}

          {item
            .effectiveness_result ===
          "ineffective" ? (
            <Badge
              label="Likely Recurrence"
              color="#7f1d1d"
            />
          ) : null}
        </div>
      </section>

      {isLocked ? (
        <section
          style={
            lockedBannerStyle
          }
        >
          🔒 CAPA RECORD LOCKED
          — Approved and
          protected from further
          modification.
        </section>
      ) : null}

      <section style={sectionStyle}>
        <h2
          style={{
            marginTop: 0,
          }}
        >
          Executive Summary
        </h2>

        <div style={summaryGridStyle}>
          <InfoCard
            label="Status"
            value={item.status}
          />

          <InfoCard
            label="Owner"
            value={item.owner}
          />

          <InfoCard
            label="Due Date"
            value={item.due_date}
          />

          <InfoCard
            label="Supplier"
            value={
              item.supplier_name
            }
          />

          <InfoCard
            label="Linked NCMR"
            value={
              item.linked_ncmr_title
            }
          />

          <InfoCard
            label="Effectiveness"
            value={
              item.effectiveness_result
            }
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2
          style={{
            marginTop: 0,
          }}
        >
          Workflow Stage
          Completion
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
          }}
        >
          {stages.map(
            (
              stage,
              index
            ) => (
              <div
                key={index}
                style={{
                  border:
                    "1px solid #d1d5db",
                  borderLeft: `6px solid ${
                    stage.completed
                      ? "#15803d"
                      : "#d97706"
                  }`,
                  borderRadius:
                    "12px",
                  padding:
                    "14px",
                  background:
                    "white",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                  }}
                >
                  {stage.completed
                    ? "✓"
                    : "⚠"}{" "}
                  {stage.label}
                </div>

                <div
                  style={{
                    marginTop:
                      "6px",
                    color:
                      "#6b7280",
                    fontSize:
                      "13px",
                  }}
                >
                  {stage.completed
                    ? "Completed"
                    : "Pending"}
                </div>
              </div>
            )
          )}
        </div>
      </section>

      <WorkflowSection
        title="1. Problem Statement"
        locked={isLocked}
      >
        <textarea
          value={
            item.problem_statement ||
            ""
          }
          onChange={(e) =>
            updateField(
              "problem_statement",
              e.target.value
            )
          }
          disabled={isLocked}
          style={textareaStyle(
            isLocked
          )}
        />
      </WorkflowSection>

      <WorkflowSection
        title="2. Risk Assessment"
        locked={isLocked}
      >
        <textarea
          value={
            item.risk_assessment ||
            ""
          }
          onChange={(e) =>
            updateField(
              "risk_assessment",
              e.target.value
            )
          }
          disabled={isLocked}
          style={textareaStyle(
            isLocked
          )}
        />
      </WorkflowSection>

      <WorkflowSection
        title="3. Investigation"
        locked={isLocked}
      >
        <textarea
          value={
            item.investigation ||
            ""
          }
          onChange={(e) =>
            updateField(
              "investigation",
              e.target.value
            )
          }
          disabled={isLocked}
          style={textareaStyle(
            isLocked
          )}
        />
      </WorkflowSection>

      <WorkflowSection
        title="4. Root Cause"
        locked={isLocked}
      >
        <textarea
          value={
            item.root_cause ||
            ""
          }
          onChange={(e) =>
            updateField(
              "root_cause",
              e.target.value
            )
          }
          disabled={isLocked}
          style={textareaStyle(
            isLocked
          )}
        />
      </WorkflowSection>

      <WorkflowSection
        title="5. Correction / Containment"
        locked={isLocked}
      >
        <textarea
          value={
            item.correction ||
            ""
          }
          onChange={(e) =>
            updateField(
              "correction",
              e.target.value
            )
          }
          disabled={isLocked}
          style={textareaStyle(
            isLocked
          )}
        />
      </WorkflowSection>

      <WorkflowSection
        title="6. Corrective Action Plan"
        locked={isLocked}
      >
        <textarea
          value={
            item.corrective_action ||
            ""
          }
          onChange={(e) =>
            updateField(
              "corrective_action",
              e.target.value
            )
          }
          disabled={isLocked}
          style={textareaStyle(
            isLocked
          )}
        />
      </WorkflowSection>

      <WorkflowSection
        title="7. Implementation"
        locked={isLocked}
      >
        <textarea
          value={
            item.implementation ||
            ""
          }
          onChange={(e) =>
            updateField(
              "implementation",
              e.target.value
            )
          }
          disabled={isLocked}
          style={textareaStyle(
            isLocked
          )}
        />
      </WorkflowSection>

      <WorkflowSection
        title="8. Effectiveness Plan"
        locked={isLocked}
      >
        <textarea
          value={
            item.effectiveness_plan ||
            ""
          }
          onChange={(e) =>
            updateField(
              "effectiveness_plan",
              e.target.value
            )
          }
          disabled={isLocked}
          style={textareaStyle(
            isLocked
          )}
        />
      </WorkflowSection>

      <WorkflowSection
        title="9. Effectiveness Verification"
        locked={isLocked}
      >
        <select
          value={
            item.effectiveness_result ||
            ""
          }
          onChange={(e) =>
            updateField(
              "effectiveness_result",
              e.target.value
            )
          }
          disabled={isLocked}
          style={inputStyle(
            isLocked
          )}
        >
          <option value="">
            Select Result
          </option>

          <option value="effective">
            Effective
          </option>

          <option value="ineffective">
            Ineffective
          </option>

          <option value="pending_review">
            Pending Review
          </option>
        </select>

        <textarea
          value={
            item.effectiveness_check ||
            ""
          }
          onChange={(e) =>
            updateField(
              "effectiveness_check",
              e.target.value
            )
          }
          disabled={isLocked}
          style={{
            ...textareaStyle(
              isLocked
            ),
            marginTop: "12px",
          }}
        />
      </WorkflowSection>

      <section style={sectionStyle}>
        <h2
          style={{
            marginTop: 0,
          }}
        >
          Approval &
          Electronic Signature
        </h2>

        <div style={summaryGridStyle}>
          <InfoCard
            label="Approved By"
            value={
              item.approved_by
            }
          />

          <InfoCard
            label="Approved At"
            value={
              item.approved_at
            }
          />

          <InfoCard
            label="Signed By"
            value={
              item.signed_by
            }
          />

          <InfoCard
            label="Signed At"
            value={
              item.signed_at
            }
          />
        </div>

        {item.signature_meaning ? (
          <div
            style={{
              marginTop: "16px",
              padding: "14px",
              background:
                "#f9fafb",
              borderRadius:
                "12px",
              border:
                "1px solid #d1d5db",
            }}
          >
            <strong>
              Signature Meaning
            </strong>

            <div
              style={{
                marginTop: "8px",
              }}
            >
              {
                item.signature_meaning
              }
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function WorkflowSection({
  title,
  children,
  locked,
}: {
  title: string;
  children: React.ReactNode;
  locked: boolean;
}) {
  return (
    <section
      style={{
        border:
          "1px solid #d1d5db",
        borderLeft: `8px solid ${
          locked
            ? "#9ca3af"
            : "#2563eb"
        }`,
        borderRadius: "14px",
        padding: "18px",
        marginBottom: "18px",
        background: "white",
      }}
    >
      <h2
        style={{
          marginTop: 0,
        }}
      >
        {title}
      </h2>

      {children}
    </section>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: any;
}) {
  return (
    <div
      style={{
        border:
          "1px solid #d1d5db",
        borderRadius: "12px",
        padding: "14px",
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "#6b7280",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>

      <div>
        {value || "N/A"}
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
        padding:
          "5px 10px",
        borderRadius:
          "999px",
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

function calculateRisk(
  item: any
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
    item.effectiveness_result ===
    "ineffective"
  )
    return "High";

  if (
    (item.recurrence_count ||
      0) >= 2
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

function getWorkflowHealth(
  risk: string,
  recurrence: boolean,
  effectiveness: string
) {
  if (
    risk === "Critical"
  ) {
    return {
      label: "Critical",
      color: "#991b1b",
    };
  }

  if (
    recurrence ||
    effectiveness ===
      "ineffective"
  ) {
    return {
      label: "Elevated",
      color: "#dc2626",
    };
  }

  if (risk === "High") {
    return {
      label: "Monitor",
      color: "#d97706",
    };
  }

  return {
    label: "Controlled",
    color: "#15803d",
  };
}

function getPredictiveEscalation(
  item: any
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

  return null;
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
    border:
      "1px solid #d1d5db",
    borderRadius: "16px",
    padding: "22px",
    background: "white",
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "20px",
  };

const sectionStyle: React.CSSProperties =
  {
    border:
      "1px solid #d1d5db",
    borderRadius: "14px",
    padding: "18px",
    background: "white",
    marginBottom: "18px",
  };

const summaryGridStyle: React.CSSProperties =
  {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  };

const bannerLabelStyle: React.CSSProperties =
  {
    fontSize: "13px",
    color: "#6b7280",
    fontWeight: 700,
  };

const lockedBannerStyle: React.CSSProperties =
  {
    background: "#111827",
    color: "white",
    padding: "14px",
    borderRadius: "12px",
    fontWeight: 700,
    marginBottom: "18px",
  };

const textareaStyle = (
  locked: boolean
): React.CSSProperties => ({
  width: "100%",
  minHeight: "140px",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  background: locked
    ? "#f3f4f6"
    : "white",
  color: locked
    ? "#6b7280"
    : "#111827",
});

const inputStyle = (
  locked: boolean
): React.CSSProperties => ({
  width: "100%",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  background: locked
    ? "#f3f4f6"
    : "white",
});

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

const secondaryButtonStyle: React.CSSProperties =
  {
    background: "#15803d",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
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
