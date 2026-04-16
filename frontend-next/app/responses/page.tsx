"use client";

import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyPlaceholder } from "@/components/ui/empty-placeholder";
import { usePortalHistory } from "@/contexts/PortalHistoryContext";
import { usePreferences } from "@/contexts/PreferencesContext";

const TEXT = {
  ru: {
    title: "Мои отчёты",
    description:
      "Здесь сохраняются последние оценки из Portal. История привязана к вашему аккаунту и хранится в базе данных.",
    clearAll: "Очистить историю",
    low: "Низкая",
    medium: "Средняя",
    high: "Высокая",
    today: "Сегодня",
    newPrice: "Новая",
    mileage: "Пробег",
    damages: "Повреждений",
    created: "Создано",
    noReports: "Отчётов пока нет",
    noReportsHint: "После расчёта в Portal запись появится здесь автоматически.",
    loading: "Загружаем историю...",
    deleteReport: "Удалить отчёт",
    newBadge: "Новый",
  },
  en: {
    title: "My Reports",
    description:
      "Latest Portal valuations are saved here. History is linked to your account and stored in the database.",
    clearAll: "Clear history",
    low: "Low",
    medium: "Medium",
    high: "High",
    today: "Today",
    newPrice: "New",
    mileage: "Mileage",
    damages: "Damages",
    created: "Created",
    noReports: "No reports yet",
    noReportsHint: "Run a valuation in Portal and it will appear here automatically.",
    loading: "Loading history...",
    deleteReport: "Delete report",
    newBadge: "New",
  },
} as const;

export default function ResponsesPage() {
  const { entries, hydrated, removeEntry, clearEntries } = usePortalHistory();
  const { language, formatAedPrice } = usePreferences();
  const text = TEXT[language];

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{text.title}</CardTitle>
            <CardDescription>{text.description}</CardDescription>
          </div>
          {entries.length > 0 && (
            <Button variant="outline" onClick={clearEntries}>
              {text.clearAll}
            </Button>
          )}
        </CardHeader>
      </Card>

      {!hydrated ? (
        <div className="rounded-xl border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          {text.loading}
        </div>
      ) : entries.length === 0 ? (
        <EmptyPlaceholder
          title={text.noReports}
          description={text.noReportsHint}
          className="min-h-[340px] rounded-2xl border border-dashed border-border bg-card"
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {entries.map((entry) => (
            <Card key={entry.id} className="border-border/80 bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">
                      {entry.year} {entry.make} {entry.model}
                    </CardTitle>
                    <CardDescription>
                      {entry.trim} • VIN {entry.vin}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeEntry(entry.id)}
                    title={text.deleteReport}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">{text.high}</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                      {formatAedPrice(entry.high)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                    <p className="text-xs text-amber-700 dark:text-amber-400">{text.medium}</p>
                    <p className="mt-1 text-lg font-semibold text-amber-700 dark:text-amber-300">
                      {formatAedPrice(entry.medium)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                    <p className="text-xs text-red-700 dark:text-red-400">{text.low}</p>
                    <p className="mt-1 text-lg font-semibold text-red-700 dark:text-red-300">
                      {formatAedPrice(entry.low)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <span className="text-muted-foreground">{text.today}</span>
                    <span className="font-medium text-foreground">
                      {formatAedPrice(entry.todayPrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <span className="text-muted-foreground">{text.newPrice}</span>
                    <span className="font-medium text-foreground">
                      {formatAedPrice(entry.newPrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <span className="text-muted-foreground">{text.mileage}</span>
                    <span className="font-medium text-foreground">
                      {entry.mileage.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <span className="text-muted-foreground">{text.damages}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{entry.damageCount}</span>
                      {entry.isNew && <Badge variant="secondary">{text.newBadge}</Badge>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {text.created}: {new Date(entry.createdAt).toLocaleString(language === "ru" ? "ru-RU" : "en-US")}
                  </span>
                  <Badge variant="outline">ID {entry.vehicleId}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
