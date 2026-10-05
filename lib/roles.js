// Shared by the API and the UI.
export const ROLE_LABELS = { analyst: "Analyst", engineer: "Engineer", soc_manager: "SOC Manager", security_manager: "Security Manager" };
export const TEAMS = ["SOC · L1", "SOC · L2", "SOC · L3", "SOC", "Design & Automation", "Threat Intelligence", "Security Department"];
export const SOC_TEAMS = ["SOC · L1", "SOC · L2", "SOC · L3"];

export const isManager = (u) => u?.role === "soc_manager" || u?.role === "security_manager";

/** Dashboard variant for a user. */
export const dashboardFor = (u) => (u.role === "soc_manager" ? "soc" : u.role === "security_manager" ? "security" : "analyst");

/**
 * Member management rules:
 * - Security Manager: manages everyone except Security Managers.
 * - SOC Manager: manages Analysts in SOC teams (SOC · L1/L2/L3).
 */
export function canManageMember(actor, target) {
  if (!actor || actor.id === target.id) return false;
  if (actor.role === "security_manager") return target.role !== "security_manager";
  if (actor.role === "soc_manager") return target.role === "analyst" && SOC_TEAMS.includes(target.team);
  return false;
}

/** Roles and teams an actor may assign when adding a member. */
export function assignableFor(actor) {
  if (actor?.role === "security_manager") return { roles: ["analyst", "engineer", "soc_manager"], teams: TEAMS.filter((t) => t !== "Security Department") };
  if (actor?.role === "soc_manager") return { roles: ["analyst"], teams: SOC_TEAMS };
  return { roles: [], teams: [] };
}

const teamKey = (team = "") => (team.startsWith("SOC") ? "SOC" : team);

/** Whose tasks count as "my team" for the viewer (a Security Manager's team is the whole department). */
export function inTeamScope(viewer, user) {
  if (!user) return false;
  if (viewer.role === "security_manager") return true;
  return teamKey(user.team) === teamKey(viewer.team) || (viewer.role === "soc_manager" && teamKey(user.assist ?? "") === "SOC");
}


/**
 * Task visibility:
 * - Analysts/engineers only see their own tasks.
 * - SOC Managers see tasks assigned within their SOC scope.
 * - Security Managers see all tasks.
 */
export function canAccessTask(actor, task) {
  if (!actor || !task) return false;
  if (task.a === actor.id) return true;
  if (actor.role === "security_manager") return true;
  return actor.role === "soc_manager" && teamKey(task.team) === teamKey(actor.team);
}

/** Who an actor may assign a task to. Mirrors task visibility scope. */
export function canAssignTask(actor, assignee) {
  if (!actor || !assignee) return false;
  if (assignee.id === actor.id) return true;
  if (actor.role === "security_manager") return true;
  return actor.role === "soc_manager" && teamKey(assignee.team) === teamKey(actor.team);
}
