"use client";

import { DashboardSection, NotificationItem } from "./DashboardComponents";

export default function NotificationPanelSection({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  const totalHighPriorityAlerts = notifications.length;

  return (
    <DashboardSection
      title="Notification Panel"
      border={totalHighPriorityAlerts > 0 ? "2px solid #b91c1c" : "2px solid #15803d"}
    >
      {notifications.length === 0 ? (
        <p style={{ color: "#15803d", fontWeight: 700 }}>No active quality alerts.</p>
      ) : (
        <ul style={{ paddingLeft: "20px" }}>
          {notifications.map((alert, index) => (
            <li key={index} style={{ marginBottom: "10px" }}>
              <strong style={{ color: "#b91c1c" }}>{alert.type}:</strong> {alert.message} <a href={alert.link}>Open</a>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}
