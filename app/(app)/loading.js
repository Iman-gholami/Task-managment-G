// Route-level loading: keeps the page frame (title, metrics, table) so nothing jumps when content arrives.
export default function Loading() {
  return (
    <div className="page" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="sk-late" aria-hidden="true">
        <div className="sk" style={{ width: 240, height: 22, marginBottom: 10 }} />
        <div className="sk" style={{ width: 320, height: 12, marginBottom: 28 }} />
        <div className="metrics">{[0, 1, 2, 3].map((i) => <div key={i} className="metric"><div className="sk" style={{ width: "50%" }} /><div className="sk" style={{ width: 64, height: 22 }} /></div>)}</div>
        <div className="panel sk-rows">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i}><div className="sk" style={{ width: `${60 + ((i * 13) % 30)}%` }} /><div className="sk" /><div className="sk" style={{ width: "60%" }} /><div className="sk" style={{ width: "40%" }} /></div>)}</div>
      </div>
    </div>
  );
}
