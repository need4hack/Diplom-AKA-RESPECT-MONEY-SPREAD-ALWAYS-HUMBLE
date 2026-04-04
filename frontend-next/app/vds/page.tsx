"use client";

import { useState } from "react";
import DataTable, { type Column } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Pencil, Copy, Trash2 } from "lucide-react";

/* ─── types ───────────────────────────────────────────────── */

interface VdsRecord {
  id: number;
  region: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  body: string;
  engine: string;
  transmission: string;
  mileage: string;
  new_price: number;
  today_price: number;
  is_active: boolean;
}

/* ─── columns ─────────────────────────────────────────────── */

const columns: Column<VdsRecord>[] = [
  { key: "id", header: "ID", className: "w-[70px] font-mono text-xs" },
  { key: "region", header: "Region", render: (r) => (
    <Badge variant={r.region === "GCC" ? "default" : "secondary"}>{r.region}</Badge>
  )},
  { key: "year", header: "Year" },
  { key: "make", header: "Make" },
  { key: "model", header: "Model" },
  { key: "trim", header: "Trim" },
  { key: "body", header: "Body" },
  { key: "engine", header: "Engine", className: "text-xs" },
  { key: "transmission", header: "Trans", className: "text-xs" },
  { key: "mileage", header: "Mileage", className: "text-xs" },
  { key: "new_price", header: "New Price", render: (r) => r.new_price?.toLocaleString() },
  { key: "today_price", header: "Today Price", render: (r) => r.today_price?.toLocaleString() },
  { key: "is_active", header: "Active", render: (r) => (
    <span className={r.is_active ? "text-emerald-600" : "text-zinc-400"}>{r.is_active ? "✓" : "✗"}</span>
  )},
];

/* ─── mock data (replaced by API later) ───────────────────── */

const MOCK_DATA: VdsRecord[] = [
  { id: 210988, region: "NON GCC", year: 2026, make: "BMW", model: "I3", trim: "I3", body: "SEDAN", engine: "0.0 L", transmission: "AUTOMATIC", mileage: "E (20,000)", new_price: 226000, today_price: 223919, is_active: true },
  { id: 210641, region: "GCC", year: 2025, make: "ABARTH", model: "500E", trim: "STANDARD", body: "HATCHBACK", engine: "0.0 L", transmission: "AUTOMATIC", mileage: "D (16,000)", new_price: 190000, today_price: 162325, is_active: true },
  { id: 44319, region: "NON GCC", year: 2020, make: "FORD", model: "MUSTANG", trim: "GT", body: "CONVERTIBLE", engine: "5.0 L", transmission: "MANUAL", mileage: "D (16,000)", new_price: 205200, today_price: 85927, is_active: true },
];

/* ─── page component ──────────────────────────────────────── */

export default function VdsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  return (
    <div className="space-y-4">
      <DataTable<VdsRecord>
        title="Vehicle Data Sheet"
        columns={columns}
        data={MOCK_DATA}
        totalRecords={155790}
        searchPlaceholder="Search by Make, Model..."
        onSearch={(q) => console.log("Search VDS:", q)}
        onCreate={() => console.log("Create new VDS record")}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        rowKey={(r) => r.id}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button className="p-1 hover:bg-zinc-100 rounded" title="Edit"><Pencil className="h-3.5 w-3.5 text-zinc-500" /></button>
            <button className="p-1 hover:bg-zinc-100 rounded" title="Copy"><Copy className="h-3.5 w-3.5 text-zinc-500" /></button>
            <button className="p-1 hover:bg-red-50 rounded" title="Delete"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
          </div>
        )}
      />
    </div>
  );
}
