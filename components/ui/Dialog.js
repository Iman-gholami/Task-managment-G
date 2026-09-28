"use client";

import useFocusTrap from "@/components/useFocusTrap";

/** Shared modal frame: scrim, focus trap, Escape to close, click-outside to close. */
export default function Dialog({ label, onClose, children, width = 520, onKeyDown }) {
  const ref = useFocusTrap(onClose);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={label} style={{ maxWidth: width }} onKeyDown={onKeyDown}>
        {children}
      </div>
    </div>
  );
}
