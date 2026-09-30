"use client";

import { cloneElement, isValidElement } from "react";
import Icon from "@/components/ui/Icon";

/**
 * Form field: visible label, the control, then either a hint or an error (never a placeholder-only label).
 * Wires aria-describedby / aria-invalid onto the control so screen readers read hint and error.
 */
export function Field({ label, htmlFor, hint, error, children }) {
  const hintId = hint ? `${htmlFor}-hint` : null;
  const errorId = error ? `${htmlFor}-error` : null;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children) ? cloneElement(children, { "aria-describedby": describedBy, "aria-invalid": error ? true : undefined }) : children;
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {control}
      {error ? <FieldError id={errorId}>{error}</FieldError> : hint && <span id={hintId} className="field-hint">{hint}</span>}
    </div>
  );
}

export function FieldError({ id, children }) {
  return <span id={id} className="field-error"><Icon name="alert" />{children}</span>;
}

/** Form-level error (e.g. from the server), announced when it appears. */
export function FormAlert({ children }) {
  if (!children) return null;
  return <div className="form-alert" role="alert"><Icon name="alert" /><span>{children}</span></div>;
}
