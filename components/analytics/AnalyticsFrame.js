"use client";

import { useI18n as useAnalyticsI18n } from "@/components/I18nProvider";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { repaintCharts } from "@/components/analytics/Chart";
import { currentTokens, lightTokens } from "@/components/analytics/chartTheme";
import FilterBar from "@/components/analytics/FilterBar";
import MonthlyReportButton from "@/components/analytics/MonthlyReport";
import { AnError, PanelSkeleton } from "@/components/analytics/ui";
import Icon from "@/components/ui/Icon";
import { faDigits, localRange } from "@/lib/analytics/calendar";

export const TABS = [
  ["/analytics", "نمای کلی", "home"],
  ["/analytics/people", "افراد و تیم‌ها", "user"],
  ["/analytics/soc", "عملیات SOC", "activity"],
  ["/analytics/compare", "مقایسه و روندها", "bars"],
];

const SCOPE_FA = { department: "کل واحد امنیت", soc: "تیم SOC", self: "آمار شخصی" };

/**
 * Printing: charts are repainted synchronously in the light theme before the browser lays out the
 * print copy, and restored afterwards. The page itself switches to light tokens for the same moment.
 */
function usePrintTheme() {
  useEffect(() => {
    let saved = null;
    const before = () => {
      saved = document.documentElement.dataset.theme;
      document.documentElement.dataset.theme = "light";
      repaintCharts(lightTokens());
    };
    const after = () => {
      if (saved) document.documentElement.dataset.theme = saved;
      saved = null;
      repaintCharts(currentTokens());
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);
}

/** Full-screen presentation: no sidebar or top bar, larger type. Esc (leaving full screen) ends it. */
function usePresentation() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("an-present", on);
    if (!on) return undefined;
    const onFs = () => { if (!document.fullscreenElement) setOn(false); };
    const onKey = (e) => { if (e.key === "Escape" && !document.fullscreenElement) setOn(false); };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("fullscreenchange", onFs); document.removeEventListener("keydown", onKey); document.documentElement.classList.remove("an-present"); };
  }, [on]);
  const toggle = () => {
    if (!on) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen?.();
    setOn(!on);
  };
  return [on, toggle];
}

const time = (iso, locale) => {
  if (!iso) return "";
  const value = new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit" });
  return locale === "fa" ? faDigits(value) : value;
};

/**
 * Chrome shared by every analytics page: header, actions, demo banner, tabs and the sticky filter bar.
 * Children render once facts have loaded; a refetch keeps them on screen, dimmed.
 */
