import "server-only";

import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export type LoggedService = "auth" | "vehicles" | "vin" | "valuation";

type CountSet = {
  today: number;
  yd: number;
  tm: number;
  lm: number;
};

export type RequestLogEntry = {
  timestamp: string;
  service: LoggedService;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
};

export type DashboardCardStat = CountSet & {
  key: "queries" | "vd" | "vv" | "vr";
  title: "Queries" | "VD" | "VV" | "VR";
};

export type DashboardStatsResponse = {
  generated_at: string;
  cards: DashboardCardStat[];
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
  const vehicleCounts = emptyCountSet();
  const valuationCounts = emptyCountSet();
  const vinCounts = emptyCountSet();

  for (const log of logs) {
    const date = new Date(log.timestamp);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    addToCounts(totalCounts, date, now);

    if (log.service === "vehicles") {
      addToCounts(vehicleCounts, date, now);
    }

    if (log.service === "valuation") {
      addToCounts(valuationCounts, date, now);
    }

    if (log.service === "vin") {
      addToCounts(vinCounts, date, now);
    }
  }

  return {
    generated_at: now.toISOString(),
    cards: [
      { key: "queries", title: "Queries", ...totalCounts },
      { key: "vd", title: "VD", ...vehicleCounts },
      { key: "vv", title: "VV", ...valuationCounts },
      { key: "vr", title: "VR", ...vinCounts },
    ],
  };
}
