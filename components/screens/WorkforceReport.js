"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import useFetch from "@/components/useFetch";
import Dialog from "@/components/ui/Dialog";
import Icon from "@/components/ui/Icon";
import { Panel } from "@/components/ui/layout";
import { Metric, MetricGrid } from "@/components/ui/Metric";
import { EmptyState, ErrorState, Loading } from "@/components/ui/states";
import { Who } from "@/components/ui/indicators";
import { monthKeyLabel, periodChoices } from "@/lib/jalali";
import { COMPONENTS, PROFILE_FA, WEIGHTS, toneFor } from "@/lib/workforce";
import { tehranDate } from "@/lib/shifts";
import styles from "./WorkforceReport.module.css";

const TODAY = tehranDate();
const CHOICES = periodChoices(TODAY);
const TEAMS = ["SOC", "Design & Automation", "Threat Intelligence"];
const SCOPE = { all: "همه‌ی تیم‌ها", soc: "تحلیلگران SOC", self: "گزارش شخصی" };
const BADGE = { good: "success", fair: "info", warn: "warning", bad: "danger" };
const SCORES = [[1, "ضعیف"], [2, "نیاز به بهبود"], [3, "قابل قبول"], [4, "خوب"], [5, "عالی"]];

const FA = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
const none = (v) => v === null || v === undefined;
const num = (v) => (none(v) ? "—" : FA.format(v));
const pct = (v) => (none(v) ? "—" : `${FA.format(v)}٪`);
const mean = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
const total = (rows, f) => rows.reduce((s, r) => s + (f(r) || 0), 0);

function Score({ value, tone, level }) {
  if (none(value)) return <span className="muted" data-tooltip="داده‌ای برای محاسبه‌ی نمره نیست">—</span>;
  return <span className={`badge ${BADGE[tone]} ${styles.score}`} data-tooltip={level}>{FA.format(value)}</span>;
}

