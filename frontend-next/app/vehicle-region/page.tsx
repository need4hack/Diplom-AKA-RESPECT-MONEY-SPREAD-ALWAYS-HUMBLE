"use client";

import { useState } from "react";
import DataTable, { type Column } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";

/* ─── types ───────────────────────────────────────────────── */

interface VehicleRegionRecord {
  id: number;
  year: number;
  make: string;
  model: string;
  trim: string;
  region: string;
  new_price: number;
  today_price: number;
}

/* ─── columns ─────────────────────────────────────────────── */

const columns: Column<VehicleRegionRecord>[] = [
  { key: "id", header: "ID", className: "w-[70px] font-mono text-xs" },
  { key: "year", header: "Year" },
  { key: "make", header: "Make" },
  { key: "model", header: "Model" },
  { key: "trim", header: "Trim" },
  { key: "region", header: "Region", render: (r) => (
    <Badge variant={r.region === "GCC" ? "default" : "secondary"}>{r.region}</Badge>
  )},
  { key: "new_price", header: "New Price", render: (r) => `$${r.new_price.toLocaleString()}` },
  { key: "today_price", header: "Today Price", render: (r) => `$${r.today_price.toLocaleString()}` },
];

/* ─── mock data ───────────────────────────────────────────── */

const MOCK_DATA: VehicleRegionRecord[] = [
  { id: 1001, year: 2025, make: "TOYOTA", model: "CAMRY", trim: "LE", region: "GCC", new_price: 105000, today_price: 98000 },
  { id: 1002, year: 2025, make: "TOYOTA", model: "CAMRY", trim: "LE", region: "NON GCC", new_price: 95000, today_price: 88000 },
  { id: 1003, year: 2024, make: "NISSAN", model: "PATROL", trim: "SE", region: "GCC", new_price: 250000, today_price: 215000 },
  { id: 1004, year: 2024, make: "NISSAN", model: "PATROL", trim: "SE", region: "NON GCC", new_price: 220000, today_price: 190000 },
];

/* ─── page component ──────────────────────────────────────── */

export default function VehicleRegionPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  return (
    <div className="space-y-4">
      <DataTable<VehicleRegionRecord>
        title="Vehicle Region Comparison"
        columns={columns}
        data={MOCK_DATA}
        totalRecords={MOCK_DATA.length}
        searchPlaceholder="Search by Make, Model..."
        onSearch={(q) => console.log("Search vehicle region:", q)}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        rowKey={(r) => r.id}
      />
    </div>
  );
}
