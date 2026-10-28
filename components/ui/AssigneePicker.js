"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import styles from "./AssigneePicker.module.css";

const nameCollator = new Intl.Collator("fa");

/**
 * Accessible name/team search for task assignment and reassignment.
 * Free text is not an assignee: an explicit result must be chosen.
 */
export default function AssigneePicker({ id, value, people, onSelect, onClear, disabled = false, autoFocus = false, overlayOptions = false, ...inputProps }) {
  const selected = people.find((person) => person.id === value);
  const [search, setSearch] = useState(() => selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Member data changes rarely; don't re-sort or normalize it for every keystroke.
  const searchIndex = useMemo(() => people
    .map((person) => ({ person, text: (person.name + " " + person.team).toLocaleLowerCase() }))
    .sort((a, b) => nameCollator.compare(a.person.name, b.person.name)), [people]);
  const filtered = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return searchIndex.filter((entry) => !normalized || entry.text.includes(normalized)).map((entry) => entry.person);
  }, [searchIndex, search]);

  const choose = (person) => {
    setSearch(person.name);
    onSelect(person.id);
    setOpen(false);
    setActive(0);
    inputRef.current?.focus();
  };

  const keyDown = (event) => {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (filtered.length) setActive((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + filtered.length) % filtered.length);
    } else if (event.key === "Enter" && open && filtered.length) {
      event.preventDefault();
      choose(filtered[Math.min(active, filtered.length - 1)]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setSearch(selected?.name ?? "");
    }
  };

  return (
    <div className={`${styles.wrapper} ${overlayOptions ? styles.overlayOptions : ""}`} onBlur={(event) => {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      setOpen(false);
      if (selected) setSearch(selected.name);
    }}>
      <input
        {...inputProps}
        ref={inputRef}
        id={id}
        type="search"
        className={"input " + styles.input}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && !disabled}
        aria-controls={open && !disabled ? listId : undefined}
        aria-activedescendant={open && filtered.length ? listId + "-opt-" + active : undefined}
        placeholder={disabled ? undefined : "Type a name or team..."}
        autoComplete="off"
        disabled={disabled}
        value={disabled ? selected?.name ?? "" : search}
        onFocus={() => { if (!disabled) { setOpen(true); setActive(0); } }}
        onChange={(event) => {
          setSearch(event.target.value);
          onClear?.();
          setActive(0);
          setOpen(true);
        }}
        onKeyDownCapture={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            setSearch(selected?.name ?? "");
          }
        }}
        onKeyDown={keyDown}
      />
      {open && !disabled && (
        <div className={styles.options} id={listId} role="listbox" aria-label="Matching assignees">
          {filtered.length === 0 ? (
            <div className={styles.empty} role="status">No matching team members</div>
          ) : filtered.map((person, index) => (
            <button
              key={person.id}
              id={listId + "-opt-" + index}
              type="button"
              role="option"
              aria-selected={value === person.id}
              data-active={active === index ? "true" : undefined}
              className={styles.option}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(person)}
            >
              <span>{person.name}</span>
              <small>{person.team}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
