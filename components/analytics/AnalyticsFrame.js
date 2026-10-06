"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { repaintCharts } from "@/components/analytics/Chart";
import { currentTokens, lightTokens } from "@/components/analytics/chartTheme";
import FilterBar from "@/components/analytics/FilterBar";
import { AnError, PanelSkeleton } from "@/components/analytics/ui";
import Icon from "@/components/ui/Icon";
import { faDigits, faRange } from "@/lib/analytics/calendar";

export const TABS = [
  ["/analytics", "نمای کلی", "home"],
  ["/analytics/teams", "تیم‌ها", "team"],
  ["/analytics/people", "کارشناسان", "user"],
  ["/analytics/compare", "مقایسه", "bars"],
  ["/analytics/trends", "روندها", "perf"],
  ["/analytics/soc", "عملیات SOC", "activity"],
  ["/analytics/alerts", "هشدارها و بینش‌ها", "alert"],
  ["/analytics/report", "گزارش مدیریتی", "report"],
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

const time = (iso) => (iso ? faDigits(new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit" })) : "");

/**
 * Chrome shared by every analytics page: header, actions, demo banner, tabs and the sticky filter bar.
 * Children render once facts have loaded; a refetch keeps them on screen, dimmed.
 */
export default function AnalyticsFrame({ title, subtitle, actions, exportKind = "full", exportId, tabs = true, crumbs, children, hideTeamFilter, className = "" }) {
  const a = useAnalytics();
  const { openPopover } = useApp();
  const path = usePathname();
  const router = useRouter();
  const [presenting, togglePresent] = usePresentation();
  usePrintTheme();
  const scope = a.facts?.scope?.kind ?? (a.manager ? null : "self");
  const visibleTabs = TABS.filter(([href]) => href !== "/analytics/soc" || !a.facts || a.facts.people.some((p) => p.shift));

  const openExport = (e) => openPopover(e.currentTarget, {
    label: "خروجی", width: 280, align: "end", dir: "rtl",
    items: [
      ...(exportKind ? [{ value: "xlsx", label: exportKind === "person" ? "Excel همین کارشناس" : "Excel کامل (با همین فیلترها)", icon: <Icon name="sheet" /> }] : []),
      ...(a.manager && exportKind !== "teams" ? [{ value: "teams", label: "Excel تیم‌ها و اعضا", icon: <Icon name="team" /> }] : []),
      { separator: true },
      { value: "print", label: "چاپ یا ذخیره PDF", icon: <Icon name="print" />, hint: "Ctrl+P" },
      ...(a.manager ? [{ value: "report", label: "گزارش مدیریتی یک‌صفحه‌ای", icon: <Icon name="report" /> }] : []),
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
    <div className={`page an ${className}`} dir="rtl" lang="fa" data-loading={a.loading && a.facts ? "true" : undefined}>
      {a.demo && (
        <div className="an-demo" role="status">
          <Icon name="info" />
          <span><b>داده نمایشی:</b> همه افراد و ارقام این صفحه ساختگی‌اند و فقط برای ارائه و آشنایی با داشبورد است.</span>
          <button type="button" className="btn btn-secondary btn-sm an-no-print" onClick={() => a.setFilters({ demo: "" })}>نمایش داده واقعی</button>
        </div>
      )}

      <header className="page-head an-head">
        <div className="page-head-main">
          <div>
            <span className="page-eyebrow">{crumbs ?? (scope ? SCOPE_FA[scope] : "")}</span>
            <h1>{title}</h1>
            <p className="page-meta">
              <span>{a.range.label}{a.range.unit ? ` (${faRange(a.range.from, a.range.end)})` : ""}</span>
              {a.cmp && <span>مقایسه با {a.cmp.label}</span>}
              {a.facts && <span>به‌روزرسانی {time(a.facts.generatedAt)}</span>}
              {subtitle && <span>{subtitle}</span>}
            </p>
          </div>
        </div>
        <div className="page-actions an-no-print">
          {actions}
          <button type="button" className="btn btn-ghost icon-btn" aria-label="بارگذاری دوباره" data-tooltip="بارگذاری دوباره داده" onClick={a.reload} aria-busy={a.loading || undefined}><Icon name="refresh" /></button>
          {a.manager && (
            <button type="button" className={`btn btn-ghost ${a.demo ? "is-on" : ""}`} aria-pressed={a.demo} onClick={() => a.setFilters({ demo: a.demo ? "" : "1" })} data-tooltip="داده ساختگی برای ارائه و آشنایی" data-testid="demo-toggle">
              <Icon name="sparkle" />داده نمایشی
            </button>
          )}
          <button type="button" className="btn btn-ghost icon-btn" aria-label={presenting ? "پایان حالت ارائه" : "حالت ارائه"} data-tooltip={presenting ? "پایان حالت ارائه (Esc)" : "حالت ارائه (تمام‌صفحه)"} aria-pressed={presenting} onClick={togglePresent}><Icon name="present" /></button>
          <button type="button" className="btn btn-primary" aria-haspopup="menu" onClick={openExport} data-testid="export-menu"><Icon name="download" />خروجی</button>
        </div>
      </header>

      {tabs && a.manager && (
        <nav className="an-tabs an-no-print" aria-label="بخش‌های داشبورد">
          {visibleTabs.map(([href, label, icon]) => {
            const on = href === "/analytics" ? path === href : path.startsWith(href);
            return (
              <Link key={href} href={a.href(href)} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
                <Icon name={icon} />{label}
              </Link>
            );
          })}
        </nav>
      )}

      <FilterBar hideTeam={hideTeamFilter} />

      {a.error && !a.facts ? (
        <div className="panel"><AnError error={a.error} onRetry={a.reload} /></div>
      ) : !a.view ? (
        <div className="an-grid an-loading" role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">در حال بارگذاری…</span>
          <PanelSkeleton height={120} /><PanelSkeleton height={120} /><PanelSkeleton height={120} />
          <PanelSkeleton height={280} /><PanelSkeleton height={280} />
        </div>
      ) : (
        <div className="an-body">
          {a.error && <div className="an-inline-error" role="alert"><Icon name="alert" />به‌روزرسانی داده انجام نشد؛ آخرین داده بارگذاری‌شده نمایش داده می‌شود. <button type="button" className="btn btn-ghost btn-sm" onClick={a.reload}>تلاش دوباره</button></div>}
          {children}
        </div>
      )}
      <p className="an-print-foot an-print-only">
        Sentinel Ops · {title} · {a.range.label} ({faRange(a.range.from, a.range.end)}) · {a.cmp ? `مقایسه با ${a.cmp.label}` : "بدون مقایسه"}{a.demo ? " · داده نمایشی" : ""}
      </p>
    </div>
  );
}
