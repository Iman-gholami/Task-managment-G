// Navigation model for the app shell: sidebar groups, breadcrumbs and command-menu pages.
import { REPORTS } from "@/lib/reports";
import { isManager } from "@/lib/roles";

const REPORT_NAMES = Object.fromEntries(REPORTS.map(([k, n]) => [k, n]));
export const TASK_VIEWS = { my: "My tasks", assigned: "Assigned by me", team: "Team tasks" };

/** Sidebar groups for a user. Operational work first, then insights, then organisation. */
export function navFor(me, counts = {}) {
  const manager = isManager(me);
  const taskViews = (manager ? ["assigned", "team", "my"] : ["my", "team"]).map((k) => ({ href: `/tasks/${k}`, label: TASK_VIEWS[k], count: counts[k] }));
  const shiftPlanning = me.keepsShiftLog || manager;
  return [
    {
      id: "work",
      items: [
        { href: "/dashboard", label: "Dashboard", icon: "home" },
        { href: taskViews[0].href, match: "/tasks", label: "Tasks", icon: "tasks", subs: taskViews },
        // Shift logs belong to SOC analysts only; scheduling is visible to analysts and managers.
        me.keepsShiftLog && { href: "/shift", match: "/shift", label: "Shift Log", icon: "shift", subs: [{ href: "/shift", label: "Today" }, { href: "/shift/history", label: "History" }] },
        shiftPlanning && {
          href: "/shift/schedule",
          match: "/shift/schedule",
          label: "Shift Schedule",
          icon: "cal",
          subs: [
            { href: "/shift/schedule", label: "Calendar" },
            { href: "/shift/changes", label: "Shift changes" },
          ],
        },
      ].filter(Boolean),
    },
    {
      id: "insights",
      label: "Insights",
      items: [
        manager
          ? { href: "/performance/overview", match: "/performance", label: "Performance", icon: "perf" }
          : { href: `/performance/employees/${me.id}`, match: "/performance", label: "My performance", icon: "perf" },
        { href: "/reports/employee", match: "/reports", label: "Reports", icon: "report" },
      ],
    },
    {
      id: "org",
      label: "Organization",
      items: [
        { href: "/team", label: "Team", icon: "team" },
        manager && { href: "/admin", label: "Administration", icon: "admin" },
      ].filter(Boolean),
    },
  ];
}

/** Pages offered by the command menu. */
export function pagesFor(me) {
  const out = [];
  for (const g of navFor(me)) {
    for (const it of g.items) {
      if (it.subs && it.label === "Tasks") it.subs.forEach((s) => out.push({ href: s.href, label: s.label, icon: "tasks" }));
      else if (it.subs) it.subs.forEach((s) => out.push({ href: s.href, label: `${it.label} · ${s.label}`, icon: it.icon }));
      else out.push({ href: it.href, label: it.label, icon: it.icon });
    }
  }
  const reports = isManager(me) ? REPORTS : REPORTS.filter(([k]) => k !== "team");
  reports.forEach(([k, n]) => out.push({ href: `/reports/${k}`, label: n, icon: "sheet" }));
  out.push({ href: "/account", label: "Account & password", icon: "user" });
  return out;
}

/** Breadcrumb trail for a path: [{ label, href? }]; the last entry is the current page. */
export function crumbsFor(path, peopleMap, me) {
  const [a, b, c] = path.split("/").filter(Boolean);
  switch (a) {
    case "tasks":
      return [{ label: "Tasks", href: "/tasks" }, { label: TASK_VIEWS[b] ?? b }];
    case "shift":
      if (b === "schedule") return [{ label: "Shift Schedule" }];
      if (b === "changes") return [{ label: "Shift Schedule", href: "/shift/schedule" }, { label: "Shift changes" }];
      return [{ label: "Shift Log", href: "/shift" }, { label: b === "history" ? "History" : "Today" }];
    case "team":
      return [{ label: "Team" }];
    case "performance":
      return b === "employees"
        ? [{ label: "Performance", href: isManager(me) ? "/performance/overview" : undefined }, { label: peopleMap[c]?.name ?? "Employee" }]
        : [{ label: "Performance" }, { label: "Overview" }];
    case "reports":
      return [{ label: "Reports", href: "/reports" }, { label: REPORT_NAMES[b] || "Reports" }];
    case "account":
      return [{ label: "Account" }];
    case "admin":
      return [{ label: "Administration" }, { label: "Users & roles" }];
    default:
      return [{ label: "Dashboard" }];
  }
}
