"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import Icon from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/indicators";
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
        >
          <Avatar id={me.id} size="sm" />
          <span className="profile-meta">
            <b>{me.name}</b>
            <small>{ROLE_LABELS[me.role]}</small>
          </span>
          <Icon name="sort" />
        </button>
      </div>
    </aside>
  );
}
