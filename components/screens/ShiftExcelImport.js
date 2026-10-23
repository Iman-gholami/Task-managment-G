"use client";

import { useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import Icon from "@/components/ui/Icon";
import styles from "./ShiftExcelImport.module.css";

const SHIFT_TYPES = ["morning", "evening", "night", "off", "leave"];
const SHIFT_LABELS = { morning: "عادی", evening: "تا ۲۰", night: "شب", off: "تعطیل شیفت", leave: "مرخصی" };
const faNum = (v) => new Intl.NumberFormat("fa-IR").format(v);
const formatDate = (date) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
}).format(new Date(date + "T00:00:00Z"));

export default function ShiftExcelImport({ onClose, onImported }) {
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [enabled, setEnabled] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  const checked = useMemo(() => new Set(enabled), [enabled]);
  const selected = useMemo(() => (preview?.days ?? []).filter((d) => checked.has(d.date)), [preview, checked]);
  const unresolved = useMemo(() => {
    const entries = selected.flatMap((day) => day.entries);
    return [...new Set(entries.filter((item) => !mapping[item.name]).map((item) => item.name))];
  }, [selected, mapping]);
  const collisions = useMemo(() => selected.flatMap((day) => {
    const ids = day.entries.map((x) => mapping[x.name]).filter(Boolean);
    return ids.length !== new Set(ids).size ? [day.date] : [];
  }), [selected, mapping]);

  const upload = async () => {
    if (files.length < 1 || busy) return;
    setBusy(true); setError(""); setPreview(null); setDone(null);
    try {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      const response = await fetch("/api/shift/schedule/import", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "خواندن فایل ناموفق بود.");
      setPreview(result);
      setMapping(Object.fromEntries(result.match.map((item) => [item.name, item.suggestedId])));
      setEnabled(result.days.filter((day) => day.issues.length === 0).map((day) => day.date));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!selected.length || unresolved.length || collisions.length || busy) return;
    setBusy(true); setError("");
    try {
      const days = selected.map((day) => ({
        date: day.date,
        assignments: Object.fromEntries(SHIFT_TYPES.map((key) =>
          [key, day.entries.filter((entry) => entry.shiftType === key).map((entry) => mapping[entry.name])])
        ),
        holidayNote: day.holidayNote,
      }));
      const response = await fetch("/api/shift/schedule/import", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ثبت برنامه شیفت ناموفق بود.");
      setDone(result);
      onImported(days[0].date, result);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog label="ورود شیفت از اکسل" title="ورود برنامه شیفت از اکسل"
      description="فایل‌های ماهانه را آپلود کنید؛ قبل از ذخیره، نام کارشناس‌ها، تداخل‌ها و تاریخ‌ها بررسی می‌شوند."
      onClose={onClose} width={750} className={styles.dialog}>
      <div className={`modal-body ${styles.body}`}>
        <div className={styles.uploadArea}>
          <label htmlFor="shift-excel-files">فایل‌های Excel (.xlsx)</label>
          <input id="shift-excel-files" className="input" type="file" accept=".xlsx" multiple disabled={busy}
            onChange={(e) => { setFiles([...e.target.files]); setPreview(null); setEnabled([]); setDone(null); setError(""); }} />
          <span>می‌توانید چند ماه را هم‌زمان انتخاب کنید؛ ستون‌های «عادی»، «تا ۲۰»، «تعطیل شیفت» و «مرخصی» خوانده می‌شوند.</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={upload} disabled={busy || !files.length}>
            <Icon name="search" /> {busy && !preview ? "در حال خواندن..." : "بررسی و پیش‌نمایش"}
          </button>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {preview && (
          <>
            <div className={styles.summary}>
              <b>{faNum(preview.days.length)} روز شناسایی شد</b>
              <span>{faNum(selected.length)} روز آماده ثبت</span>
              <span>{faNum(preview.days.filter((day) => day.issues.length).length)} روز دارای تداخل</span>
              <span>{faNum(preview.days.filter((day) => day.holidayNote !== null).length)} تعطیلی مرکز</span>
            </div>
            <p className={styles.warning}>ثبت، برنامه فعلی روزهای انتخاب‌شده را جایگزین می‌کند. روزهای دارای تداخل انتخاب نشده‌اند. اگر برای شیفتی فعالیت ثبت شده باشد، هیچ روزی از این نوبت وارد نمی‌شود.</p>
            <details className={styles.warningDetails}>
              <summary>توضیحات و هشدارهای خواندن فایل ({faNum(preview.warnings.length)})</summary>
              <ul>{preview.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
            </details>

            <div className={styles.mappingHead}>
              <b>تطبیق نام‌های اکسل با کاربران سامانه</b>
              <small>برای هر اسم، شخص صحیح را انتخاب کنید؛ نام‌های ناشناخته خودکار حدس زده نمی‌شوند.</small>
            </div>
            <div className={styles.peopleGrid}>
              {preview.match.map((item) => (
                <label key={item.name} className={styles.personMap}>
                  <span>{item.name}</span>
                  <select className="input input-sm" value={mapping[item.name] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [item.name]: e.target.value }))}>
                    <option value="">انتخاب کارشناس...</option>
                    {preview.people.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.team}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className={styles.mappingHead}>
              <b>روزهای قابل ورود</b>
              <small>با برداشتن تیک، آن تاریخ در تقویم فعلی دست‌نخورده باقی می‌ماند.</small>
            </div>
            <div className={styles.days}>
              {preview.days.map((day, i) => (
                <label key={day.date + ":" + i} className={styles.dayRow} data-issue={day.issues.length ? "true" : undefined}>
                  <input className="cb" type="checkbox" disabled={day.issues.length > 0} checked={checked.has(day.date) && !day.issues.length}
                    onChange={(e) => setEnabled((values) => e.target.checked ? [...values, day.date] : values.filter((date) => date !== day.date))} />
                  <span className={styles.date}>{formatDate(day.date)}</span>
                  <span className={styles.dayCount}>{faNum(day.entries.length)} نفر · {day.entries.map((x) => SHIFT_LABELS[x.shiftType]).filter((x, j, arr) => arr.indexOf(x) === j).join("، ")}</span>
                  {day.holidayNote !== null && <b className={styles.holiday}>تعطیلی مرکز</b>}
                  {day.issues.length > 0 && <span className={styles.issue} title={day.issues.join(" | ")}>{day.issues.join("؛ ")}</span>}
                </label>
              ))}
            </div>
            {!!unresolved.length && <p className={styles.error}>نام‌های تطبیق‌داده‌نشده در روزهای انتخابی: {unresolved.join("، ")}</p>}
            {!!collisions.length && <p className={styles.error}>یک کارشناس در چند وضعیت یک روز انتخاب شده: {collisions.map(formatDate).join("، ")}</p>}
          </>
        )}
      </div>
      <div className={styles.foot}>
        {done && <span>ثبت انجام شد: {faNum(done.importedDays)} روز</span>}
        <button className="btn btn-ghost" type="button" onClick={onClose}>بستن</button>
        <button className="btn btn-primary" type="button" onClick={save} disabled={busy || !preview || !selected.length || unresolved.length > 0 || collisions.length > 0}>
          {busy && preview ? "در حال ذخیره..." : `ثبت ${faNum(selected.length)} روز در تقویم`}
        </button>
      </div>
    </Dialog>
  );
}
