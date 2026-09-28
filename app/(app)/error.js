"use client";

import Link from "next/link";

export default function Error({ reset }) {
  return (
    <div className="empty">
      <h3>Something went wrong</h3>
      <p>This page couldn&apos;t be loaded. Your data is safe.</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button className="btn btn-secondary btn-sm" onClick={() => reset()}>Retry</button>
        <Link className="btn btn-ghost btn-sm" href="/dashboard">Go Back</Link>
      </div>
    </div>
  );
}
