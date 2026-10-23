import "server-only";
import ExcelJS from "exceljs";
import { isIsoDate } from "@/lib/shifts";

const SHIFT_COLUMNS = [
  [3, "evening"], [4, "morning"], [5, "off"], [6, "leave"],
];
const DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function normalizeExcelName(name) {
  return String(name ?? "").normalize("NFKC")
    .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
    .replace(/[\u200c\u200d\u064b-\u065f]/g, "")
    .replace(/\s+/g, " ").trim().toLocaleLowerCase("fa");
}
function content(value) {
  if (value == null) return "";
  if (typeof value === "object" && !(value instanceof Date)) {
    return content(value.result ?? value.text ?? value.richText?.map((x) => x.text).join("") ?? "");
  }
  return String(value).trim();
}
function isoDate(cell) {
  let value = cell.value;
  if (typeof value === "object" && value && !(value instanceof Date)) value = value.result;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && value > 20000 && value < 90000)
    return new Date(Math.round((value - 25569) * 86400000)).toISOString().slice(0, 10);
  const str = content(value).replace(/[۰-۹]/g, (x) => DIGITS.indexOf(x)).replace(/[٠-٩]/g, (x) => ARABIC_DIGITS.indexOf(x));
  if (isIsoDate(str)) return str;
  return null;
}
function readNames(raw, warnings, source) {
  return content(raw).split(/[-–—=،,;؛\n]+/).map((name) => {
    const annotation = name.match(/[（(]([^（）()]+)[）)]/);
    if (annotation) warnings.push(source + ": توضیح کنار نام «" + name.trim() + "»؛ وضعیت بر اساس ستون فایل خوانده شد.");
    return name.replace(/[（(][^（）()]*[）)]/g, "").trim();
  }).filter(Boolean);
}
const columns = ["تاریخ", "روز", "حضور تا ساعت 20", "حضور عادی", "تعطیل شیفت", "مرخصی"];
function isExpectedSheet(sheet) {
  const cell = (idx) => normalizeExcelName(content(sheet.getRow(1).getCell(idx).value)).replace(/\s+/g, "");
  return cell(1).includes("تاریخ") && cell(3).includes("حضورتاساعت") &&
    cell(4).includes("حضورعادی") && cell(5).includes("تعطیلشیفت") && cell(6).includes("مرخصی");
}

/** The supplied 1405_06 and 1405_07 rosters use Excel serial dates in A and C:F for statuses. */
export async function readShiftExcelFiles(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 6) throw new Error("Between one and six Excel files are required.");
  const days = [], warnings = [];
  for (const file of files) {
    if (!/\.xlsx$/i.test(file.name) || file.size < 50 || file.size > 5 * 1024 * 1024)
      throw new Error("Only .xlsx files up to 5 MB are allowed.");
    const book = new ExcelJS.Workbook();
    try { await book.xlsx.load(Buffer.from(await file.arrayBuffer())); }
    catch { throw new Error("Cannot read Excel file: " + file.name); }
    const sheet = book.worksheets.find(isExpectedSheet);
    if (!sheet) throw new Error("Expected roster columns (تاریخ، حضور تا ساعت 20، حضور عادی، تعطیل شیفت، مرخصی) in " + file.name);
    if (sheet.rowCount > 500) throw new Error("Too many rows in " + file.name);
    warnings.push(file.name + ": ستون مستقل «شیفت شب» ندارد؛ شیفت شب از این فایل وارد نمی‌شود.");
    for (let n = 2; n <= sheet.rowCount; n++) {
      const row = sheet.getRow(n);
      const date = isoDate(row.getCell(1));
      const note = content(row.getCell(7).value);
      const hasNames = SHIFT_COLUMNS.some(([col]) => !!content(row.getCell(col).value));
      if (!date) {
        if (hasNames || note) warnings.push(file.name + "، ردیف " + n + ": تاریخ معتبر ندارد و وارد نمی‌شود.");
        continue;
      }
      const entries = [];
      for (const [column, shiftType] of SHIFT_COLUMNS) {
        for (const name of readNames(row.getCell(column).value, warnings, file.name + "، ردیف " + n)) {
          entries.push({ name, shiftType });
        }
      }
      const issues = [];
      const seen = new Map();
      for (const item of entries) {
        const key = normalizeExcelName(item.name);
        if (seen.has(key)) issues.push(item.name + " در چند ستون یا چند بار در یک روز آمده است (" + seen.get(key) + " / " + item.shiftType + ").");
        else seen.set(key, item.shiftType);
      }
      const centerHoliday = /تعطیل(?:ی)?\s*مرکز/.test(normalizeExcelName(note));
      days.push({
        date, source: file.name, row: n, entries, issues,
        holidayNote: centerHoliday ? note : null,
        note,
      });
    }
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  const seenDates = new Set();
  for (const day of days) {
    if (seenDates.has(day.date)) day.issues.push("تاریخ تکراری بین فایل‌ها؛ برای جلوگیری از بازنویسی روز وارد نمی‌شود.");
    seenDates.add(day.date);
  }
  if (!days.length || days.length > 370) throw new Error("No valid daily rosters found, or the import is too large.");
  return { days, warnings: warnings.slice(0, 100) };
}
