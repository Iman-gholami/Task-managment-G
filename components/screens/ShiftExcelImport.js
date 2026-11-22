"use client";

import { useI18n as useShiftI18n } from "@/components/I18nProvider";

import { useEffect, useMemo, useState } from "react";
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
  const [conflictCheck, setConflictCheck] = useState({ key: "", pending: false, conflicts: [], error: "" });

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
  const preparedDays = useMemo(() => {
    if (!selected.length || unresolved.length || collisions.length) return [];
    return selected.map((day) => ({
      date: day.date,
      assignments: Object.fromEntries(SHIFT_TYPES.map((key) =>
        [key, day.entries.filter((entry) => entry.shiftType === key).map((entry) => mapping[entry.name])])
      ),
      holidayNote: day.holidayNote,
    }));
  }, [selected, mapping, unresolved, collisions]);
  const checkKey = preparedDays.length ? JSON.stringify(preparedDays) : "";
  const currentCheck = checkKey && conflictCheck.key === checkKey ? conflictCheck : null;
  const protectedConflicts = currentCheck?.conflicts ?? [];
  const protectedDates = new Set(protectedConflicts.map((conflict) => conflict.date));
  const checking = !!checkKey && (!currentCheck || currentCheck.pending);
  const canSave = !busy && !!currentCheck && !currentCheck.pending && !currentCheck.error &&
    protectedConflicts.length === 0 && preparedDays.length > 0;

  useEffect(() => {
    if (!checkKey) return;
    const controller = new AbortController();
    setConflictCheck({ key: checkKey, pending: true, conflicts: [], error: "" });
    (async () => {
      try {
        const response = await fetch("/api/shift/schedule/import", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days: preparedDays }), signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Conflict check failed.");
        if (!controller.signal.aborted) {
          setConflictCheck({ key: checkKey, pending: false, conflicts: result.conflicts ?? [], error: "" });
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setConflictCheck({ key: checkKey, pending: false, conflicts: [], error: cause.message });
        }
      }
    })();
    return () => controller.abort();
  }, [checkKey, preparedDays]);

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
    if (!canSave) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/shift/schedule/import", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: preparedDays }),
      });
      const result = await response.json();
      if (result.conflicts?.length) {
        setConflictCheck({ key: checkKey, pending: false, conflicts: result.conflicts, error: "" });
      }
      if (!response.ok) throw new Error(result.error || "ثبت برنامه شیفت ناموفق بود.");
      setDone(result);
      onImported(preparedDays[0].date, result);
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
          <span>{locale === "fa"
            ? "قالب‌های قدیمی و جدید اکسل پشتیبانی می‌شوند؛ در قالب جدید، شیفت شب هم وارد می‌شود و «تعطیل شیفت» همان فرد به‌معنای نداشتن شیفت روز است."
            : "Both Excel roster layouts are supported. In the newer layout, night shifts are imported and the same person's daytime-off marker is ignored."}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={upload} disabled={busy || !files.length}>
            <Icon name="search" /> {__shiftTr(busy && !preview ? "در حال خواندن..." : "بررسی و پیش‌نمایش")}
          </button>
        </div>
        {error && <p className={styles.error} role="alert">{message(error)}</p>}
        {preview && (
          <>
            <div className={styles.summary}>
              <b>{faNum(preview.days.length)}{" " + __shiftTr("روز شناسایی شد") + ""}</b>
              <span>{faNum(selected.length - protectedDates.size)}{" " + __shiftTr("روز آماده ثبت") + ""}</span>
              <span>{faNum(preview.days.filter((day) => day.issues.length).length)}{" " + __shiftTr("روز دارای تداخل") + ""}</span>
              <span>{faNum(preview.days.filter((day) => day.holidayNote !== null).length)}{" " + __shiftTr("تعطیلی مرکز") + ""}</span>
            </div>
            <p className={styles.warning}>{locale === "fa"
              ? "ورود اکسل، برنامه روزهای انتخاب‌شده را جایگزین می‌کند. شیفت‌های دارای گزارش فعالیت محافظت می‌شوند؛ در صورت تداخل، تاریخ‌های مربوط را از انتخاب خارج کنید."
              : "Excel replaces the selected dates' rosters. Shifts with recorded activity are protected. Deselect conflicting dates to continue."}</p>
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
            {checking && <p className={styles.checkState} role="status">{locale === "fa" ? "در حال بررسی تداخل با گزارش‌های ثبت‌شده..." : "Checking against existing shift activity..."}</p>}
            {currentCheck?.error && <p className={styles.error} role="alert">{locale === "fa"
              ? "بررسی تداخل انجام نشد؛ اتصال را بررسی کنید و دوباره تلاش کنید."
              : "Could not check conflicts. Check your connection and try again."} <span dir="auto">{message(currentCheck.error)}</span></p>}
            {!!protectedConflicts.length && (
              <section className={styles.conflictPanel} aria-label={locale === "fa" ? "تداخل با فعالیت‌های ثبت‌شده" : "Conflicts with recorded activity"}>
                <div className={styles.conflictHead}>
                  <div>
                    <b>{locale === "fa" ? `${faNum(protectedDates.size)} تاریخ دارای گزارش ثبت‌شده` : `${faNum(protectedDates.size)} dates have recorded activity`}</b>
                    <p>{locale === "fa"
                      ? "تغییر یا حذف شیفت این افراد مجاز نیست. با کنار گذاشتن این تاریخ‌ها، بقیه روزها وارد می‌شوند."
                      : "These assignments cannot be changed or removed. Skip these dates to import the rest."}</p>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm"
                    disabled={busy} onClick={() => { setEnabled((dates) => dates.filter((date) => !protectedDates.has(date))); setError(""); }}>
                    {locale === "fa" ? "کنار گذاشتن تاریخ‌های متداخل" : "Skip conflicting dates"}
                  </button>
                </div>
                <ul className={styles.conflictRows}>
                  {protectedConflicts.map((conflict) => (
                    <li key={conflict.date + ":" + conflict.userId}>
                      <strong>{formatDate(conflict.date)}</strong>
                      <span>{conflict.name}</span>
                      <span>{locale === "fa" ? "فعلی: " : "Current: "}
                        {__shiftTr(SHIFT_LABELS[conflict.currentType] ?? conflict.currentType)}
                        {" · "}{locale === "fa" ? "در اکسل: " : "Excel: "}
                        {conflict.requestedType
                          ? __shiftTr(SHIFT_LABELS[conflict.requestedType] ?? conflict.requestedType)
                          : locale === "fa" ? "حذف از برنامه" : "Remove from roster"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
      <div className={styles.foot}>
        {done && <span>{"" + __shiftTr("ثبت انجام شد:") + " "}{faNum(done.importedDays)}{" " + __shiftTr("روز") + ""}</span>}
        <button className="btn btn-ghost" type="button" onClick={onClose}>{"" + __shiftTr("بستن") + ""}</button>
        <button className="btn btn-primary" type="button" onClick={save} disabled={!canSave}>
          {busy && preview ? __shiftTr("در حال ذخیره...") : locale === "fa" ? `ثبت ${faNum(selected.length)} روز در تقویم` : `Import ${faNum(selected.length)} days to calendar`}
        </button>
      </div>
    </Dialog>
  );
}
