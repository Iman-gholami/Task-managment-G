/* Sentinel Ops — interactive prototype (vanilla JS, hash routing). */
const { people, P, tasks, activities, tickets, ticketLog } = window.DB;
const $ = (s, el = document) => el.querySelector(s);
const state = { role: "analyst", theme: "dark", collapsed: false, taskScope: "my", taskView: "table", sort: { k: "due", dir: 1 }, q: "", filters: { status: null, prio: null }, kb: 0, shiftDone: false };

/* ---------- icons ---------- */
const ICONS = {
  home: '<path d="M3 10.5 10 4l7 6.5V17a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1z"/>',
  tasks: '<rect x="3" y="3" width="14" height="14" rx="3"/><path d="m7 10 2 2 4-4"/>',
  shift: '<path d="M6 3h8M6 17h8M4 3v14M16 3v14"/><path d="M7 8h6M7 12h4"/>',
  team: '<circle cx="7.5" cy="7" r="2.5"/><circle cx="14" cy="8" r="2"/><path d="M3 16c.6-2.6 2.3-4 4.5-4s3.9 1.4 4.5 4M12.5 12.3c2 .1 3.6 1.3 4.1 3.7"/>',
  perf: '<path d="M3 16h14M5 13l3-4 3 2 4-6"/>',
  report: '<path d="M5 3h7l3 3v11H5z"/><path d="M12 3v3h3M8 10h4M8 13h4"/>',
  admin: '<circle cx="10" cy="10" r="2.5"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',
  search: '<circle cx="9" cy="9" r="5"/><path d="m16 16-3.5-3.5"/>',
  bell: '<path d="M5.5 13V9a4.5 4.5 0 0 1 9 0v4l1.5 2h-12z"/><path d="M8.5 17.5h3"/>',
  plus: '<path d="M10 4v12M4 10h12"/>',
  sun: '<circle cx="10" cy="10" r="3.2"/><path d="M10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1 1M14.3 14.3l1 1M4.7 15.3l1-1M14.3 5.7l1-1"/>',
  side: '<rect x="3" y="4" width="14" height="12" rx="2"/><path d="M8 4v12"/>',
  filter: '<path d="M4 5h12M6.5 10h7M9 15h2"/>',
  cols: '<rect x="3" y="4" width="14" height="12" rx="2"/><path d="M8 4v12M12 4v12"/>',
  x: '<path d="m6 6 8 8M14 6l-8 8"/>',
  chev: '<path d="m8 6 4 4-4 4"/>',
  down: '<path d="m6 8 4 4 4-4"/>',
  clip: '<path d="m15 9.5-5.3 5.3a3.2 3.2 0 0 1-4.5-4.5l5.6-5.6a2.1 2.1 0 0 1 3 3l-5.4 5.4a1 1 0 0 1-1.5-1.5L12 6.9"/>',
  link: '<path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.5-2.5a3 3 0 0 0-4.2-4.2l-.8.8M11.5 8.5a3 3 0 0 0-4.2 0L4.8 11a3 3 0 0 0 4.2 4.2l.8-.8"/>',
  at: '<circle cx="10" cy="10" r="3"/><path d="M13 10v1.2a2 2 0 0 0 4 0V10a7 7 0 1 0-2.7 5.5"/>',
  grip: '<circle cx="8" cy="6" r=".8"/><circle cx="12" cy="6" r=".8"/><circle cx="8" cy="10" r=".8"/><circle cx="12" cy="10" r=".8"/><circle cx="8" cy="14" r=".8"/><circle cx="12" cy="14" r=".8"/>',
  check: '<path d="m5 10.5 3 3 7-7"/>',
  flag: '<path d="M5 17V4M5 4h9l-2 3 2 3H5"/>',
  xls: '<rect x="3" y="3" width="14" height="14" rx="2"/><path d="m7 7 6 6M13 7l-6 6"/>',
  alert: '<path d="M10 3 2.5 16h15z"/><path d="M10 8v3.5M10 14v.01"/>',
  cal: '<rect x="3" y="4.5" width="14" height="12" rx="2"/><path d="M3 8.5h14M7 3v3M13 3v3"/>',
  board: '<rect x="3" y="4" width="4" height="12" rx="1"/><rect x="8.5" y="4" width="4" height="8" rx="1"/><rect x="14" y="4" width="3" height="10" rx="1"/>',
  list: '<path d="M4 6h12M4 10h12M4 14h12"/>',
  more: '<circle cx="5" cy="10" r=".9"/><circle cx="10" cy="10" r=".9"/><circle cx="15" cy="10" r=".9"/>',
};
const ic = (n, cls = "i") => `<svg class="${cls}" viewBox="0 0 20 20">${ICONS[n] || ""}</svg>`;

