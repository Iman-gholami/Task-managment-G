import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { readShiftExcelFiles, normalizeExcelName } from "../lib/server/shift-excel.js";

test("reads the supplied-format Persian monthly roster, allowing coverage on center holidays", async () => {
  const b = new ExcelJS.Workbook();
  const s = b.addWorksheet("مهر 1405");
  s.addRow(["تاریخ", "روز", "حضور تا ساعت 20", "حضور عادی", "تعطیل شیفت", "مرخصی", "توضیحات"]);
  s.addRow([46286, 46286, "دامغانی", "غضنفری", "غلامی-خصالی", "", "تعطیلی مرکز"]);
  s.addRow([46291, 46291, "برجیان", "دامغانی-برجیان", "", "", ""]);
  s.addRow([46292, 46292, "ناطق", "", "شکرانه-ناطق(شیفت شب)", "", ""]);
  const bytes = await b.xlsx.writeBuffer();
  const f = { name: "1405_07.xlsx", size: bytes.byteLength, arrayBuffer: async () => bytes };
  const p = await readShiftExcelFiles([f]);
  assert.equal(p.days.length, 3);
  assert.equal(p.days[0].date, "2026-09-21");
  assert.deepEqual(p.days[0].entries.map((e) => e.shiftType), ["evening", "morning", "off", "off"]);
  assert.equal(p.days[0].holidayNote, "تعطیلی مرکز");
  assert.equal(p.days[1].issues.length, 1);
  assert.equal(p.days[2].issues.length, 1);
  assert.ok(p.warnings.some((w) => w.includes("شیفت شب")));
  assert.equal(normalizeExcelName("كياني"), normalizeExcelName("کیانی"));
});

test("reads the newer roster with an explicit night shift and ignores night workers' daytime off markers", async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("آذر 1405");
  sheet.addRow([
    "تاریخ", "روز", "شیفت روز (خروج 15:18)", "شیفت روز (حضور تا 20:00)",
    "شیفت شب (20:00 الی 08:00)", "تعطیل شیفت", "مرخصی", "توضیحات",
  ]);
  sheet.addRow([46343, 46343, "سارا-رضا", "ندا", "امیر", "امیر-مینا", "لیلا", ""]);
  sheet.addRow([46344, 46344, "", "مینا", "امیر", "امیر-مینا", "", "تعطیلی مرکز"]);
  const buffer = await book.xlsx.writeBuffer();
  const file = { name: "1405_09.xlsx", size: buffer.byteLength, arrayBuffer: async () => buffer };

  const result = await readShiftExcelFiles([file]);
  assert.equal(result.days.length, 2);
  assert.equal(result.days[0].date, "2026-11-17");
  assert.deepEqual(result.days[0].entries, [
    { name: "سارا", shiftType: "morning" },
    { name: "رضا", shiftType: "morning" },
    { name: "ندا", shiftType: "evening" },
    { name: "امیر", shiftType: "night" },
    { name: "مینا", shiftType: "off" },
    { name: "لیلا", shiftType: "leave" },
  ]);
  assert.deepEqual(result.days[0].issues, []);
  assert.deepEqual(result.days[1].entries.filter((e) => e.name === "امیر"), [
    { name: "امیر", shiftType: "night" },
  ]);
  assert.equal(result.days[1].issues.length, 1);
  assert.match(result.days[1].issues[0], /مینا/);
  assert.equal(result.days[1].holidayNote, "تعطیلی مرکز");
  assert.ok(result.warnings.some((warning) => warning.includes("۲ مورد") || warning.includes("2 مورد")));
  assert.ok(!result.warnings.some((warning) => warning.includes("ستون مستقل «شیفت شب» ندارد")));
});
