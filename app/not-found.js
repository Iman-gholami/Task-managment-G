import Link from "next/link";
import { EmptyState } from "@/components/ui/states";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="standalone">
      <EmptyState icon="search" title="Page not found" action={<Link className="btn btn-primary btn-sm" href="/dashboard">Go to Dashboard</Link>}>
        The page you&apos;re looking for doesn&apos;t exist or was moved. Check the address, or start again from the dashboard.
      </EmptyState>
    </main>
  );
}
