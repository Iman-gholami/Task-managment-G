import { Suspense } from "react";
import { notFound } from "next/navigation";
import Reports from "@/components/screens/Reports";
import { REPORTS } from "@/lib/reports";

export async function generateMetadata({ params }) {
  const { report } = await params;
  return { title: REPORTS.find((r) => r[0] === report)?.[1] ?? "Reports" };
}

export default async function Page({ params }) {
  const { report } = await params;
  if (!REPORTS.some((r) => r[0] === report)) notFound();
  return <Suspense><Reports key={report} report={report} /></Suspense>;
}
