"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, ChartColumn, KeyRound, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalHistory } from "@/contexts/PortalHistoryContext";
import { usePreferences } from "@/contexts/PreferencesContext";

const TEXT = {
  ru: {
    greeting: "Пользовательский кабинет",
    anonymousGreeting: "Клиентский кабинет",
    subtitle:
      "Здесь пользователь видит только свои рабочие разделы: Portal, отчёты и ключевые данные по аккаунту.",
    openPortal: "Открыть Portal",
    openReports: "Мои отчёты",
    usage: "Лимит запросов",
    usageHint: "Использовано в текущем периоде",
    remaining: "Осталось запросов",
    account: "Аккаунт",
    email: "Email",
    role: "Роль",
    apiAccess: "API доступ",
    apiAccessHint: "Ключ можно использовать для клиентских интеграций.",
    apiMissing: "API ключ пока не выдан",
    reports: "Последние отчёты",
    reportsHint: "Сюда попадают последние оценки из Portal.",
    emptyReports: "Пока нет сохранённых оценок. Сделайте первую оценку в Portal.",
    mileage: "Пробег",
    damages: "Повреждений",
    viewAll: "Смотреть всё",
    guestCta: "Войдите, чтобы видеть персональные лимиты и данные аккаунта.",
    active: "Активен",
    guest: "Гость",
  },
  en: {
    greeting: "User workspace",
    anonymousGreeting: "Client workspace",
    subtitle:
      "This view keeps only user-facing sections: Portal, reports, and account essentials.",
    openPortal: "Open Portal",
    openReports: "My Reports",
    usage: "Request limit",
    usageHint: "Used in the current period",
    remaining: "Requests left",
    account: "Account",
    email: "Email",
    role: "Role",
    apiAccess: "API access",
    apiAccessHint: "Use this key for client integrations.",
    apiMissing: "API key has not been issued yet",
    reports: "Recent reports",
    reportsHint: "Latest valuations from Portal appear here.",
    emptyReports: "No saved valuations yet. Run your first estimate in Portal.",
    mileage: "Mileage",
    damages: "Damages",
    viewAll: "View all",
    guestCta: "Sign in to see personal limits and account data.",
    active: "Active",
    guest: "Guest",
  },
} as const;

function maskApiKey(apiKey: string | null) {
  if (!apiKey) {
    return null;
  }

  if (apiKey.length <= 10) {
    return apiKey;
  }

  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
}

export default function UserWorkspace() {
  const { user } = useAuth();
  const { entries } = usePortalHistory();
  const { language, formatAedPrice } = usePreferences();
  const text = TEXT[language];

  const requestLimit = user?.request_limit ?? 0;
  const requestCount = user?.request_count ?? 0;
  const usagePercent =
    requestLimit > 0 ? Math.min(100, Math.round((requestCount / requestLimit) * 100)) : 0;
  const remaining = Math.max(0, requestLimit - requestCount);
  const recentEntries = entries.slice(0, 3);

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card">
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="w-fit">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              CarSpecs
            </Badge>
            <div className="space-y-1">
              <CardTitle className="text-2xl">
                {user ? `${text.greeting}, ${user.username}` : text.anonymousGreeting}
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm">
                {text.subtitle}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/portal">
                {text.openPortal}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/responses">{text.openReports}</Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ChartColumn className="h-4 w-4 text-primary" />
                {text.usage}
              </CardTitle>
              <CardDescription>{text.usageHint}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-bold tracking-tight text-foreground">
                    {requestCount}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    / {requestLimit || "—"}
                  </p>
                </div>
                <Badge variant="secondary">{usagePercent}%</Badge>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {text.remaining}: <span className="font-medium text-foreground">{remaining}</span>
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BadgeCheck className="h-4 w-4 text-primary" />
                {text.account}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-muted-foreground">{text.email}</span>
                <span className="font-medium text-foreground">
                  {user?.email ?? "guest@carspecs"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-muted-foreground">{text.role}</span>
                <span className="font-medium uppercase text-foreground">
                  {user?.role ?? "guest"}
                </span>
              </div>
              {!user && (
                <p className="text-sm text-muted-foreground">{text.guestCta}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" />
              {text.apiAccess}
            </CardTitle>
            <CardDescription>{text.apiAccessHint}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                API Key
              </p>
              <p className="mt-2 break-all font-mono text-sm text-foreground">
                {maskApiKey(user?.api_key ?? null) ?? text.apiMissing}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Portal</p>
                <p className="mt-2 text-lg font-semibold text-foreground">VIN + VV</p>
              </div>
              <div className="rounded-xl border border-border px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Reports</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{entries.length}</p>
              </div>
              <div className="rounded-xl border border-border px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {user ? text.active : text.guest}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/80 bg-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{text.reports}</CardTitle>
            <CardDescription>{text.reportsHint}</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/responses">{text.viewAll}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              {text.emptyReports}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">
                        {entry.year} {entry.make} {entry.model}
                      </p>
                      <p className="text-sm text-muted-foreground">{entry.trim}</p>
                    </div>
                    <Badge variant="outline">{entry.vin.slice(-6)}</Badge>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{text.mileage}</span>
                      <span className="font-medium text-foreground">
                        {entry.mileage.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{text.damages}</span>
                      <span className="font-medium text-foreground">{entry.damageCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">VV</span>
                      <span className="font-medium text-foreground">
                        {formatAedPrice(entry.medium)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
