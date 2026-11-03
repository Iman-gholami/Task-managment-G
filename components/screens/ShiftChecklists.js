"use client";

import { useI18n as useEngShiftI18n } from "@/components/I18nProvider";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, useApp } from "@/components/AppProvider";
import Dialog from "@/components/ui/Dialog";
import Icon from "@/components/ui/Icon";
import { Field, FieldError, FormAlert } from "@/components/ui/Field";
import { IconButton, PageHeader, Panel } from "@/components/ui/layout";
import { EmptyState, ErrorState, Loading } from "@/components/ui/states";
import useUnsavedChanges from "@/components/useUnsavedChanges";
import { CHECKLIST_LIMITS, ITEM_KINDS, ITEM_KIND_KEYS, changeSummary, describeChanges, normalizeChecklist, sameChecklistItem } from "@/lib/checklists";
import { SHIFT_TYPES, SHIFT_TYPE_KEYS } from "@/lib/shifts";
import { plural, when } from "@/lib/format";
import { taskWhen } from "@/lib/task-date";

const LEAVE = "You have unsaved checklist changes. Leave without saving?";
const EVENT_ICONS = { created: "plus", saved: "edit", migrated: "refresh", assigned: "link", unassigned: "x", enabled: "checkCircle", disabled: "blocked", archived: "inbox" };

let keySeq = 0;
const newKey = () => `new-${++keySeq}`;
const blankItem = () => ({ key: newKey(), id: null, title: "", hint: "", kind: "basic", shiftTypes: [...SHIFT_TYPE_KEYS], active: true });
const toDraft = (c) => ({ name: c.name, description: c.description, items: c.items.map((it) => ({ ...it, key: `item-${it.id}` })), removed: [] });
const payloadOf = (d) => ({
  name: d.name,
  description: d.description,
  items: d.items.map(({ id, title, hint, kind, shiftTypes, active }) => ({ id, title, hint, kind, shiftTypes, active })),
});
const perShift = (items) => SHIFT_TYPE_KEYS.map((k) => [k, items.filter((it) => it.active && it.shiftTypes.includes(k)).length]);
const countText = (count, kind, locale, number) => locale === "fa"
  ? `${number(count)} ${({ checklist: "چک‌لیست", "active item": "مورد فعال", analyst: "کارشناس", item: "مورد", problem: "مشکل", version: "نسخه" })[kind] ?? kind}`
  : plural(count, kind);
const changesText = (changes, locale, number) => {
  if (locale !== "fa") return changeSummary(changes);
  const parts = [];
  if (changes.added) parts.push(`${number(changes.added)} افزوده`);
  if (changes.removed) parts.push(`${number(changes.removed)} حذف‌شده`);
  if (changes.edited) parts.push(`${number(changes.edited)} ویرایش‌شده`);
  if (changes.reordered) parts.push("تغییر ترتیب");
  if (changes.details) parts.push("تغییر نام یا توضیحات");
  return parts.join(" · ") || "بدون تغییر";
};
const eventText = (event, locale, number, teamText) => {
  if (locale !== "fa") return event.detail;
  const text = event.detail ?? "";
  let match;
  if ((match = /^Created(?: as a copy of “(.*)”)\s*·\s*(\d+) items?$/.exec(text))) return `کپی از «${match[1]}» ایجاد شد · ${number(Number(match[2]))} مورد`;
  if ((match = /^Created\s*·\s*(\d+) items?$/.exec(text))) return `ایجاد شد · ${number(Number(match[1]))} مورد`;
  if ((match = /^Version (\d+) · (.*)$/.exec(text))) {
    const parts = match[2].split(" · ").map((part) => {
      const count = /^(\d+) (added|removed|edited)$/.exec(part);
      if (count) return `${number(Number(count[1]))} ${{ added: "افزوده", removed: "حذف‌شده", edited: "ویرایش‌شده" }[count[2]]}`;
      return ({ reordered: "تغییر ترتیب", "name or description changed": "تغییر نام یا توضیحات", "no changes": "بدون تغییر" })[part] ?? part;
    });
    return `نسخه ${number(Number(match[1]))} · ${parts.join(" · ")}`;
  }
  if (text === "Archived; existing shift logs keep their copy") return "بایگانی شد؛ گزارش‌های شیفت موجود نسخه خود را حفظ می‌کنند";
  const migratedPrefix = "Built-in routine migrated as version 1 and assigned to ";
  if (text.startsWith(migratedPrefix)) return `فعالیت پیش‌فرض به نسخه ۱ منتقل و به ${text.slice(migratedPrefix.length).split(", ").map(teamText).join("، ")} واگذار شد`;
  if ((match = /^Assigned to (.*), replacing “(.*)”$/.exec(text))) return `به ${teamText(match[1])} واگذار شد و جای «${match[2]}» را گرفت`;
  if ((match = /^Assigned to (.*)$/.exec(text))) return `به ${teamText(match[1])} واگذار شد`;
  if ((match = /^Removed from (.*)$/.exec(text))) return `از ${teamText(match[1])} حذف شد`;
  if ((match = /^Replaced by “(.*)” for (.*)$/.exec(text))) return `در ${teamText(match[2])} با «${match[1]}» جایگزین شد`;
  if ((match = /^(Enabled|Disabled) for (.*)$/.exec(text))) return `برای ${teamText(match[2])} ${match[1] === "Enabled" ? "فعال" : "غیرفعال"} شد`;
  return text;
};

