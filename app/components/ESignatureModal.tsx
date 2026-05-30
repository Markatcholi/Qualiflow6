"use client";

import React, { useState } from "react";

type Props = {
  open: boolean;
  title: string;
  actionLabel: string;
  onSubmit: (data: {
    meaning: string;
    reason: string;
  }) => Promise<void>;
  onClose: () => void;
};

export default function ESignatureModal({
  open,
  title,
  actionLabel,
  onSubmit,
  onClose,
}: Props) {
  const [meaning, setMeaning] = useState("Approve");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2>{title}</h2>

        <label>
          Signature Meaning
          <select
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            style={inputStyle}
          >
            <option>Approve</option>
            <option>Reject</option>
            <option>Review</option>
            <option>Verify</option>
            <option>Acknowledge Training</option>
            <option>Authorize Release</option>
          </select>
        </label>

        <label>
          Reason / Comments
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={inputStyle}
          />
        </label>

        <div style={{ marginTop: 20 }}>
          <button
            onClick={async () => {
              setSaving(true);

              await onSubmit({
                meaning,
                reason,
              });

              setSaving(false);
            }}
          >
            {saving ? "Signing..." : actionLabel}
          </button>

          <button
            onClick={onClose}
            style={{ marginLeft: 10 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const modalStyle = {
  background: "white",
  padding: 20,
  width: 500,
  borderRadius: 12,
};

const inputStyle = {
  width: "100%",
  marginTop: 6,
  marginBottom: 16,
};
