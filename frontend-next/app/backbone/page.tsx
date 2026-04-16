"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable, { type Column } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { vehicles, type VehicleRecord } from "@/lib/api";
import { toast } from "sonner";
import FilterSidebar from "@/components/layout/FilterSidebar";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { usePreferences } from "@/contexts/PreferencesContext";

type BackboneFilters = Record<string, string | number>;

interface BackboneRecord extends VehicleRecord {
  source?: string;
}

const UI_TEXT = {
  ru: {
    title: "База Данных",
    searchPlaceholder: "Умный поиск, например: 2020 sedan bmw",
    totalLabel: "Всего",
    pageLabel: "Страница",
    ofLabel: "из",
    noRecordsTitle: "Записи не найдены",
    noRecordsDescription: "По текущим фильтрам или поисковому запросу данных нет.",
    id: "ID",
    year: "Год",
    make: "Марка",
    model: "Модель",
    trim: "Комплектация",
    body: "Кузов",
    engine: "Двигатель",
    transmission: "КПП",
    newPrice: "Цена новой",
    todayPrice: "Цена сегодня",
    status: "Статус",
    source: "Источник",
    active: "Активна",
    inactive: "Неактивна",
    selected: "выбрано",
    markActive: "Сделать активными",
    markInactive: "Сделать неактивными",
    exportCsv: "Экспорт CSV",
    fetchFailed: "Не удалось загрузить данные Backbone",
    bulkUpdateFailed: "Не удалось выполнить массовое обновление",
    bulkUpdateSuccessActive: "Автомобили успешно отмечены как активные.",
    bulkUpdateSuccessInactive: "Автомобили успешно отмечены как неактивные.",
    exchangeRateHint: "Язык и валюта теперь управляются глобально через верхний header.",
    exchangeRateSource:
      "Все цены из базы отображаются в выбранной валюте, но исходно хранятся в AED.",
  },
  en: {
    title: "Backbone Analytics",
    searchPlaceholder: "Smart Search, e.g. 2020 sedan bmw",
    totalLabel: "Total",
    pageLabel: "Page",
    ofLabel: "of",
    noRecordsTitle: "No records found",
    noRecordsDescription: "No data is available for the current filters or search query.",
    id: "ID",
    year: "Year",
    make: "Make",
    model: "Model",
    trim: "Trim",
    body: "Body",
    engine: "Engine",
    transmission: "Trans",
    newPrice: "New Price",
    todayPrice: "Today Price",
    status: "Status",
    source: "Source",
    active: "Active",
    inactive: "Inactive",
    selected: "selected",
    markActive: "Mark Active",
    markInactive: "Mark Inactive",
    exportCsv: "Export CSV",
    fetchFailed: "Failed to fetch backbone data",
    bulkUpdateFailed: "Bulk update failed",
    bulkUpdateSuccessActive: "Vehicles were successfully marked as active.",
    bulkUpdateSuccessInactive: "Vehicles were successfully marked as inactive.",
    exchangeRateHint: "Language and currency are now controlled globally from the top header.",
    exchangeRateSource:
      "All price values are rendered in the selected currency while the source data stays in AED.",
  },
} as const;