/* ---------- indicator helpers ---------- */
const STATUS = { backlog: "Backlog", todo: "To Do", progress: "In Progress", review: "Review", done: "Done", blocked: "Blocked", returned: "Returned", cancelled: "Cancelled" };
const PRIO = { low: "Low", normal: "Normal", high: "High", critical: "Critical" };
const CX = ["", "Simple", "Medium", "Complex", "Advanced"];
const QUAL = { excellent: "Excellent", good: "Good", acceptable: "Acceptable", needs: "Needs Improvement" };
const status = s => `<span class="status" data-s="${s}">${STATUS[s]}</span>`;
const prio = p => `<span class="prio" data-p="${p}"><i>${p === "critical" ? "!" : "<b></b><b></b><b></b>"}</i>${PRIO[p]}</span>`;
const cx = c => `<span class="cx" data-c="${c}"><i><b></b><b></b><b></b><b></b></i>${CX[c]}</span>`;
const qual = q => q ? `<span class="q" data-q="${q}">${QUAL[q]}</span>` : `<span class="muted">—</span>`;
const initials = n => n.split(" ").map(w => w[0]).join("");
const av = (id, cls = "") => { const p = P[id]; return `<span class="avatar ${cls}" style="background:${p.color}" title="${p.name}">${initials(p.name)}</span>`; };
const who = id => `<span class="who">${av(id)}${P[id].name}</span>`;
const TODAY = "2026-09-28";
const fmtDate = d => d === "—" ? '<span class="muted">—</span>' : new Date(d + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const dueCell = t => {
  if (t.due === "—") return fmtDate(t.due);
  const open = !["done", "cancelled"].includes(t.status);
  if (open && t.due < TODAY) return `<span class="overdue">${fmtDate(t.due)} · overdue</span>`;
  if (open && t.due <= "2026-09-30") return `<span class="soon">${fmtDate(t.due)}</span>`;
  return `<span class="num">${fmtDate(t.due)}</span>`;
};
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast"; el.innerHTML = `<span class="ok">${ic("check")}</span>${msg}`;
  $("#toasts").append(el); setTimeout(() => el.remove(), 2600);
}
function spark(vals, w = 120, h = 28, color = "var(--primary)") {
  const max = Math.max(...vals), min = Math.min(...vals);
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - 2 - ((v - min) / (max - min || 1)) * (h - 4)}`).join(" ");
  const last = pts.split(" ").pop().split(",");
  return `<svg class="spark" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="${last[0]}" cy="${last[1]}" r="2.5" fill="${color}"/></svg>`;
}

/* ---------- shell ---------- */
const NAV = [
  ["dashboard", "Dashboard", "home"],
  ["tasks", "Tasks", "tasks", [["tasks/my", "My Tasks", 5], ["tasks/team", "Team Tasks", 24], ["tasks/all", "All Tasks"]]],
  ["shift", "Shift Logs", "shift"],
  ["team", "Team", "team"],
  ["perf", "Performance", "perf", [["perf/overview", "Overview"], ["perf/employee", "Employees"]]],
  ["reports", "Reports", "report"],
  ["admin", "Administration", "admin"],
];
const ROLES = { analyst: ["sr", "Analyst · SOC L1"], soc: ["ln", "SOC Manager"], security: ["kf", "Security Manager"] };

function shell(route, crumbs, body, opts = {}) {
  const me = ROLES[state.role][0];
  const nav = NAV.map(([r, label, icon, subs]) => {
    const on = route === r || route.startsWith(r + "/");
    return `<a class="nav-item ${on && !subs ? "active" : ""}" href="#/${subs ? subs[0][0] : r}" data-tip="${label}">${ic(icon)}<span>${label}</span></a>` +
      (subs && on ? subs.map(([sr, sl, c]) => `<a class="nav-item sub ${route === sr ? "active" : ""}" href="#/${sr}"><span>${sl}</span>${c ? `<span class="count num">${c}</span>` : ""}</a>`).join("") : "");
  }).join("");
  return `<div class="app ${state.collapsed ? "collapsed" : ""}">
  <aside class="sidebar">
    <div class="brand"><span class="brand-mark">S</span><span>Sentinel Ops</span></div>
    ${nav}
    <div class="sidebar-foot">
      <div class="nav-item" data-act="role" data-tip="Switch role (demo)">${ic("team")}<span>Switch role (demo)</span></div>
      <div class="me">${av(me)}<div class="me-meta">${P[me].name}<small>${ROLES[state.role][1]}</small></div></div>
    </div>
  </aside>
  <main class="main">
    <header class="header">
      <button class="btn btn-ghost icon-btn" data-act="collapse" aria-label="Toggle sidebar">${ic("side")}</button>
      <nav class="crumbs">${crumbs.map((c, i) => i === crumbs.length - 1 ? `<b>${c}</b>` : `${c}${ic("chev")}`).join("")}</nav>
      <div class="spacer"></div>
      <div class="cmdk" data-act="cmdk">${ic("search")}Search or jump to…<kbd>⌘K</kbd></div>
      <button class="btn btn-ghost icon-btn" data-act="notif" aria-label="Notifications">${ic("bell")}</button>
      <button class="btn btn-ghost icon-btn" data-act="theme" aria-label="Toggle theme">${ic("sun")}</button>
    </header>
    <div class="content">${body}</div>
  </main></div>`;
}

/* ---------- screens ---------- */
function dashboard() {
  if (state.role === "soc") return socDashboard();
  if (state.role === "security") return secDashboard();
  const mine = tasks.filter(t => t.a === "sr" && !["done", "cancelled"].includes(t.status));
  const doneAct = activities.filter(a => a.done).length;
  return shell("dashboard", ["Dashboard"], `<div class="page">
  <div class="page-head"><div><h1>Good morning, Sara</h1><p>Monday, Sep 28 · Day shift 07:00–15:00</p></div>
    <div class="actions"><button class="btn btn-secondary" data-act="create">${ic("plus")}Create Task</button><a class="btn btn-primary" href="#/shift">Continue Shift Log</a></div></div>

  <div class="metrics">
    <div class="metric link" data-go="tasks/my"><div class="l">Assigned to me</div><div class="v">5</div></div>
    <div class="metric link"><div class="l">Due in 48h</div><div class="v">2</div></div>
    <div class="metric alert link"><div class="l">Overdue</div><div class="v">1</div></div>
    <div class="metric"><div class="l">Awaiting review</div><div class="v">1</div></div>
    <div class="metric"><div class="l">Completed · Sep</div><div class="v">11 <span class="d up">+3</span></div></div>
    <div class="metric"><div class="l">MISP IOCs · Sep</div><div class="v">142</div></div>
    <div class="metric"><div class="l">Tickets · Sep</div><div class="v">23</div></div>
  </div>

  <div class="grid g-main">
    <section>
      <div class="section-head"><h2>My work queue</h2><span class="meta">Sorted by deadline</span><div class="right"><a class="btn btn-ghost btn-sm" href="#/tasks/my">View all</a></div></div>
      ${taskTable(mine.concat(tasks.filter(t => t.id === "T-1033")), ["title", "status", "prio", "due"], true)}
    </section>
    <aside>
      <div class="panel" style="padding:16px 18px">
        <div class="section-head" style="margin-bottom:12px"><h2>Today's Shift Log</h2><span class="badge primary" style="margin-left:auto">In progress</span></div>
        <div style="display:flex;align-items:baseline;gap:8px"><span style="font:600 24px var(--font-sans)" class="num">${doneAct}/8</span><span class="sec">activities done</span></div>
        <div class="progress" style="margin:10px 0 14px"><span style="width:${doneAct / 8 * 100}%"></span></div>
        <div style="font-size:13px;display:grid;gap:8px">
          <div class="sec" style="display:flex;justify-content:space-between"><span>Remaining</span><span class="num" style="color:var(--text)">Monitor Security Center Website</span></div>
          <div class="sec" style="display:flex;justify-content:space-between"><span>IOCs added</span><span class="num" style="color:var(--text)">6</span></div>
          <div class="sec" style="display:flex;justify-content:space-between"><span>Tickets</span><span class="num" style="color:var(--text)">2</span></div>
          <div class="sec" style="display:flex;justify-content:space-between"><span>Last saved</span><span class="num">09:42</span></div>
        </div>
        <a class="btn btn-secondary" style="width:100%;justify-content:center;margin-top:16px" href="#/shift">Open Shift Log</a>
      </div>
      <div style="margin-top:24px">
        <div class="section-head"><h2>Recent activity</h2></div>
        ${[["am", "requested changes on", "T-1033", "1h"], ["ln", "assigned you", "T-1042", "3h"], ["rj", "mentioned you in", "T-1038", "yesterday"]].map(([p, a, t, w]) => `<div class="activity" style="border:0;margin:0;padding:6px 0">${av(p)}<span><span style="color:var(--text)">${P[p].name}</span> ${a} <span class="mono" style="color:var(--text-2)">${t}</span></span><span style="margin-left:auto">${w}</span></div>`).join("")}
      </div>
    </aside>
  </div></div>`);
}

function socDashboard() {
  const soc = people.filter(p => p.team.startsWith("SOC ·") || p.assist);
  return shell("dashboard", ["Dashboard"], `<div class="page">
  <div class="page-head"><div><h1>SOC overview</h1><p>Monday, Sep 28 · 4 analysts on shift</p></div>
    <div class="actions"><a class="btn btn-secondary" href="#/reports">Reports</a><button class="btn btn-primary" data-act="create">${ic("plus")}Create Task</button></div></div>
  <div class="metrics">
    <div class="metric"><div class="l">Active team tasks</div><div class="v">24</div></div>
    <div class="metric alert"><div class="l">Overdue</div><div class="v">3</div></div>
    <div class="metric link"><div class="l">Awaiting your review</div><div class="v">4</div></div>
    <div class="metric"><div class="l">Shift completion today</div><div class="v">78%</div></div>
    <div class="metric"><div class="l">MISP IOCs · Sep</div><div class="v">486 ${spark([12, 18, 15, 22, 19, 25, 21], 56, 20)}</div></div>
    <div class="metric"><div class="l">Tickets · Sep</div><div class="v">71 ${spark([4, 3, 5, 2, 6, 4, 5], 56, 20)}</div></div>
  </div>
  <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
    <section>
      <div class="section-head"><h2>Needs your attention</h2><span class="meta">7 items</span></div>
      <div class="panel" style="padding:4px 14px">
        ${[["alert", "danger", "Neda Karimi has not started today's Shift Log", "Remind"], ["flag", "danger", "T-1039 is 1 day overdue · Mina Sadeghi", "Open"],
          ["tasks", "violet", "T-1041 awaiting review · Arash Moradi", "Review"], ["tasks", "violet", "T-1044 awaiting review · Reza Jafari", "Review"],
          ["alert", "warning", "1 issue reported: Sensor S-04 stopped reporting", "View"]].map(([i, c, t, a]) =>
          `<div style="display:flex;align-items:center;gap:12px;height:44px;border-bottom:1px solid var(--divider)"><span style="color:var(--${c})">${ic(i)}</span><span style="flex:1">${t}</span><button class="btn btn-ghost btn-sm">${a}</button></div>`).join("")}
      </div>
    </section>
    <section>
      <div class="section-head"><h2>Team workload</h2><span class="meta">Estimated hours of open work vs capacity</span></div>
      ${soc.map(p => `<div class="hbar"><span class="who">${av(p.id)}${p.name.split(" ")[0]}${p.assist ? ' <span class="badge" title="Assisting from Design & Automation">assist</span>' : ""}</span><div class="track"><span style="width:${p.load}%;background:${p.load > 90 ? "var(--warning)" : "var(--primary)"}"></span></div><span class="num r sec" style="text-align:right">${p.load}%</span></div>`).join("")}
      <div class="section-head" style="margin-top:28px"><h2>Today's shift logs</h2></div>
      ${soc.filter(p => p.shift).map(p => `<div class="hbar"><span class="who">${av(p.id)}${p.name.split(" ")[0]}</span><div class="track"><span style="width:${{ active: 75, completed: 100, missing: 0 }[p.shift]}%;background:var(--success)"></span></div><span style="text-align:right">${p.shift === "missing" ? '<span class="badge danger">Missing</span>' : p.shift === "completed" ? '<span class="badge success">Done</span>' : '<span class="num sec">6/8</span>'}</span></div>`).join("")}
    </section>
  </div></div>`);
}

function secDashboard() {
  const teams = [["SOC", 64, 22, 3, [40, 48, 52, 58, 61, 64]], ["Design & Automation", 21, 9, 1, [14, 17, 19, 18, 22, 21]], ["Threat Intelligence", 17, 6, 0, [12, 13, 15, 14, 16, 17]]];
  return shell("dashboard", ["Dashboard"], `<div class="page">
  <div class="page-head"><div><h1>Security Department</h1><p>September 2026 · 3 teams · 18 people</p></div>
    <div class="actions"><div class="seg"><button class="on">This Month</button><button>Last Month</button><button>Quarter</button></div><a class="btn btn-primary" href="#/reports">${ic("xls")}Export</a></div></div>
  <div class="metrics">
    <div class="metric"><div class="l">Work completed</div><div class="v">102 <span class="d up">+12%</span></div></div>
    <div class="metric"><div class="l">Active tasks</div><div class="v">37</div></div>
    <div class="metric alert"><div class="l">Overdue</div><div class="v">4</div></div>
    <div class="metric"><div class="l">Task hours logged</div><div class="v">1,284</div></div>
    <div class="metric"><div class="l">Shift log compliance</div><div class="v">96%</div></div>
  </div>
  <section class="section"><div class="section-head"><h2>Team comparison</h2><span class="meta">Completed tasks · 6-month trend</span></div>
    <table class="dt"><thead><tr><th>Team</th><th class="r">Completed</th><th class="r">Active</th><th class="r">Overdue</th><th>Complexity mix</th><th>Trend</th></tr></thead><tbody>
    ${teams.map(([n, c, a, o, tr]) => `<tr><td class="title">${n}</td><td class="r num">${c}</td><td class="r num">${a}</td><td class="r num">${o ? `<span class="overdue">${o}</span>` : '<span class="muted">0</span>'}</td><td style="width:220px"><div class="dist"><span style="flex:4;background:var(--viz-1)"></span><span style="flex:3;background:var(--viz-2)"></span><span style="flex:2;background:var(--viz-3)"></span><span style="flex:1;background:var(--viz-4)"></span></div></td><td>${spark(tr)}</td></tr>`).join("")}
    </tbody></table>
    <div class="legend">${CX.slice(1).map((c, i) => `<span><i style="background:var(--viz-${i + 1})"></i>${c}</span>`).join("")}</div>
  </section>
  <section class="section"><div class="section-head"><h2>Employee activity</h2><span class="meta">Alphabetical · not a ranking</span><div class="right"><a class="btn btn-ghost btn-sm" href="#/team">Directory</a></div></div>
    ${peopleTable(people.filter(p => p.role !== "Security Manager"))}
  </section></div>`);
}

function taskTable(list, cols, compact) {
  const H = { title: "Task", a: "Assignee", team: "Team", status: "Status", prio: "Priority", cx: "Complexity", due: "Deadline", hours: "Hours", quality: "Quality", upd: "Updated" };
  const cell = (t, c) => ({
    title: `<td class="title"><span class="id">${t.id}</span>${t.title}</td>`,
    a: `<td>${who(t.a)}</td>`, team: `<td>${t.team}</td>`,
    status: `<td><span class="cell-edit" data-edit="status" data-id="${t.id}">${status(t.status)}</span></td>`,
    prio: `<td><span class="cell-edit" data-edit="prio" data-id="${t.id}">${prio(t.prio)}</span></td>`,
    cx: `<td>${cx(t.cx)}</td>`, due: `<td>${dueCell(t)}</td>`,
    hours: `<td class="r num">${t.hours ? t.hours.toFixed(1) : '<span class="muted">—</span>'}</td>`,
    quality: `<td>${qual(t.quality)}</td>`, upd: `<td class="muted num">${t.upd}</td>`,
  })[c];
  const arrow = k => state.sort.k === k ? (state.sort.dir > 0 ? " ↑" : " ↓") : "";
  return `<div class="table-wrap" ${compact ? 'style="border:0"' : ""}><table class="dt"><thead><tr>${cols.map(c => `<th data-sort="${c}" class="${c === "hours" ? "r" : ""} ${state.sort.k === c ? "sorted" : ""}">${H[c]}${arrow(c)}</th>`).join("")}</tr></thead>
  <tbody>${list.length ? list.map((t, i) => `<tr data-task="${t.id}" class="${!compact && i === state.kb ? "kb" : ""}">${cols.map(c => cell(t, c)).join("")}</tr>`).join("")
    : `<tr><td colspan="${cols.length}"><div class="empty"><div class="glyph">${ic("check")}</div><h3>You're all caught up.</h3>No tasks match this view.</div></td></tr>`}</tbody></table></div>`;
}

function tasksPage(scope) {
  state.taskScope = scope;
  let list = tasks.filter(t => scope === "my" ? t.a === "sr" : scope === "team" ? t.team.startsWith("SOC") : true);
  if (state.q) list = list.filter(t => (t.title + t.id).toLowerCase().includes(state.q.toLowerCase()));
  if (state.filters.status) list = list.filter(t => t.status === state.filters.status);
  if (state.filters.prio) list = list.filter(t => t.prio === state.filters.prio);
  const order = { status: Object.keys(STATUS), prio: Object.keys(PRIO) };
  const { k, dir } = state.sort;
  list = [...list].sort((a, b) => {
    const va = order[k] ? order[k].indexOf(a[k]) : k === "a" ? P[a.a].name : a[k], vb = order[k] ? order[k].indexOf(b[k]) : k === "a" ? P[b.a].name : b[k];
    return (va > vb ? 1 : va < vb ? -1 : 0) * dir;
  });
  state.visible = list;
  const title = { my: "My Tasks", team: "Team Tasks", all: "All Tasks" }[scope];
  const cols = scope === "my" ? ["title", "status", "prio", "cx", "due", "hours", "quality", "upd"] : ["title", "a", "status", "prio", "cx", "due", "hours", "quality"];
  const active = Object.entries(state.filters).filter(([, v]) => v);
  const board = () => `<div style="display:grid;grid-template-columns:repeat(5,minmax(220px,1fr));gap:12px;padding-top:12px">${["backlog", "todo", "progress", "review", "done"].map(s => `<div class="panel-2" style="padding:10px"><div style="display:flex;justify-content:space-between;margin:2px 4px 10px">${status(s)}<span class="muted num">${list.filter(t => t.status === s).length}</span></div>${list.filter(t => t.status === s).map(t => `<div class="panel" data-task="${t.id}" style="padding:10px 12px;margin-bottom:8px;cursor:pointer;box-shadow:var(--shadow-sm)"><div class="mono muted">${t.id}</div><div style="font-weight:500;margin:4px 0 10px;font-size:13px">${t.title}</div><div style="display:flex;align-items:center;gap:10px">${prio(t.prio)}<span style="margin-left:auto">${av(t.a)}</span></div></div>`).join("")}</div>`).join("")}</div>`;
  return shell("tasks/" + scope, ["Tasks", title], `<div class="page" style="padding-bottom:0">
  <div class="page-head" style="margin-bottom:16px"><div><h1>${title}</h1><p class="num">${list.length} tasks${scope === "team" ? " · SOC" : ""}</p></div>
    <div class="actions"><div class="seg"><button class="${state.taskView === "table" ? "on" : ""}" data-view="table">${ic("list")}</button><button class="${state.taskView === "board" ? "on" : ""}" data-view="board">${ic("board")}</button></div><button class="btn btn-primary" data-act="create">${ic("plus")}Create Task<kbd style="border-color:rgba(255,255,255,.3);color:rgba(255,255,255,.8)">C</kbd></button></div></div>
  <div class="toolbar">
    <div class="search">${ic("search")}<input class="input" id="q" placeholder="Filter by title or ID" value="${state.q}"></div>
    ${active.map(([k, v]) => `<button class="chip active" data-clear="${k}">${k === "status" ? "Status" : "Priority"} is <b>${k === "status" ? STATUS[v] : PRIO[v]}</b><span class="x">${ic("x")}</span></button>`).join("")}
    ${!state.filters.status ? `<button class="chip" data-filter="status">${ic("plus")}Status</button>` : ""}
    ${!state.filters.prio ? `<button class="chip" data-filter="prio">${ic("plus")}Priority</button>` : ""}
    <button class="chip">${ic("plus")}Complexity</button>${scope !== "my" ? `<button class="chip">${ic("plus")}Assignee</button>` : ""}<button class="chip">${ic("cal")}Deadline</button>
    ${active.length || state.q ? `<button class="btn btn-ghost btn-sm" data-act="reset">Reset</button>` : ""}
    <div style="margin-left:auto;display:flex;gap:6px"><span class="muted" style="font-size:12px;align-self:center"><kbd>J</kbd> <kbd>K</kbd> navigate · <kbd>↵</kbd> open · <kbd>S</kbd> status</span><button class="btn btn-ghost btn-sm">${ic("cols")}Columns</button></div>
  </div></div>
  <div style="padding:0 20px">${state.taskView === "board" ? board() : taskTable(list, cols)}</div>
  ${state.taskView === "table" ? `<div class="table-foot" style="padding:10px 32px"><span class="num">1–${list.length} of ${list.length}</span><span>Rows: 50</span></div>` : ""}`);
}

function taskDetail(id) {
  const t = tasks.find(x => x.id === id) || tasks[0];
  const checks = [["Pull 30 days of VPN auth logs", 1], ["Baseline normal login geography per user", 1], ["Draft SPL with risk scoring", 1], ["Validate against last month's true positives", 0], ["Peer review with L2", 0]];
  return shell("tasks/my", ["Tasks", "My Tasks", t.id], `<div class="detail">
  <div class="detail-main">
    <div class="mono muted" style="margin-bottom:8px">${t.id} · ${t.team}</div>
    <h1 style="font:var(--text-display);letter-spacing:var(--tracking-title);margin:0 0 14px" contenteditable="true" spellcheck="false">${t.title}</h1>
    <p class="sec" style="font-size:14px;line-height:22px;max-width:680px">Current rule fires on every login from a new country, producing ~40 false positives/day. Add per-user baselining and a risk score so only logins that combine new geography with an unusual time window or ASN reach the analyst queue. Reference ruleset lives in the detection repo.</p>
    <div style="display:flex;gap:8px;margin:14px 0 30px"><span class="file"><span class="ext" style="background:#3B7D4F">SPL</span><span>vpn_anomaly_v3.spl<small>6 KB · Sara Rahimi</small></span></span><a class="file" href="#">${ic("link")}<span>Splunk search<small class="mono">splunk/search/88213</small></span></a></div>

    <div class="section-head"><h2>Checklist</h2><span class="meta num">3 of 5</span><div class="progress ok" style="width:80px"><span style="width:60%"></span></div></div>
    <div id="checklist">${checks.map(([c, d]) => `<label class="check-item ${d ? "done" : ""}"><span class="grip">${ic("grip")}</span><input type="checkbox" class="cb" ${d ? "checked" : ""}><span>${c}</span></label>`).join("")}
    <div class="check-item" style="color:var(--text-3)"><span class="grip"></span>${ic("plus")}<input class="input" style="border:0;background:none;height:28px;padding:0" placeholder="Add item"></div></div>

    <div class="hr"></div>
    <div class="section-head"><h2>Comments</h2><span class="meta">2</span></div>
    <div class="comment">${av("ln")}<div><div class="h"><b>Leila Nouri</b><span class="muted">Sep 27, 16:20</span></div><p>Please coordinate with <span class="mention">@Arash Moradi</span> before enabling in production — L2 owns the escalation path.</p></div></div>
    <div class="activity">${ic("chev")}Leila Nouri changed priority Normal → <b style="color:var(--text)">High</b> · Sep 27</div>
    <div class="comment">${av("sr")}<div><div class="h"><b>Sara Rahimi</b><span class="muted">Today, 08:05 · edited</span></div><p>Baseline done. False-positive rate on last week's data drops from 41/day to 6/day.</p></div></div>
    <div class="composer"><textarea placeholder="Leave a comment… use @ to mention"></textarea><div class="bar"><button class="btn btn-ghost icon-btn btn-sm">${ic("at")}</button><button class="btn btn-ghost icon-btn btn-sm">${ic("clip")}</button><button class="btn btn-secondary btn-sm" style="margin-left:auto">Comment <kbd>⌘↵</kbd></button></div></div>
  </div>
  <aside class="detail-side">
    <div style="display:flex;gap:8px;margin-bottom:18px"><button class="btn btn-primary" style="flex:1;justify-content:center" data-act="submit-review">Submit for Review</button><button class="btn btn-secondary icon-btn">${ic("more")}</button></div>
    <dl class="kv">
      <dt>Status</dt><dd><span class="cell-edit" data-edit="status" data-id="${t.id}">${status(t.status)}</span></dd>
      <dt>Assignee</dt><dd><span class="cell-edit">${who(t.a)}</span></dd>
      <dt>Priority</dt><dd><span class="cell-edit" data-edit="prio" data-id="${t.id}">${prio(t.prio)}</span></dd>
      <dt>Complexity</dt><dd><span class="cell-edit">${cx(t.cx)}</span></dd>
      <dt>Start</dt><dd class="num">Sep 24</dd>
      <dt>Deadline</dt><dd>${dueCell(t)}</dd>
      <dt>Actual hours</dt><dd><span class="stepper"><button>−</button><input value="${t.hours}"><button>+</button></span></dd>
      <dt>Reviewer</dt><dd>${who("ln")}</dd>
      <dt>Quality</dt><dd class="muted">Set on approval</dd>
    </dl>
    <div class="side-h">Activity</div>
    <div style="font-size:12px;color:var(--text-3);display:grid;gap:8px">
      <div>Created by Leila Nouri · Sep 24</div><div>Status → In Progress · Sep 24</div><div>Hours logged +2.5 · Today</div>
    </div>
  </aside></div>`);
}

function shiftLog() {
  const done = activities.filter(a => a.done).length, iocs = activities[7].iocs, issues = activities.filter(a => a.issue).length;
  const completed = state.shiftDone;
  const act = a => {
    let right = `<button class="toggle-done ${a.done ? "on" : ""}" data-toggle="${a.n}">${ic("check")}${a.done ? (a.kind === "monitor" && !a.issue ? "Completed — No Issue" : "Done") : "Mark done"}</button>`;
    let extra = "";
    if (a.kind === "misp") extra = `<div class="line"><span class="sec" style="font-size:12px">IOC count</span><span class="stepper"><button data-ioc="-1">−</button><input id="ioc" value="${a.iocs}" inputmode="numeric"><button data-ioc="1">+</button></span>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px" class="sec"><input type="checkbox" class="switch" ${a.bale ? "checked" : ""}>Shared via Bale</label>
      <span class="muted" style="font-size:12px">MISP event</span><input class="input mono" style="width:150px;height:28px" value="5534"></div>`;
    if (a.files) extra = `<div class="line">${a.files.map(([n, s, e]) => `<span class="file"><span class="ext" style="${e === "TXT" ? "background:var(--neutral)" : ""}">${e}</span><span>${n}<small>${s}</small></span></span>`).join("")}<button class="btn btn-ghost btn-sm">${ic("clip")}${a.kind === "report" ? "Replace report" : "Add file or link"}</button></div>`;
    if (a.issue) extra = `<div class="issue"><div style="display:flex;align-items:center;gap:8px;font-weight:500;color:var(--text)"><span style="color:var(--warning)">${ic("alert")}</span>Issue reported: ${a.issue.summary}</div><div class="sec" style="font-size:13px">Sensor resumed at 07:15 after service restart; data gap of 35 min. Escalated as INC-2026-4476.</div><div style="font-size:12px" class="muted">Reference <span class="mono" style="color:var(--text-2)">${a.issue.ref}</span></div></div>`;
    if (a.kind === "monitor" && !a.issue) right = `<button class="btn btn-ghost btn-sm" data-issue="${a.n}">Report an issue</button>` + right;
    const sub = { misp: "IOC count feeds monthly reports", files: "Upload the day's files or link to them", report: "Attach the Word report", monitor: a.issue ? "Completed with 1 issue" : "Default: completed with no issue" }[a.kind] || "";
    return `<div class="act ${a.done ? "done" : ""}" id="act-${a.n}"><div class="act-row"><span class="n num">${a.n}</span><input type="checkbox" class="cb" ${a.done ? "checked" : ""} data-toggle="${a.n}" aria-label="Done"><div class="t">${a.title}${sub ? `<small>${sub}</small>` : ""}</div><div style="display:flex;gap:6px">${right}<button class="btn btn-ghost icon-btn btn-sm" title="Add note">${ic("more")}</button></div></div>${extra ? `<div class="act-extra">${extra}</div>` : ""}<div class="act-extra" id="issue-${a.n}" hidden></div></div>`;
  };
  return shell("shift", ["Shift Logs", "Today"], `<div class="page narrow" style="max-width:1080px;padding-bottom:0">
  <div class="page-head" style="margin-bottom:0"><div><h1>Shift Log — Sep 28, 2026</h1></div><div class="actions"><div class="seg"><button class="${!completed ? "on" : ""}" data-shiftview="0">Active</button><button class="${completed ? "on" : ""}" data-shiftview="1">Completed (demo)</button></div><a class="btn btn-ghost" href="#/shift/history">History</a></div></div>
  <div class="shift-head">
    <div class="ring" style="--v:${done / 8 * 100}"></div>
    <div class="facts"><div><small>Analyst</small>${who("sr")}</div><div><small>Shift</small>Day · 07:00–15:00</div><div><small>Status</small>${completed ? '<span class="badge success">Completed 14:52</span>' : '<span class="badge primary">In progress</span>'}</div><div><small>Completion</small><span class="num">${Math.round(done / 8 * 100)}%</span></div><div><small>Last updated</small><span class="num">09:42 · autosaved</span></div></div>
  </div>
  <div class="section-head"><h2>Routine activities</h2><span class="meta num">${done} of 8</span></div>
  ${activities.map(act).join("")}
  <div class="section" style="margin-top:32px">
    <div class="section-head"><h2>Created Tickets</h2><span class="badge num">Tickets Created: ${tickets.length}</span><div class="right"><button class="btn btn-secondary btn-sm" data-act="add-ticket">${ic("plus")}Add Ticket</button></div></div>
    <div class="ticket muted" style="height:28px;font-size:12px"><span>Ticket number *</span><span>Related reference</span><span>Description</span><span></span></div>
    <div id="tickets">${tickets.map(tk => `<div class="ticket"><span class="mono" style="color:var(--text)">${tk.no}</span><span class="mono sec">${tk.ref}</span><span class="sec">${tk.desc}</span><button class="btn btn-ghost icon-btn btn-sm">${ic("link")}</button></div>`).join("")}</div>
  </div>
  <div class="summary">
    <span class="s"><b>${done}/8</b>Activities</span><span class="s"><b>${iocs}</b>IOCs added</span><span class="s"><b>${tickets.length}</b>Tickets created</span><span class="s"><b>${issues}</b>Issue reported</span>
    <span style="margin-left:auto" class="remain">${completed ? "" : done < 8 ? `1 remaining: Monitor Security Center Website` : ""}</span>
    ${completed ? '<button class="btn btn-secondary">Reopen</button>' : `<button class="btn btn-primary" data-act="complete-shift" ${done < 8 ? 'title="Complete remaining activities first"' : ""}>Complete Shift</button>`}
  </div></div>`);
}

function shiftHistory() {
  const rows = Array.from({ length: 12 }, (_, i) => { const d = 27 - i; const miss = i === 4; return [`2026-09-${String(d).padStart(2, "0")}`, miss ? 5 : 8, [4, 7, 5, 9, 2, 6, 5, 3, 8, 6, 4, 5][i], [2, 1, 3, 0, 1, 2, 1, 4, 0, 2, 1, 1][i], i % 5 === 1 ? 1 : 0, miss]; });
  return shell("shift", ["Shift Logs", "History"], `<div class="page"><div class="page-head"><div><h1>Shift Log History</h1><p>Sara Rahimi · September 2026</p></div><div class="actions"><button class="chip active">Analyst is <b>Sara Rahimi</b></button><button class="chip active">Period <b>Sep 2026</b></button><button class="btn btn-secondary">${ic("xls")}Export</button></div></div>
  <table class="dt"><thead><tr><th>Date</th><th>Status</th><th>Activities</th><th class="r">IOCs</th><th class="r">Tickets</th><th class="r">Issues</th><th>Traffic report</th></tr></thead><tbody>
  ${rows.map(([d, a, i, t, is, miss]) => `<tr><td class="title num">${fmtDate(d)} <span class="muted" style="font-weight:400">· ${new Date(d).toLocaleDateString("en-US", { weekday: "short" })}</span></td><td>${miss ? '<span class="status" data-s="returned">Incomplete</span>' : '<span class="status" data-s="done">Completed</span>'}</td><td><span style="display:inline-flex;align-items:center;gap:10px"><span class="progress ok" style="width:80px"><span style="width:${a / 8 * 100}%"></span></span><span class="num">${a}/8</span></span></td><td class="r num">${i}</td><td class="r num">${t}</td><td class="r num">${is || '<span class="muted">0</span>'}</td><td>${miss ? '<span class="muted">Not attached</span>' : `<span class="sec">${ic("report")} .docx</span>`}</td></tr>`).join("")}
  </tbody></table></div>`);
}

function peopleTable(list) {
  return `<table class="dt"><thead><tr><th>Name</th><th>Role</th><th>Primary team</th><th>Workload</th><th class="r">Open tasks</th><th>Shift today</th><th></th></tr></thead><tbody>
  ${list.map(p => `<tr data-person="${p.id}"><td class="title">${who(p.id)}</td><td>${p.role}</td><td>${p.team}${p.assist ? ` <span class="muted">· assisting ${p.assist}</span>` : ""}</td><td><span style="display:inline-flex;align-items:center;gap:10px"><span class="progress" style="width:100px"><span style="width:${p.load}%;${p.load > 90 ? "background:var(--warning)" : ""}"></span></span><span class="num muted">${p.load}%</span></span></td><td class="r num">${p.open}</td><td>${p.shift === "missing" ? '<span class="badge danger">Not started</span>' : p.shift === "completed" ? '<span class="status" data-s="done">Completed</span>' : p.shift === "active" ? '<span class="status" data-s="progress">In progress</span>' : '<span class="muted">—</span>'}</td><td class="r"><a class="btn btn-ghost btn-sm" href="#/perf/employee">Performance</a></td></tr>`).join("")}</tbody></table>`;
}

function team() {
  return shell("team", ["Team"], `<div class="page"><div class="page-head"><div><h1>Team</h1><p>${people.length} people · Security Department</p></div><div class="actions"><div class="seg"><button class="on">All</button><button>SOC</button><button>Design & Automation</button><button>Threat Intelligence</button></div></div></div>
  <div class="toolbar"><div class="search">${ic("search")}<input class="input" placeholder="Search people"></div><button class="chip">${ic("plus")}Role</button><button class="chip">${ic("plus")}Shift status</button></div>
  ${peopleTable(people)}</div>`);
}

function performance() {
  const done = tasks.filter(t => t.status === "done");
  const rows = [["Onboard new L1 analyst to shift procedures", "Walkthrough of shift log + escalation paths", 1, "excellent", "Sep 23", "Sep 25", 2], ["Tune Splunk rule: brute-force on OWA", "Reduced FP rate by 70%", 3, "good", "Sep 10", "Sep 16", 11.5], ["Phishing campaign IOC sweep", "Swept 1,200 mailboxes for 14 indicators", 2, "good", "Sep 08", "Sep 09", 5], ["Scanner coverage report for DMZ", "Identified 3 unscanned subnets", 3, "acceptable", "Sep 02", "Sep 05", 8], ["Automate daily blocklist diff", "Python script, peer reviewed", 4, "excellent", "Sep 14", "Sep 22", 16]];
  return shell("perf/employee", ["Performance", "Employees", "Sara Rahimi"], `<div class="page narrow">
  <div class="page-head"><div style="display:flex;gap:16px;align-items:center">${av("sr", "lg")}<div><h1>Sara Rahimi</h1><p>Analyst · SOC Layer 1 · Reports to Leila Nouri</p></div></div>
    <div class="actions"><div class="seg"><button class="on">This Month</button><button>Last Month</button><button>Quarter</button><button>${ic("cal")}Custom</button></div><button class="btn btn-primary">${ic("xls")}Export to Excel</button></div></div>
  <p class="muted" style="margin:-12px 0 20px;font-size:12px">Period: Sep 1 – Sep 28, 2026 · 20 working days</p>

  <div class="metrics">
    <div class="metric"><div class="l">Completed tasks</div><div class="v">11</div></div>
    <div class="metric"><div class="l">Task hours</div><div class="v">62.5</div></div>
    <div class="metric"><div class="l">Shift logs completed</div><div class="v">19<span class="muted" style="font-size:14px;font-weight:500">/20</span></div></div>
    <div class="metric"><div class="l">MISP IOCs</div><div class="v">142</div></div>
    <div class="metric link" data-act="tickets"><div class="l">Tickets created ${ic("chev")}</div><div class="v">23</div></div>
  </div>

  <section class="section"><div class="section-head"><h2>Routine Activity</h2><span class="badge">Shift Logs</span><span class="meta">Daily operational work — counted separately from tasks</span><div class="right"><a class="btn btn-ghost btn-sm" href="#/shift/history">Daily logs ${ic("chev")}</a></div></div>
    <div class="grid" style="grid-template-columns:repeat(5,1fr);gap:0" >
      ${[["Shift logs", "19 / 20", "1 incomplete (Sep 23)"], ["Routine completion", "97.5%", "156 of 160 activities"], ["MISP IOCs", "142", "7.5 per shift avg"], ["Tickets created", "23", "View ticket numbers"], ["Daily traffic reports", "19", "All attached as .docx"]].map(([l, v, s], i) => `<div style="padding:4px 18px;${i ? "border-left:1px solid var(--divider)" : "padding-left:0"}"><div class="muted" style="font-size:12px">${l}</div><div style="font:600 18px var(--font-sans);margin:4px 0" class="num">${v}</div><div class="sec" style="font-size:12px">${s}</div></div>`).join("")}
    </div>
    <div style="margin-top:18px"><div class="muted" style="font-size:12px;margin-bottom:6px">IOCs per shift</div>${spark([4, 7, 5, 9, 2, 6, 5, 3, 8, 6, 4, 5, 11, 9, 7, 8, 10, 6, 7], 960, 36)}</div>
  </section>

  <section class="section"><div class="section-head"><h2>Task Performance</h2><span class="badge primary">Tasks</span><span class="meta">Project & improvement work</span></div>
    <div class="grid" style="grid-template-columns:1fr 1fr;margin-bottom:18px">
      <div><div class="muted" style="font-size:12px;margin-bottom:8px">Complexity of completed work</div><div class="dist"><span style="flex:4;background:var(--viz-1)"></span><span style="flex:3;background:var(--viz-2)"></span><span style="flex:3;background:var(--viz-3)"></span><span style="flex:1;background:var(--viz-4)"></span></div>
      <div class="legend">${[["Simple", 4], ["Medium", 3], ["Complex", 3], ["Advanced", 1]].map(([c, n], i) => `<span><i style="background:var(--viz-${i + 1})"></i>${c} <b class="num" style="color:var(--text)">${n}</b></span>`).join("")}</div></div>
      <div><div class="muted" style="font-size:12px;margin-bottom:8px">Quality of completed work</div><div style="display:flex;gap:24px;font-size:13px">${[["Excellent", 4], ["Good", 5], ["Acceptable", 2], ["Needs Improvement", 0]].map(([q, n]) => `<span class="sec">${q} <b class="num" style="color:var(--text)">${n}</b></span>`).join("")}</div></div>
    </div>
    <table class="dt"><thead><tr><th>Task</th><th>Description</th><th>Complexity</th><th>Quality</th><th>Start</th><th>End</th><th class="r">Hours</th><th>Status</th></tr></thead><tbody>
    ${rows.map(([t, d, c, q, s, e, h]) => `<tr><td class="title">${t}</td><td style="max-width:280px;overflow:hidden;text-overflow:ellipsis">${d}</td><td>${cx(c)}</td><td>${qual(q)}</td><td class="num">${s}</td><td class="num">${e}</td><td class="r num">${h.toFixed(1)}</td><td>${status("done")}</td></tr>`).join("")}
    </tbody></table>
  </section></div>`);
}

function perfOverview() {
  return shell("perf/overview", ["Performance", "Overview"], `<div class="page"><div class="page-head"><div><h1>Performance Overview</h1><p>September 2026 · all teams</p></div><div class="actions"><div class="seg"><button class="on">This Month</button><button>Last Month</button><button>Quarter</button></div><button class="btn btn-primary">${ic("xls")}Export to Excel</button></div></div>
  <div class="metrics"><div class="metric"><div class="l">Tasks completed</div><div class="v">102</div></div><div class="metric"><div class="l">Task hours</div><div class="v">1,284</div></div><div class="metric"><div class="l">Shift logs</div><div class="v">231</div></div><div class="metric"><div class="l">MISP IOCs</div><div class="v">486</div></div><div class="metric"><div class="l">Tickets</div><div class="v">71</div></div></div>
  <div class="toolbar"><div class="search">${ic("search")}<input class="input" placeholder="Search employee"></div><button class="chip active">Team is <b>All</b></button></div>
  <table class="dt"><thead><tr><th>Employee</th><th>Team</th><th class="r">Tasks done</th><th class="r">Hours</th><th>Complexity mix</th><th class="r">Shift logs</th><th class="r">IOCs</th><th class="r">Tickets</th><th></th></tr></thead><tbody>
  ${people.slice(0, 6).map((p, i) => `<tr data-person="${p.id}"><td class="title">${who(p.id)}</td><td>${p.team}</td><td class="r num">${[11, 9, 6, 8, 14, 7][i]}</td><td class="r num">${[62.5, 71, 38, 55, 118, 64][i]}</td><td style="width:180px"><div class="dist"><span style="flex:${4 - i % 3};background:var(--viz-1)"></span><span style="flex:3;background:var(--viz-2)"></span><span style="flex:${2 + i % 2};background:var(--viz-3)"></span><span style="flex:1;background:var(--viz-4)"></span></div></td><td class="r num">${p.shift !== null ? [19, 20, 17, 18][i] ?? "—" : '<span class="muted">n/a</span>'}</td><td class="r num">${p.shift !== null ? [142, 131, 96, 117][i] ?? "—" : '<span class="muted">n/a</span>'}</td><td class="r num">${p.shift !== null ? [23, 19, 12, 17][i] ?? "—" : '<span class="muted">n/a</span>'}</td><td class="r">${ic("chev")}</td></tr>`).join("")}
  </tbody></table><p class="muted" style="font-size:12px;margin-top:12px">Sorted alphabetically by default. Metrics describe output, not rank; there is no leaderboard view.</p></div>`);
}

function reports(sub) {
  const R = [["employee", "Employee Monthly Report", "Tasks + routine activity per person, matching the monthly Excel format"], ["team", "Team Monthly Report", "Aggregated output, workload and complexity per team"], ["task", "Task Report", "Every task with executor, hours, complexity and quality"], ["shift", "SOC Shift Activity Report", "Shift log completion, IOCs, issues and traffic reports"], ["tickets", "Ticket Report", "Every ticket registered in shift logs"]];
  if (sub === "tickets") return ticketReport();
  const cur = R.find(r => r[0] === sub) || R[0];
  return shell("reports", ["Reports", cur[1]], `<div style="display:grid;grid-template-columns:260px 1fr;height:100%">
  <nav style="border-right:1px solid var(--divider);padding:20px 12px">${R.map(([k, n]) => `<a class="nav-item ${k === cur[0] ? "active" : ""}" href="#/reports/${k}"><span>${n}</span></a>`).join("")}</nav>
  <div class="page"><div class="page-head"><div><h1>${cur[1]}</h1><p>${cur[2]}</p></div><div class="actions"><button class="btn btn-secondary">Preview</button><button class="btn btn-primary" data-act="export">${ic("xls")}Export to Excel</button></div></div>
  <div class="toolbar"><button class="chip active">${ic("cal")}Date range <b>Sep 1 – Sep 30</b></button><button class="chip active">Employee <b>Sara Rahimi</b><span class="x">${ic("x")}</span></button><button class="chip">${ic("plus")}Team</button><button class="chip">${ic("plus")}Task Status</button><button class="chip">${ic("plus")}Complexity</button><button class="chip">${ic("plus")}Quality</button><button class="btn btn-ghost btn-sm">Reset</button></div>
  <div class="section-head" style="margin-top:12px"><h2>Tasks</h2><span class="meta">11 rows</span></div>
  <table class="dt"><thead><tr><th>Task Title</th><th>Work Description</th><th>Quality</th><th>Start Time</th><th>End Time</th><th class="r">Hours</th><th>Executor</th><th>Complexity</th></tr></thead><tbody>
  ${[["Automate daily blocklist diff", "Python script, peer reviewed", "excellent", "Sep 14 09:00", "Sep 22 16:30", 16, 4], ["Tune Splunk rule: brute-force on OWA", "Reduced FP rate by 70%", "good", "Sep 10 10:15", "Sep 16 14:00", 11.5, 3], ["Phishing campaign IOC sweep", "Swept 1,200 mailboxes", "good", "Sep 08 08:30", "Sep 09 12:00", 5, 2], ["Onboard new L1 analyst", "Walkthrough of shift log", "excellent", "Sep 23 09:00", "Sep 25 11:00", 2, 1]].map(([t, d, q, s, e, h, c]) => `<tr><td class="title">${t}</td><td>${d}</td><td>${qual(q)}</td><td class="num">${s}</td><td class="num">${e}</td><td class="r num">${h.toFixed(1)}</td><td>${who("sr")}</td><td>${cx(c)}</td></tr>`).join("")}
  </tbody></table>
  <div class="section-head" style="margin-top:28px"><h2>Routine Activity</h2><span class="meta">SOC employees only</span></div>
  <div class="metrics" style="margin:0"><div class="metric"><div class="l">Shift logs</div><div class="v">19</div></div><div class="metric"><div class="l">Routine completion</div><div class="v">97.5%</div></div><div class="metric"><div class="l">MISP IOCs</div><div class="v">142</div></div><div class="metric"><div class="l">Tickets</div><div class="v">23</div></div><div class="metric"><div class="l">Traffic reports</div><div class="v">19</div></div><div class="metric"><div class="l">Issues reported</div><div class="v">4</div></div></div>
  </div></div>`);
}

function ticketReport() {
  return shell("reports", ["Reports", "Ticket Report"], `<div class="page"><div class="page-head"><div><h1>Ticket Report</h1><p class="num">${ticketLog.length} tickets · Sep 2026</p></div><div class="actions"><button class="btn btn-primary" data-act="export">${ic("xls")}Export to Excel</button></div></div>
  <div class="toolbar"><div class="search">${ic("search")}<input class="input" placeholder="Search ticket number or description"></div><button class="chip">${ic("plus")}Analyst</button><button class="chip active">${ic("cal")}Date <b>Sep 2026</b></button></div>
  <table class="dt"><thead><tr><th>Analyst</th><th class="sorted">Date ↓</th><th>Ticket Number</th><th>Related Reference</th><th>Description</th></tr></thead><tbody>
  ${ticketLog.map(([a, d, n, r, ds]) => `<tr><td>${who(a)}</td><td class="num">${fmtDate(d)}</td><td class="mono" style="color:var(--text)">${n}</td><td class="mono">${r}</td><td>${ds}</td></tr>`).join("")}
  </tbody></table></div>`);
}

function admin() {
  return shell("admin", ["Administration", "Users & Roles"], `<div style="display:grid;grid-template-columns:220px 1fr;height:100%">
  <nav style="border-right:1px solid var(--divider);padding:20px 12px">${["Users & Roles", "Teams", "Shift Templates", "Activity Definitions", "Notifications", "Audit Log"].map((n, i) => `<a class="nav-item ${i ? "" : "active"}"><span>${n}</span></a>`).join("")}</nav>
  <div class="page"><div class="page-head"><div><h1>Users & Roles</h1><p>${people.length} active users</p></div><div class="actions"><button class="btn btn-primary">${ic("plus")}Invite User</button></div></div>
  <div class="toolbar"><div class="search">${ic("search")}<input class="input" placeholder="Search users"></div><button class="chip">${ic("plus")}Role</button><button class="chip">${ic("plus")}Team</button></div>
  <table class="dt"><thead><tr><th>User</th><th>Role</th><th>Primary team</th><th>Temporary assignment</th><th>Last active</th><th>Status</th><th></th></tr></thead><tbody>
  ${people.map((p, i) => `<tr><td class="title">${who(p.id)}</td><td><span class="cell-edit">${p.role} ${ic("down")}</span></td><td>${p.team}</td><td>${p.assist ? `${p.assist} <span class="muted">· until Oct 15</span>` : '<span class="muted">—</span>'}</td><td class="muted num">${["2m", "1h", "3h", "5m", "20m", "1d", "now", "2h"][i]}</td><td>${i === 5 ? '<span class="badge warning">Invited</span>' : '<span class="status" data-s="done">Active</span>'}</td><td class="r"><button class="btn btn-ghost icon-btn btn-sm">${ic("more")}</button></td></tr>`).join("")}
  </tbody></table>
  <div class="section-head" style="margin-top:32px"><h2>Role permissions</h2></div>
  <table class="dt"><thead><tr><th>Capability</th><th>Analyst</th><th>SOC Manager</th><th>Security Manager</th><th>Admin</th></tr></thead><tbody>
  ${[["Create & assign tasks", "Self only", "SOC", "All teams", "All"], ["Review & set quality", "—", "SOC", "All teams", "—"], ["Shift Log", "Own", "View SOC", "View all", "Configure"], ["Performance", "Own", "SOC", "All teams", "—"], ["Export reports", "Own", "SOC", "All", "All"]].map(r => `<tr><td class="title">${r[0]}</td>${r.slice(1).map(c => `<td>${c === "—" ? '<span class="muted">—</span>' : c}</td>`).join("")}</tr>`).join("")}
  </tbody></table></div></div>`);
}

function states() {
  return shell("dashboard", ["System", "States"], `<div class="page"><div class="page-head"><div><h1>Empty, loading & error states</h1></div></div>
  <div class="state-demo">
    <div class="panel"><div class="empty"><div class="glyph">${ic("check")}</div><h3>You're all caught up.</h3>No tasks are assigned to you right now.<div style="margin-top:14px"><button class="btn btn-secondary btn-sm" data-act="create">Create Task</button></div></div></div>
    <div class="panel"><div class="empty"><div class="glyph">${ic("shift")}</div><h3>No shift activity yet</h3>No shift activity has been recorded for today.<div style="margin-top:14px"><a class="btn btn-primary btn-sm" href="#/shift">Start Shift Log</a></div></div></div>
    <div class="panel"><div class="empty"><div class="glyph">${ic("report")}</div><h3>Nothing to report</h3>No activity was found for the selected period.<div style="margin-top:14px"><button class="btn btn-ghost btn-sm">Reset filters</button></div></div></div>
    <div class="panel" style="padding:12px 16px">${Array.from({ length: 7 }, (_, i) => `<div style="display:grid;grid-template-columns:3fr 1fr 1fr 1fr;gap:16px;height:36px;align-items:center;border-bottom:1px solid var(--divider)"><div class="sk" style="width:${60 + (i * 13) % 35}%"></div><div class="sk" style="width:70%"></div><div class="sk" style="width:50%"></div><div class="sk" style="width:40%"></div></div>`).join("")}</div>
    <div class="panel"><div class="empty"><div class="glyph" style="color:var(--danger)">${ic("alert")}</div><h3>Couldn't load team tasks</h3>The server didn't respond in time. Your filters are kept.<div style="margin-top:14px;display:flex;gap:8px;justify-content:center"><button class="btn btn-secondary btn-sm">Retry</button><button class="btn btn-ghost btn-sm">Go Back</button></div></div></div>
    <div class="panel"><div class="empty"><div class="glyph">${ic("admin")}</div><h3>You don't have access</h3>Team performance is visible to SOC and Security Managers.<div style="margin-top:14px"><button class="btn btn-ghost btn-sm">Contact Administrator</button></div></div></div>
  </div></div>`);
}

function login() {
  return `<div class="login"><div class="login-l"><form class="login-form" onsubmit="location.hash='#/dashboard';return false">
    <div class="brand" style="padding:0;margin-bottom:20px"><span class="brand-mark">S</span><span>Sentinel Ops</span></div>
    <h1 style="font:var(--text-display);letter-spacing:var(--tracking-title);margin:0">Sign in</h1><p class="sec" style="margin:-6px 0 8px">Security Department workspace</p>
    <button type="button" class="btn btn-secondary" style="justify-content:center;height:36px">Continue with SSO</button>
    <div class="muted" style="font-size:12px;text-align:center">or</div>
    <div class="field"><label>Work email</label><input class="input" style="height:36px" value="s.rahimi@corp.local"></div>
    <div class="field"><label>Password</label><input class="input" style="height:36px" type="password" value="••••••••••"></div>
    <button class="btn btn-primary" style="justify-content:center;height:36px">Sign in</button>
    <p class="muted" style="font-size:12px">Trouble signing in? Contact your administrator.</p></form></div>
    <div class="login-r"><div style="max-width:420px"><div class="mono muted" style="margin-bottom:10px">TODAY · SEP 28</div><div style="font:600 22px/30px var(--font-sans);letter-spacing:var(--tracking-title)">Tasks, shift logs and team output — in one quiet place.</div><p class="sec">Internal use only. Activity is recorded for audit.</p></div></div></div>`;
}

/* ---------- modals / popovers ---------- */
function openCreate() {
  const el = document.createElement("div"); el.className = "scrim";
  el.innerHTML = `<div class="modal" role="dialog" aria-label="Create task"><div class="modal-body">
    <div class="crumbs" style="margin-bottom:12px"><span class="badge">SOC · L1</span>${ic("chev")}<b>New task</b></div>
    <input class="title-input" placeholder="Task title" autofocus>
    <textarea class="desc-input" placeholder="Add description…"></textarea>
    <div class="prop-row">
      <button class="prop">${av("sr")}Sara Rahimi</button><button class="prop">${prio("normal")}</button><button class="prop">${cx(2)}</button>
      <button class="prop">${ic("cal")}Start: Today</button><button class="prop">${ic("flag")}Deadline</button>
      <label class="prop"><input type="checkbox" class="switch" checked>Review required</label>
    </div>
    <button class="disclose" data-act="adv">${ic("chev")}Checklist, attachments, external reference</button>
    <div id="adv" hidden style="margin-top:12px;display:grid;gap:10px">
      <div class="field"><label>Checklist</label><input class="input" placeholder="Add first item and press Enter"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="field"><label>External reference</label><input class="input mono" placeholder="e.g. splunk/search/88213"></div><div class="field"><label>Attachments</label><button class="btn btn-secondary">${ic("clip")}Attach files</button></div></div>
    </div></div>
    <div class="modal-foot"><label class="sec" style="font-size:12px;display:flex;gap:8px;align-items:center"><input type="checkbox" class="switch">Create another</label><span style="margin-left:auto" class="muted"><kbd>Esc</kbd></span><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-create>Create Task <kbd style="border-color:rgba(255,255,255,.3);color:rgba(255,255,255,.8)">⌘↵</kbd></button></div></div>`;
  document.body.append(el);
  $(".title-input", el).focus();
  el.addEventListener("click", e => {
    if (e.target === el || e.target.closest("[data-close]")) el.remove();
    if (e.target.closest("[data-create]")) { el.remove(); toast("Task T-1045 created and assigned to Sara Rahimi"); }
    if (e.target.closest('[data-act="adv"]')) { const a = $("#adv", el); a.hidden = !a.hidden; }
  });
}
function popover(anchor, html, onPick) {
  document.querySelectorAll(".pop").forEach(p => p.remove());
  const r = anchor.getBoundingClientRect(), el = document.createElement("div");
  el.className = "pop"; el.innerHTML = html;
  el.style.left = Math.min(r.left, innerWidth - 300) + "px"; el.style.top = r.bottom + 6 + "px";
  document.body.append(el);
  el.addEventListener("click", e => { const mi = e.target.closest("[data-v]"); if (mi) { onPick && onPick(mi.dataset.v); el.remove(); } });
  setTimeout(() => document.addEventListener("click", function h(e) { if (!el.contains(e.target)) { el.remove(); document.removeEventListener("click", h); } }), 0);
}
const statusMenu = () => `<div class="ph">Change status</div>` + Object.keys(STATUS).map((s, i) => `<div class="mi" data-v="${s}">${status(s)}<kbd>${i + 1}</kbd></div>`).join("");
const prioMenu = () => `<div class="ph">Priority</div>` + Object.keys(PRIO).map(p => `<div class="mi" data-v="${p}">${prio(p)}</div>`).join("");

/* ---------- router & events ---------- */
function render() {
  const h = location.hash.replace(/^#\/?/, "") || "dashboard";
  const [a, b] = h.split("/");
  document.documentElement.dataset.theme = state.theme;
  const view = a === "login" ? login() : a === "tasks" && b && b.startsWith("T-") ? taskDetail(b) : a === "tasks" ? tasksPage(b || "my")
    : a === "shift" ? (b === "history" ? shiftHistory() : shiftLog()) : a === "team" ? team()
    : a === "perf" ? (b === "overview" ? perfOverview() : performance()) : a === "reports" ? reports(b) : a === "admin" ? admin() : a === "states" ? states() : dashboard();
  $("#root").innerHTML = view;
  const q = $("#q"); if (q && state.q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}
addEventListener("hashchange", () => { state.kb = 0; render(); });
document.addEventListener("input", e => { if (e.target.id === "q") { state.q = e.target.value; render(); } if (e.target.id === "ioc") activities[7].iocs = +e.target.value || 0; });
document.addEventListener("click", e => {
  const t = e.target.closest("[data-act],[data-sort],[data-task],[data-edit],[data-filter],[data-clear],[data-view],[data-toggle],[data-issue],[data-ioc],[data-go],[data-person],[data-shiftview]");
  if (!t) return;
  const d = t.dataset;
  if (d.edit) {
    e.stopPropagation();
    return popover(t, d.edit === "status" ? statusMenu() : prioMenu(), v => { const task = tasks.find(x => x.id === d.id); task[d.edit] = v; toast(`${task.id} → ${d.edit === "status" ? STATUS[v] : PRIO[v]}`); render(); });
  }
  if (d.act === "collapse") { state.collapsed = !state.collapsed; render(); }
  if (d.act === "theme") { state.theme = state.theme === "dark" ? "light" : "dark"; render(); }
  if (d.act === "role") { state.role = { analyst: "soc", soc: "security", security: "analyst" }[state.role]; location.hash = "#/dashboard"; render(); }
  if (d.act === "create") openCreate();
  if (d.act === "reset") { state.q = ""; state.filters = { status: null, prio: null }; render(); }
  if (d.act === "export") toast("Report exported · Employee_Monthly_Sep2026.xlsx");
  if (d.act === "submit-review") toast("Submitted for review · Leila Nouri notified");
  if (d.act === "complete-shift") { const left = activities.filter(a => !a.done); if (left.length) { const el = $(`#act-${left[0].n}`); el.scrollIntoView({ behavior: "smooth", block: "center" }); el.style.background = "var(--warning-soft)"; setTimeout(() => el.style.background = "", 1200); } else { state.shiftDone = true; toast("Shift completed · summary sent to Leila Nouri"); render(); } }
  if (d.act === "add-ticket") { const row = document.createElement("div"); row.className = "ticket"; row.innerHTML = `<input class="input mono" placeholder="INC-2026-…" autofocus><input class="input mono" placeholder="Reference"><input class="input" placeholder="Short description"><button class="btn btn-secondary btn-sm">Save</button>`; $("#tickets").append(row); $("input", row).focus(); row.querySelector("button").onclick = () => { const no = $("input", row).value.trim(); if (!no) { $("input", row).style.borderColor = "var(--danger)"; return; } tickets.push({ no, ref: row.children[1].value, desc: row.children[2].value }); toast(`Ticket ${no} added`); render(); }; }
  if (d.act === "cmdk") popover(t, `<div class="ph">Jump to</div>${[["dashboard", "Dashboard"], ["tasks/my", "My Tasks"], ["shift", "Today's Shift Log"], ["perf/employee", "My Performance"], ["reports/tickets", "Ticket Report"], ["states", "Empty / loading / error states"], ["login", "Login screen"]].map(([h, n]) => `<div class="mi" data-v="${h}">${n}</div>`).join("")}<div class="sep"></div><div class="mi" data-v="create">${ic("plus")}Create Task<kbd>C</kbd></div>`, v => v === "create" ? openCreate() : (location.hash = "#/" + v));
  if (d.act === "notif") popover(t, `<div class="ph" style="display:flex">Notifications<span style="margin-left:auto">Mark all read</span></div>${[["New task assigned", "T-1042 · by Leila Nouri", "3h"], ["Task returned", "T-1033 · changes requested", "1h"], ["Mentioned in comment", "T-1038 · Reza Jafari", "1d"], ["Deadline approaching", "T-1041 due in 2 days", "1d"]].map(([a, b, w]) => `<div class="mi" style="height:auto;padding:8px;align-items:flex-start;width:320px"><div><div>${a}</div><div class="muted" style="font-size:12px">${b}</div></div><span class="muted" style="margin-left:auto;font-size:12px">${w}</span></div>`).join("")}`);
  if (d.act === "tickets") popover(t, `<div class="ph">Tickets created · Sep</div>${ticketLog.filter(r => r[0] === "sr").map(r => `<div class="mi"><span class="mono">${r[2]}</span><span class="muted" style="margin-left:auto;font-size:12px">${fmtDate(r[1])}</span></div>`).join("")}<div class="sep"></div><div class="mi" data-v="x">Open Ticket Report ${ic("chev")}</div>`, () => location.hash = "#/reports/tickets");
  if (d.sort) { state.sort = { k: d.sort, dir: state.sort.k === d.sort ? -state.sort.dir : 1 }; render(); }
  if (d.filter) popover(t, d.filter === "status" ? statusMenu() : prioMenu(), v => { state.filters[d.filter] = v; render(); });
  if (d.clear) { state.filters[d.clear] = null; render(); }
  if (d.view) { state.taskView = d.view; render(); }
  if (d.go) location.hash = "#/" + d.go;
  if (d.person) location.hash = "#/perf/employee";
  if (d.shiftview) { state.shiftDone = d.shiftview === "1"; render(); }
  if (d.toggle) { const a = activities.find(x => x.n == d.toggle); a.done = !a.done; render(); }
  if (d.ioc) { const a = activities[7]; a.iocs = Math.max(0, a.iocs + +d.ioc); $("#ioc").value = a.iocs; }
  if (d.issue) { const box = $(`#issue-${d.issue}`); box.hidden = !box.hidden; box.innerHTML = `<div class="issue"><input class="input" placeholder="Issue summary" autofocus><textarea class="textarea" placeholder="What happened? (optional)"></textarea><div style="display:flex;gap:8px"><button class="btn btn-ghost btn-sm">${ic("clip")}Attachment</button><button class="btn btn-ghost btn-sm">${ic("link")}External reference</button><button class="btn btn-secondary btn-sm" style="margin-left:auto">Save issue</button></div></div>`; $("input", box)?.focus(); }
  if (d.task && !e.target.closest(".cell-edit")) location.hash = "#/tasks/" + d.task;
});
document.addEventListener("keydown", e => {
  if (e.target.matches("input,textarea,[contenteditable]")) { if (e.key === "Escape") e.target.blur(); return; }
  if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); $('[data-act="cmdk"]')?.click(); return; }
  if (e.key === "Escape") document.querySelectorAll(".scrim,.pop").forEach(x => x.remove());
  if (e.key === "c") { e.preventDefault(); openCreate(); }
  if (e.key === "/" && $("#q")) { e.preventDefault(); $("#q").focus(); }
  if (state.visible && location.hash.match(/tasks\/(my|team|all)/)) {
    const n = state.visible.length;
    if (e.key === "j" || e.key === "ArrowDown") { state.kb = Math.min(n - 1, state.kb + 1); render(); }
    if (e.key === "k" || e.key === "ArrowUp") { state.kb = Math.max(0, state.kb - 1); render(); }
    if (e.key === "Enter") location.hash = "#/tasks/" + state.visible[state.kb].id;
    if (e.key === "s") { const row = document.querySelector("tr.kb [data-edit=status]"); row && row.click(); }
  }
});
render();
