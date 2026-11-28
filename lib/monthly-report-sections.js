/** A stable, allowlisted selection shared by the report drawer and all export formats. */
export const REPORT_SECTIONS = [
  { id: "completed", fa: "تسک‌های انجام‌شده", en: "Completed tasks", group: "tasks" },
  { id: "open", fa: "تسک‌های انجام‌نشده", en: "Unfinished tasks", group: "tasks" },
  { id: "shiftSchedules", fa: "برنامه شیفت و ساعت‌ها", en: "Shifts and hours", group: "shifts" },
  { id: "shiftLogs", fa: "شیفت‌لاگ‌ها و فعالیت‌ها", en: "Shift logs and activities", group: "shifts" },
  { id: "tickets", fa: "تیکت‌ها و نتایج FP/TP", en: "Tickets and FP/TP", group: "details" },
  { id: "reviews", fa: "ارزیابی کیفیت شیفت", en: "Shift quality reviews", group: "details" },
  { id: "evidence", fa: "مستندات و تاریخچه تسک", en: "Task evidence and history", group: "details" },
];
export const ALL_REPORT_SECTIONS = REPORT_SECTIONS.map((item) => item.id);
export function parseReportSections(value) {
  if (value == null) return [...ALL_REPORT_SECTIONS]; // Backward-compatible existing export links.
  if (typeof value !== "string" || !value || value.length > 200) return null;
  const selected = value.split(",");
  if (new Set(selected).size !== selected.length || selected.some((id) => !ALL_REPORT_SECTIONS.includes(id))) return null;
  if (!selected.length) return null;
  if (selected.includes("shiftLogs") && !selected.includes("shiftSchedules")) return null;
  if (selected.includes("evidence") && !selected.includes("completed") && !selected.includes("open")) return null;
  return ALL_REPORT_SECTIONS.filter((id) => selected.includes(id));
}
