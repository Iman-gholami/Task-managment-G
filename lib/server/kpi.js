import "server-only";
import { db } from "@/lib/server/db";
import { factsFor } from "@/lib/server/analytics";
import { listUsers } from "@/lib/server/repo";
import { stats } from "@/lib/analytics/metrics";
import { teamParts } from "@/lib/analytics/labels";
import {
  calculateKpi,
  DEFAULT_KPI_CONFIGS,
  KPI_SCOPES,
  KPI_SOURCES,
  KPI_STATUSES,
  QUALITY_SCORE,
  sanitizeKpiConfig,
} from "@/lib/analytics/kpi";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function kpiScopesFor(user) {
  if (user?.role === "security_manager") return KPI_SCOPES;
  if (user?.role === "soc_manager") return ["SOC"];
  return [];
}

export const canManageKpiScope = (user, scope) => kpiScopesFor(user).includes(scope);

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function rowConfig(row) {
  if (!row) return null;
  return {
    id: row.id,
    scope: row.scope,
    version: row.version,
    name: row.name,
    specializedWeight: Number(row.specialized_weight),
    target: Number(row.target),
    complexityWeights: parseJson(row.complexity_weights, [1, 2, 3, 5]),
    items: parseJson(row.items, []),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function currentConfig(scope) {
  return rowConfig(db.prepare("SELECT * FROM kpi_configs WHERE scope = ? ORDER BY version DESC LIMIT 1").get(scope));
}

function configById(id) {
  return rowConfig(db.prepare("SELECT * FROM kpi_configs WHERE id = ?").get(id));
}

export function kpiSettingsFor(user) {
  const scopes = kpiScopesFor(user);
  const configs = scopes.map((scope) => currentConfig(scope)).filter(Boolean);
  const versions = Object.fromEntries(scopes.map((scope) => [
    scope,
    db.prepare("SELECT id, version, name, created_by AS createdBy, created_at AS createdAt FROM kpi_configs WHERE scope = ? ORDER BY version DESC LIMIT 12").all(scope),
  ]));
  return { scopes, configs, versions, sources: KPI_SOURCES };
}

export function saveKpiConfig(user, input) {
  const scope = String(input?.scope || "");
  if (!canManageKpiScope(user, scope)) throw Object.assign(new Error("You cannot manage KPI settings for this group."), { status: 403 });
  const cfg = sanitizeKpiConfig(input, scope);
  const specialized = cfg.items.filter((x) => x.category === "specialized");
  const shared = cfg.items.filter((x) => x.category === "shared");
  if (!specialized.length || !shared.length) throw Object.assign(new Error("Keep at least one specialized and one shared KPI."), { status: 400 });
  const prev = currentConfig(scope);
  const version = (prev?.version ?? 0) + 1;
  const result = db.prepare(
    "INSERT INTO kpi_configs (scope, version, name, specialized_weight, target, complexity_weights, items, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    scope,
    version,
    cfg.name,
    cfg.specializedWeight,
    cfg.target,
    JSON.stringify(cfg.complexityWeights),
    JSON.stringify(cfg.items),
    user.id,
  );
  const id = Number(result.lastInsertRowid);
  db.prepare("INSERT INTO kpi_events (config_id, scope, action, detail, user_id) VALUES (?, ?, 'config_saved', ?, ?)")
    .run(id, scope, `KPI configuration v${version} saved`, user.id);
  return configById(id);
}

function evaluationRow(userId, from, to) {
  const row = db.prepare(
    "SELECT * FROM kpi_evaluations WHERE user_id = ? AND period_from = ? AND period_to = ?"
  ).get(userId, from, to);
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    from: row.period_from,
    to: row.period_to,
    configId: row.config_id,
    scores: parseJson(row.scores, {}),
    summary: parseJson(row.summary, {}),
    status: row.status,
    evaluatorId: row.evaluator_id,
    finalizedAt: row.finalized_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function qualityAuto(tasks, config) {
  let sum = 0;
  let weight = 0;
  for (const task of tasks) {
    const q = QUALITY_SCORE[task.quality];
    if (!Number.isFinite(q)) continue;
    const w = Number(config.complexityWeights?.[(Number(task.cx) || 1) - 1]) || 1;
    sum += q * w;
    weight += w;
  }
  return weight ? sum / weight : null;
}

function productivityAuto(tasks, config) {
  if (!config.target) return null;
  let points = 0;
  for (const task of tasks) {
    const w = Number(config.complexityWeights?.[(Number(task.cx) || 1) - 1]) || 1;
    const q = QUALITY_SCORE[task.quality];
    points += w * (Number.isFinite(q) ? q / 100 : 1);
  }
  return tasks.length ? Math.min(100, points / config.target * 100) : null;
}

function autoScores(facts, person, range, config) {
  const s = stats(facts, [person.id], { from: range.from, end: range.to, to: range.to });
  const tasks = facts.tasks.filter((t) => t.a === person.id && t.completed && t.completed >= range.from && t.completed <= range.to);
  return {
    quality: qualityAuto(tasks, config),
    productivity: productivityAuto(tasks, config),
    onTime: s.onTimeRate === null ? null : s.onTimeRate * 100,
    routine: s.routineRate === null ? null : s.routineRate * 100,
    closure: s.closureRate === null ? null : s.closureRate * 100,
    returnQuality: s.returnShare === null ? null : (1 - s.returnShare) * 100,
  };
}

function periodOk(from, to) {
  return ISO.test(from || "") && ISO.test(to || "") && from <= to;
}

function visiblePeople(user, facts) {
  const allowed = new Set(kpiScopesFor(user));
  return facts.people.filter((p) => !p.manager && allowed.has(p.group));
}

function buildResult(user, facts, person, from, to) {
  const evaluation = evaluationRow(person.id, from, to);
  const config = evaluation ? configById(evaluation.configId) : currentConfig(person.group);
  if (!config) return null;
  const auto = autoScores(facts, person, { from, to }, config);
  const calc = calculateKpi(config, auto, evaluation?.scores ?? {});
  return {
    person,
    config,
    evaluation: evaluation ?? { id: null, userId: person.id, from, to, configId: config.id, scores: {}, summary: {}, status: "draft", finalizedAt: null, updatedAt: null },
    auto,
    ...calc,
  };
}

export function kpiResultsFor(user, { from, to }) {
  if (!periodOk(from, to)) throw Object.assign(new Error("Choose a valid KPI period."), { status: 400 });
  const facts = factsFor(user, { wf: from, wt: to });
  if (!facts) throw Object.assign(new Error("KPI evaluation is not available for this view."), { status: 403 });
  const rows = visiblePeople(user, facts).map((p) => buildResult(user, facts, p, from, to)).filter(Boolean);
  return {
    from,
    to,
    rows,
    scopes: kpiScopesFor(user),
    sources: KPI_SOURCES,
    statuses: KPI_STATUSES,
  };
}

function sanitizeScores(config, input) {
  const out = {};
  for (const item of config.items) {
    const raw = input?.[item.id];
    if (!raw || raw.value === "" || raw.value === null || raw.value === undefined) continue;
    const value = Number(raw.value);
    if (!Number.isFinite(value) || value < 0 || value > 100) throw Object.assign(new Error(`Score for ${item.name} must be between 0 and 100.`), { status: 400 });
    const note = String(raw.note || "").trim().slice(0, 800);
    if (item.source && !note) throw Object.assign(new Error(`Add a reason when overriding the automatic score for ${item.name}.`), { status: 400 });
    out[item.id] = { value, note };
  }
  return out;
}

function sanitizeSummary(input = {}) {
  const pick = (key, max = 2000) => String(input?.[key] || "").trim().slice(0, max);
  return { strengths: pick("strengths"), improve: pick("improve"), plan: pick("plan"), critical: pick("critical") };
}

export function saveKpiEvaluation(user, body) {
  const userId = String(body?.userId || "");
  const from = String(body?.from || "");
  const to = String(body?.to || "");
  if (!periodOk(from, to)) throw Object.assign(new Error("Choose a valid KPI period."), { status: 400 });
  const target = listUsers().find((u) => u.id === userId && u.active);
  if (!target) throw Object.assign(new Error("Employee not found."), { status: 404 });
  const { group } = teamParts(target.team);
  if (!group || !canManageKpiScope(user, group)) throw Object.assign(new Error("You cannot evaluate this employee."), { status: 403 });

  const existing = evaluationRow(userId, from, to);
  const config = existing ? configById(existing.configId) : currentConfig(group);
  if (!config) throw Object.assign(new Error("No KPI configuration is assigned to this group."), { status: 409 });
  const scores = sanitizeScores(config, body?.scores);
  const summary = sanitizeSummary(body?.summary);
  const status = body?.status === "final" ? "final" : "draft";

  if (status === "final") {
    const facts = factsFor(user, { wf: from, wt: to });
    const person = facts?.people.find((p) => p.id === userId);
    if (!person) throw Object.assign(new Error("Employee is outside your analytics scope."), { status: 403 });
    const auto = autoScores(facts, person, { from, to }, config);
    const calc = calculateKpi(config, auto, scores);
    if (!calc.complete) throw Object.assign(new Error("Complete every KPI before finalizing the evaluation."), { status: 400 });
  }

  let id;
  if (existing) {
    db.prepare(
      "UPDATE kpi_evaluations SET scores = ?, summary = ?, status = ?, evaluator_id = ?, finalized_at = CASE WHEN ? = 'final' THEN COALESCE(finalized_at, datetime('now')) ELSE NULL END, updated_at = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(scores), JSON.stringify(summary), status, user.id, status, existing.id);
    id = existing.id;
  } else {
    const result = db.prepare(
      "INSERT INTO kpi_evaluations (user_id, period_from, period_to, config_id, scores, summary, status, evaluator_id, finalized_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'final' THEN datetime('now') ELSE NULL END)"
    ).run(userId, from, to, config.id, JSON.stringify(scores), JSON.stringify(summary), status, user.id, status);
    id = Number(result.lastInsertRowid);
  }
  db.prepare("INSERT INTO kpi_events (config_id, evaluation_id, scope, action, detail, user_id) VALUES (?, ?, ?, ?, ?, ?)")
    .run(config.id, id, group, status === "final" ? "evaluation_finalized" : "evaluation_saved", `${from}..${to}`, user.id);

  return kpiResultsFor(user, { from, to }).rows.find((r) => r.person.id === userId);
}

export function kpiPilotDefaults() {
  return DEFAULT_KPI_CONFIGS;
}
