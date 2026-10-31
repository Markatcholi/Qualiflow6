"use client";
import { useId } from "react";
export type EmployeeProfileValues = { fullName: string; email: string; jobTitle: string; department: string; managerEmail: string; status: string };
type Props = { value: EmployeeProfileValues; onChange: (value: EmployeeProfileValues) => void; onSave: () => void; saving?: boolean; managers: { email: string; name?: string | null }[] };
export default function EmployeeProfileForm({ value, onChange, onSave, saving, managers }: Props) {
  const listId = useId();
  const inputStyle = { padding: 8, marginRight: 8, marginBottom: 8 };
  const field = (key: keyof EmployeeProfileValues, label: string, type = "text") => <input type={type} aria-label={label} placeholder={label} value={value[key]} onChange={e=>onChange({...value,[key]:e.target.value})} style={inputStyle} />;
  return <>
    <h3>Add or Update User Profile</h3>
    <p style={{ color: "#4b5563", marginTop: 0 }}>Select Edit below to update an employee. Type a manager email or choose a suggestion; leave blank for no manager.</p>
    {field("fullName", "Employee name")}{field("email", "User email", "email")}{field("jobTitle", "Job title")}{field("department", "Department")}
    <label style={{ display: "inline-flex", flexDirection: "column", gap: 4, verticalAlign: "middle" }}>
      <span style={{ fontSize: 12, fontWeight: 600 }}>Manager Email (optional)</span>
      <input type="email" list={listId} value={value.managerEmail} onChange={e=>onChange({...value,managerEmail:e.target.value})} placeholder="manager@company.com" style={inputStyle} aria-label="Manager email" />
      <datalist id={listId}>{managers.filter(m=>m.email.toLowerCase()!==value.email.trim().toLowerCase()).map(m=><option key={m.email} value={m.email}>{m.name || m.email}</option>)}</datalist>
    </label>
    <select aria-label="Account status" value={value.status} onChange={e=>onChange({...value,status:e.target.value})} style={{...inputStyle,minWidth:190}}><option value="active">Active</option><option value="inactive">Inactive</option></select>
    <button type="button" onClick={onSave} disabled={saving}>{saving?"Saving...":"Add / Update User"}</button>
  </>;
}