/** Workforce Performance (Persian): one row per person with an overall score, and the manager's monthly evaluation. */
export default function WorkforceReport() {
  const { me, toast } = useApp();
  const [choice, setChoice] = useState(`month:${CHOICES.months[0].key}`);
  const [range, setRange] = useState({ from: "", to: "" });
  const [team, setTeam] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [evaluating, setEvaluating] = useState(null);

  const custom = choice === "custom";
  const rangeOk = range.from && range.to && range.from <= range.to;
  const [period, key] = choice.split(":");
  const periodQs = custom ? (rangeOk ? `period=custom&from=${range.from}&to=${range.to}` : "") : `period=${period}&key=${key}`;
  const qs = [periodQs, team && `team=${encodeURIComponent(team)}`].filter(Boolean).join("&");
  const { data, loading, error, reload } = useFetch(custom && !rangeOk ? null : `/api/reports/workforce?${qs}`);

  const people = data?.people ?? [];
  const rows = people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const self = data?.scope === "self";
  const analysts = people.filter((p) => p.shift);
  const managers = people.filter((p) => p.mgr);
  const busy = loading && !data;

  return (
    <div className={`page ${styles.page}`} dir="rtl">
      <header className="page-head">
        <div className="page-head-main">
          <div>
            <h1>گزارش عملکرد نیروها</h1>
            <p className="page-meta">
              {data && <span>{data.period.label}</span>}
              {data && <span>{data.team ? `${SCOPE[data.scope]} · ${data.team}` : SCOPE[data.scope]}</span>}
              {data && !self && <span>{FA.format(people.length)} نفر</span>}
            </p>
          </div>
        </div>
        <div className="page-actions">
          <a className={`btn btn-primary ${custom && !rangeOk ? styles.disabled : ""}`} href={`/api/reports/workforce?${qs}&format=xlsx`} download data-testid="workforce-export" aria-disabled={(custom && !rangeOk) || undefined} data-tooltip="همه‌ی نیروها با جزئیات تسک‌ها، شیفت‌ها و ارزیابی‌ها، در یک فایل اکسل">
            <Icon name="download" />دریافت فایل اکسل
          </a>
        </div>
      </header>

      <div className="toolbar" role="search" aria-label="فیلترهای گزارش">
        <select className="input" style={{ width: 170 }} value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="دوره‌ی گزارش">
          <optgroup label="ماه">{CHOICES.months.map((m) => <option key={m.key} value={`month:${m.key}`}>{m.label}</option>)}</optgroup>
          <optgroup label="فصل">{CHOICES.seasons.map((s) => <option key={s.key} value={`season:${s.key}`}>{s.label}</option>)}</optgroup>
          <optgroup label="سال">{CHOICES.years.map((y) => <option key={y.key} value={`year:${y.key}`}>{y.label}</option>)}</optgroup>
          <option value="custom">بازه‌ی دلخواه…</option>
        </select>
        {custom && (
          <span className={styles.range}>
            <input type="date" className="input" value={range.from} max={range.to || undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} aria-label="از تاریخ" />
            <span className="muted">تا</span>
            <input type="date" className="input" value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} aria-label="تا تاریخ" />
          </span>
        )}
        {me.role === "security_manager" && (
          <select className={`input ${team ? "is-set" : ""}`} style={{ width: 190 }} value={team} onChange={(e) => setTeam(e.target.value)} aria-label="تیم">
            <option value="">همه‌ی تیم‌ها</option>
            {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {!self && <div className="search"><Icon name="search" /><input type="search" className="input" placeholder="جستجوی نام" aria-label="جستجوی نام" value={q} onChange={(e) => setQ(e.target.value)} /></div>}
      </div>

      {custom && !rangeOk ? (
        <div className="panel"><EmptyState compact icon="cal" title="بازه را انتخاب کنید">تاریخ شروع و پایان را وارد کنید؛ تاریخ شروع باید قبل از تاریخ پایان باشد.</EmptyState></div>
      ) : error ? (
        <div className="panel"><ErrorState error={error} title="دریافت گزارش ناموفق بود" onRetry={reload} /></div>
      ) : (
        <div className="stack-lg">
          <MetricGrid label="خلاصه">
            {self ? (
              <>
                <Metric label="نمره‌ی کلی" icon="perf" value={busy ? "" : people[0]?.score === null || !people[0] ? "—" : `${num(people[0].score)} از ۱۰۰`} loading={busy} foot={people[0]?.level || "از روی تسک‌ها، شیفت‌ها و ارزیابی مدیر"} />
                <Metric label="تسک انجام‌شده" icon="checkCircle" value={num(people[0]?.completed ?? 0)} loading={busy} foot={`${num(people[0]?.hours ?? 0)} ساعت کار`} />
                <Metric label="تحویل به‌موقع" icon="clock" value={pct(people[0]?.onTimePct)} loading={busy} foot="تسک‌های موعددار" />
                {people[0]?.shift && <Metric label="انجام روتین شیفت" icon="shift" value={pct(people[0].shift.routinePct)} foot={`${num(people[0].shift.missing)} شیفت بدون گزارش`} />}
              </>
            ) : (
              <>
                <Metric label="میانگین نمره" icon="perf" value={busy ? "" : num(mean(people.filter((p) => !none(p.score)).map((p) => p.score)))} unit=" از ۱۰۰" loading={busy} foot={`${FA.format(people.length)} نفر در این گزارش`} />
                <Metric label="تسک انجام‌شده" icon="checkCircle" value={num(total(people, (p) => p.completed))} loading={busy} foot={`${num(Math.round(total(people, (p) => p.hours)))} ساعت کار`} />
                <Metric label="برگشت برای اصلاح" icon="review" value={num(total(people, (p) => p.returns))} loading={busy} foot="در این دوره" />
                <Metric label="عقب‌افتاده" icon="flag" value={num(total(people, (p) => p.overdueNow))} tone={total(people, (p) => p.overdueNow) ? "alert" : undefined} loading={busy} foot="تسک باز گذشته از موعد" />
                {(busy || analysts.length > 0) && <Metric label="انجام روتین شیفت" icon="shift" value={pct(mean(analysts.map((p) => p.shift.routinePct).filter((v) => !none(v))))} loading={busy} foot={`${num(total(analysts, (p) => p.shift.missing))} شیفت بدون گزارش`} />}
              </>
            )}
          </MetricGrid>

          {data?.evalMonth === null && data.canEvaluate.length > 0 && (
            <p className={styles.note}><Icon name="info" size="sm" />برای ثبت ارزیابی، یک ماه (نه فصل، سال یا بازه) را انتخاب کنید.</p>
          )}

          <Panel title={self ? "عملکرد من" : "نیروها"} meta={self ? null : "مرتب‌شده بر اساس تیم و نمره"}>
            {busy ? <Loading label="در حال دریافت گزارش" rows={6} /> : rows.length === 0 ? (
              <EmptyState compact icon="team" title={people.length ? "کسی با این نام پیدا نشد" : "کسی در این گزارش نیست"}>
                {people.length ? "عبارت جستجو را تغییر دهید." : "در این دوره فعالیتی ثبت نشده است."}
              </EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="dt">
                  <thead>
                    <tr>
                      <th scope="col">نام</th><th scope="col">تیم</th><th scope="col">نمره کلی</th>
                      <th scope="col" data-tooltip="تسک‌های تأییدشده در این دوره">تسک‌ها</th><th scope="col">کیفیت</th><th scope="col">به‌موقع</th><th scope="col">عقب‌افتاده</th>
                      <th scope="col" data-tooltip="شیفت‌هایی که Shift Log دارند، از شیفت‌های سپری‌شده">گزارش شیفت</th><th scope="col" data-tooltip="انجام فعالیت‌های روتین شیفت">روتین</th><th scope="col">نمره مدیر</th><th scope="col"><span className="sr-only">کارها</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const expanded = self || open === p.id;
                      const canEval = data.canEvaluate.includes(p.id);
                      return (
                        <Fragment key={p.id}>
                          <tr data-person={p.id} className={self ? "" : "is-link"} onClick={(e) => !self && !e.target.closest("button, a") && setOpen(expanded ? null : p.id)}>
                            <td className={`title ${styles.nameCell}`}>
                              <span className={styles.name}>
                                <Who id={p.id} />
                                {!p.active && <span className={`badge ${styles.inactive}`}>غیرفعال</span>}
                              </span>
                            </td>
                            <td className={styles.team}>{p.team}</td>
                            <td><Score value={p.score} tone={p.tone} level={p.level} /></td>
                            <td>{num(p.completed)}</td>
                            <td>{pct(p.qualityPct)}</td>
                            <td>{pct(p.onTimePct)}</td>
                            <td className={p.overdueNow ? styles.alert : ""}>{num(p.overdueNow)}</td>
                            <td>{p.shift ? `${num(p.shift.logged)} از ${num(p.shift.due)}` : <span className="muted">—</span>}</td>
                            <td>{p.shift ? pct(p.shift.routinePct) : <span className="muted">—</span>}</td>
                            <td>{none(p.evalScore) ? <span className="muted">—</span> : `${num(p.evalScore)} از ۵`}</td>
                            <td className="actions">
                              <span>
                                {canEval && (
                                  <button type="button" className="btn btn-ghost icon-btn btn-sm" disabled={!data.evalMonth} onClick={() => setEvaluating(p)} aria-label={`ارزیابی ${p.name}`} data-tooltip="ثبت نمره و نظر ماهانه">
                                    <Icon name="edit" />
                                  </button>
                                )}
                                {!self && (
                                  <button type="button" className="btn btn-ghost icon-btn btn-sm" aria-expanded={expanded} aria-label={`جزئیات ${p.name}`} data-tooltip="جزئیات" onClick={() => setOpen(expanded ? null : p.id)}>
                                    <Icon name={expanded ? "up" : "down"} size="sm" />
                                  </button>
                                )}
                              </span>
                            </td>
                          </tr>
                          {expanded && (
                            <tr className={styles.detailRow}>
                              <td colSpan={11}><Details person={p} self={self} /></td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {!self && data?.teams.length > 1 && (
            <Panel title="خلاصه‌ی تیم‌ها">
              <div className="table-wrap">
                <table className="dt">
                  <thead><tr><th scope="col">تیم</th><th scope="col">نفرات</th><th scope="col">میانگین نمره</th><th scope="col">تسک انجام‌شده</th><th scope="col">ساعت</th><th scope="col">به‌موقع</th><th scope="col">برگشت</th><th scope="col">عقب‌افتاده</th><th scope="col">شیفت</th><th scope="col">بدون گزارش</th><th scope="col">روتین</th></tr></thead>
                  <tbody>
                    {data.teams.map((t) => (
                      <tr key={t.team} className={t.total ? styles.totalRow : ""}>
                        <td className="title">{t.total ? "کل" : t.team}</td><td>{num(t.people)}</td>
                        <td><Score value={t.avgScore} tone={toneFor(t.avgScore)} /></td>
                        <td>{num(t.completed)}</td><td>{num(t.hours)}</td><td>{pct(t.onTimePct)}</td><td>{num(t.returns)}</td><td>{num(t.overdueNow)}</td>
                        <td>{num(t.shifts)}</td><td>{num(t.missing)}</td><td>{pct(t.routinePct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {!self && managers.length > 0 && (
            <Panel title="مدیران" meta="بررسی تسک‌ها و عملکرد تیم">
              <div className="table-wrap">
                <table className="dt">
                  <thead><tr><th scope="col">نام</th><th scope="col">نمره کلی</th><th scope="col">تسک بررسی‌شده</th><th scope="col">میانگین زمان بررسی</th><th scope="col">منتظر بررسی (اکنون)</th><th scope="col">تسک واگذارشده</th><th scope="col">میانگین نمره تحلیلگران</th></tr></thead>
                  <tbody>
                    {managers.map((p) => (
                      <tr key={p.id}>
                        <td className="title"><Who id={p.id} /></td>
                        <td><Score value={p.score} tone={p.tone} level={p.level} /></td>
                        <td>{num(p.mgr.reviewed)}</td>
                        <td>{none(p.mgr.reviewHours) ? "—" : `${num(p.mgr.reviewHours)} ساعت`}</td>
                        <td className={p.mgr.pendingNow ? styles.alert : ""}>{num(p.mgr.pendingNow)}</td>
                        <td>{num(p.mgr.assigned)}</td>
                        <td>{num(p.mgr.teamScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <details className={`panel ${styles.guide}`}>
            <summary>نمره‌ی کلی چطور حساب می‌شود؟</summary>
            <div className={styles.guideBody}>
              <p>هر بخش از ۰ تا ۱۰۰ سنجیده می‌شود و نمره‌ی کلی میانگین وزنی بخش‌هاست. اگر برای بخشی داده‌ای نباشد (مثلاً تسکی تأیید نشده)، وزنش بین بقیه پخش می‌شود. سطح‌ها: ۸۵ به بالا عالی، ۷۰ تا ۸۴ خوب، ۵۰ تا ۶۹ قابل قبول، زیر ۵۰ نیاز به بهبود.</p>
              <div className={styles.guideGrid}>
                {Object.entries(WEIGHTS).map(([profile, w]) => (
                  <div key={profile}>
                    <h3>{PROFILE_FA[profile]}</h3>
                    <ul>{Object.entries(w).map(([k, weight]) => <li key={k} data-tooltip={COMPONENTS[k].how}><span>{COMPONENTS[k].label}</span><b>{FA.format(weight)}٪</b></li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      )}

      {evaluating && (
        <EvaluationDialog
          person={evaluating}
          month={data.evalMonth}
          mine={evaluating.evaluations.find((e) => e.by === me.id && e.month === data.evalMonth)}
          onClose={() => setEvaluating(null)}
          onSaved={(message) => { setEvaluating(null); toast(message); reload(); }}
          onError={(message) => toast(message, "error")}
        />
      )}
    </div>
  );
}

/** One person's figures for the period, score breakdown and the manager's evaluations. */
function Details({ person: p, self }) {
  const weights = WEIGHTS[p.profile];
  const figures = [
    ["تسک انجام‌شده", num(p.completed)], ["ساعت کار تسک‌ها", num(p.hours)], ["میانگین پیچیدگی (۱ تا ۴)", num(p.avgCx)],
    ["تسک دیرتحویل", num(p.late)], ["برگشت برای اصلاح", num(p.returns)], ["میانگین زمان انجام", none(p.cycleDays) ? "—" : `${num(p.cycleDays)} روز`],
    ["تسک باز (اکنون)", num(p.openNow)], ["مسدود (اکنون)", num(p.blockedNow)],
    ...(p.shift ? [
      ["شیفت‌ها", num(p.shift.scheduled)], ["ساعت شیفت", num(p.shift.hours)],
      ["شیفت صبح", num(p.shift.morning)], ["شیفت تا ۸ شب", num(p.shift.evening)], ["شیفت شب", num(p.shift.night)],
      ["شیفت بدون گزارش", num(p.shift.missing)], ["IOC ثبت‌شده", num(p.shift.iocs)], ["تیکت", num(p.shift.tickets)],
      ["گزارش ترافیک", num(p.shift.reports)], ["Issue گزارش‌شده", num(p.shift.issues)],
    ] : []),
    ...(p.mgr ? [
      ["تسک بررسی‌شده", num(p.mgr.reviewed)], ["برگشت داده‌شده", num(p.mgr.returned)], ["میانگین زمان بررسی", none(p.mgr.reviewHours) ? "—" : `${num(p.mgr.reviewHours)} ساعت`],
      ["منتظر بررسی (اکنون)", num(p.mgr.pendingNow)], ["تسک واگذارشده", num(p.mgr.assigned)], ["میانگین نمره تحلیلگران", num(p.mgr.teamScore)],
    ] : []),
  ];
  return (
    <div className={styles.details}>
      <section>
        <h3>آمار این دوره</h3>
        <ul className={styles.parts}>{figures.map(([label, value]) => <li key={label}><span>{label}</span><b>{value}</b></li>)}</ul>
      </section>
      <section>
        <h3>اجزای نمره <span className="muted">({PROFILE_FA[p.profile]})</span></h3>
        <ul className={styles.parts}>
          {Object.entries(weights).map(([k, w]) => (
            <li key={k} data-tooltip={COMPONENTS[k].how}>
              <span>{COMPONENTS[k].label}</span>
              <span className="muted">وزن {FA.format(w)}٪</span>
              <b>{none(p.parts?.[k]) ? "—" : FA.format(Math.round(p.parts[k]))}</b>
            </li>
          ))}
        </ul>
        {!self && <Link className="btn btn-ghost btn-sm" href={`/performance/employees/${p.id}`}>صفحه‌ی عملکرد<Icon name="left" size="sm" /></Link>}
      </section>
      <section>
        <h3>ارزیابی مدیر</h3>
        {p.evaluations.length === 0 ? <p className="muted">برای این دوره ارزیابی‌ای ثبت نشده است.</p> : (
          <ul className={styles.evals}>
            {p.evaluations.map((e) => (
              <li key={`${e.by}-${e.month}`}>
                <div><b>{e.byName}</b><span className="muted">{e.monthLabel}</span><span className={`badge ${e.score >= 4 ? "success" : e.score === 3 ? "info" : "warning"}`}>{FA.format(e.score)} از ۵</span></div>
                {e.comment && <p>{e.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EvaluationDialog({ person, month, mine, onClose, onSaved, onError }) {
  const [score, setScore] = useState(mine?.score ?? 0);
  const [comment, setComment] = useState(mine?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);

  const save = async () => {
    if (!score) return setMissing(true);
    setSaving(true);
    try {
      await api("/api/evaluations", { method: "PUT", body: { userId: person.id, month, score, comment } });
      onSaved(`ارزیابی ${person.name} ذخیره شد.`);
    } catch (e) {
      onError(e.message);
      setSaving(false);
    }
  };
  const remove = async () => {
    setSaving(true);
    try {
      await api(`/api/evaluations?userId=${encodeURIComponent(person.id)}&month=${month}`, { method: "DELETE" });
      onSaved(`ارزیابی ${person.name} حذف شد.`);
    } catch (e) {
      onError(e.message);
      setSaving(false);
    }
  };

  return (
    <Dialog label="ارزیابی ماهانه" title={`ارزیابی ${person.name} · ${monthKeyLabel(month)}`} description="نمره و نظر شما در گزارش و فایل اکسل همین ماه می‌آید و خود فرد هم آن را می‌بیند." onClose={onClose} dismissible={false}>
      <div className={`modal-body ${styles.evalBody}`} dir="rtl">
        <fieldset className={styles.scorePick}>
          <legend>نمره (از ۵)</legend>
          <div role="radiogroup" aria-label="نمره">
            {SCORES.map(([v, label]) => (
              <button key={v} type="button" role="radio" aria-checked={score === v} aria-label={`${FA.format(v)} — ${label}`} className={score === v ? styles.picked : ""} onClick={() => { setScore(v); setMissing(false); }}>
                <b>{FA.format(v)}</b><span>{label}</span>
              </button>
            ))}
          </div>
          {missing && <span className="field-error" role="alert"><Icon name="alert" />یک نمره انتخاب کنید.</span>}
        </fieldset>
        <div className="field">
          <label htmlFor="eval-comment">نظر مدیر</label>
          <textarea id="eval-comment" className="textarea" rows={4} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="مثلاً: در شیفت‌های شب دقیق و منظم بود؛ گزارش ترافیک را دیر ثبت می‌کند." />
        </div>
      </div>
      <div className="modal-foot" dir="rtl">
        {mine && <button type="button" className="btn btn-ghost danger lead" onClick={remove} disabled={saving}>حذف ارزیابی</button>}
        <button type="button" className="btn btn-ghost" onClick={onClose}>انصراف</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving} aria-busy={saving || undefined}>ذخیره</button>
      </div>
    </Dialog>
  );
}
