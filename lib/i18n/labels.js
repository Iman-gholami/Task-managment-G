// Display names for stored values, in the viewer's language. The database keeps the original values
// ("progress", "SOC · L1", "soc_manager"); only the label changes.
const TEAM_KEY = {
  "SOC · L1": "socL1",
  "SOC · L2": "socL2",
  "SOC · L3": "socL3",
  SOC: "soc",
  "Design & Automation": "da",
  "Threat Intelligence": "ti",
  "Security Department": "dept",
};

const known = (t, key, fallback) => (t.has(key) ? t(key) : fallback ?? "—");

export const statusName = (t, s) => known(t, `enums.status.${s}`, s);
export const prioName = (t, p) => known(t, `enums.prio.${p}`, p);
export const cxName = (t, c) => known(t, `enums.cx.${c}`, String(c ?? "—"));
export const qualityName = (t, q) => (q ? known(t, `enums.quality.${q}`, q) : "—");
export const roleName = (t, r) => known(t, `enums.role.${r}`, r);
/** Team or analytics group ("SOC · L1", "Design & Automation", or a group key such as "da"). */
export const teamName = (t, team) => {
  if (!team) return "—";
  const key = TEAM_KEY[team] ?? team;
  return known(t, `enums.team.${key}`, team);
};
export const shiftTypeName = (t, type, form = "") => known(t, `enums.shiftType${form}.${type}`, type);
export const itemKindName = (t, kind) => known(t, `enums.itemKind.${kind}`, kind);
export const swapStatusName = (t, s) => known(t, `enums.swapStatus.${s}`, s);

export { TEAM_KEY };
