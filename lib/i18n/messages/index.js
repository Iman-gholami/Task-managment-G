// Dictionaries, one file per area. Each file exports { fa: {…}, en: {…} } with the same shape in both languages.
// Keys are addressed as "<file>.<path>", e.g. t("tasks.create"). tests/i18n.unit.test.mjs keeps the two in step.
import common from "./common.js";
import enums from "./enums.js";
import errors from "./errors.js";
import events from "./events.js";
import nav from "./nav.js";
import shell from "./shell.js";
import notifications from "./notifications.js";
import dashboard from "./dashboard.js";
import tasks from "./tasks.js";
import task from "./task.js";
import shift from "./shift.js";
import schedule from "./schedule.js";
import checklists from "./checklists.js";
import insights from "./insights.js";
import reports from "./reports.js";
import team from "./team.js";
import admin from "./admin.js";
import account from "./account.js";
import auth from "./auth.js";
import onboarding from "./onboarding.js";
import states from "./states.js";
import dates from "./dates.js";

export const NAMESPACES = { common, enums, errors, events, nav, shell, notifications, dashboard, tasks, task, shift, schedule, checklists, insights, reports, team, admin, account, auth, onboarding, states, dates };

export const MESSAGES = { fa: {}, en: {} };
for (const [name, dict] of Object.entries(NAMESPACES)) {
  MESSAGES.fa[name] = dict.fa;
  MESSAGES.en[name] = dict.en;
}
