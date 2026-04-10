"use client";

import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search, Plus, FileQuestion } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyPlaceholder } from "@/components/ui/empty-placeholder";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* ─── types ───────────────────────────────────────────────── */

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  title?: string;
  columns: Column<T>[];
  data: T[];
  totalRecords?: number;
  searchPlaceholder?: string;
  searchInputClassName?: string;
  showTopPagination?: boolean;
  onSearch?: (query: string) => void;
  onCreate?: () => void;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  rowKey?: (row: T) => string | number;
  actions?: (row: T) => React.ReactNode;
  isLoading?: boolean;
  
  // Selection
  selectable?: boolean;
  selectedRowKeys?: string[];
  onSelectedRowKeysChange?: (keys: string[]) => void;
  toolbarActions?: React.ReactNode;
}

/* ─── component ───────────────────────────────────────────── */

export default function DataTable<T extends object>({
  title,
  columns,
  data,
  totalRecords = 0,
  searchPlaceholder = "Search...",
  searchInputClassName,
  showTopPagination = false,
  onSearch,
  onCreate,
  page = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  rowKey,
  actions,
  isLoading = false,
  selectable = false,
  selectedRowKeys = [],
  onSelectedRowKeysChange,
  toolbarActions,
}: DataTableProps<T>) {
  const [searchValue, setSearchValue] = useState("");

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  function handleSearch() {
    onSearch?.(searchValue);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }
  
  const allCurrentKeys = data.map((r, i) => String(rowKey?.(r) ?? i));
  const isAllSelected = data.length > 0 && allCurrentKeys.every(k => selectedRowKeys.includes(k));
  
  function handleSelectAll() {
    if (!onSelectedRowKeysChange) return;
    if (isAllSelected) {
      onSelectedRowKeysChange(selectedRowKeys.filter(k => !allCurrentKeys.includes(k)));
    } else {
      const added = allCurrentKeys.filter(k => !selectedRowKeys.includes(k));
      onSelectedRowKeysChange([...selectedRowKeys, ...added]);
    }
  }

  function handleSelectRow(key: string) {
    if (!onSelectedRowKeysChange) return;
    if (selectedRowKeys.includes(key)) {
      onSelectedRowKeysChange(selectedRowKeys.filter(k => k !== key));
    } else {
      onSelectedRowKeysChange([...selectedRowKeys, key]);
    }
  }

  const paginationControls = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange?.(page - 1)}
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
        onClick={() => onPageChange?.(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {onSearch && (
            <>
              <Input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className={`w-64 ${searchInputClassName ?? ""}`}
              />
              <Button variant="secondary" size="sm" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </>
          )}
          {showTopPagination && paginationControls}
          {title && (
            <span className="ml-2 text-sm text-muted-foreground">
              Total: {totalRecords.toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {toolbarActions}
          {onCreate && (
            <Button size="sm" onClick={onCreate}>
              <Plus className="h-4 w-4 mr-1" /> Create New
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              {selectable && (
                <TableHead className="w-12 text-center items-center">
                  <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead key={String(col.key)} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
              {actions && <TableHead className="w-[80px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, rowIndex) => (
                <TableRow key={`skeleton-row-${rowIndex}`}>
                  {selectable && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
                  {columns.map((col, colIndex) => (
                    <TableCell key={`skeleton-col-${colIndex}`} className={col.className}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell>
                      <Skeleton className="h-8 w-8 rounded-md float-right" />
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions ? 1 : 0) + (selectable ? 1 : 0)} className="h-48 text-center">
                  <EmptyPlaceholder
                    icon={
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <FileQuestion className="h-6 w-6 text-muted-foreground" />
                      </div>
                    }
                    title="No records found"
                    description="No data is available for the current filters or search query."
                    className="border-none min-h-[250px]"
                  />
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, i) => {
                const rKey = String(rowKey?.(row) ?? i);
                const isSelected = selectedRowKeys.includes(rKey);
                
                return (
                  <TableRow key={rKey} className={`hover:bg-muted/50 ${isSelected ? "bg-muted/50" : ""}`}>
                    {selectable && (
                       <TableCell className="w-12 text-center items-center">
                         <Checkbox checked={isSelected} onCheckedChange={() => handleSelectRow(rKey)} />
                       </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell key={String(col.key)} className={col.className}>
                        {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key as string] ?? "")}
                      </TableCell>
                    ))}
                    {actions && (
                      <TableCell>{actions(row)}</TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        {paginationControls}
        <Select value={String(pageSize)} onValueChange={(val) => onPageSizeChange?.(Number(val))}>
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue placeholder={String(pageSize)} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
