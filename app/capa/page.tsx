"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Capa = {
  id: string;
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
};

export default function CapaPage() {
  const [list, setList] = useState<Capa[]>([]);
  const [userRole, setUserRole] = useState("");
  const [userEmail, setUserEmail] = useState("");

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

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>CAPA Records</h1>

      <p><strong>Logged-in Email:</strong> {userEmail || "none"}</p>
      <p><strong>Your Role:</strong> {userRole || "none"}</p>

      <ul>
        {list.map((item) => (
          <li key={item.id} style={{ marginBottom: "18px" }}>
            <a href={`/capa/${item.id}`}>
              <strong>{item.title}</strong>
            </a>{" "}
            — {item.status}

            <br />
            Owner: {item.owner || "Not assigned"}
            <br />
            Due Date: {item.due_date || "Not set"}
            <br />
            Effectiveness: {item.effectiveness_check || "Not done"}

            {item.signed_by && (
              <>
                <br />
                <strong>Electronic Signature:</strong>
                <br />
                Signed by: {item.signed_by}
                <br />
                Signed at: {item.signed_at}
                <br />
                Meaning: {item.signature_meaning}
              </>
            )}

            <div style={{ marginTop: "8px" }}>
              <button
                onClick={() => updateStatus(item, "in_progress")}
                style={{ marginRight: "8px" }}
              >
                In Progress
              </button>

              <button
                onClick={() => updateStatus(item, "effectiveness_check")}
                style={{ marginRight: "8px" }}
              >
                Effectiveness
              </button>

              <button onClick={() => updateStatus(item, "closed")}>
                Close with E-Signature
              </button>
            </div>
          </li>
        ))}
      </ul>

      <br />
      <a href="/ncmrs">Back to NCMRs</a>
    </main>
  );
}
