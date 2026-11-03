import { translate } from "./messages.js";

// Match only diagnostics produced by the Excel parser. Preserve file and person names verbatim.
export function shiftImportMessage(message, locale) {
  if (typeof message !== "string") return message;
  let match;
  if (locale === "en") {
    match = /^(.*)، ردیف (\d+): توضیح کنار نام «(.*)»؛ وضعیت بر اساس ستون فایل خوانده شد\.$/.exec(message);
    if (match) return `${match[1]}, row ${match[2]}: Annotation beside “${match[3]}”; the status was read from its column.`;
    match = /^(.*): ستون مستقل «شیفت شب» ندارد؛ شیفت شب از این فایل وارد نمی‌شود\.$/.exec(message);
    if (match) return `${match[1]}: No separate night-shift column; night shifts will not be imported from this file.`;
    match = /^(.*)، ردیف (\d+): تاریخ معتبر ندارد و وارد نمی‌شود\.$/.exec(message);
    if (match) return `${match[1]}, row ${match[2]}: Invalid date; this row will not be imported.`;
    match = /^(.*) در چند ستون یا چند بار در یک روز آمده است \(([^ ]+) \/ ([^ ]+)\)\.$/.exec(message);
    if (match) return `${match[1]} appears more than once on the same day (${match[2]} / ${match[3]}).`;
  } else {
    match = /^Cannot read Excel file: (.*)$/.exec(message);
    if (match) return `خواندن فایل اکسل ممکن نشد: ${match[1]}`;
    match = /^Too many rows in (.*)$/.exec(message);
    if (match) return `تعداد ردیف‌های فایل بیش از حد مجاز است: ${match[1]}`;
    match = /^Expected roster columns \(تاریخ، حضور تا ساعت 20، حضور عادی، تعطیل شیفت، مرخصی\) in (.*)$/.exec(message);
    if (match) return `ستون‌های موردنیاز برنامه شیفت در فایل پیدا نشد: ${match[1]}`;
  }
  return translate(locale, message);
}
