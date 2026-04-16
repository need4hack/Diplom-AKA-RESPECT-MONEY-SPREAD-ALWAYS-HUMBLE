"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Download, Loader2 } from "lucide-react";
import { usePreferences } from "@/contexts/PreferencesContext";

interface BulkResult {
  vin: string;
  status: "found" | "not_found" | "error";
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
}

const TEXT = {
  ru: {
    inputTitle: "Пакетный ввод VIN",
    resultsTitle: "Результаты",
    placeholder: "Вставьте VIN сюда, по одному в строке:\nWVWZZZAUZNP000001\n1FTFW1E50NFA00002\n...",
    process: "Обработать VIN",
    exportCsv: "Экспорт CSV",
    noResults: 'Результатов пока нет. Вставьте VIN и нажмите "Обработать VIN".',
    invalidVin: "Введите хотя бы один корректный 17-значный VIN",
    processing: (count: number) => `Обрабатывается VIN: ${count}`,
    processed: (count: number) => `Обработано VIN: ${count}`,
    found: "найден",
    notFound: "не найден",
    error: "ошибка",
  },
  en: {
    inputTitle: "Batch VIN Input",
    resultsTitle: "Results",
    placeholder: "Paste VINs here, one per line:\nWVWZZZAUZNP000001\n1FTFW1E50NFA00002\n...",
    process: "Process VINs",
    exportCsv: "Export CSV",
    noResults: 'No results yet. Paste VINs and click "Process VINs".',
    invalidVin: "Enter at least one valid 17-character VIN",
    processing: (count: number) => `Processing ${count} VIN(s)...`,
    processed: (count: number) => `${count} VIN(s) processed`,
    found: "found",
    notFound: "not found",
    error: "error",
  },
} as const;

export default function BulkSearchPage() {
  const { language } = usePreferences();
  const text = TEXT[language];

  const [vinList, setVinList] = useState("");
  const [results, setResults] = useState<BulkResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleBulkSearch() {
    const vins = vinList
      .split(/[\n,;]+/)
      .map((value) => value.trim().toUpperCase())
      .filter((value) => value.length === 17);

    if (vins.length === 0) {
      toast.error(text.invalidVin);
      return;
    }

    setLoading(true);
    toast.info(text.processing(vins.length));

    const mockResults: BulkResult[] = vins.map((vin) => ({
      vin,
      status: "found",
      year: 2020,
      make: "—",
      model: "—",
      trim: "—",
    }));

    setResults(mockResults);
    setLoading(false);
    toast.success(text.processed(mockResults.length));
  }

  const localizedStatus = (status: BulkResult["status"]) => {
    if (status === "found") return text.found;
    if (status === "not_found") return text.notFound;
    return text.error;
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{text.inputTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={vinList}
            onChange={(event) => setVinList(event.target.value)}
            placeholder={text.placeholder}
            rows={12}
            className="w-full resize-none rounded-md border border-input bg-background p-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
          <div className="flex gap-2">
            <Button onClick={handleBulkSearch} disabled={loading} className="flex-1">
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {text.process}
            </Button>
            <Button variant="outline" disabled={results.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              {text.exportCsv}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            {text.resultsTitle}
            {results.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {results.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {text.noResults}
            </p>
          ) : (
            <div className="max-h-[400px] space-y-2 overflow-y-auto">
              {results.map((result, index) => (
                <div
                  key={`${result.vin}-${index}`}
                  className="flex items-center justify-between rounded border border-border p-2 text-sm hover:bg-muted/50"
                >
                  <span className="font-mono text-xs">{result.vin}</span>
                  <Badge
                    variant={
                      result.status === "found"
                        ? "default"
                        : result.status === "error"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {localizedStatus(result.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
