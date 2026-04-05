import { Metadata } from "next";
import {
  Activity,
  Clock3,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getDashboardActivity,
  getDashboardStats,
  type DashboardCardStat,
} from "@/lib/request-stats";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CARD_ICONS: Record<DashboardCardStat["key"], typeof Search> = {
  queries: Search,
  vd: Activity,
  vv: Clock3,
  vr: UserRound,
};

const CARD_DESCRIPTIONS: Record<DashboardCardStat["key"], string> = {
  queries: "All proxied API requests",
  vd: "VIN decodes",
  vv: "Vehicle valuations",
  vr: "Vehicle catalog requests",
};

function formatRequestTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getMethodBadgeVariant(method: string): "default" | "secondary" {
  return method === "POST" ? "default" : "secondary";
}

function getStatusBadgeVariant(status: number): "default" | "destructive" | "secondary" {
  if (status >= 400) {
    return "destructive";
  }

  if (status >= 300) {
    return "secondary";
  }

  return "default";
}

export default async function DashboardPage() {
  const [stats, activity] = await Promise.all([
    getDashboardStats(),
    getDashboardActivity(12),
  ]);

  const successRate =
    activity.total_requests === 0
      ? 0
      : (activity.successful_requests / activity.total_requests) * 100;

  const errorRate =
    activity.total_requests === 0
      ? 0
      : (activity.failed_requests / activity.total_requests) * 100;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.cards.map((card) => {
          const Icon = CARD_ICONS[card.key];

          return (
            <Card key={card.key} className="border-zinc-200/80 bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardDescription>{CARD_DESCRIPTIONS[card.key]}</CardDescription>
                    <CardTitle>{card.title}</CardTitle>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-zinc-600">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tracking-tight text-zinc-950">{card.today}</p>
                <p className="mt-1 text-xs text-zinc-500">Today</p>
                <div className="mt-4 flex gap-4 text-xs text-zinc-500">
                  <span>YD: {card.yd}</span>
                  <span>TM: {card.tm}</span>
                  <span>LM: {card.lm}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <Card className="border-zinc-200/80 bg-white">
          <CardHeader className="border-b border-zinc-100 pb-4">
            <CardTitle>Recent API Requests</CardTitle>
            <CardDescription>
              Live request feed for all users going through the admin proxy.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-100">
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activity.recent_requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-sm text-zinc-500">
                      No API requests logged yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  activity.recent_requests.map((request) => (
                    <TableRow key={request.id} className="border-zinc-100">
                      <TableCell className="text-sm text-zinc-600">
                        {formatRequestTime(request.timestamp)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-zinc-900">{request.user}</span>
                          <span className="text-xs text-zinc-500">
                            {request.role ?? "no role"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getMethodBadgeVariant(request.method)}>
                          {request.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[320px] truncate font-mono text-xs text-zinc-700">
                        {request.endpoint}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(request.status)}>
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-zinc-700">
                        {request.duration_ms} ms
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border-zinc-200/80 bg-white">
            <CardHeader className="pb-3">
              <CardTitle>Request Health</CardTitle>
              <CardDescription>Admin-side API quality snapshot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Success Rate
                  </p>
                  <p className="mt-2 text-2xl font-bold text-zinc-950">
                    {formatPercentage(successRate)}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Avg Duration
                  </p>
                  <p className="mt-2 text-2xl font-bold text-zinc-950">
                    {activity.avg_duration_ms} ms
                  </p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2">
                  <span className="text-zinc-500">Errors</span>
                  <span className="font-medium text-zinc-900">
                    {activity.failed_requests} ({formatPercentage(errorRate)})
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2">
                  <span className="text-zinc-500">Tracked users</span>
                  <span className="font-medium text-zinc-900">{activity.unique_users}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2">
                  <span className="text-zinc-500">Total logged</span>
                  <span className="font-medium text-zinc-900">{activity.total_requests}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200/80 bg-white">
            <CardHeader className="pb-3">
              <CardTitle>Top Requesters</CardTitle>
              <CardDescription>Who is generating the most traffic now.</CardDescription>
            </CardHeader>
            <CardContent>
              {activity.top_users.length === 0 ? (
                <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-zinc-200 text-sm text-zinc-500">
                  No user activity yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {activity.top_users.map((entry, index) => (
                    <div
                      key={`${entry.user}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">
                          {entry.user.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900">{entry.user}</p>
                          <p className="text-xs text-zinc-500">API activity</p>
                        </div>
                      </div>
                      <Badge variant="outline">{entry.requests}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-200/80 bg-zinc-950 text-white shadow-none ring-zinc-900/10">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-zinc-300" />
                <CardTitle className="text-white">Admin Note</CardTitle>
              </div>
              <CardDescription className="text-zinc-400">
                Dashboard sees requests that pass through `frontend-next/app/api`.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-zinc-300">
              Direct calls to Django services bypass this feed and will not show up here
              until they are routed through the same proxy layer.
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
