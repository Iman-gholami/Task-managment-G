"use client";

import { useEffect } from "react";

/**
 * Warns before unsaved work is lost: closing or reloading the tab always asks; with `links`, following an
 * in-app link (sidebar, breadcrumbs) asks too. In-page switches (another checklist) use the app's own dialog.
 */
export default function useUnsavedChanges(dirty, { links = false, message = "You have unsaved changes. Leave without saving?" } = {}) {
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    // Capture phase on the document runs before Next.js' <Link> handler, so cancelling here stops the navigation.
    const onClick = (e) => {
      const a = e.target.closest?.("a[href]");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank") return;
      if (a.getAttribute("href").startsWith("#")) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    if (links) document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (links) document.removeEventListener("click", onClick, true);
    };
  }, [dirty, links, message]);
}
