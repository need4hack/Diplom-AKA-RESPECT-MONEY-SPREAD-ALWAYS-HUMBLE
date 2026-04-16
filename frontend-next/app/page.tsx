import { Metadata } from "next";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import { getDashboardActivity, getDashboardStats } from "@/lib/request-stats";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const [stats, activity] = await Promise.all([
    getDashboardStats(),
    getDashboardActivity(),
  ]);

  return <DashboardOverview stats={stats} activity={activity} />;
}
