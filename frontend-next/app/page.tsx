import { Metadata } from "next";
import HomePageContent from "@/components/dashboard/HomePageContent";
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

  return <HomePageContent stats={stats} activity={activity} />;
}
