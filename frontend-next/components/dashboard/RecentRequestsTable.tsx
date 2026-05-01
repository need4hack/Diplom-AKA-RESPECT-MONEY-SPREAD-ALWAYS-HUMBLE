"use client";

import { useMemo, useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RequestActivityItem } from "@/lib/request-stats";
import { usePreferences } from "@/contexts/PreferencesContext";

type RecentRequestsTableProps = {
  requests: RequestActivityItem[];
};

const PAGE_SIZE = 20;

function getMethodBadgeVariant(method: string): "default" | "secondary" {
  return method === "POST" ? "default" : "secondary";
}

function getStatusBadgeVariant(status: number): "default" | "destructive" | "secondary" {
  if (status >= 400) return "destructive";
  if (status >= 300) return "secondary";
  return "default";
}

function escapeCsv(value: string | number | null): string {
  const normalized = String(value ?? "");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function parseIsoDateTimeParts(dateValue: string, timeValue: string, isEnd: boolean): Date | null {
  if (!dateValue) return null;

  const normalizedTime = timeValue || (isEnd ? "23:59" : "00:00");
  const candidate = new Date(`${dateValue}T${normalizedTime}`);
  if (Number.isNaN(candidate.getTime())) return null;

  if (isEnd && timeValue.length === 5) {
    candidate.setSeconds(59, 999);
  }

  return candidate;
}

function matchesDateRangeFilter(
  timestamp: string,
  fromDate: string,
  fromTime: string,
  toDate: string,
  toTime: string
): boolean {
  const requestDate = new Date(timestamp);
  if (Number.isNaN(requestDate.getTime())) return false;

  const from = parseIsoDateTimeParts(fromDate, fromTime, false);
  const to = parseIsoDateTimeParts(toDate, toTime, true);

  if (from && requestDate < from) return false;
  if (to && requestDate > to) return false;

  return true;
}

function matchesStatusFilter(status: number, value: string): boolean {
  if (value === "all") return true;
  if (value === "2xx") return status >= 200 && status < 300;
  if (value === "3xx") return status >= 300 && status < 400;
  if (value === "4xx") return status >= 400 && status < 500;
  if (value === "5xx") return status >= 500;
  return String(status) === value;
}

const TEXT = {
  ru: {
    allTime: "За всё время",
    start: "Начало",
    now: "Сейчас",
    totalRequests: "Всего запросов в логе",
    exportCsv: "Экспорт CSV",
    page: "Страница",
    of: "из",
    userPlaceholder: "Фильтр по пользователю или роли",
    endpointPlaceholder: "Фильтр по endpoint",
    method: "Метод",
    allMethods: "Все методы",
    status: "Статус",
    allStatuses: "Все статусы",
    dateRange: "Период",
    dateRangeHint: "Фильтрация запросов по дате и времени начала/окончания.",
    fromDate: "Дата от",
    fromTime: "Время от",
    toDate: "Дата до",
    toTime: "Время до",
    resetRange: "Сбросить диапазон",
    time: "Время",
    user: "Пользователь",
    source: "Источник",
    sourceWebsite: "Сайт",
    sourceApi: "API",
    endpoint: "Endpoint",
    duration: "Длительность",
    noMatches: "Нет API-запросов, подходящих под текущие фильтры.",
    noRole: "без роли",
    fileName: "recent-api-requests.csv",
  },
  en: {
    allTime: "All time",
    start: "Start",
    now: "Now",
    totalRequests: "Total logged requests",
    exportCsv: "Export CSV",
    page: "Page",
    of: "of",
    userPlaceholder: "Filter by user or role",
    endpointPlaceholder: "Filter by endpoint",
    method: "Method",
    allMethods: "All methods",
    status: "Status",
    allStatuses: "All statuses",
    dateRange: "Date range",
    dateRangeHint: "Filter requests by start and end date/time.",
    fromDate: "From date",
    fromTime: "From time",
    toDate: "To date",
    toTime: "To time",
    resetRange: "Reset range",
    time: "Time",
    user: "User",
    source: "Source",
    sourceWebsite: "Website",
    sourceApi: "API",
    endpoint: "Endpoint",
    duration: "Duration",
    noMatches: "No API requests matched the current filters.",
    noRole: "no role",
    fileName: "recent-api-requests.csv",
  },
} as const;

export default function RecentRequestsTable({ requests }: RecentRequestsTableProps) {
  const { language } = usePreferences();
  const text = TEXT[language];
  const sourceHeaderLabel = language === "ru" ? "Источник" : "Source";
  const sourceWebsiteLabel = language === "ru" ? "Вебсайт" : "Website";

  const [page, setPage] = useState(1);
  const [userFilter, setUserFilter] = useState("");
  const [endpointFilter, setEndpointFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [fromTime, setFromTime] = useState("");
  const [toDate, setToDate] = useState("");
  const [toTime, setToTime] = useState("");

  function formatRequestTime(timestamp: string): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return timestamp;
    }

    return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function formatDateRangeLabel(): string {
    if (!fromDate && !toDate) {
      return text.allTime;
    }

    const startLabel = fromDate ? `${fromDate}${fromTime ? ` ${fromTime}` : ""}` : text.start;
    const endLabel = toDate ? `${toDate}${toTime ? ` ${toTime}` : ""}` : text.now;

    return `${startLabel} - ${endLabel}`;
  }

  const filteredRequests = useMemo(() => {
    const normalizedUser = userFilter.trim().toLowerCase();
    const normalizedEndpoint = endpointFilter.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesUser =
        !normalizedUser ||
        request.user.toLowerCase().includes(normalizedUser) ||
        (request.role ?? "").toLowerCase().includes(normalizedUser);

      const matchesEndpoint =
        !normalizedEndpoint ||
        request.endpoint.toLowerCase().includes(normalizedEndpoint);

      const matchesMethod = methodFilter === "all" || request.method === methodFilter;

      return (
        matchesUser &&
        matchesEndpoint &&
        matchesMethod &&
        matchesStatusFilter(request.status, statusFilter) &&
        matchesDateRangeFilter(request.timestamp, fromDate, fromTime, toDate, toTime)
      );
    });
  }, [
    endpointFilter,
    fromDate,
    fromTime,
    methodFilter,
    requests,
    statusFilter,
    toDate,
    toTime,
    userFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRequests.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredRequests]);

  function handleExportCsv() {
    const header = ["timestamp", "source", "user", "role", "method", "endpoint", "status", "duration_ms", "service"];

    const rows = filteredRequests.map((request) => [
      request.timestamp,
      request.source,
      request.user,
      request.role ?? "",
      request.method,
      request.endpoint,
      request.status,
      request.duration_ms,
      request.service,
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => escapeCsv(value)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = text.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function resetDateRange() {
    setFromDate("");
    setFromTime("");
    setToDate("");
    setToTime("");
    setPage(1);
  }

  function getSourceLabel(source: RequestActivityItem["source"]) {
    return source === "external_api" ? text.sourceApi : sourceWebsiteLabel;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <span className="text-sm text-muted-foreground">
            {text.totalRequests}: {filteredRequests.length.toLocaleString()}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="mr-2 h-4 w-4" />
              {text.exportCsv}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {text.page} {currentPage} {text.of} {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input
            value={userFilter}
            onChange={(event) => {
              setUserFilter(event.target.value);
              setPage(1);
            }}
            placeholder={text.userPlaceholder}
            className="focus-visible:ring-0 focus-visible:ring-transparent focus-visible:shadow-none"
          />
          <Input
            value={endpointFilter}
            onChange={(event) => {
              setEndpointFilter(event.target.value);
              setPage(1);
            }}
            placeholder={text.endpointPlaceholder}
            className="focus-visible:ring-0 focus-visible:ring-transparent focus-visible:shadow-none"
          />
          <Select
            value={methodFilter}
            onValueChange={(value) => {
              setMethodFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={text.method} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{text.allMethods}</SelectItem>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={text.status} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{text.allStatuses}</SelectItem>
              <SelectItem value="2xx">2xx</SelectItem>
              <SelectItem value="3xx">3xx</SelectItem>
              <SelectItem value="4xx">4xx</SelectItem>
              <SelectItem value="5xx">5xx</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start px-2.5 font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                <span className="truncate">{formatDateRangeLabel()}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[360px]">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{text.dateRange}</p>
                  <p className="text-xs text-muted-foreground">{text.dateRangeHint}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{text.fromDate}</label>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(event) => {
                        setFromDate(event.target.value);
                        setPage(1);
                      }}
                      className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{text.fromTime}</label>
                    <Input
                      type="time"
                      value={fromTime}
                      onChange={(event) => {
                        setFromTime(event.target.value);
                        setPage(1);
                      }}
                      className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{text.toDate}</label>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(event) => {
                        setToDate(event.target.value);
                        setPage(1);
                      }}
                      className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{text.toTime}</label>
                    <Input
                      type="time"
                      value={toTime}
                      onChange={(event) => {
                        setToTime(event.target.value);
                        setPage(1);
                      }}
                      className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={resetDateRange}>
                    {text.resetRange}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-border">
            <TableHead>{text.time}</TableHead>
            <TableHead>{text.user}</TableHead>
            <TableHead>{sourceHeaderLabel}</TableHead>
            <TableHead>{text.method}</TableHead>
            <TableHead>{text.endpoint}</TableHead>
            <TableHead>{text.status}</TableHead>
            <TableHead className="text-right">{text.duration}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedRequests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                {text.noMatches}
              </TableCell>
            </TableRow>
          ) : (
            paginatedRequests.map((request) => (
              <TableRow key={request.id} className="border-border">
                <TableCell className="text-sm text-muted-foreground">
                  {formatRequestTime(request.timestamp)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{request.user}</span>
                    <span className="text-xs text-muted-foreground">
                      {request.role ?? text.noRole}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={request.source === "external_api" ? "secondary" : "outline"}>
                    {getSourceLabel(request.source)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={getMethodBadgeVariant(request.method)}>{request.method}</Badge>
                </TableCell>
                <TableCell className="max-w-[320px] truncate font-mono text-xs text-foreground/80">
                  {request.endpoint}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(request.status)}>{request.status}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium text-foreground/80">
                  {request.duration_ms} ms
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
