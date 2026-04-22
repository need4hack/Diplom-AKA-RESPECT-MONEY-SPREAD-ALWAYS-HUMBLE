import "server-only";

import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export type LoggedService = "auth" | "vehicles" | "vin" | "valuation";
export type RequestSource = "website" | "external_api";

type CountSet = {
  today: number;
  yd: number;
  tm: number;
  lm: number;
};

export type RequestLogEntry = {
  timestamp: string;
  service: LoggedService;
  source?: RequestSource;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  user_id?: string | null;
  username?: string | null;
  role?: string | null;
};

export type DashboardCardStat = CountSet & {
  key: "queries" | "vd" | "vv" | "vr";
  title: "Queries" | "VD" | "VV" | "VR";
};

export type DashboardStatsResponse = {
  generated_at: string;
  cards: DashboardCardStat[];
};

export type RequestActivityItem = {
  id: string;
  timestamp: string;
  source: RequestSource;
  endpoint: string;
  method: string;
  status: number;
  duration_ms: number;
  user: string;
  role: string | null;
  service: LoggedService;
};

export type DashboardActivityResponse = {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_duration_ms: number;
  unique_users: number;
  recent_requests: RequestActivityItem[];
  top_users: Array<{
    user: string;
    requests: number;
  }>;
};

const LOG_DIR = path.join(process.cwd(), ".runtime");
const LOG_FILE = path.join(LOG_DIR, "api-request-log.jsonl");

function emptyCountSet(): CountSet {
  return { today: 0, yd: 0, tm: 0, lm: 0 };
}

function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isSameMonth(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

function addToCounts(counts: CountSet, date: Date, now: Date) {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const entryMonth = new Date(date.getFullYear(), date.getMonth(), 1);

  if (isSameDay(date, now)) {
    counts.today += 1;
  }

  if (isSameDay(date, yesterday)) {
    counts.yd += 1;
  }

  if (isSameMonth(date, currentMonth)) {
    counts.tm += 1;
  }

  if (isSameMonth(date, lastMonth) && entryMonth.getTime() < currentMonth.getTime()) {
    counts.lm += 1;
  }
}

function isVinDecodeRequest(log: RequestLogEntry): boolean {
  return log.method === "POST" && log.path === "/api/vin/decode/";
}

function isValuationRequest(log: RequestLogEntry): boolean {
  return log.method === "POST" && log.path === "/api/valuation/calculate/";
}

function isVehicleRequest(log: RequestLogEntry): boolean {
  return log.path.startsWith("/api/vehicles/");
}

function getLogUserLabel(log: RequestLogEntry): string {
  if (log.username && log.username.trim()) {
    return log.username;
  }

  if (log.service === "auth") {
    return "Guest";
  }

  return "Unknown";
}

async function ensureLogDir() {
  await mkdir(LOG_DIR, { recursive: true });
}

async function readRequestLogs(): Promise<RequestLogEntry[]> {
  try {
    const raw = await readFile(LOG_FILE, "utf8");

    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as RequestLogEntry;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is RequestLogEntry => entry !== null);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return [];
    }
    console.error("[Dashboard Stats] Failed to read request logs:", error);
    return [];
  }
}

export async function getRequestLogs(): Promise<RequestLogEntry[]> {
  return readRequestLogs();
}

export async function appendRequestLog(entry: RequestLogEntry) {
  try {
    await ensureLogDir();
    await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    console.error("[Dashboard Stats] Failed to append request log:", error);
  }
}

export async function getDashboardStats(
  now: Date = new Date()
): Promise<DashboardStatsResponse> {
  const logs = await readRequestLogs();

  const totalCounts = emptyCountSet();
  const vehicleDetailsCounts = emptyCountSet();
  const valuationCounts = emptyCountSet();
  const vehicleRequestCounts = emptyCountSet();

  for (const log of logs) {
    const date = new Date(log.timestamp);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    addToCounts(totalCounts, date, now);

    if (isVinDecodeRequest(log)) {
      addToCounts(vehicleDetailsCounts, date, now);
    }

    if (isValuationRequest(log)) {
      addToCounts(valuationCounts, date, now);
    }

    if (isVehicleRequest(log)) {
      addToCounts(vehicleRequestCounts, date, now);
    }
  }

  return {
    generated_at: now.toISOString(),
    cards: [
      { key: "queries", title: "Queries", ...totalCounts },
      { key: "vd", title: "VD", ...vehicleDetailsCounts },
      { key: "vv", title: "VV", ...valuationCounts },
      { key: "vr", title: "VR", ...vehicleRequestCounts },
    ],
  };
}

export async function getDashboardActivity(
  limit?: number
): Promise<DashboardActivityResponse> {
  const logs = await readRequestLogs();
  const sortedLogs = [...logs].sort((left, right) => {
    return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
  });

  const totalRequests = sortedLogs.length;
  const successfulRequests = sortedLogs.filter((log) => log.status < 400).length;
  const failedRequests = totalRequests - successfulRequests;
  const avgDurationMs =
    totalRequests === 0
      ? 0
      : Math.round(
          sortedLogs.reduce((total, log) => total + log.duration_ms, 0) / totalRequests
        );

  const uniqueUsers = new Set(
    sortedLogs
      .map((log) => log.user_id ?? log.username ?? null)
      .filter((value): value is string => Boolean(value))
  ).size;

  const topUsersMap = new Map<string, number>();
  for (const log of sortedLogs) {
    const label = getLogUserLabel(log);
    topUsersMap.set(label, (topUsersMap.get(label) ?? 0) + 1);
  }

  const topUsers = Array.from(topUsersMap.entries())
    .map(([user, requests]) => ({ user, requests }))
    .sort((left, right) => right.requests - left.requests)
    .slice(0, 5);

  const logsForActivity =
    typeof limit === "number" ? sortedLogs.slice(0, limit) : sortedLogs;

  const recentRequests = logsForActivity.map((log, index) => ({
    id: `${log.timestamp}-${log.method}-${log.path}-${index}`,
    timestamp: log.timestamp,
    source: log.source ?? "website",
    endpoint: log.path,
    method: log.method,
    status: log.status,
    duration_ms: log.duration_ms,
    user: getLogUserLabel(log),
    role: log.role ?? null,
    service: log.service,
  }));

  return {
    total_requests: totalRequests,
    successful_requests: successfulRequests,
    failed_requests: failedRequests,
    avg_duration_ms: avgDurationMs,
    unique_users: uniqueUsers,
    recent_requests: recentRequests,
    top_users: topUsers,
  };
}
