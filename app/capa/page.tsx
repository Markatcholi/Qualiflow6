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
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      alert(userError.message);
      return;
    }

    const email = userData?.user?.email || "";
    setUserEmail(email);

    if (!email) {
      setUserRole("");
      return;
    }

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_email", email)
      .maybeSingle();

    if (error) {
      alert(error.message);
      return;
    }

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

  const closeCapa = async (item: Capa) => {
    if (!item.effectiveness_check) {
      alert("Complete effectiveness check before closing.");
      return;
    }

    if (userRole !== "approver") {
      alert("Only an approver can close CAPA.");
      return;
    }

    const confirmClose = window.confirm(
      "By closing this CAPA, you are electronically signing that it is complete. Continue?"
    );

    if (!confirmClose) return;

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
      await closeCapa(item);
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

      <p><strong>Logged-in Email:</strong> {userEmail || "none"}</p>
      <p><strong>Your Role:</strong> {userRole || "none"}</p>

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
                Approved by: {item.approved_by}
                <br />
                {item.approved_at}
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
