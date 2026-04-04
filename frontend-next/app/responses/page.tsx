"use client";

import { useState } from "react";
import DataTable, { type Column } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";

/* ─── types ───────────────────────────────────────────────── */

interface ResponseRecord {
  id: number;
  timestamp: string;
  endpoint: string;
  method: string;
  status: number;
  user: string;
  duration_ms: number;
}

/* ─── columns ─────────────────────────────────────────────── */

const columns: Column<ResponseRecord>[] = [
  { key: "id", header: "ID", className: "w-[60px] font-mono text-xs" },
  { key: "timestamp", header: "Timestamp", className: "text-xs" },
  { key: "method", header: "Method", render: (r) => (
    <Badge variant={r.method === "POST" ? "default" : "secondary"}>{r.method}</Badge>
  )},
  { key: "endpoint", header: "Endpoint", className: "font-mono text-xs" },
  { key: "status", header: "Status", render: (r) => (
    <Badge variant={r.status >= 400 ? "destructive" : "default"}>
      {r.status}
    </Badge>
  )},
  { key: "user", header: "User" },
  { key: "duration_ms", header: "Duration", render: (r) => `${r.duration_ms}ms` },
];

/* ─── mock data ───────────────────────────────────────────── */

const MOCK_RESPONSES: ResponseRecord[] = [
  { id: 1, timestamp: "2026-03-29 14:30:12", endpoint: "/api/valuation/calculate/", method: "POST", status: 200, user: "SALAMA", duration_ms: 85 },
  { id: 2, timestamp: "2026-03-29 14:28:05", endpoint: "/api/vin/decode/", method: "POST", status: 200, user: "NGI", duration_ms: 234 },
  { id: 3, timestamp: "2026-03-29 14:25:33", endpoint: "/api/vehicles/search/", method: "GET", status: 200, user: "Autodata", duration_ms: 42 },
  { id: 4, timestamp: "2026-03-29 14:20:10", endpoint: "/api/valuation/calculate/", method: "POST", status: 400, user: "Fidelity", duration_ms: 12 },
  { id: 5, timestamp: "2026-03-29 14:15:00", endpoint: "/api/auth/login/", method: "POST", status: 200, user: "TMNF", duration_ms: 56 },
];

/* ─── page component ──────────────────────────────────────── */

export default function ResponsesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  return (
    <div className="space-y-4">
      <DataTable<ResponseRecord>
        title="API Responses"
        columns={columns}
        data={MOCK_RESPONSES}
        totalRecords={1250}
        searchPlaceholder="Search by endpoint, user..."
        onSearch={(q) => console.log("Search responses:", q)}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        rowKey={(r) => r.id}
      />
    </div>
  );
}
