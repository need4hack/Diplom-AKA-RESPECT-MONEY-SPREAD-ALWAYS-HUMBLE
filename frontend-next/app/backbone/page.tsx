"use client";

import { useState } from "react";
import DataTable, { type Column } from "@/components/data-table/DataTable";

/* ─── types ───────────────────────────────────────────────── */

interface BackboneRecord {
  id: number;
  year: number;
  make: string;
  model: string;
  trim: string;
  body: string;
  engine: string;
  transmission: string;
  new_price: number;
  today_price: number;
  source: string;
}

/* ─── columns ─────────────────────────────────────────────── */

const columns: Column<BackboneRecord>[] = [
  { key: "id", header: "ID", className: "w-[70px] font-mono text-xs" },
  { key: "year", header: "Year" },
  { key: "make", header: "Make" },
  { key: "model", header: "Model" },
  { key: "trim", header: "Trim" },
  { key: "body", header: "Body" },
  { key: "engine", header: "Engine", className: "text-xs" },
  { key: "transmission", header: "Trans", className: "text-xs" },
  { key: "new_price", header: "New Price", render: (r) => `$${r.new_price.toLocaleString()}` },
  { key: "today_price", header: "Today Price", render: (r) => `$${r.today_price.toLocaleString()}` },
  { key: "source", header: "Source", className: "text-xs text-zinc-500" },
];

/* ─── page component ──────────────────────────────────────── */

import { useEffect } from "react";
import { vehicles, type VehicleRecord } from "@/lib/api";
import { toast } from "sonner";
import FilterSidebar from "@/components/layout/FilterSidebar";
import { Button } from "@/components/ui/button";
import { Download, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";

export default function BackbonePage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, any>>({});
  
  const [data, setData] = useState<VehicleRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await vehicles.backbone(page, pageSize, searchQuery, advancedFilters);
      setData(response.results);
      setTotalRecords(response.count);
    } catch (err) {
      toast.error("Failed to fetch backbone data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, pageSize, searchQuery, advancedFilters]);

  // When search or filters change, reset to page 1
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    setPage(1);
    setSelectedRowKeys([]);
  };
  
  const handleFiltersChange = (filters: Record<string, any>) => {
    setAdvancedFilters(filters);
    setPage(1);
    setSelectedRowKeys([]);
  };

  // --- Batch Actions ---
  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.append("search", searchQuery);
    Object.entries(advancedFilters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
    });
    
    // Direct browser redirect to download endpoint
    window.location.href = `/api/vehicles/backbone/export/?${params.toString()}`;
  };

  const handleBulkToggleActive = async (targetActive: boolean) => {
    if (selectedRowKeys.length === 0) return;
    setUpdating(true);
    try {
      const ids = selectedRowKeys.map(k => parseInt(k, 10));
      const res = await vehicles.bulkUpdate(ids, { is_active: targetActive });
      toast.success(`Successfully updated ${res.updated} vehicles to ${targetActive ? 'Active' : 'Inactive'}.`);
      setSelectedRowKeys([]);
      fetchData(); // Refresh UI
    } catch (err) {
      toast.error("Bulk update failed");
    } finally {
      setUpdating(false);
    }
  };

  const TopToolbar = (
    <div className="flex gap-2 items-center">
      {selectedRowKeys.length > 0 && (
        <span className="text-xs text-muted-foreground mr-2 font-medium bg-zinc-100 px-2 py-1 rounded-md">
          {selectedRowKeys.length} selected
        </span>
      )}
      {selectedRowKeys.length > 0 && (
        <>
          <Button variant="outline" size="sm" onClick={() => handleBulkToggleActive(true)} disabled={updating}>
            {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ToggleRight className="h-4 w-4 mr-2 text-green-600" />}
            Mark Active
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleBulkToggleActive(false)} disabled={updating}>
            {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ToggleLeft className="h-4 w-4 mr-2 text-red-600" />}
            Mark Inactive
          </Button>
        </>
      )}
      <Button variant="outline" size="sm" onClick={handleExportCSV}>
        <Download className="h-4 w-4 mr-2" /> Export CSV
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="hidden lg:block w-72 flex-shrink-0">
         <FilterSidebar onFiltersChange={handleFiltersChange} />
      </div>
      
      <div className="flex-1 w-full overflow-hidden space-y-4">
        <DataTable<VehicleRecord>
          title="Backbone Analytics"
          columns={columns as any}
          data={loading ? [] : data}
          totalRecords={totalRecords}
          searchPlaceholder="Smart Search (ex: '2020 sedan bmw')"
          searchInputClassName="focus-visible:ring-0 focus-visible:ring-transparent focus-visible:shadow-none"
          showTopPagination={true}
          onSearch={handleSearch}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          rowKey={(r: VehicleRecord) => String(r.id)}
          selectable={true}
          selectedRowKeys={selectedRowKeys}
          onSelectedRowKeysChange={setSelectedRowKeys}
          toolbarActions={TopToolbar}
        />
      </div>
    </div>
  );
}
