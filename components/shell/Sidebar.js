"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { ROLE_LABELS } from "@/lib/roles";

const isOn = (path, prefix) => path === prefix || path.startsWith(prefix + "/");

/**
 * Grouped navigation plus the account area. When the rail is collapsed, labels become tooltips.
 * `inert` keeps the off-canvas drawer out of the tab order on small screens until it is opened.
 */
export default function Sidebar({ groups, path, collapsed, inert, onProfile, onBrand }) {
  const { me } = useApp();
  const tip = (label) => (collapsed ? { "data-tooltip": label, "data-tooltip-side": "right" } : {});

  return (
    <aside className="sidebar" id="sidebar" aria-label="Sidebar" inert={inert}>
      <Link href="/dashboard" className="brand" onClick={onBrand} aria-label="Sentinel Ops — Dashboard" {...tip("Sentinel Ops")}>
        <span className="brand-mark" aria-hidden="true"><Icon name="brand" /></span>
        <span>Sentinel Ops</span>
      </Link>

      <nav className="nav" aria-label="Main">
        {groups.map((g) => (
          <div key={g.id} className="nav-group">
            {g.label && <div className="nav-label" id={`nav-${g.id}`}>{g.label}</div>}
            <ul aria-labelledby={g.label ? `nav-${g.id}` : undefined}>
              {g.items.map((it) => {
                const on = isOn(path, it.match ?? it.href);
                const current = on && !it.subs;
                return (
                  <li key={it.href}>
                    <Link
                      className={`nav-item ${current || (on && collapsed) ? "active" : ""} ${on && it.subs ? "open" : ""}`}
                      href={it.href}
                      aria-current={current ? "page" : undefined}
                      {...tip(it.label)}
                    >
                      <Icon name={it.icon} />
                      <span className="label">{it.label}</span>
                    </Link>
                    {it.subs && on && (
                      <ul className="nav-sub">
                        {it.subs.map((s) => (
                          <li key={s.href}>
                            <Link className={`nav-item ${path === s.href ? "active" : ""}`} href={s.href} aria-current={path === s.href ? "page" : undefined}>
                              <span className="label">{s.label}</span>
                              {s.count > 0 && <span className="nav-count" aria-label={`${s.count} open`}>{s.count}</span>}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <button
          type="button"
          className="profile"
          onClick={(e) => onProfile(e.currentTarget)}
          aria-haspopup="menu"
          aria-label={`Account menu for ${me.name}`}
          title={`${ROLE_LABELS[me.role]} · ${me.team}`}
          {...tip(me.name)}
          style={{
            display: "grid",
            gridTemplateColumns: collapsed ? "1fr" : "22px minmax(0, 1fr) 16px",
            alignItems: "center",
            columnGap: collapsed ? 0 : 10,
            minHeight: 46,
            justifyItems: collapsed ? "center" : "stretch",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 22,
              height: 22,
              display: "grid",
              placeItems: "center",
              borderRadius: 6,
              background: "var(--hover)",
              color: "var(--text-2)",
            }}
          >
            <Icon name="user" size="sm" />
          </span>

          {!collapsed && (
            <span
              className="profile-meta"
              style={{
                display: "grid",
                gap: 4,
                minWidth: 0,
                lineHeight: 1.1,
                overflow: "hidden",
              }}
            >
              <b
                style={{
                  display: "block",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {me.name}
              </b>
              <small
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  width: "fit-content",
                  maxWidth: "100%",
                  minHeight: 18,
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: "var(--primary-soft)",
                  color: "var(--text-2)",
                  fontSize: 11,
                  lineHeight: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {ROLE_LABELS[me.role]}
              </small>
            </span>
          )}

          {!collapsed && (
            <span style={{ display: "grid", placeItems: "center", color: "var(--text-3)" }}>
              <Icon name="sort" />
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
