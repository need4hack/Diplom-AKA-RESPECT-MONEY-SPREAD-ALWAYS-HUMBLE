"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

type RecentRequestsTableProps = {
  requests: RequestActivityItem[];
};

const PAGE_SIZE = 20;

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

function escapeCsv(value: string | number | null): string {
  const normalized = String(value ?? "");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function parseIsoDateTimeParts(dateValue: string, timeValue: string, isEnd: boolean): Date | null {
  if (!dateValue) {
    return null;
  }

  const normalizedTime = timeValue || (isEnd ? "23:59" : "00:00");
  const candidate = new Date(`${dateValue}T${normalizedTime}`);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

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
  if (Number.isNaN(requestDate.getTime())) {
    return false;
  }

  const from = parseIsoDateTimeParts(fromDate, fromTime, false);
  const to = parseIsoDateTimeParts(toDate, toTime, true);

  if (from && requestDate < from) {
    return false;
  }

  if (to && requestDate > to) {
    return false;
  }

  return true;
}

function matchesStatusFilter(status: number, value: string): boolean {
  if (value === "all") {
    return true;
  }

  if (value === "2xx") {
    return status >= 200 && status < 300;
  }

  if (value === "3xx") {
    return status >= 300 && status < 400;
  }

  if (value === "4xx") {
    return status >= 400 && status < 500;
  }

  if (value === "5xx") {
    return status >= 500;
  }

  return String(status) === value;
}

function formatDateRangeLabel(
  fromDate: string,
  fromTime: string,
  toDate: string,
  toTime: string
): string {
  if (!fromDate && !toDate) {
    return "All time";
  }

  const startLabel = fromDate
    ? `${fromDate}${fromTime ? ` ${fromTime}` : ""}`
    : "Start";
  const endLabel = toDate
    ? `${toDate}${toTime ? ` ${toTime}` : ""}`
    : "Now";

  return `${startLabel} - ${endLabel}`;
}

export default function RecentRequestsTable({
  requests,
}: RecentRequestsTableProps) {
  const [page, setPage] = useState(1);
  const [userFilter, setUserFilter] = useState("");
  const [endpointFilter, setEndpointFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [fromTime, setFromTime] = useState("");
  const [toDate, setToDate] = useState("");
  const [toTime, setToTime] = useState("");

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

      const matchesMethod =
        methodFilter === "all" || request.method === methodFilter;

      return (
        matchesUser &&
        matchesEndpoint &&
        matchesMethod &&
        matchesStatusFilter(request.status, statusFilter) &&
        matchesDateRangeFilter(
          request.timestamp,
          fromDate,
          fromTime,
          toDate,
          toTime
        )
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

  useEffect(() => {
    setPage(1);
  }, [userFilter, endpointFilter, methodFilter, statusFilter, fromDate, fromTime, toDate, toTime]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRequests.slice(start, start + PAGE_SIZE);
  }, [filteredRequests, page]);

  function handleExportCsv() {
    const header = [
      "timestamp",
      "user",
      "role",
      "method",
      "endpoint",
      "status",
      "duration_ms",
      "service",
    ];

    const rows = filteredRequests.map((request) => [
      request.timestamp,
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
    link.download = "recent-api-requests.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function resetDateRange() {
    setFromDate("");
    setFromTime("");
    setToDate("");
    setToTime("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <span className="text-sm text-muted-foreground">
            Total logged requests: {filteredRequests.length.toLocaleString()}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input
            value={userFilter}
            onChange={(event) => setUserFilter(event.target.value)}
            placeholder="Filter by user or role"
            className="focus-visible:ring-0 focus-visible:ring-transparent focus-visible:shadow-none"
          />
          <Input
            value={endpointFilter}
            onChange={(event) => setEndpointFilter(event.target.value)}
            placeholder="Filter by endpoint"
            className="focus-visible:ring-0 focus-visible:ring-transparent focus-visible:shadow-none"
          />
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="2xx">2xx</SelectItem>
              <SelectItem value="3xx">3xx</SelectItem>
              <SelectItem value="4xx">4xx</SelectItem>
              <SelectItem value="5xx">5xx</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start px-2.5 font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                <span className="truncate">
                  {formatDateRangeLabel(fromDate, fromTime, toDate, toTime)}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[360px]">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Date range</p>
                  <p className="text-xs text-muted-foreground">
                    Filter requests by start and end date/time.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">From date</label>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(event) => setFromDate(event.target.value)}
                      className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">From time</label>
                    <Input
                      type="time"
                      value={fromTime}
                      onChange={(event) => setFromTime(event.target.value)}
                      className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">To date</label>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(event) => setToDate(event.target.value)}
                      className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">To time</label>
                    <Input
                      type="time"
                      value={toTime}
                      onChange={(event) => setToTime(event.target.value)}
                      className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={resetDateRange}>
                    Reset range
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
            <TableHead>Time</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Endpoint</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedRequests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                No API requests matched the current filters.
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
                      {request.role ?? "no role"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getMethodBadgeVariant(request.method)}>
                    {request.method}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[320px] truncate font-mono text-xs text-foreground/80">
                  {request.endpoint}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(request.status)}>
                    {request.status}
                  </Badge>
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
