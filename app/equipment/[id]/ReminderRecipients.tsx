import { useId } from "react";

export type ReminderRule = {
  recipient_type: string;
  recipient_email: string | null;
  notification_type: "both" | "email" | "in_app";
  days_before_due: number;
};

type Recipient = Omit<ReminderRule, "days_before_due"> & { days: number[] };

const offsets = [30, 17, 14, 7, 3, 1, 0, -1, -3, -7, -14];
export const defaultRecipients: Recipient[] = [
  { recipient_type: "owner", recipient_email: null, notification_type: "both", days: [30, 17, 7, 1] },
];

export function groupRecipients(rules: ReminderRule[]): Recipient[] {
  const groups = new Map<string, Recipient>();
  for (const { days_before_due, ...rule } of rules) {
    const key = JSON.stringify([rule.recipient_type, rule.recipient_email, rule.notification_type]);
    if (!groups.has(key)) groups.set(key, { ...rule, days: [] });
    groups.get(key)!.days.push(days_before_due);
  }
  return [...groups.values()];
}

export function reminderRules(recipients: Recipient[]): ReminderRule[] {
  const ruleKeys = new Set<string>();
  return recipients.flatMap(({ days, ...recipient }) => {
    const email = recipient.recipient_email?.trim().toLowerCase() || null;
    if (days.length && recipient.recipient_type === "specific_user" &&
        (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      throw new Error("Enter a valid email for each selected recipient.");
    }
    return days.map(day => {
      const key = JSON.stringify([recipient.recipient_type, email, day]);
      if (ruleKeys.has(key)) throw new Error("Select one delivery preference per recipient and reminder day.");
      ruleKeys.add(key);
      return { ...recipient, recipient_email: email, days_before_due: day };
    });
  });
}

export function ReminderRecipients({ employeeEmails, recipients, onChange }: {
  employeeEmails: string[];
  recipients: Recipient[];
  onChange: (recipients: Recipient[]) => void;
}) {
  const employeeListId = useId();
  return (
    <div style={{ marginTop: 18 }}>
      <datalist id={employeeListId}>
        {employeeEmails.map(email => <option key={email} value={email} />)}
      </datalist>
      <h4>Reminder recipients</h4>
      {recipients.map((recipient, index) => {
        const update = (changes: Partial<Recipient>) =>
          onChange(recipients.map((row, position) => position === index ? { ...row, ...changes } : row));
        const days = [...new Set([...offsets, ...recipient.days])].sort((a, b) => b - a);
        return (
          <fieldset key={index} style={{ marginBottom: 12 }}>
            <legend>Recipient {index + 1}</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <label>Recipient <select value={recipient.recipient_type} onChange={event =>
                update({ recipient_type: event.target.value, recipient_email: null })}>
                <option value="owner">Equipment Owner</option>
                <option value="specific_user">Specific employee</option>
                {recipient.recipient_type === "department" && <option value="department">Department (legacy)</option>}
                {recipient.recipient_type === "quality" && <option value="quality">Quality (legacy)</option>}
              </select></label>
              {recipient.recipient_type === "specific_user" && <label>
                Work email <input type="email" list={employeeListId} value={recipient.recipient_email || ""}
                  onChange={event => update({ recipient_email: event.target.value })} />
              </label>}
              <label>Delivery <select value={recipient.notification_type} onChange={event =>
                update({ notification_type: event.target.value as Recipient["notification_type"] })}>
                <option value="both">Workspace and Email</option>
                <option value="in_app">Workspace only</option>
                <option value="email">Email only</option>
              </select></label>
              <button type="button" onClick={() => onChange(recipients.filter((_, position) => position !== index))}>
                Remove recipient
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
              {days.map(day => <label key={day}>
                <input type="checkbox" checked={recipient.days.includes(day)} onChange={() =>
                  update({ days: recipient.days.includes(day) ? recipient.days.filter(value => value !== day) : [...recipient.days, day] })} />
                {day === 0 ? "Due Date" : day < 0 ? `${-day} Days Overdue` : `${day} Days Before`}
              </label>)}
            </div>
          </fieldset>
        );
      })}
      <button type="button" onClick={() => onChange([...recipients, {
        recipient_type: recipients.length ? "specific_user" : "owner",
        recipient_email: null,
        notification_type: "both",
        days: [...defaultRecipients[0].days],
      }])}>Add recipient</button>
    </div>
  );
}
