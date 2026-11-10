import { STANDARD_CHECKLIST } from "../checklists.js";
import { ENGINEERING_CHECKLIST } from "../shift-log-mode.js";
import { translate } from "./messages.js";

/** Translate unchanged built-in activities only. Custom or edited text stays exactly as entered. */
export function shiftActivityText(activity, checklist, locale) {
  if (locale !== "fa") return { title: activity.title, hint: activity.hint };
  const legacy = activity.legacyN ?? (activity.itemId == null ? activity.n : null);
  const standard = STANDARD_CHECKLIST.items.find((item) => item.legacyN === legacy && item.title === activity.title);
  const engineering = checklist?.builtIn && ENGINEERING_CHECKLIST.items.find((item) => item.id === activity.itemId && item.title === activity.title);
  const source = standard || engineering;
  if (!source) return { title: activity.title, hint: activity.hint };
  return {
    title: translate(locale, activity.title),
    hint: activity.hint && activity.hint === source.hint ? translate(locale, activity.hint) : activity.hint,
  };
}