export default function BackbonePage() {
  const { language, currency, formatAedPrice } = usePreferences();
  const text = UI_TEXT[language];

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [advancedFilters, setAdvancedFilters] = useState<BackboneFilters>({});

  const [data, setData] = useState<BackboneRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const columns: Column<BackboneRecord>[] = useMemo(
    () => [
      { key: "id", header: text.id, className: "w-[70px] font-mono text-xs" },
      { key: "year", header: text.year },
      { key: "make", header: text.make },
      { key: "model", header: text.model },
      { key: "trim", header: text.trim },
      { key: "body", header: text.body },
      { key: "engine", header: text.engine, className: "text-xs" },
      { key: "transmission", header: text.transmission, className: "text-xs" },
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
        key: "status",
        header: text.status,
        render: (row) => (
          <Badge variant={row.is_active ? "default" : "secondary"}>
            {row.is_active ? text.active : text.inactive}
          </Badge>
        ),
      },
      {
        key: "source",
        header: text.source,
        className: "text-xs text-muted-foreground",
        render: (row) => row.source ?? "—",
      },
    ],
    [formatAedPrice, text]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await vehicles.backbone(page, pageSize, searchQuery, advancedFilters);
      setData(response.results as BackboneRecord[]);
      setTotalRecords(response.count);
    } catch {
      toast.error(text.fetchFailed);
    } finally {
      setLoading(false);
    }
  }, [advancedFilters, page, pageSize, searchQuery, text.fetchFailed]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
    setSelectedRowKeys([]);
  };

  const handleFiltersChange = useCallback((filters: BackboneFilters) => {
    setAdvancedFilters(filters);
    setPage(1);
    setSelectedRowKeys([]);
  }, []);

  const handleExportCSV = () => {
    const params = new URLSearchParams();

    if (searchQuery) {
      params.append("search", searchQuery);
    }

    Object.entries(advancedFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, String(value));
      }
    });

    window.location.href = `/api/vehicles/backbone/export/?${params.toString()}`;
  };

  const handleBulkToggleActive = async (targetActive: boolean) => {
    if (selectedRowKeys.length === 0) {
      return;
    }

    setUpdating(true);

    try {
      const ids = selectedRowKeys.map((key) => Number.parseInt(key, 10));
      const response = await vehicles.bulkUpdate(ids, { is_active: targetActive });

      toast.success(
        `${targetActive ? text.bulkUpdateSuccessActive : text.bulkUpdateSuccessInactive} (${response.updated})`
      );
      setSelectedRowKeys([]);
      await fetchData();
    } catch {
      toast.error(text.bulkUpdateFailed);
    } finally {
      setUpdating(false);
    }
  };

  const topToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {selectedRowKeys.length > 0 && (
        <span className="mr-2 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
          {selectedRowKeys.length} {text.selected}
        </span>
      )}
      {selectedRowKeys.length > 0 && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkToggleActive(true)}
            disabled={updating}
          >
            {updating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ToggleRight className="mr-2 h-4 w-4 text-green-600" />
            )}
            {text.markActive}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkToggleActive(false)}
            disabled={updating}
          >
            {updating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ToggleLeft className="mr-2 h-4 w-4 text-red-600" />
            )}
            {text.markInactive}
          </Button>
        </>
      )}
      <Button variant="outline" size="sm" onClick={handleExportCSV}>
        <Download className="mr-2 h-4 w-4" />
        {text.exportCsv}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">{text.exchangeRateHint}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {text.exchangeRateSource} ({currency})
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full lg:w-72 lg:flex-shrink-0">
          <FilterSidebar
            onFiltersChange={handleFiltersChange}
            language={language}
            currency={currency}
            formatPrice={formatAedPrice}
          />
        </div>

        <div className="w-full flex-1 overflow-hidden space-y-4">
          <DataTable<BackboneRecord>
            title={text.title}
            columns={columns}
            data={data}
            totalRecords={totalRecords}
            searchPlaceholder={text.searchPlaceholder}
            searchInputClassName="focus-visible:ring-0 focus-visible:ring-transparent focus-visible:shadow-none"
            showTopPagination
            onSearch={handleSearch}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            rowKey={(row) => String(row.id)}
            selectable
            selectedRowKeys={selectedRowKeys}
            onSelectedRowKeysChange={setSelectedRowKeys}
            toolbarActions={topToolbar}
            isLoading={loading}
            texts={{
              totalLabel: text.totalLabel,
              pageLabel: text.pageLabel,
              ofLabel: text.ofLabel,
              noRecordsTitle: text.noRecordsTitle,
              noRecordsDescription: text.noRecordsDescription,
            }}
          />
        </div>
      </div>
    </div>
  );
}
