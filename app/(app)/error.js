"use client";

import { useI18n as useSharedI18n } from "@/components/I18nProvider";

import Link from "next/link";
import { useEffect } from "react";
import { EmptyState } from "@/components/ui/states";

// Unexpected failure inside a screen. The shell (navigation) keeps working; nothing technical is shown.
export default function Error({ error, retry, reset }) {
  const { t: __sharedTr } = useSharedI18n();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="page">
      <EmptyState
        danger
        icon="alert"
        title={__sharedTr("This page couldn't be displayed")}
        action={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => (retry ?? reset)()}>{"" + __sharedTr("Try again") + ""}</button>
            <Link className="btn btn-ghost btn-sm" href="/dashboard">{"" + __sharedTr("Go to Dashboard") + ""}</Link>
          </>
        }
      >{"" + __sharedTr("Something unexpected went wrong. Your data is safe. If it keeps happening, tell your administrator") + ""}{error?.digest ? ` (reference ${error.digest})` : ""}.
      </EmptyState>
    </div>
  );
}
