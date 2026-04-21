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
};

export default function CapaPage() {
  const [list, setList] = useState<Capa[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

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
    const { data } = await supabase
      .from("capas")
      .select("*")
      .order("created_at", { ascending: false });

    setList((data as Capa[]) || []);
  };

  const closeCapa = async (item: Capa) => {
    if (!item.effectiveness_check) {
      alert("Complete effectiveness check before closing.");
      return;
    }

    if (userRole !== "approver") {
      alert("Only an approver can close CAPA.");
      return;
    }

    const confirm = window.confirm(
      "By closing this CAPA, you are electronically signing that it is complete. Continue?"
    );

    if (!confirm) return;

    const { error } = await supabase
      .from("capas")
      .update({
        status: "closed",
        approved_by: userEmail,
        approved_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchData();
  };

  const updateStatus = async (item: Capa, status: string) => {
    if (status === "closed") {
      closeCapa(item);
      return;
    }

    const { error } = await supabase
      .from("capas")
      .update({ status })
      .eq("id", item.id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchData();
  };

  useEffect(() => {
    fetchUserRole();
    fetchData();
  }, []);

  return (
    <main style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>CAPA Records</h1>

      <p><strong>Logged-in:</strong> {userEmail}</p>
      <p><strong>Role:</strong> {userRole}</p>

      <ul>
        {list.map((item) => (
          <li key={item.id} style={{ marginBottom: "16px" }}>
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

            {item.approved_by && (
              <>
                <br />
                ✅ Approved by: {item.approved_by}
                <br />
                🕒 {item.approved_at}
              </>
            )}

            <div style={{ marginTop: "8px" }}>
              <button onClick={() => updateStatus(item, "in_progress")}>
                In Progress
              </button>

              <button onClick={() => updateStatus(item, "effectiveness_check")}>
                Effectiveness
              </button>

              <button onClick={() => updateStatus(item, "closed")}>
                Close (Sign)
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