/** Managers: define Shift Log checklists, choose which SOC group uses which, and see what changed when. */
export default function ShiftChecklists() {
  const { t: __shiftFaTr, locale, number, team: teamText } = useEngShiftI18n();
  const { toast } = useApp();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [draft, setDraft] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [creating, setCreating] = useState(false);
  const editorRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api("/api/shift/checklists");
      setData(res);
      setLoadError(null);
      setSelectedId((id) => (id && res.checklists.some((c) => c.id === id) ? id : res.checklists[0]?.id ?? null));
    } catch (e) {
      setLoadError(e);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Only the latest requested checklist may fill the editor, however quickly the manager clicks through the list.
  const wanted = useRef(null);
  const loadDetail = useCallback(async (id) => {
    wanted.current = id;
    setDetailError(null);
    try {
      const res = await api(`/api/shift/checklists/${id}`);
      if (wanted.current !== id) return;
      setDetail(res);
      setDraft(toDraft(res.checklist));
      setAttempted(false);
      setServerError(null);
    } catch (e) {
      if (wanted.current !== id) return;
      setDetail(null);
      setDraft(null);
      setDetailError(e);
    }
  }, []);
  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else { wanted.current = null; setDetail(null); setDraft(null); }
  }, [selectedId, loadDetail]);

  const base = detail?.checklist?.id === selectedId ? detail.checklist : null;
  const normalized = useMemo(() => (draft ? normalizeChecklist(payloadOf(draft)) : null), [draft]);
  const changes = base && normalized ? describeChanges(base, normalized.value) : null;
  const dirty = !!changes?.any;
  useUnsavedChanges(dirty, { links: true, message: __shiftFaTr(LEAVE) });

  /** Runs `next` now, or after the manager agrees to drop unsaved edits. */
  const whenClean = (next) => {
    if (!dirty) return next();
    setConfirm({
      title: __shiftFaTr("Discard unsaved changes?"),
      body: locale === "fa" ? `تغییرات «${base.name}» (${changesText(changes, locale, number)}) ذخیره نشده است.` : `Your changes to “${base.name}” (${changeSummary(changes)}) have not been saved.`,
      confirmLabel: __shiftFaTr("Discard changes"),
      danger: true,
      onConfirm: async () => { setDraft(toDraft(base)); next(); },
    });
  };

  const select = (id) => {
    if (id === selectedId) return;
    whenClean(() => setSelectedId(id));
  };
  const openInEditor = (id) => {
    const go = () => {
      setSelectedId(id);
      requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    if (id === selectedId) go();
    else whenClean(go);
  };

  const save = async () => {
    setAttempted(true);
    if (normalized.errors) {
      requestAnimationFrame(() => document.querySelector(".cl-editor [aria-invalid='true']")?.focus());
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const res = await api(`/api/shift/checklists/${base.id}`, { method: "PUT", body: { version: base.version, ...payloadOf(draft) } });
      setDetail({ checklist: res.checklist, versions: res.versions, events: res.events });
      setDraft(toDraft(res.checklist));
      setAttempted(false);
      toast(locale === "fa" ? `«${res.checklist.name}» با نسخه ${number(res.checklist.version)} ذخیره شد` : `“${res.checklist.name}” saved as version ${res.checklist.version}`);
      load();
    } catch (e) {
      setServerError({ message: e.message, conflict: !!e.data?.conflict });
    } finally {
      setSaving(false);
    }
  };

  const assignmentRequest = async (body, done) => {
    try {
      const res = await api("/api/shift/checklist-assignments", { method: "PUT", body });
      setData((d) => ({ ...d, groups: res.groups }));
      toast(done);
      load();
      if (selectedId && wanted.current === selectedId) {
        const fresh = await api(`/api/shift/checklists/${selectedId}`).catch(() => null);
        if (fresh) setDetail((d) => (d?.checklist?.id === selectedId ? { ...d, events: fresh.events, checklist: { ...d.checklist, groups: fresh.checklist.groups } } : d));
      }
      return true;
    } catch (e) {
      toast(e.message, "error");
      return false;
    }
  };

  const assign = (group, value) => {
    const checklistId = value === "" ? null : Number(value);
    if (checklistId === group.checklistId) return;
    const next = data.checklists.find((c) => c.id === checklistId);
    const run = () => assignmentRequest(
      { team: group.team, checklistId },
      locale === "fa" ? next ? `چک‌لیست «${next.name}» برای ${teamText(group.team)} انتخاب شد` : `چک‌لیست ${teamText(group.team)} حذف شد` : next ? `${group.team} now uses “${next.name}”` : `${group.team} no longer has a checklist`
    );
    if (!group.checklistId) return run();
    setConfirm({
      title: locale === "fa" ? next ? `چک‌لیست ${teamText(group.team)} به «${next.name}» تغییر کند؟` : `چک‌لیست ${teamText(group.team)} حذف شود؟` : next ? `Switch ${group.team} to “${next.name}”?` : `Remove the checklist from ${group.team}?`,
      body: locale === "fa" ? next ? `کارشناسان ${teamText(group.team)} که گزارش شیفت امروز را شروع نکرده‌اند، فوراً «${next.name}» را می‌گیرند. گزارش‌های در حال انجام «${group.checklistName}» را حفظ می‌کنند و گزارش‌های گذشته تغییر نمی‌کنند.` : `گزارش‌های جدید ${teamText(group.team)} تا انتخاب چک‌لیست موردی ندارند. گزارش‌های در حال انجام و گذشته تغییر نمی‌کنند.` : next
        ? `Analysts in ${group.team} who haven't started today's Shift Log get “${next.name}” straight away. Logs already in progress keep “${group.checklistName}”, and past logs never change.`
        : `New Shift Logs in ${group.team} will have no checklist items until you choose a checklist again. Logs already in progress and past logs are not changed.`,
      confirmLabel: __shiftFaTr(next ? "Switch checklist" : "Remove checklist"),
      danger: !next,
      onConfirm: run,
    });
  };

  const toggle = (group, enabled) => {
    const run = () => assignmentRequest({ team: group.team, enabled }, locale === "fa" ? `«${group.checklistName}» برای ${teamText(group.team)} ${enabled ? "فعال" : "غیرفعال"} شد` : `“${group.checklistName}” turned ${enabled ? "on" : "off"} for ${group.team}`);
    if (enabled) return run();
    setConfirm({
      title: locale === "fa" ? `چک‌لیست ${teamText(group.team)} غیرفعال شود؟` : `Turn off the checklist for ${group.team}?`,
      body: locale === "fa" ? `گزارش‌های شروع‌نشده ${teamText(group.team)} تا فعال‌سازی مجدد موردی ندارند. گزارش‌های در حال انجام و گذشته بدون تغییر می‌مانند.` : `Shift Logs in ${group.team} that haven't started will have no checklist items until you turn it back on. Logs already in progress keep their items, and past logs never change.`,
      confirmLabel: __shiftFaTr("Turn off"),
      danger: true,
      onConfirm: run,
    });
  };

  const archive = () => setConfirm({
    title: locale === "fa" ? `«${base.name}» بایگانی شود؟` : `Archive “${base.name}”?`,
    body: __shiftFaTr("It disappears from this list and can no longer be assigned. Shift logs created from it keep their items and stay in reports."),
    confirmLabel: __shiftFaTr("Archive checklist"),
    danger: true,
    onConfirm: async () => {
      try {
        await api(`/api/shift/checklists/${base.id}`, { method: "DELETE" });
        toast(locale === "fa" ? `«${base.name}» بایگانی شد` : `“${base.name}” archived`);
        setDraft(null);
        setSelectedId(null);
        load();
        return true;
      } catch (e) {
        toast(e.message, "error");
        return false;
      }
    },
  });

  const onCreated = (checklist) => {
    setCreating(false);
    toast(locale === "fa" ? `«${checklist.name}» ایجاد شد. موارد آن را اضافه و ذخیره کنید، سپس گروه استفاده‌کننده را انتخاب کنید.` : `“${checklist.name}” created. Add its items, save, then choose which group uses it.`);
    setData((d) => ({ ...d, checklists: [...d.checklists, checklist].sort((a, b) => a.name.localeCompare(b.name)) }));
    setSelectedId(checklist.id);
    load();
  };

  if (loadError && !data) {
    return (
      <div className="page">
        <PageHeader title={__shiftFaTr("Shift Log checklists")} />
        <div className="panel"><ErrorState error={loadError} title={__shiftFaTr("Couldn't load checklists")} onRetry={load} /></div>
      </div>
    );
  }

  return (
    <div className="page cl-page">
      <PageHeader
        title={__shiftFaTr("Shift Log checklists")}
        meta={[data ? countText(data.checklists.length, "checklist", locale, number) : null, __shiftFaTr("SOC Managers and Security Managers"), __shiftFaTr("Logs already started keep their checklist")]}
        actions={<button type="button" className="btn btn-primary" onClick={() => whenClean(() => setCreating(true))} disabled={!data}><Icon name="plus" />{"" + __shiftFaTr("New checklist") + ""}</button>}
      />

      <div className="panel" role="note" style={{ padding: "var(--s-3)", marginBottom: "var(--s-3)" }}>
        <strong>{"" + __shiftFaTr("How daily work is selected") + ""}</strong>
        <p className="muted small" style={{ marginTop: 6 }}>{"" + __shiftFaTr("Morning L2: ticket analysis. Morning L3 / Design: engineering work (or an assigned custom L3 checklist). Until 20:00 and Night: everyone uses the L1 SOC operational checklist, regardless of their team. Logs already in progress keep their original activities.") + ""}</p>
      </div>
      {!data ? (
        <div className="panel"><Loading label={__shiftFaTr("Loading checklists")} rows={6} /></div>
      ) : (
        <>
          <GroupAssignments groups={data.groups} checklists={data.checklists} onAssign={assign} onToggle={toggle} onOpen={openInEditor} />

          <div className="cl-layout">
            <Panel title={__shiftFaTr("Checklists")} meta={countText(data.checklists.length, "checklist", locale, number)} className="cl-list">
              {data.checklists.length === 0 ? (
                <EmptyState compact icon="shift" title={__shiftFaTr("No checklists yet")}>{"" + __shiftFaTr("Create one, add its items, then choose which SOC group uses it.") + ""}</EmptyState>
              ) : (
                <ul className="cl-list-items">
                  {data.checklists.map((c) => (
                    <li key={c.id}>
                      <button type="button" className={`cl-list-item ${c.id === selectedId ? "on" : ""}`} aria-current={c.id === selectedId ? "true" : undefined} onClick={() => select(c.id)}>
                        <span className="name" dir="auto">{c.name}</span>
                        <span className="meta">{countText(c.activeCount, "active item", locale, number)} · v{number(c.version)}</span>
                        <span className="groups">
                          {c.groups.length ? c.groups.map((g) => <span key={g.team} className={`badge ${g.enabled ? "primary" : ""}`}>{teamText(g.team)}{g.enabled ? "" : locale === "fa" ? " · غیرفعال" : " · off"}</span>) : <span className="muted small">{"" + __shiftFaTr("Not used by a group") + ""}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <div className="cl-main" ref={editorRef}>
              {!selectedId ? (
                <div className="panel"><EmptyState icon="shift" title={__shiftFaTr("Choose a checklist")} action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => setCreating(true)}><Icon name="plus" />{"" + __shiftFaTr("New checklist") + ""}</button>}>{"" + __shiftFaTr("Select a checklist to edit its items, or create a new one.") + ""}</EmptyState></div>
              ) : detailError ? (
                <div className="panel"><ErrorState error={detailError} title={__shiftFaTr("Couldn't load this checklist")} onRetry={() => loadDetail(selectedId)} /></div>
              ) : !base || !draft ? (
                <div className="panel"><Loading label={__shiftFaTr("Loading checklist")} rows={8} /></div>
              ) : (
                <ChecklistEditor
                  key={base.id}
                  base={base}
                  draft={draft}
                  setDraft={setDraft}
                  normalizedItems={normalized.value.items}
                  errors={attempted ? normalized.errors : null}
                  changes={changes}
                  dirty={dirty}
                  saving={saving}
                  serverError={serverError}
                  onSave={save}
                  onDiscard={() => { setDraft(toDraft(base)); setAttempted(false); setServerError(null); }}
                  onReload={() => loadDetail(base.id)}
                  onArchive={archive}
                  events={detail.events}
                  versions={detail.versions}
                />
              )}
            </div>
          </div>
        </>
      )}

      {creating && data && <NewChecklistDialog checklists={data.checklists} onClose={() => setCreating(false)} onCreated={onCreated} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

/** One card per SOC group: its checklist, whether it is on, and how many items each shift gets. */
function GroupAssignments({ groups, checklists, onAssign, onToggle, onOpen }) {
  const { t: __shiftFaTr, locale, number, team: teamText } = useEngShiftI18n();
  const byId = Object.fromEntries(checklists.map((c) => [c.id, c]));
  return (
    <Panel title={__shiftFaTr("Groups")} meta={__shiftFaTr("L1 controls shared extended/Night duty; custom L3 controls normal L3 mornings.")}>
      <div className="cl-groups">
        {groups.map((g) => {
          const c = byId[g.checklistId];
          const state = !g.checklistId ? "none" : g.enabled ? "on" : "off";
          const id = `grp-${g.team.replace(/\W+/g, "-")}`;
          return (
            <article key={g.team} className="cl-group" data-group={g.team} data-state={state} aria-labelledby={`${id}-name`}>
              <div className="cl-group-head">
                <h3 id={`${id}-name`}>{teamText(g.team)}</h3>
                <span className={`badge dot ${state === "on" ? "success" : state === "off" ? "warning" : ""}`}>{state === "on" ? __shiftFaTr("Active") : state === "off" ? __shiftFaTr("Turned off") : __shiftFaTr("No checklist")}</span>
              </div>
              <p className="muted small">{countText(g.analysts, "analyst", locale, number)}</p>
              <label className="field">
                <span className="label">{"" + __shiftFaTr("Checklist") + ""}</span>
                <select className="input" id={`${id}-select`} value={g.checklistId ?? ""} onChange={(e) => onAssign(g, e.target.value)} aria-label={locale === "fa" ? `چک‌لیست ${teamText(g.team)}` : `Checklist for ${g.team}`}>
                  <option value="">{"" + __shiftFaTr("No checklist") + ""}</option>
                  {checklists.map((x) => (
                    <option key={x.id} value={x.id} disabled={!x.activeCount && x.id !== g.checklistId}>{x.name}{x.activeCount ? "" : __shiftFaTr(" (no active items yet)")}</option>
                  ))}
                </select>
              </label>
              {c ? (
                <>
                  <label className="toggle-label">
                    <input type="checkbox" role="switch" className="switch" checked={g.enabled} onChange={(e) => onToggle(g, e.target.checked)} aria-label={locale === "fa" ? `استفاده از چک‌لیست برای ${teamText(g.team)}` : `Use the checklist for ${g.team}`} />
                    {__shiftFaTr(g.enabled ? "On for new shift logs" : "Off — new logs get no items")}
                  </label>
                  <div className="cl-group-counts">
                    <span className="cap" id={`${id}-counts`}>{"" + __shiftFaTr("Active items per shift") + ""}</span>
                    <dl aria-labelledby={`${id}-counts`}>
                      {perShift(c.items).map(([k, n]) => <div key={k}><dt>{__shiftFaTr(SHIFT_TYPES[k].label)}</dt><dd className="num">{number(n)}</dd></div>)}
                    </dl>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm cl-group-open" onClick={() => onOpen(c.id)}><Icon name="edit" />{"" + __shiftFaTr("Edit “") + ""}{c.name}”</button>
                </>
              ) : (
                <p className="sec small">{"" + __shiftFaTr("Analysts in") + " "}{teamText(g.team)}{" " + __shiftFaTr("get no checklist items until you choose one.") + ""}</p>
              )}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

function ChecklistEditor({ base, draft, setDraft, normalizedItems, errors, changes, dirty, saving, serverError, onSave, onDiscard, onReload, onArchive, events, versions }) {
  const { t: __shiftFaTr, locale, number, team: teamText } = useEngShiftI18n();
  const { peopleMap } = useApp();
  const [focusKey, setFocusKey] = useState(null);
  const [announce, setAnnounce] = useState("");
  const [dragKey, setDragKey] = useState(null);
  const [overKey, setOverKey] = useState(null);
  const baseItems = useMemo(() => new Map(base.items.map((it) => [it.id, it])), [base]);

  useEffect(() => {
    if (!focusKey) return;
    document.getElementById(`cl-title-${focusKey}`)?.focus();
    setFocusKey(null);
  }, [focusKey]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const updateItem = (key, patch) => setDraft((d) => ({ ...d, items: d.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) }));
  const move = (from, to, refocus) => {
    if (to < 0 || to >= draft.items.length || from === to) return;
    const item = draft.items[from];
    setDraft((d) => {
      const items = [...d.items];
      const [it] = items.splice(from, 1);
      items.splice(to, 0, it);
      return { ...d, items };
    });
    setAnnounce(locale === "fa" ? `«${item.title || "مورد بدون عنوان"}» به جایگاه ${number(to + 1)} از ${number(draft.items.length)} منتقل شد.` : `Moved “${item.title || "untitled item"}” to position ${to + 1} of ${draft.items.length}.`);
    if (refocus) requestAnimationFrame(() => document.getElementById(refocus)?.focus());
  };
  const add = () => {
    const item = blankItem();
    setDraft((d) => ({ ...d, items: [...d.items, item] }));
    setFocusKey(item.key);
  };
  const remove = (index) => {
    const item = draft.items[index];
    setDraft((d) => ({
      ...d,
      items: d.items.filter((it) => it.key !== item.key),
      removed: item.id ? [...d.removed, { ...item, at: index }] : d.removed,
    }));
    setAnnounce(locale === "fa" ? `«${item.title || "مورد بدون عنوان"}» حذف شد.${item.id ? " تا زمان ذخیره می‌توانید آن را بازگردانید." : ""}` : `Removed “${item.title || "untitled item"}”.${item.id ? " Undo is available until you save." : ""}`);
  };
  const restore = (key) => setDraft((d) => {
    const item = d.removed.find((it) => it.key === key);
    const items = [...d.items];
    items.splice(Math.min(item.at, items.length), 0, { ...item, at: undefined });
    return { ...d, items, removed: d.removed.filter((it) => it.key !== key) };
  });
  const indexOf = (key) => draft.items.findIndex((it) => it.key === key);

  const itemErrors = errors?.items ?? {};
  const shownErrors = errors ? Object.keys(itemErrors).length + ["name", "description", "form"].filter((k) => errors[k]).length : 0;

  return (
    <div className="stack-lg">
      <section className="panel cl-editor" aria-label={locale === "fa" ? `ویرایش ${base.name}` : `Edit ${base.name}`}>
        <div className="cl-editor-head">
          <div className="cl-editor-fields">
            <Field label={__shiftFaTr("Checklist name")} htmlFor="cl-name" error={errors?.name}>
              <input id="cl-name" className="input" dir="auto" value={draft.name} maxLength={CHECKLIST_LIMITS.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label={__shiftFaTr("Description (optional)")} htmlFor="cl-desc" hint={__shiftFaTr("Who it is for and when it applies. Shown to managers only.")} error={errors?.description}>
              <textarea id="cl-desc" className="textarea cl-desc" dir="auto" rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
          </div>
          <dl className="cl-facts">
            <div><dt>{"" + __shiftFaTr("Version") + ""}</dt><dd className="num">v{base.version}</dd></div>
            <div><dt>{"" + __shiftFaTr("Last saved") + ""}</dt><dd>{taskWhen(base.updatedAt, locale)}{base.updatedBy && peopleMap[base.updatedBy] ? ` · ${peopleMap[base.updatedBy].name}` : ""}</dd></div>
            <div>
              <dt>{"" + __shiftFaTr("Used by") + ""}</dt>
              <dd className="cl-used">{base.groups.length ? base.groups.map((g) => <span key={g.team} className={`badge ${g.enabled ? "primary" : ""}`}>{teamText(g.team)}{g.enabled ? "" : locale === "fa" ? " · غیرفعال" : " · off"}</span>) : <span className="muted">{"" + __shiftFaTr("No group yet") + ""}</span>}</dd>
            </div>
            {!base.groups.length && (
              <div className="cl-archive"><button type="button" className="btn btn-ghost btn-sm danger" onClick={onArchive}><Icon name="inbox" />{"" + __shiftFaTr("Archive") + ""}</button></div>
            )}
          </dl>
        </div>

        <div className="cl-items-head" aria-hidden="true">
          <span>{"" + __shiftFaTr("Items, in the order analysts see them") + ""}</span>
          <span className="muted small">{countText(draft.items.filter((it) => it.active).length, "active item", locale, number)}</span>
        </div>

        {draft.items.length === 0 ? (
          <EmptyState compact icon="tasks" title={__shiftFaTr("No items yet")} action={<button type="button" className="btn btn-secondary btn-sm" onClick={add}><Icon name="plus" />{"" + __shiftFaTr("Add the first item") + ""}</button>}>{"" + __shiftFaTr("Add what analysts should do during the shift, in order.") + ""}</EmptyState>
        ) : (
          <ol className="cl-items">
            {draft.items.map((it, i) => {
              const saved = it.id ? baseItems.get(it.id) : null;
              const edited = !!saved && !!normalizedItems[i] && !sameChecklistItem(saved, normalizedItems[i]);
              const e = itemErrors[i] ?? {};
              const n = i + 1;
              return (
                <li
                  key={it.key}
                  className={`cl-item ${it.active ? "" : "inactive"} ${dragKey === it.key ? "dragging" : ""} ${overKey === it.key && dragKey !== it.key ? "drop" : ""}`}
                  data-item={n}
                  onDragOver={(ev) => { if (dragKey) { ev.preventDefault(); setOverKey(it.key); } }}
                  onDrop={(ev) => { ev.preventDefault(); if (dragKey) move(indexOf(dragKey), i); setDragKey(null); setOverKey(null); }}
                  onKeyDown={(ev) => {
                    if (!ev.altKey || (ev.key !== "ArrowUp" && ev.key !== "ArrowDown")) return;
                    ev.preventDefault();
                    move(i, ev.key === "ArrowUp" ? i - 1 : i + 1, ev.target.id || undefined);
                  }}
                >
                  <div className="cl-item-row">
                    <span
                      className="cl-grip"
                      draggable
                      aria-hidden="true"
                      title={__shiftFaTr("Drag to reorder")}
                      onDragStart={(ev) => {
                        setDragKey(it.key);
                        ev.dataTransfer.effectAllowed = "move";
                        ev.dataTransfer.setData("text/plain", it.key);
                        const row = ev.currentTarget.closest(".cl-item");
                        if (row) ev.dataTransfer.setDragImage(row, 24, 20);
                      }}
                      onDragEnd={() => { setDragKey(null); setOverKey(null); }}
                    ><Icon name="grip" /></span>
                    <span className="n" aria-hidden="true">{number(n)}</span>
                    <div className="cl-title">
                      <input
                        id={`cl-title-${it.key}`}
                        className="input"
                        dir="auto"
                        placeholder={__shiftFaTr("What should the analyst do?")}
                        maxLength={CHECKLIST_LIMITS.title}
                        value={it.title}
                        onChange={(ev) => updateItem(it.key, { title: ev.target.value })}
                        aria-label={locale === "fa" ? `عنوان مورد ${number(n)}` : `Item ${n} title`}
                        aria-invalid={e.title ? true : undefined}
                        aria-describedby={e.title ? `cl-title-${it.key}-error` : undefined}
                      />
                      {e.title && <FieldError id={`cl-title-${it.key}-error`}>{e.title}</FieldError>}
                    </div>
                    <div className="cl-item-side">
                    <span className="cl-flags">
                      {!it.id && <span className="badge info">{"" + __shiftFaTr("New") + ""}</span>}
                      {edited && <span className="badge violet">{"" + __shiftFaTr("Edited") + ""}</span>}
                      {it.legacyN && <span className="badge" data-tooltip={locale === "fa" ? `در گزارش‌ها به‌عنوان فعالیت استاندارد شماره ${number(it.legacyN)} محاسبه می‌شود` : `Counted as activity #${it.legacyN} of the standard routine in reports and analytics`}>{"" + __shiftFaTr("Standard #") + ""}{number(it.legacyN)}</span>}
                    </span>
                    <span className="cl-order">
                      <IconButton id={`cl-up-${it.key}`} icon="up" size="sm" label={locale === "fa" ? `بردن مورد ${number(n)} به بالا` : `Move item ${n} up`} disabled={i === 0} onClick={() => move(i, i - 1, `cl-up-${it.key}`)} />
                      <IconButton id={`cl-down-${it.key}`} icon="down" size="sm" label={locale === "fa" ? `بردن مورد ${number(n)} به پایین` : `Move item ${n} down`} disabled={i === draft.items.length - 1} onClick={() => move(i, i + 1, `cl-down-${it.key}`)} />
                      <IconButton icon="x" size="sm" className="danger" label={locale === "fa" ? `حذف مورد ${number(n)}` : `Remove item ${n}`} onClick={() => remove(i)} />
                    </span>
                    </div>
                  </div>
                  <div className="cl-item-props">
                    <label className="cl-prop">
                      <span className="sr-only">{"" + __shiftFaTr("Item") + " "}{n}{" " + __shiftFaTr("type") + ""}</span>
                      <select className="input input-sm" value={it.kind} onChange={(ev) => updateItem(it.key, { kind: ev.target.value })} aria-label={locale === "fa" ? `نوع مورد ${number(n)}` : `Item ${n} type`} title={__shiftFaTr(ITEM_KINDS[it.kind]?.hint)}>
                        {ITEM_KIND_KEYS.map((k) => <option key={k} value={k}>{__shiftFaTr(ITEM_KINDS[k].label)}</option>)}
                      </select>
                    </label>
                    <span className="cl-shifts" role="group" aria-label={locale === "fa" ? `شیفت‌های مورد ${number(n)}` : `Shifts for item ${n}`} aria-describedby={e.shiftTypes ? `cl-shifts-${it.key}-error` : undefined}>
                      {SHIFT_TYPE_KEYS.map((k) => {
                        const on = it.shiftTypes.includes(k);
                        return (
                          <button
                            key={k}
                            type="button"
                            className={`cl-shift ${on ? "on" : ""}`}
                            data-shift={k}
                            aria-pressed={on}
                            onClick={() => updateItem(it.key, { shiftTypes: on ? it.shiftTypes.filter((x) => x !== k) : SHIFT_TYPE_KEYS.filter((x) => x === k || it.shiftTypes.includes(x)) })}
                          >
                            <Icon name={on ? "check" : "plus"} size="sm" />{__shiftFaTr(SHIFT_TYPES[k].label)}
                          </button>
                        );
                      })}
                    </span>
                    <label className="toggle-label cl-active">
                      <input type="checkbox" role="switch" className="switch" checked={it.active} onChange={(ev) => updateItem(it.key, { active: ev.target.checked })} aria-label={locale === "fa" ? `فعال‌بودن مورد ${number(n)}` : `Item ${n} active`} />
                      {__shiftFaTr(it.active ? "Active" : "Inactive")}
                    </label>
                    <input
                      className="input input-sm cl-hint"
                      dir="auto"
                      placeholder={__shiftFaTr("Guidance for analysts (optional)")}
                      maxLength={CHECKLIST_LIMITS.hint}
                      value={it.hint}
                      onChange={(ev) => updateItem(it.key, { hint: ev.target.value })}
                      aria-label={locale === "fa" ? `راهنمای مورد ${number(n)}` : `Item ${n} guidance`}
                      aria-invalid={e.hint ? true : undefined}
                    />
                  </div>
                  {(e.shiftTypes || e.hint || e.kind || e.form) && (
                    <div className="cl-item-errors">
                      <FieldError id={`cl-shifts-${it.key}-error`}>{e.shiftTypes ?? e.hint ?? e.kind ?? e.form}</FieldError>
                    </div>
                  )}
                  {!it.active && <p className="cl-item-note muted small">{"" + __shiftFaTr("Inactive: kept here, but left out of new shift logs.") + ""}</p>}
                </li>
              );
            })}
          </ol>
        )}

        <div className="cl-add">
          <button type="button" className="btn btn-secondary btn-sm" onClick={add} disabled={draft.items.length >= CHECKLIST_LIMITS.items}><Icon name="plus" />{"" + __shiftFaTr("Add item") + ""}</button>
          <span className="muted small">{"" + __shiftFaTr("Drag") + " "}<Icon name="grip" size="sm" />{" " + __shiftFaTr("or use the arrows (Alt + ↑/↓) to reorder. Items apply only to the shifts you select.") + ""}</span>
        </div>

        {draft.removed.length > 0 && (
          <div className="cl-removed" role="region" aria-label={__shiftFaTr("Removed items")}>
            <span className="small sec">{"" + __shiftFaTr("Removed when you save:") + ""}</span>
            {draft.removed.map((it) => (
              <span key={it.key} className="cl-removed-item">
                <s dir="auto">{it.title || __shiftFaTr("Untitled item")}</s>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => restore(it.key)}>{"" + __shiftFaTr("Undo") + ""}</button>
              </span>
            ))}
          </div>
        )}

        <p className="sr-only" aria-live="polite">{announce}</p>

        <div className="cl-savebar" role="region" aria-label={__shiftFaTr("Save checklist")}>
          <span className={`cl-savestate ${dirty ? "dirty" : ""}`} aria-live="polite">
            {dirty ? <><Icon name="edit" size="sm" />{"" + __shiftFaTr("Unsaved:") + " "}{changesText(changes, locale, number)}</> : <><Icon name="checkCircle" size="sm" />{"" + __shiftFaTr("All changes saved · v") + ""}{number(base.version)}</>}
          </span>
          {errors?.form && <FieldError>{errors.form}</FieldError>}
          {shownErrors > 0 && !errors?.form && <FieldError>{"" + __shiftFaTr("Fix") + " "}{countText(shownErrors, "problem", locale, number)}{" " + __shiftFaTr("above to save.") + ""}</FieldError>}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onDiscard} disabled={!dirty || saving}>{"" + __shiftFaTr("Discard") + ""}</button>
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={!dirty || saving} aria-busy={saving}>{"" + __shiftFaTr("Save changes") + ""}</button>
        </div>
        {serverError && (
          <div className="cl-server-error">
            <FormAlert>{serverError.message}</FormAlert>
            {serverError.conflict && <button type="button" className="btn btn-secondary btn-sm" onClick={onReload}><Icon name="refresh" />{"" + __shiftFaTr("Load the latest version") + ""}</button>}
          </div>
        )}
      </section>

      <Panel title={__shiftFaTr("Change history")} meta={countText(versions.length, "version", locale, number)}>
        {events.length === 0 ? <p className="panel-body muted small">{"" + __shiftFaTr("No changes recorded yet.") + ""}</p> : (
          <ol className="cl-history">
            {events.map((ev) => (
              <li key={ev.id}>
                <span className="cl-history-icon" aria-hidden="true"><Icon name={EVENT_ICONS[ev.action] ?? "info"} size="sm" /></span>
                <span className="cl-history-text">{eventText(ev, locale, number, teamText)}</span>
                <span className="muted small">{ev.by ? peopleMap[ev.by]?.name ?? __shiftFaTr("Former member") : __shiftFaTr("System")} · {taskWhen(ev.at, locale)}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

function NewChecklistDialog({ checklists, onClose, onCreated }) {
  const { t: __shiftFaTr, locale, number } = useEngShiftI18n();
  const [form, setForm] = useState({ name: "", description: "", copyFrom: "" });
  const [error, setError] = useState(null);
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError(null); setServerError(""); };
  const dirty = !!(form.name || form.description);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Give the checklist a name, like “Layer 2 technical routine”.");
      return document.getElementById("nc-name")?.focus();
    }
    setBusy(true);
    try {
      const { checklist } = await api("/api/shift/checklists", { method: "POST", body: { ...form, copyFrom: form.copyFrom || undefined } });
      onCreated(checklist);
    } catch (err) {
      setServerError(err.message);
      setBusy(false);
    }
  };

  return (
    <Dialog label={__shiftFaTr("New checklist")} title={__shiftFaTr("New checklist")} description={__shiftFaTr("No group uses it until you assign it, so you can prepare it first.")} onClose={onClose} width={520} dismissible={!dirty}>
      <form onSubmit={submit} noValidate>
        <div className="modal-body form">
          <Field label={__shiftFaTr("Name")} htmlFor="nc-name" error={error}>
            <input id="nc-name" className="input" dir="auto" maxLength={CHECKLIST_LIMITS.name} value={form.name} onChange={set("name")} autoComplete="off" data-autofocus />
          </Field>
          <Field label={__shiftFaTr("Description (optional)")} htmlFor="nc-desc">
            <textarea id="nc-desc" className="textarea" dir="auto" rows={2} value={form.description} onChange={set("description")} />
          </Field>
          <Field label={__shiftFaTr("Start from")} htmlFor="nc-copy" hint={__shiftFaTr("A copy gets the same items; editing it never changes the original.")}>
            <select id="nc-copy" className="input" value={form.copyFrom} onChange={set("copyFrom")}>
              <option value="">{"" + __shiftFaTr("An empty checklist") + ""}</option>
              {checklists.map((c) => <option key={c.id} value={c.id}>{"" + __shiftFaTr("Copy of “") + ""}{c.name}{locale === "fa" ? "»" : "”"} ({countText(c.items.length, "item", locale, number)})</option>)}
            </select>
          </Field>
          <FormAlert>{serverError}</FormAlert>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{"" + __shiftFaTr("Cancel") + ""}</button>
          <button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}>{"" + __shiftFaTr("Create checklist") + ""}</button>
        </div>
      </form>
    </Dialog>
  );
}

/** Confirmation for consequential changes. `onConfirm` may return false to keep the dialog open. */
function ConfirmDialog({ title, body, confirmLabel, danger, onConfirm, onClose }) {
  const { t: __shiftFaTr } = useEngShiftI18n();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const ok = await onConfirm();
    setBusy(false);
    if (ok !== false) onClose();
  };
  return (
    <Dialog label={title} title={title} onClose={onClose} width={480}>
      <div className="modal-body"><p className="sec">{body}</p></div>
      <div className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose}>{"" + __shiftFaTr("Cancel") + ""}</button>
        <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={go} disabled={busy} aria-busy={busy}>{confirmLabel}</button>
      </div>
    </Dialog>
  );
}
