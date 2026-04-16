"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DataTable, { type Column } from "@/components/data-table/DataTable";
import { Pencil, Trash2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { usePreferences } from "@/contexts/PreferencesContext";

interface MasterRecord {
  id: number;
  key: string;
  value: string;
  description: string;
  category: string;
}

const MOCK_MASTERS: MasterRecord[] = [
  { id: 1, key: "DEFAULT_CURRENCY", value: "USD", description: "Default currency for valuations", category: "Valuation" },
  { id: 2, key: "HIGH_MULTIPLIER", value: "1.10", description: "High price = medium × this", category: "Valuation" },
  { id: 3, key: "LOW_MULTIPLIER", value: "0.90", description: "Low price = medium × this", category: "Valuation" },
  { id: 4, key: "MAX_REQUEST_LIMIT", value: "300", description: "Default API request limit for new users", category: "Auth" },
  { id: 5, key: "NHTSA_ENABLED", value: "true", description: "Enable NHTSA fallback decoding", category: "VIN" },
  { id: 6, key: "VDS_SEARCH_ENABLED", value: "true", description: "Enable VDS pattern matching", category: "VIN" },
];

const TEXT = {
  ru: {
    title: "Конфигурация справочников",
    category: "Категория",
    key: "Ключ",
    value: "Значение",
    description: "Описание",
    searchPlaceholder: "Поиск по ключу...",
    create: "Создать запись",
    edit: "Редактировать",
    delete: "Удалить",
    createTitle: "Создать запись справочника",
    createDescription: "Добавьте новую запись конфигурации для оценки, VIN или настроек авторизации.",
    categoryLabel: "Категория",
    keyLabel: "Ключ",
    valueLabel: "Значение",
    descriptionLabel: "Описание",
    categoryPlaceholder: "например: Valuation, VIN, Auth",
    keyPlaceholder: "например: MAX_AGE_YEARS",
    valuePlaceholder: "например: 30",
    descriptionPlaceholder: "Краткое описание",
    save: "Сохранить",
    created: "Запись создана",
  },
  en: {
    title: "Master Configuration",
    category: "Category",
    key: "Key",
    value: "Value",
    description: "Description",
    searchPlaceholder: "Search by key...",
    create: "Create record",
    edit: "Edit",
    delete: "Delete",
    createTitle: "Create Master Record",
    createDescription: "Add a new configuration entry for valuation, VIN, or auth settings.",
    categoryLabel: "Category",
    keyLabel: "Key",
    valueLabel: "Value",
    descriptionLabel: "Description",
    categoryPlaceholder: "e.g. Valuation, VIN, Auth",
    keyPlaceholder: "e.g. MAX_AGE_YEARS",
    valuePlaceholder: "e.g. 30",
    descriptionPlaceholder: "Brief description",
    save: "Save",
    created: "Record created",
  },
} as const;

export default function MastersPage() {
  const { language } = usePreferences();
  const text = TEXT[language];

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);

  const columns: Column<MasterRecord>[] = useMemo(
    () => [
      { key: "id", header: "ID", className: "w-[60px] font-mono text-xs" },
      { key: "category", header: text.category },
      { key: "key", header: text.key, className: "font-mono text-sm" },
      { key: "value", header: text.value },
      {
        key: "description",
        header: text.description,
        className: "text-xs text-muted-foreground",
      },
    ],
    [text]
  );

  return (
    <div className="space-y-4">
      <DataTable<MasterRecord>
        title={text.title}
        columns={columns}
        data={MOCK_MASTERS}
        totalRecords={MOCK_MASTERS.length}
        searchPlaceholder={text.searchPlaceholder}
        onSearch={(query) => console.log("Search masters:", query)}
        onCreate={() => setDialogOpen(true)}
        texts={{ createButtonLabel: text.create }}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        rowKey={(row) => row.id}
        actions={() => (
          <div className="flex items-center gap-1">
            <button className="rounded p-1 hover:bg-muted" title={text.edit}>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button className="rounded p-1 hover:bg-destructive/10" title={text.delete}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        )}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text.createTitle}</DialogTitle>
            <DialogDescription>{text.createDescription}</DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{text.categoryLabel}</label>
              <Input placeholder={text.categoryPlaceholder} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{text.keyLabel}</label>
              <Input placeholder={text.keyPlaceholder} className="font-mono" />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{text.valueLabel}</label>
              <Input placeholder={text.valuePlaceholder} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{text.descriptionLabel}</label>
              <Input placeholder={text.descriptionPlaceholder} />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                toast.success(text.created);
                setDialogOpen(false);
              }}
            >
              <Save className="mr-2 h-4 w-4" />
              {text.save}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
