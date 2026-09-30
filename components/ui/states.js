"use client";

import Icon from "@/components/ui/Icon";

/**
 * Empty state: what happened, whether it's expected, and (at most) one next step.
 * `compact` for use inside panels; `danger` tints the glyph for failures.
 */
export function EmptyState({ icon = "inbox", title, children, action, danger, compact }) {
  return (
    <div className={`empty ${compact ? "compact" : ""} ${danger ? "danger" : ""}`}>
      <div className="glyph" aria-hidden="true"><Icon name={icon} /></div>
      {title && <h3>{title}</h3>}
      {children && <p>{children}</p>}
      {action && <div className="actions">{action}</div>}
    </div>
  );
}

/** One-line state inside a panel ("All clear"), for places where a big empty state would waste space. */
export function Notice({ icon = "checkCircle", tone, children }) {
  return (
    <div className={`notice ${tone === "neutral" ? "neutral" : ""}`} role="status">
      <span className="glyph" aria-hidden="true"><Icon name={icon} /></span>
      <span>{children}</span>
    </div>
  );
}

/** Maps an API error to user-facing copy. Raw server output is never shown. */
export function describeError(error, fallbackTitle = "Couldn't load this") {
  const status = error?.status ?? 0;
  if (error?.kind === "network") return { icon: "offline", title: "Can't reach the server", body: "Check your network connection, then try again.", retry: true };
  if (status === 403) return { icon: "lock", title: "You don't have access", body: `${error.message} If you need it, contact your administrator.`, retry: false };
  if (status === 404) return { icon: "search", title: "Not found", body: error.message, retry: false };
  if (status >= 500) return { icon: "server", title: "The server ran into a problem", body: "Your data is safe. Try again in a moment; if it keeps happening, contact your administrator.", retry: true };
  return { icon: "alert", title: fallbackTitle, body: error?.message || "Something went wrong. Try again.", retry: true };
}

/** Inline failure for one region of a page; the rest of the page keeps working. */
export function ErrorState({ error, title, onRetry, compact }) {
  const e = describeError(error, title);
  return (
    <EmptyState danger icon={e.icon} title={e.title} compact={compact} action={e.retry && onRetry ? <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>Try again</button> : null}>
      {e.body}
    </EmptyState>
  );
}

/** Skeleton rows that keep table height; they fade in late so fast loads never flash. */
export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="sk-rows sk-late" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i}>
          <div className="sk" style={{ width: `${55 + ((i * 13) % 35)}%` }} />
          <div className="sk" style={{ width: "70%" }} />
          <div className="sk" style={{ width: "50%" }} />
          <div className="sk" style={{ width: "40%" }} />
        </div>
      ))}
    </div>
  );
}

/** Loading region with an accessible label. */
export function Loading({ label = "Loading", rows = 6 }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}…</span>
      <TableSkeleton rows={rows} />
    </div>
  );
}
