"use client";

import {
  Activity,
  Clock3,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import RecentRequestsTable from "@/components/dashboard/RecentRequestsTable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type DashboardActivityResponse,
  type DashboardCardStat,
  type DashboardStatsResponse,
} from "@/lib/request-stats";
import { usePreferences } from "@/contexts/PreferencesContext";

const CARD_ICONS: Record<DashboardCardStat["key"], typeof Search> = {
  queries: Search,
  vd: Activity,
  vv: Clock3,
  vr: UserRound,
};

const TEXT = {
  ru: {
    queries: "Все проксированные API-запросы",
    vd: "Декодирование VIN",
    vv: "Оценки автомобилей",
    vr: "Запросы к каталогу автомобилей",
    today: "Сегодня",
    recentRequests: "Последние API-запросы",
    recentRequestsDescription:
      "Живая лента запросов всех пользователей, проходящих через admin proxy.",
    requestHealth: "Состояние запросов",
    requestHealthDescription: "Срез качества API на стороне администратора.",
    successRate: "Успешность",
    avgDuration: "Средняя длительность",
    errors: "Ошибки",
    trackedUsers: "Отслеживаемые пользователи",
    totalLogged: "Всего в логах",
    topRequesters: "Топ пользователей",
    topRequestersDescription: "Кто сейчас генерирует больше всего трафика.",
    noActivity: "Активности пользователей пока нет.",
    apiActivity: "API-активность",
    adminNote: "Заметка администратора",
    adminNoteDescription:
      "Dashboard видит запросы, которые проходят через `frontend-next/app/api`.",
    adminNoteText:
      "Прямые вызовы к Django-сервисам обходят эту ленту и не появятся здесь, пока не будут направлены через тот же proxy-слой.",
  },
  en: {
    queries: "All proxied API requests",
    vd: "VIN decodes",
    vv: "Vehicle valuations",
    vr: "Vehicle catalog requests",
    today: "Today",
    recentRequests: "Recent API Requests",
    recentRequestsDescription:
      "Live request feed for all users going through the admin proxy.",
    requestHealth: "Request Health",
    requestHealthDescription: "Admin-side API quality snapshot.",
    successRate: "Success Rate",
    avgDuration: "Avg Duration",
    errors: "Errors",
    trackedUsers: "Tracked users",
    totalLogged: "Total logged",
    topRequesters: "Top Requesters",
    topRequestersDescription: "Who is generating the most traffic now.",
    noActivity: "No user activity yet.",
    apiActivity: "API activity",
    adminNote: "Admin Note",
    adminNoteDescription:
      "Dashboard sees requests that pass through `frontend-next/app/api`.",
    adminNoteText:
      "Direct calls to Django services bypass this feed and will not show up here until they are routed through the same proxy layer.",
  },
} as const;

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function DashboardOverview({
  stats,
  activity,
}: {
  stats: DashboardStatsResponse;
  activity: DashboardActivityResponse;
}) {
  const { language } = usePreferences();
  const text = TEXT[language];

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
          const description = text[card.key];

          return (
            <Card key={card.key} className="border-border/80 bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardDescription>{description}</CardDescription>
                    <CardTitle>{card.title}</CardTitle>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/60 p-2 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tracking-tight text-foreground">{card.today}</p>
                <p className="mt-1 text-xs text-muted-foreground">{text.today}</p>
                <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
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
        <Card className="border-border/80 bg-card">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle>{text.recentRequests}</CardTitle>
            <CardDescription>{text.recentRequestsDescription}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <RecentRequestsTable requests={activity.recent_requests} />
          </CardContent>
        </Card>

        <div className="grid content-start gap-4 self-start">
          <Card className="h-fit border-border/80 bg-card">
            <CardHeader className="pb-3">
              <CardTitle>{text.requestHealth}</CardTitle>
              <CardDescription>{text.requestHealthDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-xl border border-border bg-muted/50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {text.successRate}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {formatPercentage(successRate)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {text.avgDuration}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {activity.avg_duration_ms} ms
                  </p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-muted-foreground">{text.errors}</span>
                  <span className="font-medium text-foreground">
                    {activity.failed_requests} ({formatPercentage(errorRate)})
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-muted-foreground">{text.trackedUsers}</span>
                  <span className="font-medium text-foreground">{activity.unique_users}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="text-muted-foreground">{text.totalLogged}</span>
                  <span className="font-medium text-foreground">{activity.total_requests}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit border-border/80 bg-card">
            <CardHeader className="pb-3">
              <CardTitle>{text.topRequesters}</CardTitle>
              <CardDescription>{text.topRequestersDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {activity.top_users.length === 0 ? (
                <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                  {text.noActivity}
                </div>
              ) : (
                <div className="space-y-3">
                  {activity.top_users.map((entry, index) => (
                    <div
                      key={`${entry.user}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                          {entry.user.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{entry.user}</p>
                          <p className="text-xs text-muted-foreground">{text.apiActivity}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{entry.requests}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit border-primary/15 bg-primary/5 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" />
                <CardTitle>{text.adminNote}</CardTitle>
              </div>
              <CardDescription>{text.adminNoteDescription}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {text.adminNoteText}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
