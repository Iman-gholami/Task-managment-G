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
