"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { IRAN_PROVINCES } from "@/lib/roles";
import styles from "./ProvincePicker.module.css";

// Persian and Arabic keyboards should search the same provinces.
const normalize = (value) => String(value ?? "").normalize("NFKC")
  .replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[\u064b-\u065f\u0670\u200c]/g, "")
  .trim().toLocaleLowerCase("fa");

export default function ProvincePicker({ id, value = "", onChange, placeholder = "Search provinces…", className = "", ...inputProps }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef(null);
  const input = useRef(null);
  const listId = useId();
  const matches = useMemo(() => IRAN_PROVINCES.filter((province) => normalize(province).includes(normalize(query))), [query]);

  const close = () => { setOpen(false); setQuery(""); setActive(0); };
  const choose = (province) => { onChange?.(province); close(); input.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    const outside = (event) => { if (!root.current?.contains(event.target)) close(); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const keys = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { setQuery(""); setActive(0); setOpen(true); }
      else setActive((index) => Math.max(0, Math.min(matches.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
    }
    if (event.key === "Enter" && open) {
      event.preventDefault(); // Don't accidentally submit the Add member form.
      if (matches[active]) choose(matches[active]);
      else if (query === "" && !value) close();
    }
    if (event.key === "Tab" && open) close();
  };

  return (
    <div ref={root} className={`${styles.root} ${className}`} dir="rtl">
      <div className={styles.control}>
        <Icon name="search" size="sm" />
        <input {...inputProps} ref={input} id={id} type="text"
          className={`input ${styles.input}`}
          role="combobox" aria-autocomplete="list" aria-expanded={open}
          aria-controls={listId} aria-activedescendant={open && matches[active] ? `${listId}-${IRAN_PROVINCES.indexOf(matches[active])}` : undefined}
          value={open ? query : value}
          placeholder={open ? "Type to filter provinces…" : (value || placeholder)}
          autoComplete="off" spellCheck={false}
          onFocus={() => { setQuery(""); setActive(0); setOpen(true); }}
          onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
          // The Dialog traps Escape using a native listener. Capture it before that listener
          // so the first Escape only dismisses this combobox, not the entire member form.
          onKeyDownCapture={(event) => {
            if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
          onKeyDown={keys}
        />
        {value && !open ? (
          <button type="button" className={styles.chevron} aria-label="Clear province" title="Clear province"
            onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange?.(""); input.current?.focus(); }}>
            <Icon name="x" size="sm" />
          </button>
        ) : <Icon name="down" size="sm" />}
      </div>
      {open && (
        <div id={listId} className={styles.menu} role="listbox" aria-label="Provinces">
          <div className={styles.hint}>{matches.length} {matches.length === 1 ? "province" : "provinces"}</div>
          {matches.length ? matches.map((province, index) => (
            <button type="button" role="option" id={`${listId}-${IRAN_PROVINCES.indexOf(province)}`} key={province}
              aria-selected={province === value} data-active={index === active}
              className={styles.option}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(province)}>
              <span>{province}</span>
              {province === value && <Icon name="check" size="sm" />}
            </button>
          )) : <p className={styles.empty}>No matching province</p>}
        </div>
      )}
    </div>
  );
}
