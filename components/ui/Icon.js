const PATHS = {
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

export default function Icon({ name, className = "i" }) {
  return <svg className={className} viewBox="0 0 20 20" aria-hidden="true" dangerouslySetInnerHTML={{ __html: PATHS[name] || "" }} />;
}
