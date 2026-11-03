import { translate } from "./messages.js";

// Only static workbook titles, column headings and controlled enum values belong here.
// Employee names, task titles, notes and other user-authored fields are never translated.
const EN = {
  "راهنما": "Guide", "فیلترها": "Filters", "خلاصه": "Summary", "تیم‌ها": "Teams",
  "سطح‌های SOC": "SOC levels", "کارشناسان": "Analysts", "اعضا": "Members",
  "روند": "Trend", "تسک‌ها (خام)": "Tasks (raw)", "تسک‌های تکمیل‌شده": "Completed tasks",
  "تسک‌های باز": "Open tasks", "شیفت‌ها (خام)": "Shifts (raw)", "تیکت روزانه": "Daily tickets",
  "هشدارها و بینش‌ها": "Alerts and insights", "نوع": "Type", "هشدار": "Alert", "بینش": "Insight",
  "قابل توجه": "Notable", "متن": "Text", "جزئیات": "Details", "شاخص": "Metric",
  "این دوره": "Current period", "دوره مقایسه": "Comparison period", "تغییر": "Change",
  "نوع تغییر": "Change type", "واحد درصد": "Percentage points", "درصد": "Percent", "میانه تیم": "Team median",
  "وضعیت کار باز (اکنون)": "Open work (now)", "معوق با اولویت بالا یا بحرانی": "High-priority or critical overdue",
  "در انتظار بازبینی": "Awaiting review", "بک‌لاگ": "Backlog", "برای انجام": "To do", "در حال انجام": "In progress",
  "بازبینی": "Review", "انجام‌شده": "Done", "مسدود": "Blocked", "برگشتی": "Returned", "لغوشده": "Cancelled",
  "سرانه تکمیل‌شده": "Completed per analyst", "سرانه حجم وزن‌دار": "Weighted workload per analyst",
  "سرانه ساعت": "Hours per analyst", "تکمیل‌شده دوره مقایسه": "Completed in comparison period",
  "تغییر تکمیل‌شده": "Completed work change", "ساعت به ازای تسک": "Hours per task", "تسک‌های دارای ددلاین": "Tasks with deadlines",
  "میانه زمان انجام (روز)": "Median completion time (days)", "سهم عالی و خوب": "Excellent/good share",
  "شیفت‌لاگ جامانده": "Missed shift logs", "تیکت (تعداد)": "Tickets (count)", "مسدود (اکنون)": "Blocked (now)",
  "معوق (اکنون)": "Overdue (now)", "در انتظار بازبینی (اکنون)": "Awaiting review (now)",
  "از": "From", "تا": "To", "ناقص": "Partial", "تکمیل‌شده (دوره مقایسه)": "Completed (comparison period)",
  "شناسه": "ID", "عنوان": "Title", "ایجاد": "Created", "شروع": "Started", "تأیید": "Approved",
  "زمان انجام (روز)": "Completion time (days)", "دفعات برگشت": "Returns", "ایجاد (میلادی)": "Created (Gregorian)",
  "تأیید (میلادی)": "Approved (Gregorian)", "تاریخ": "Date", "تاریخ میلادی": "Gregorian date",
  "روز هفته": "Weekday", "شیفت‌لاگ": "Shift log", "کامل‌شده": "Completed", "فعالیت انجام‌شده": "Completed activities",
  "کل فعالیت": "Total activities", "تعداد تیکت": "Ticket count", "فعال": "Active", "غیرفعال": "Inactive",
  "طراحی و اتوماسیون": "Design & Automation", "هوش تهدید": "Threat Intelligence",
  "تحلیلگر": "Analyst", "مهندس": "Engineer", "مدیر SOC": "SOC Manager", "مدیر امنیت": "Security Manager",
  "ناظر": "Observer", "شنبه": "Saturday", "یکشنبه": "Sunday", "دوشنبه": "Monday", "سه‌شنبه": "Tuesday",
  "چهارشنبه": "Wednesday", "پنجشنبه": "Thursday", "جمعه": "Friday", "بله": "Yes", "خیر": "No",
  "پیچیدگی": "Complexity", "کیفیت": "Quality",
};

export function analyticsExportText(text, locale = "fa") {
  if (locale !== "en" || typeof text !== "string") return text;
  const category = /^(پیچیدگی|کیفیت): (.+)$/.exec(text);
  if (category) return `${EN[category[1]]}: ${analyticsExportText(category[2], locale)}`;
  return EN[text] ?? translate("en", text);
}

const CONTROLLED_COLUMNS = new Set(["team", "role", "state", "status", "prio", "cx", "quality", "unit", "partial", "weekday", "type", "log", "closed", "onTime", "report"]);

export function localizeAnalyticsSheets(workbook, locale) {
  if (locale !== "en") return;
  for (const sheet of workbook.worksheets) {
    const originalName = sheet.name;
    sheet.name = analyticsExportText(originalName, locale).slice(0, 31);
    sheet.views = (sheet.views ?? []).map((view) => ({ ...view, rightToLeft: false }));
    // The guide and filter sheets are already constructed in English; they have no column keys.
    if (originalName === "راهنما" || originalName === "فیلترها") continue;
    for (const column of sheet.columns) {
      const key = column.key;
      const heading = sheet.getCell(1, column.number);
      if (typeof heading.value === "string") heading.value = analyticsExportText(heading.value, locale);
      if (!CONTROLLED_COLUMNS.has(key) && !(originalName === "خلاصه" && key === "metric")) continue;
      column.eachCell({ includeEmpty: false }, (cell, row) => {
        if (row > 1 && typeof cell.value === "string") cell.value = analyticsExportText(cell.value, locale);
      });
    }
  }
}
