"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import styles from "./AssigneePicker.module.css";

/**
 * Accessible name/team search for task assignment and reassignment.
 * Free text is not an assignee: an explicit result must be chosen.
 */
export default function AssigneePicker({ id, value, people, onSelect, onClear, disabled = false, autoFocus = false, ...inputProps }) {
  const selected = people.find((person) => person.id === value);
  const [search, setSearch] = useState(() => selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const filtered = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return people
      .filter((person) => !normalized || (person.name + " " + person.team).toLocaleLowerCase().includes(normalized))
      .sort((a, b) => a.name.localeCompare(b.name, "fa"));
  }, [people, search]);

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
    <div className={styles.wrapper} onBlur={(event) => {
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
