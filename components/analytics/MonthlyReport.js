"use client";

import { useMemo, useState } from "react";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { useI18n } from "@/components/I18nProvider";
import { Drawer } from "@/components/analytics/ui";
import Icon from "@/components/ui/Icon";
import { addDays, jalaliMonthBounds, jalaliMonthKey, jMonthStart } from "@/lib/analytics/calendar";
import { GROUPS, GROUP_BY_KEY, LEVELS } from "@/lib/analytics/labels";
import { isManager } from "@/lib/roles";

const normalizeMonth = (value) => value.trim().replace(/[۰-۹٠-٩]/g, (ch) => String(ch.charCodeAt(0) - (ch.charCodeAt(0) >= 1776 ? 1776 : 1632))).replaceAll("/", "-");

export default function MonthlyReportButton({ personId }) {
  const analytics = useAnalytics();
  const [open, setOpen] = useState(false);
  if (!isManager(analytics.me)) return null;
  const demo = analytics.demo || analytics.filters.demo === "1";
  return <>
    <button type="button" className="btn btn-secondary" disabled={demo || !analytics.view} onClick={() => setOpen(true)} data-tooltip={demo ? (analytics.locale === "fa" ? "برای گزارش ماهانه، داده واقعی را نمایش دهید" : "Switch to real data for monthly reports") : undefined} data-testid="monthly-report-button"><Icon name="report" />{analytics.locale === "fa" ? "گزارش ماهانه" : "Monthly report"}</button>
    {open && <MonthlyReportDrawer analytics={analytics} personId={personId} onClose={() => setOpen(false)} />}
  </>;
}
function MonthlyReportDrawer({ analytics, personId, onClose }) {
  const fa = analytics.locale === "fa", { team: teamText } = useI18n();
  const [monthText, setMonthText] = useState(() => jalaliMonthKey(addDays(jMonthStart(analytics.today), -1)));
  const [team, setTeam] = useState(() => analytics.filters.team || (analytics.facts.scope.kind === "soc" ? "soc" : ""));
  const [level, setLevel] = useState(() => analytics.filters.team === "soc" || analytics.facts.scope.kind === "soc" ? analytics.filters.level : "");
  const [person, setPerson] = useState(() => analytics.view.people.some((p) => p.id === personId) ? personId : "");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const month = normalizeMonth(monthText), bounds = useMemo(() => jalaliMonthBounds(month), [month]);
  const valid = !!bounds && bounds.from <= analytics.today;
  const groups = GROUPS.filter((group) => analytics.facts.people.some((p) => p.group === group.name)), groupName = GROUP_BY_KEY[team]?.name;
  const people = analytics.facts.people.filter((p) => (!groupName || p.group === groupName) && (!level || team !== "soc" || p.level === level) && (!analytics.filters.province || p.province === analytics.filters.province)).slice().sort((a,b) => a.name.localeCompare(b.name, fa ? "fa" : "en"));
  const query = new URLSearchParams({ month, lang: analytics.locale });
  if (team) query.set("team", team);
  if (team === "soc" && level) query.set("level", level);
  if (analytics.filters.province) query.set("province", analytics.filters.province);
  if (person) query.set("person", person);
  const url = (format) => `/api/analytics/monthly-report?${query}&format=${format}`;
  async function download() {
    if (!valid || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(url("zip"), { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 403 ? (fa ? "دسترسی شما برای این گزارش کافی نیست." : "You no longer have access to this report.") : (fa ? "گزارش آماده نشد؛ دوباره تلاش کنید." : "The report could not be prepared. Try again."));
      const file = await response.blob(), objectUrl = URL.createObjectURL(file), link = document.createElement("a");
      link.href = objectUrl; link.download = `Sentinel_Monthly_${month}.zip`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (failure) { setError(failure.message || (fa ? "اتصال برقرار نشد؛ دوباره تلاش کنید." : "Connection failed. Try again.")); }
    finally { setBusy(false); }
  }
  return <Drawer title={fa ? "گزارش ماهانه" : "Monthly report"} subtitle={fa ? "ماه، تیم و در صورت نیاز یک نفر را انتخاب کنید؛ هر دو فایل از همان داده ساخته می‌شوند." : "Choose a month, team and optionally one person. Both files use the same data."} onClose={onClose}
    footer={<>{valid && <a className="btn btn-ghost" href={url("html")} target="_blank" rel="noopener noreferrer">{fa ? "نمایش HTML" : "Preview HTML"}</a>}<span className="spacer" /><button type="button" className="btn btn-primary" disabled={!valid || busy} onClick={download} aria-busy={busy} data-testid="monthly-report-download"><Icon name="download" />{busy ? (fa ? "در حال ساخت…" : "Preparing…") : (fa ? "دانلود Excel و HTML" : "Download Excel and HTML")}</button></>}>
    <div className="stack">
      <div className="field"><label htmlFor="monthly-report-month">{fa ? "ماه شمسی" : "Jalali month"}</label><input id="monthly-report-month" className="input" dir="ltr" inputMode="numeric" value={monthText} onChange={(event) => { setMonthText(event.target.value); setError(""); }} placeholder="1405-07" aria-invalid={!valid} aria-describedby="monthly-report-month-help" data-testid="monthly-report-month" /><small id="monthly-report-month-help" className={valid ? "muted" : "danger"}>{valid ? (fa ? "قالب: سال-ماه، برای نمونه ۱۴۰۵-۰۷" : "Format: year-month, for example 1405-07") : (fa ? "ماه معتبر وارد کنید؛ ماه آینده قابل انتخاب نیست." : "Enter a valid month that is not in the future.")}</small></div>
      <div className="field"><label htmlFor="monthly-report-team">{fa ? "تیم" : "Team"}</label><select id="monthly-report-team" className="input" value={team} onChange={(event) => { setTeam(event.target.value); setLevel(""); setPerson(""); }}>{analytics.facts.scope.kind !== "soc" && <option value="">{fa ? "همه تیم‌ها" : "All teams"}</option>}{groups.map((group) => <option key={group.key} value={group.key}>{teamText(group.name)}</option>)}</select></div>
      {team === "soc" && <div className="field"><label htmlFor="monthly-report-level">{fa ? "لایه SOC" : "SOC level"}</label><select id="monthly-report-level" className="input" value={level} onChange={(event) => { setLevel(event.target.value); setPerson(""); }}><option value="">{fa ? "همه لایه‌ها" : "All levels"}</option>{LEVELS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>}
      <div className="field"><label htmlFor="monthly-report-person">{fa ? "افراد" : "People"}</label><select id="monthly-report-person" className="input" value={person} onChange={(event) => setPerson(event.target.value)}><option value="">{fa ? "همه افراد در دامنه انتخاب‌شده" : "Everyone in the selected scope"}</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.team}</option>)}</select></div>
      <div className="an-note" role="note"><Icon name="info" /><span>{fa ? "فایل ZIP شامل یک Excel و یک HTML مستقل است." : "The ZIP contains one Excel workbook and one standalone HTML file."}{analytics.filters.province && (fa ? ` فیلتر استان صفحه نیز اعمال می‌شود: ${analytics.filters.province}.` : ` The page's province filter also applies: ${analytics.filters.province}.`)}</span></div>
      {error && <div className="an-inline-error" role="alert">{error}</div>}
    </div>
  </Drawer>;
}
