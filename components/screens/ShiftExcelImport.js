"use client";

import { useI18n as useShiftI18n } from "@/components/I18nProvider";

import { useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import Icon from "@/components/ui/Icon";
import { localDate } from "@/lib/analytics/calendar";
import { shiftImportMessage } from "@/lib/i18n/shift-import-copy";
import styles from "./ShiftExcelImport.module.css";

const SHIFT_TYPES = ["morning", "evening", "night", "off", "leave"];
const SHIFT_LABELS = { morning: "عادی", evening: "تا ۲۰", night: "شب", off: "تعطیل شیفت", leave: "مرخصی" };
export default function ShiftExcelImport({ onClose, onImported }) {
  const { t: __shiftTr, locale, number: faNum, team: teamText } = useShiftI18n();
  const formatDate = (date) => localDate(date, locale);
  const message = (value) => shiftImportMessage(value, locale);
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
    <Dialog label={__shiftTr("ورود شیفت از اکسل")} title={__shiftTr("ورود برنامه شیفت از اکسل")}
      description={__shiftTr("فایل‌های ماهانه را آپلود کنید؛ قبل از ذخیره، نام کارشناس‌ها، تداخل‌ها و تاریخ‌ها بررسی می‌شوند.")}
      onClose={onClose} width={750} className={styles.dialog}>
      <div className={`modal-body ${styles.body}`}>
        <div className={styles.uploadArea}>
          <label htmlFor="shift-excel-files">{"" + __shiftTr("فایل‌های Excel (.xlsx)") + ""}</label>
          <input id="shift-excel-files" className="input" type="file" accept=".xlsx" multiple disabled={busy}
            onChange={(e) => { setFiles([...e.target.files]); setPreview(null); setEnabled([]); setDone(null); setError(""); }} />
          <span>{"" + __shiftTr("می‌توانید چند ماه را هم‌زمان انتخاب کنید؛ ستون‌های «عادی»، «تا ۲۰»، «تعطیل شیفت» و «مرخصی» خوانده می‌شوند.") + ""}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={upload} disabled={busy || !files.length}>
            <Icon name="search" /> {__shiftTr(busy && !preview ? "در حال خواندن..." : "بررسی و پیش‌نمایش")}
          </button>
        </div>
        {error && <p className={styles.error} role="alert">{message(error)}</p>}
        {preview && (
          <>
            <div className={styles.summary}>
              <b>{faNum(preview.days.length)}{" " + __shiftTr("روز شناسایی شد") + ""}</b>
              <span>{faNum(selected.length)}{" " + __shiftTr("روز آماده ثبت") + ""}</span>
              <span>{faNum(preview.days.filter((day) => day.issues.length).length)}{" " + __shiftTr("روز دارای تداخل") + ""}</span>
              <span>{faNum(preview.days.filter((day) => day.holidayNote !== null).length)}{" " + __shiftTr("تعطیلی مرکز") + ""}</span>
            </div>
            <p className={styles.warning}>{"" + __shiftTr("ثبت، برنامه فعلی روزهای انتخاب‌شده را جایگزین می‌کند. روزهای دارای تداخل انتخاب نشده‌اند. اگر برای شیفتی فعالیت ثبت شده باشد، هیچ روزی از این نوبت وارد نمی‌شود.") + ""}</p>
            <details className={styles.warningDetails}>
              <summary>{"" + __shiftTr("توضیحات و هشدارهای خواندن فایل (") + ""}{faNum(preview.warnings.length)})</summary>
              <ul>{preview.warnings.map((warning, i) => <li key={i}>{message(warning)}</li>)}</ul>
            </details>

            <div className={styles.mappingHead}>
              <b>{"" + __shiftTr("تطبیق نام‌های اکسل با کاربران سامانه") + ""}</b>
              <small>{"" + __shiftTr("برای هر اسم، شخص صحیح را انتخاب کنید؛ نام‌های ناشناخته خودکار حدس زده نمی‌شوند.") + ""}</small>
            </div>
            <div className={styles.peopleGrid}>
              {preview.match.map((item) => (
                <label key={item.name} className={styles.personMap}>
                  <span>{item.name}</span>
                  <select className="input input-sm" value={mapping[item.name] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [item.name]: e.target.value }))}>
                    <option value="">{"" + __shiftTr("انتخاب کارشناس...") + ""}</option>
                    {preview.people.map((person) => <option key={person.id} value={person.id}>{person.name} · {teamText(person.team)}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className={styles.mappingHead}>
              <b>{"" + __shiftTr("روزهای قابل ورود") + ""}</b>
              <small>{"" + __shiftTr("با برداشتن تیک، آن تاریخ در تقویم فعلی دست‌نخورده باقی می‌ماند.") + ""}</small>
            </div>
            <div className={styles.days}>
              {preview.days.map((day, i) => (
                <label key={day.date + ":" + i} className={styles.dayRow} data-issue={day.issues.length ? "true" : undefined}>
                  <input className="cb" type="checkbox" disabled={day.issues.length > 0} checked={checked.has(day.date) && !day.issues.length}
                    onChange={(e) => setEnabled((values) => e.target.checked ? [...values, day.date] : values.filter((date) => date !== day.date))} />
                  <span className={styles.date}>{formatDate(day.date)}</span>
                  <span className={styles.dayCount}>{faNum(day.entries.length)}{" " + __shiftTr("نفر ·") + " "}{day.entries.map((x) => __shiftTr(SHIFT_LABELS[x.shiftType])).filter((x, j, arr) => arr.indexOf(x) === j).join(locale === "fa" ? "، " : ", ")}</span>
                  {day.holidayNote !== null && <b className={styles.holiday}>{"" + __shiftTr("تعطیلی مرکز") + ""}</b>}
                  {day.issues.length > 0 && <span className={styles.issue} title={day.issues.map(message).join(" | ")}>{day.issues.map(message).join(locale === "fa" ? "؛ " : "; ")}</span>}
                </label>
              ))}
            </div>
            {!!unresolved.length && <p className={styles.error}>{"" + __shiftTr("نام‌های تطبیق‌داده‌نشده در روزهای انتخابی:") + " "}{unresolved.join(locale === "fa" ? "، " : ", ")}</p>}
            {!!collisions.length && <p className={styles.error}>{"" + __shiftTr("یک کارشناس در چند وضعیت یک روز انتخاب شده:") + " "}{collisions.map(formatDate).join(locale === "fa" ? "، " : ", ")}</p>}
          </>
        )}
      </div>
      <div className={styles.foot}>
        {done && <span>{"" + __shiftTr("ثبت انجام شد:") + " "}{faNum(done.importedDays)}{" " + __shiftTr("روز") + ""}</span>}
        <button className="btn btn-ghost" type="button" onClick={onClose}>{"" + __shiftTr("بستن") + ""}</button>
        <button className="btn btn-primary" type="button" onClick={save} disabled={busy || !preview || !selected.length || unresolved.length > 0 || collisions.length > 0}>
          {busy && preview ? __shiftTr("در حال ذخیره...") : locale === "fa" ? `ثبت ${faNum(selected.length)} روز در تقویم` : `Import ${faNum(selected.length)} days to calendar`}
        </button>
      </div>
    </Dialog>
  );
}
