"use client";

import { useApp } from "@/components/AppProvider";
import AnalystDashboard from "@/components/screens/dashboard/AnalystDashboard";
import SecurityDashboard from "@/components/screens/dashboard/SecurityDashboard";
import SocDashboard from "@/components/screens/dashboard/SocDashboard";

/** Role-aware dashboard: Security Manager (department), SOC Manager (SOC team), everyone else (own work). */
export default function Dashboard() {
  const { role } = useApp();
  if (role === "soc") return <SocDashboard />;
  if (role === "security") return <SecurityDashboard />;
  return <AnalystDashboard />;
}
