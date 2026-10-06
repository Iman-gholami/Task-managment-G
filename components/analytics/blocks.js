"use client";

import Link from "next/link";
import { useState } from "react";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import Icon from "@/components/ui/Icon";
import { LEVELS as ALERT_LEVELS } from "@/lib/analytics/alerts";
import { faDigits } from "@/lib/analytics/calendar";

const LEVEL_ICON = { critical: "alert", warning: "flag", info: "info" };

/** Answers "is everything all right?" in one sentence, from the alerts. */
export function StatusBanner({ status, compact }) {
  const { href } = useAnalytics();
  const text = status.level === "ok"
    ? "هشدار بحرانی یا مورد نیازمند توجهی وجود ندارد."
    : [status.critical ? `${faDigits(status.critical)} مورد بحرانی` : null, status.warning ? `${faDigits(status.warning)} مورد نیازمند توجه` : null].filter(Boolean).join(" و ") + `؛ مهم‌ترین: ${status.lead.title}.`;
  return (
    <section className="an-status" data-level={status.level} aria-label="وضعیت کلی" data-testid="status">
      <span className="an-status-icon" aria-hidden="true"><Icon name={status.level === "ok" ? "checkCircle" : status.level === "critical" ? "alert" : "flag"} /></span>
      <div>
        <b>وضعیت: {status.fa}</b>
        <p>{text}</p>
      </div>
      {!compact && status.level !== "ok" && <Link className="btn btn-secondary btn-sm an-no-print" href={href("/analytics/alerts")}>همه هشدارها<Icon name="left" /></Link>}
    </section>
  );
}

/** Link target for an alert item; demo tasks have no task page. */
function useItemHref() {
  const { href, demo } = useAnalytics();
  return (item) => {
    if (!item.href) return null;
    if (item.kind === "task") return demo ? null : item.href;
    return href(item.href);
  };
}

/** One alert: level, title, detail and its records (first few, then "show all"). */
export function AlertCard({ alert, open: startOpen = false, limit = 5 }) {
  const { href } = useAnalytics();
  const itemHref = useItemHref();
  const [open, setOpen] = useState(startOpen);
  const [all, setAll] = useState(false);
  const items = all ? alert.items : alert.items.slice(0, limit);
  return (
    <article className="an-alert" data-level={alert.level}>
      <button type="button" className="an-alert-head" aria-expanded={open} onClick={() => setOpen(!open)} disabled={!alert.items.length && !alert.link}>
        <span className="an-alert-icon" aria-hidden="true"><Icon name={LEVEL_ICON[alert.level]} /></span>
        <span className="an-alert-text">
          <b>{alert.title}</b>
          {alert.detail && <span>{alert.detail}</span>}
        </span>
        <span className={`badge ${alert.level === "critical" ? "danger" : alert.level === "warning" ? "warning" : "info"}`}>{ALERT_LEVELS[alert.level].fa}</span>
        {(alert.items.length > 0 || alert.link) && <Icon name={open ? "up" : "down"} />}
      </button>
      {open && (
        <div className="an-alert-body">
          {items.length > 0 && (
            <ul>
              {items.map((it) => {
                const to = itemHref(it);
                return (
                  <li key={`${it.kind}-${it.id}`}>
                    {to ? <Link href={to}>{it.label}</Link> : <span>{it.label}</span>}
                    <span className="muted">{it.sub}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="row">
            {alert.items.length > limit && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAll(!all)}>{all ? "نمایش کمتر" : `نمایش همه (${faDigits(alert.items.length)})`}</button>}
            {alert.link && <Link className="btn btn-ghost btn-sm" href={href(alert.link.path, alert.link.params)}>بررسی بیشتر<Icon name="left" /></Link>}
          </div>
        </div>
      )}
    </article>
  );
}

export function AlertList({ alerts, limit, emptyText = "موردی برای پیگیری نیست." }) {
  const shown = limit ? alerts.slice(0, limit) : alerts;
  if (!alerts.length) {
    return <div className="notice"><span className="glyph" aria-hidden="true"><Icon name="checkCircle" /></span><span>{emptyText}</span></div>;
  }
  return <div className="an-alerts">{shown.map((a) => <AlertCard key={a.id} alert={a} />)}</div>;
}

const TONE_ICON = { up: "arrowUp", down: "arrowDown", neutral: "sparkle" };

/** Automatic insights: one sentence each, with a link to the evidence. */
export function InsightList({ insights, limit }) {
  const { href } = useAnalytics();
  const shown = limit ? insights.slice(0, limit) : insights;
  if (!insights.length) {
    return <div className="notice neutral"><span className="glyph" aria-hidden="true"><Icon name="info" /></span><span>در این دوره تغییر یا الگوی قابل توجهی دیده نشد.</span></div>;
  }
  return (
    <ul className="an-insights">
      {shown.map((i) => (
        <li key={i.id} data-attention={i.attention || undefined}>
          <span className="an-insight-icon" aria-hidden="true"><Icon name={TONE_ICON[i.tone] ?? "sparkle"} /></span>
          <p>{i.text}</p>
          {i.link && <Link className="an-insight-link an-no-print" href={href(i.link.path, i.link.params)} aria-label={`شواهد: ${i.text}`}><Icon name="left" /></Link>}
        </li>
      ))}
    </ul>
  );
}

/** In-page breadcrumb for drill-down (department › team › level › person). items: [{ label, href? | onClick? }] */
export function Trail({ items }) {
  return (
    <nav className="an-trail an-no-print" aria-label="مسیر">
      {items.map((it, i) => (
        <span key={i}>
          {i > 0 && <Icon name="left" size="sm" />}
          {it.href ? <Link href={it.href}>{it.label}</Link> : it.onClick ? <button type="button" onClick={it.onClick}>{it.label}</button> : <b aria-current="page">{it.label}</b>}
        </span>
      ))}
    </nav>
  );
}

/** Coloured key for a categorical series (a swatch beside the text; the text stays in ink). */
export const Key = ({ color, children }) => <span className="an-key"><i style={{ background: color }} />{children}</span>;
