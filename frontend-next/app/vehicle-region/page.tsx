"use client";

import { useMemo, useState } from "react";
import DataTable, { type Column } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { usePreferences } from "@/contexts/PreferencesContext";

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

const MOCK_DATA: VehicleRegionRecord[] = [
  { id: 1001, year: 2025, make: "TOYOTA", model: "CAMRY", trim: "LE", region: "GCC", new_price: 105000, today_price: 98000 },
  { id: 1002, year: 2025, make: "TOYOTA", model: "CAMRY", trim: "LE", region: "NON GCC", new_price: 95000, today_price: 88000 },
  { id: 1003, year: 2024, make: "NISSAN", model: "PATROL", trim: "SE", region: "GCC", new_price: 250000, today_price: 215000 },
  { id: 1004, year: 2024, make: "NISSAN", model: "PATROL", trim: "SE", region: "NON GCC", new_price: 220000, today_price: 190000 },
];

const TEXT = {
  ru: {
    title: "Сравнение цен по регионам",
    searchPlaceholder: "Поиск по марке или модели...",
    id: "ID",
    year: "Год",
    make: "Марка",
    model: "Модель",
    trim: "Комплектация",
    region: "Регион",
    newPrice: "Цена новой",
    todayPrice: "Цена сегодня",
  },
  en: {
    title: "Vehicle Region Comparison",
    searchPlaceholder: "Search by Make or Model...",
    id: "ID",
    year: "Year",
    make: "Make",
    model: "Model",
    trim: "Trim",
    region: "Region",
    newPrice: "New Price",
    todayPrice: "Today Price",
  },
} as const;

export default function VehicleRegionPage() {
  const { language, formatAedPrice } = usePreferences();
  const text = TEXT[language];

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const columns: Column<VehicleRegionRecord>[] = useMemo(
    () => [
      { key: "id", header: text.id, className: "w-[70px] font-mono text-xs" },
      { key: "year", header: text.year },
      { key: "make", header: text.make },
      { key: "model", header: text.model },
      { key: "trim", header: text.trim },
      {
        key: "region",
        header: text.region,
        render: (row) => (
          <Badge variant={row.region === "GCC" ? "default" : "secondary"}>
            {row.region}
          </Badge>
        ),
      },
      {
        key: "new_price",
        header: text.newPrice,
        render: (row) => formatAedPrice(row.new_price),
      },
      {
        key: "today_price",
        header: text.todayPrice,
        render: (row) => formatAedPrice(row.today_price),
      },
    ],
    [formatAedPrice, text]
  );

  return (
    <div className="space-y-4">
      <DataTable<VehicleRegionRecord>
        title={text.title}
        columns={columns}
        data={MOCK_DATA}
        totalRecords={MOCK_DATA.length}
        searchPlaceholder={text.searchPlaceholder}
        onSearch={(query) => console.log("Search vehicle region:", query)}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        rowKey={(row) => row.id}
      />
    </div>
  );
}
