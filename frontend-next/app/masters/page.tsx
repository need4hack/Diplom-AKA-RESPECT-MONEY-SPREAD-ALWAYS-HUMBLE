"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DataTable, { type Column } from "@/components/data-table/DataTable";
import { Pencil, Trash2, Plus, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

/* ─── types ───────────────────────────────────────────────── */

interface MasterRecord {
  id: number;
  key: string;
  value: string;
  description: string;
  category: string;
}

/* ─── columns ─────────────────────────────────────────────── */

const columns: Column<MasterRecord>[] = [
  { key: "id", header: "ID", className: "w-[60px] font-mono text-xs" },
  { key: "category", header: "Category" },
  { key: "key", header: "Key", className: "font-mono text-sm" },
  { key: "value", header: "Value" },
  { key: "description", header: "Description", className: "text-xs text-zinc-500" },
];

/* ─── mock data ───────────────────────────────────────────── */

const MOCK_MASTERS: MasterRecord[] = [
  { id: 1, key: "DEFAULT_CURRENCY", value: "USD", description: "Default currency for valuations", category: "Valuation" },
  { id: 2, key: "HIGH_MULTIPLIER", value: "1.10", description: "High price = medium × this", category: "Valuation" },
  { id: 3, key: "LOW_MULTIPLIER", value: "0.90", description: "Low price = medium × this", category: "Valuation" },
  { id: 4, key: "MAX_REQUEST_LIMIT", value: "300", description: "Default API request limit for new users", category: "Auth" },
  { id: 5, key: "NHTSA_ENABLED", value: "true", description: "Enable NHTSA fallback decoding", category: "VIN" },
  { id: 6, key: "VDS_SEARCH_ENABLED", value: "true", description: "Enable VDS pattern matching", category: "VIN" },
];

/* ─── page component ──────────────────────────────────────── */

export default function MastersPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <DataTable<MasterRecord>
        title="Master Configuration"
        columns={columns}
        data={MOCK_MASTERS}
        totalRecords={MOCK_MASTERS.length}
        searchPlaceholder="Search by key..."
        onSearch={(q) => console.log("Search masters:", q)}
        onCreate={() => setDialogOpen(true)}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        rowKey={(r) => r.id}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button className="p-1 hover:bg-zinc-100 rounded" title="Edit"><Pencil className="h-3.5 w-3.5 text-zinc-500" /></button>
            <button className="p-1 hover:bg-red-50 rounded" title="Delete"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
          </div>
        )}
      />

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Master Record</DialogTitle>
            <DialogDescription>
              Add a new configuration entry for valuation, VIN, or auth settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <label className="text-sm text-zinc-600">Category</label>
              <Input placeholder="e.g. Valuation, VIN, Auth" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-zinc-600">Key</label>
              <Input placeholder="e.g. MAX_AGE_YEARS" className="font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-zinc-600">Value</label>
              <Input placeholder="e.g. 30" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-zinc-600">Description</label>
              <Input placeholder="Brief description" />
            </div>
            <Button className="w-full" onClick={() => { toast.success("Record created"); setDialogOpen(false); }}>
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
