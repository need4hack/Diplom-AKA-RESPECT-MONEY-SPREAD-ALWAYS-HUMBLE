"use client";

import DashboardOverview from "@/components/dashboard/DashboardOverview";
import UserWorkspace from "@/components/dashboard/UserWorkspace";
import type {
  DashboardActivityResponse,
  DashboardStatsResponse,
} from "@/lib/request-stats";
import { useAuth } from "@/contexts/AuthContext";
import { isPrivilegedRole } from "@/lib/access";

export default function HomePageContent({
  stats,
  activity,
}: {
  stats: DashboardStatsResponse;
  activity: DashboardActivityResponse;
}) {
  const { user } = useAuth();

  if (isPrivilegedRole(user?.role)) {
    return <DashboardOverview stats={stats} activity={activity} />;
  }

  return <UserWorkspace />;
}