export default function AnalyticsFrame({ title, subtitle, actions, exportKind = "full", exportId, tabs = true, crumbs, children, hideTeamFilter, className = "" }) {
  const { t: __analyticsTr, locale, dir } = useAnalyticsI18n();
  const a = useAnalytics();
  const { openPopover } = useApp();
  const path = usePathname();
  const router = useRouter();
  const [presenting, togglePresent] = usePresentation();
  usePrintTheme();
  const scope = a.facts?.scope?.kind ?? (a.manager ? null : "self");
  const visibleTabs = TABS.filter(([href]) => href !== "/analytics/soc" || !a.facts || a.facts.people.some((p) => p.shift));
  const inPeople = path.startsWith("/analytics/people") || path.startsWith("/analytics/teams");
  const inCompare = path.startsWith("/analytics/compare") || path.startsWith("/analytics/trends");

  const openExport = (e) => openPopover(e.currentTarget, {
    label: __analyticsTr("خروجی"), width: 280, align: "end", dir,
    items: [
      ...(exportKind ? [{ value: "xlsx", label: __analyticsTr(exportKind === "person" ? "Excel همین کارشناس" : "Excel کامل (با همین فیلترها)"), icon: <Icon name="sheet" /> }] : []),
      ...(a.manager && exportKind !== "teams" ? [{ value: "teams", label: __analyticsTr("Excel تیم‌ها و اعضا"), icon: <Icon name="team" /> }] : []),
      { separator: true },
      { value: "print", label: __analyticsTr("چاپ یا ذخیره PDF"), icon: <Icon name="print" />, hint: "Ctrl+P" },
      ...(a.manager ? [{ value: "report", label: __analyticsTr("گزارش مدیریتی یک‌صفحه‌ای"), icon: <Icon name="report" /> }] : []),
    ],
    onPick: (v) => {
      if (v === "print") setTimeout(() => window.print(), 50);
      else if (v === "report") router.push(a.href("/analytics/report"));
      else {
        const url = v === "teams" ? a.exportUrl("teams") : a.exportUrl(exportKind, exportKind === "person" ? { id: exportId } : {});
        const link = document.createElement("a");
        link.href = url;
        link.download = "";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    },
  });

  return (
    <div className={`page an ${className}`} dir={dir} lang={locale} data-loading={a.loading && a.facts ? "true" : undefined}>
      {a.demo && (
        <div className="an-demo" role="status">
          <Icon name="info" />
          <span><b>{"" + __analyticsTr("داده نمایشی:") + ""}</b>{" " + __analyticsTr("همه افراد و ارقام این صفحه ساختگی‌اند و فقط برای ارائه و آشنایی با داشبورد است.") + ""}</span>
          <button type="button" className="btn btn-secondary btn-sm an-no-print" onClick={() => a.setFilters({ demo: "" })}>{"" + __analyticsTr("نمایش داده واقعی") + ""}</button>
        </div>
      )}

      <header className="page-head an-head">
        <div className="page-head-main">
          <div>
            <span className="page-eyebrow">{crumbs ?? (scope ? __analyticsTr(SCOPE_FA[scope]) : "")}</span>
            <h1>{title}</h1>
            <p className="page-meta">
              <span>{a.range.label}{a.range.unit ? ` (${localRange(a.range.from, a.range.end, locale)})` : ""}</span>
              {a.cmp && <span>{"" + __analyticsTr("مقایسه با") + " "}{a.cmp.label}</span>}
              {a.facts && <span>{__analyticsTr("به‌روزرسانی")} {time(a.facts.generatedAt, locale)}</span>}
              {subtitle && <span>{subtitle}</span>}
            </p>
          </div>
        </div>
        <div className="page-actions an-no-print">
          {actions}
          <MonthlyReportButton personId={exportKind === "person" ? exportId : undefined} />
          <button type="button" className="btn btn-ghost icon-btn" aria-label={__analyticsTr("بارگذاری دوباره")} data-tooltip={__analyticsTr("بارگذاری دوباره داده")} onClick={a.reload} aria-busy={a.loading || undefined}><Icon name="refresh" /></button>
          {a.manager && (
            <button type="button" className={`btn btn-ghost ${a.demo ? "is-on" : ""}`} aria-pressed={a.demo} onClick={() => a.setFilters({ demo: a.demo ? "" : "1" })} data-tooltip={__analyticsTr("داده ساختگی برای ارائه و آشنایی")} data-testid="demo-toggle">
              <Icon name="sparkle" />{"" + __analyticsTr("داده نمایشی") + ""}</button>
          )}
          <button type="button" className="btn btn-ghost icon-btn" aria-label={__analyticsTr(presenting ? "پایان حالت ارائه" : "حالت ارائه")} data-tooltip={__analyticsTr(presenting ? "پایان حالت ارائه (Esc)" : "حالت ارائه (تمام‌صفحه)")} aria-pressed={presenting} onClick={togglePresent}><Icon name="present" /></button>
          <button type="button" className="btn btn-primary" aria-haspopup="menu" onClick={openExport} data-testid="export-menu"><Icon name="download" />{"" + __analyticsTr("خروجی") + ""}</button>
        </div>
      </header>

      {tabs && a.manager && (
        <nav className="an-tabs an-no-print" aria-label={__analyticsTr("بخش‌های داشبورد")}>
          {visibleTabs.map(([href, label, icon]) => {
            const on = href === "/analytics" ? ["/analytics", "/analytics/alerts", "/analytics/report"].includes(path) : href === "/analytics/people" ? inPeople : href === "/analytics/compare" ? inCompare : path.startsWith(href);
            return (
              <Link key={href} href={a.href(href)} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
                <Icon name={icon} />{__analyticsTr(label)}
              </Link>
            );
          })}
        </nav>
      )}

      {tabs && a.manager && (inPeople || inCompare) && <nav className="an-subtabs an-no-print" aria-label={locale === "fa" ? "نمای بخش" : "Section views"}>
        {(inPeople ? [["/analytics/people", "کارشناسان", "People"], ["/analytics/teams", "تیم‌ها", "Teams"]] : [["/analytics/compare", "مقایسه", "Comparison"], ["/analytics/trends", "روندها", "Trends"]]).map(([href, fa, en]) => <Link key={href} href={a.href(href)} className={path.startsWith(href) ? "on" : ""} aria-current={path.startsWith(href) ? "page" : undefined}>{locale === "fa" ? fa : en}</Link>)}
      </nav>}
      <FilterBar hideTeam={hideTeamFilter} />

      {a.error && !a.facts ? (
        <div className="panel"><AnError error={a.error} onRetry={a.reload} /></div>
      ) : !a.view ? (
        <div className="an-grid an-loading" role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">{"" + __analyticsTr("در حال بارگذاری…") + ""}</span>
          <PanelSkeleton height={120} /><PanelSkeleton height={120} /><PanelSkeleton height={120} />
          <PanelSkeleton height={280} /><PanelSkeleton height={280} />
        </div>
      ) : (
        <div className="an-body">
          {a.error && <div className="an-inline-error" role="alert"><Icon name="alert" />{"" + __analyticsTr("به‌روزرسانی داده انجام نشد؛ آخرین داده بارگذاری‌شده نمایش داده می‌شود.") + " "}<button type="button" className="btn btn-ghost btn-sm" onClick={a.reload}>{"" + __analyticsTr("تلاش دوباره") + ""}</button></div>}
          {children}
        </div>
      )}
      <p className="an-print-foot an-print-only">
        Sentinel Ops · {title} · {a.range.label} ({localRange(a.range.from, a.range.end, locale)}) · {a.cmp ? `${__analyticsTr("مقایسه با")} ${a.cmp.label}` : __analyticsTr("بدون مقایسه")}{a.demo ? ` · ${__analyticsTr("داده نمایشی")}` : ""}
      </p>
    </div>
  );
}
