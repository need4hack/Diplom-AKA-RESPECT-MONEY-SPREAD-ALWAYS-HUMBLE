"use client";

import { useMemo, useState } from "react";
import DataTable, { type Column } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Pencil, Copy, Trash2 } from "lucide-react";
import { usePreferences } from "@/contexts/PreferencesContext";

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

const MOCK_DATA: VdsRecord[] = [
  { id: 210988, region: "NON GCC", year: 2026, make: "BMW", model: "I3", trim: "I3", body: "SEDAN", engine: "0.0 L", transmission: "AUTOMATIC", mileage: "E (20,000)", new_price: 226000, today_price: 223919, is_active: true },
  { id: 210641, region: "GCC", year: 2025, make: "ABARTH", model: "500E", trim: "STANDARD", body: "HATCHBACK", engine: "0.0 L", transmission: "AUTOMATIC", mileage: "D (16,000)", new_price: 190000, today_price: 162325, is_active: true },
  { id: 44319, region: "NON GCC", year: 2020, make: "FORD", model: "MUSTANG", trim: "GT", body: "CONVERTIBLE", engine: "5.0 L", transmission: "MANUAL", mileage: "D (16,000)", new_price: 205200, today_price: 85927, is_active: true },
];

const TEXT = {
  ru: {
    title: "Лист данных автомобиля",
    searchPlaceholder: "Поиск по марке или модели...",
    id: "ID",
    region: "Регион",
    year: "Год",
    make: "Марка",
    model: "Модель",
    trim: "Комплектация",
    body: "Кузов",
    engine: "Двигатель",
    transmission: "КПП",
    mileage: "Пробег",
    newPrice: "Цена новой",
    todayPrice: "Цена сегодня",
    active: "Активна",
    create: "Создать запись",
    edit: "Редактировать",
    copy: "Копировать",
    delete: "Удалить",
  },
  en: {
    title: "Vehicle Data Sheet",
    searchPlaceholder: "Search by Make or Model...",
    id: "ID",
    region: "Region",
    year: "Year",
    make: "Make",
    model: "Model",
    trim: "Trim",
    body: "Body",
    engine: "Engine",
    transmission: "Trans",
    mileage: "Mileage",
    newPrice: "New Price",
    todayPrice: "Today Price",
    active: "Active",
    create: "Create record",
    edit: "Edit",
    copy: "Copy",
    delete: "Delete",
  },
} as const;

export default function VdsPage() {
  const { language, formatAedPrice } = usePreferences();
  const text = TEXT[language];

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const columns: Column<VdsRecord>[] = useMemo(
    () => [
      { key: "id", header: text.id, className: "w-[70px] font-mono text-xs" },
      {
        key: "region",
        header: text.region,
        render: (row) => (
          <Badge variant={row.region === "GCC" ? "default" : "secondary"}>
            {row.region}
          </Badge>
        ),
      },
      { key: "year", header: text.year },
      { key: "make", header: text.make },
      { key: "model", header: text.model },
      { key: "trim", header: text.trim },
      { key: "body", header: text.body },
      { key: "engine", header: text.engine, className: "text-xs" },
      { key: "transmission", header: text.transmission, className: "text-xs" },
      { key: "mileage", header: text.mileage, className: "text-xs" },
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
      {
        key: "is_active",
        header: text.active,
        render: (row) => (
          <span className={row.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
            {row.is_active ? "✓" : "✕"}
          </span>
        ),
      },
    ],
    [formatAedPrice, text]
  );

  return (
    <div className="space-y-4">
      <DataTable<VdsRecord>
        title={text.title}
        columns={columns}
        data={MOCK_DATA}
        totalRecords={155790}
        searchPlaceholder={text.searchPlaceholder}
        onSearch={(query) => console.log("Search VDS:", query)}
        onCreate={() => console.log("Create new VDS record")}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        rowKey={(row) => row.id}
        texts={{ createButtonLabel: text.create }}
        actions={() => (
          <div className="flex items-center gap-1">
            <button className="rounded p-1 hover:bg-muted" title={text.edit}>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button className="rounded p-1 hover:bg-muted" title={text.copy}>
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button className="rounded p-1 hover:bg-destructive/10" title={text.delete}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        )}
      />
    </div>
  );
}
