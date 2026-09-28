import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty" style={{ minHeight: "100vh" }}>
      <div>
        <h3>Page not found</h3>
        <p>The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
        <Link className="btn btn-secondary btn-sm" href="/dashboard">Go to Dashboard</Link>
      </div>
    </div>
  );
}
