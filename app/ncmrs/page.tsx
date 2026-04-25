"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Ncmr = {
  id: string;
  title: string | null;
  product_part_number: string | null;
  defect_category: string | null;
  defect_subcategory: string | null;
  recurring_issue: boolean | null;
  recurrence_reason: string | null;
  severity: string | null;
  owner: string | null;
  status: string | null;
  capa_required: boolean | null;
  created_at: string | null;
};

export default function NcmrPage() {
  const [title, setTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [productPartNumber, setProductPartNumber] = useState("");
  const [defectCategory, setDefectCategory] = useState("");
  const [defectSubcategory, setDefectSubcategory] = useState("");
  const [quantityAffected, setQuantityAffected] = useState("");
  const [containmentAction, setContainmentAction] = useState("");
  const [owner, setOwner] = useState("");

  const [list, setList] = useState<Ncmr[]>([]);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("ncmrs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setList(data || []);
  };

  const checkRecurrence = async () => {
    if (!productPartNumber || !defectCategory) {
      return { recurring: false, reason: "" };
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data } = await supabase
      .from("ncmrs")
      .select("*")
      .eq("product_part_number", productPartNumber)
      .eq("defect_category", defectCategory)
      .gte("created_at", thirtyDaysAgo.toISOString());

    if (data && data.length > 0) {
      return {
        recurring: true,
        reason: `Recurring issue: ${data.length} similar cases in last 30 days`,
      };
    }

    return { recurring: false, reason: "" };
  };

  const addNcmr = async () => {
    if (!title) {
      alert("Title required");
      return;
    }

    const recurrence = await checkRecurrence();

    const { data, error } = await supabase
      .from("ncmrs")
      .insert({
        title,
        issue_description: issueDescription,
        product_part_number: productPartNumber,
        defect_category: defectCategory,
        defect_subcategory: defectSubcategory,
        quantity_affected: quantityAffected
          ? Number(quantityAffected)
          : null,
        containment_action: containmentAction,
        owner,
        status: "open",
        severity: "not_assessed",
        capa_required: recurrence.recurring,
        recurring_issue: recurrence.recurring,
        recurrence_reason: recurrence.reason,
        recurrence_checked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    if (recurrence.recurring) {
      await supabase.from("capas").insert({
        ncmr_id: data.id,
        title: `CAPA for ${title}`,
        source_type: "ncmr",
        capa_source: "Recurring",
        problem_description: issueDescription,
        status: "open",
      });
    }

    setTitle("");
    setIssueDescription("");
    setProductPartNumber("");
    setDefectCategory("");
    setDefectSubcategory("");
    setQuantityAffected("");
    setContainmentAction("");
    setOwner("");

    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <main style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>NCMR Initiation</h1>

      <div>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <textarea
          placeholder="Issue Description"
          value={issueDescription}
          onChange={(e) => setIssueDescription(e.target.value)}
        />
      </div>

      <div>
        <input
          placeholder="Part Number"
          value={productPartNumber}
          onChange={(e) => setProductPartNumber(e.target.value)}
        />
      </div>

      <div>
        <input
          placeholder="Defect Category"
          value={defectCategory}
          onChange={(e) => setDefectCategory(e.target.value)}
        />
      </div>

      <div>
        <input
          placeholder="Defect Subcategory"
          value={defectSubcategory}
          onChange={(e) => setDefectSubcategory(e.target.value)}
        />
      </div>

      <div>
        <input
          type="number"
          placeholder="Quantity Affected"
          value={quantityAffected}
          onChange={(e) => setQuantityAffected(e.target.value)}
        />
      </div>

      <div>
        <textarea
          placeholder="Containment Action"
          value={containmentAction}
          onChange={(e) => setContainmentAction(e.target.value)}
        />
      </div>

      <div>
        <input
          placeholder="Owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        />
      </div>

      <button onClick={addNcmr}>Create NCMR</button>

      <h2>Existing NCMRs</h2>

      <ul>
        {list.map((item) => (
          <li key={item.id}>
            <strong>{item.title}</strong> — {item.status}

            {item.recurring_issue && (
              <span style={{ color: "orange" }}> (Recurring)</span>
            )}

            {item.capa_required && (
              <span style={{ color: "red" }}> (CAPA Required)</span>
            )}

            <div>
              Part: {item.product_part_number} | Defect:{" "}
              {item.defect_category}
            </div>

            <a href={`/ncmrs/${item.id}`}>Open</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
