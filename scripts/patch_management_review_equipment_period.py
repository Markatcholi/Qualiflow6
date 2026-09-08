from pathlib import Path

page = Path("app/management-review/page.tsx")
s = page.read_text()

old = 'supabase.from("equipment_current_schedule_status").select("equipment_id,activity_type,schedule_status"),'
new = 'supabase.from("equipment_current_schedule_status").select("equipment_id,activity_type,schedule_status,nominal_due_date,scheduled_service_date,hard_due_date,use_status,lifecycle_status"),'
if old not in s:
    raise SystemExit("Equipment schedule select marker not found")
s = s.replace(old, new, 1)

old = '''      const calibrationRequiredIds = new Set(equipmentRows.filter((item: any) => item.calibration_required === true).map((item: any) => item.id));
      const pmRequiredIds = new Set(equipmentRows.filter((item: any) => item.preventive_maintenance_required === true).map((item: any) => item.id));
      const calibrationOverdueIds = new Set(scheduleRows.filter((item: any) => item.activity_type === "calibration" && item.schedule_status === "overdue").map((item: any) => item.equipment_id));
      const pmOverdueIds = new Set(scheduleRows.filter((item: any) => item.activity_type === "preventive_maintenance" && item.schedule_status === "overdue").map((item: any) => item.equipment_id));
'''
new = '''      const calibrationRequiredIds = new Set(equipmentRows.filter((item: any) => item.calibration_required === true).map((item: any) => item.id));
      const pmRequiredIds = new Set(equipmentRows.filter((item: any) => item.preventive_maintenance_required === true).map((item: any) => item.id));
      const reviewCutoff = reviewAsOfDate().toISOString().slice(0, 10);
      const scheduleDueDate = (item: any) => String(item.hard_due_date || item.scheduled_service_date || item.nominal_due_date || "").slice(0, 10);
      const isOverdueAsOfReviewEnd = (item: any) => {
        const due = scheduleDueDate(item);
        return Boolean(due && due < reviewCutoff);
      };
      const calibrationOverdueIds = new Set(
        scheduleRows
          .filter((item: any) => item.activity_type === "calibration" && isOverdueAsOfReviewEnd(item))
          .map((item: any) => item.equipment_id),
      );
      const pmOverdueIds = new Set(
        scheduleRows
          .filter((item: any) => item.activity_type === "preventive_maintenance" && isOverdueAsOfReviewEnd(item))
          .map((item: any) => item.equipment_id),
      );
'''
if old not in s:
    raise SystemExit("Equipment overdue logic marker not found")
s = s.replace(old, new, 1)

s = s.replace("Out of Service Equipment", "Out of Service at Snapshot")
s = s.replace(
    "Due-soon calibration and preventive-maintenance activity is intentionally excluded from Management Review and remains available on the operational Equipment dashboard.",
    "Calibration and PM overdue status is evaluated against the Management Review period end using the configured equipment due dates. Out-of-service status is preserved as a point-in-time value at snapshot generation. Due-soon activity remains on the operational Equipment dashboard.",
)
page.write_text(s)

report = Path("app/management-review/components/ManagementReviewSnapshotReport.tsx")
s = report.read_text()
s = s.replace("Out of Service Equipment", "Out of Service at Snapshot")
s = s.replace(
    "Due-soon calibration and preventive-maintenance activity is intentionally excluded from Management Review and remains on the operational Equipment dashboard.",
    "Calibration and PM overdue status is evaluated against the Management Review period end using the configured equipment due dates. Out-of-service status is preserved as a point-in-time value at snapshot generation. Due-soon activity remains on the operational Equipment dashboard.",
)
report.write_text(s)
