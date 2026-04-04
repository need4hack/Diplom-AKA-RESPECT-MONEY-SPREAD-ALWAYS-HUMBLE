import { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats } from "@/lib/request-stats";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.cards.map((s) => (
          <Card key={s.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">
                {s.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-zinc-900">{s.today}</p>
              <p className="text-xs text-zinc-500 mt-1">Today</p>
              <div className="flex gap-4 mt-3 text-xs text-zinc-400">
                <span>YD: {s.yd}</span>
                <span>TM: {s.tm}</span>
                <span>LM: {s.lm}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
