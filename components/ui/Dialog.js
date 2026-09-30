"use client";

import { useId } from "react";
import useFocusTrap from "@/components/useFocusTrap";
import Icon from "@/components/ui/Icon";

/**
 * Modal frame: scrim, focus trap, Esc to close, title + optional description, close button.
 * `label` is the accessible name. `dismissible={false}` stops a click on the scrim from closing it
 * (use while a form has unsaved input); Esc and the close button always work.
 * Children are the body and footer (`.modal-body`, `.modal-foot`).
 */
export default function Dialog({ label, title, description, onClose, children, width = 520, onKeyDown, dismissible = true, className = "" }) {
  const ref = useFocusTrap(onClose);
  const descId = useId();
  return (
    <div className="scrim" onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={label} aria-describedby={description ? descId : undefined} style={{ maxWidth: width }} onKeyDown={onKeyDown}>
        {title && (
          <div className="modal-head">
            <div>
              <h2>{title}</h2>
              {description && <p id={descId}>{description}</p>}
            </div>
            <span style={{ width: 28 }} aria-hidden="true" />
          </div>
        )}
        {children}
        {/* Last in the DOM so initial focus lands on the form or the safe action, not on Close. */}
        <button type="button" className="btn btn-ghost icon-btn btn-sm modal-close" aria-label="Close" data-tooltip="Close (Esc)" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
    </div>
  );
}
