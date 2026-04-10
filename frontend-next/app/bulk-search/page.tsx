"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Download, Loader2 } from "lucide-react";

/* ─── types ───────────────────────────────────────────────── */

interface BulkResult {
  vin: string;
  status: "found" | "not_found" | "error";
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
}

/* ─── page component ──────────────────────────────────────── */

export default function BulkSearchPage() {
  const [vinList, setVinList] = useState("");
  const [results, setResults] = useState<BulkResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleBulkSearch() {
    const vins = vinList
      .split(/[\n,;]+/)
      .map((v) => v.trim().toUpperCase())
      .filter((v) => v.length === 17);

    if (vins.length === 0) {
      toast.error("Enter at least one valid 17-character VIN");
      return;
    }

    setLoading(true);
    toast.info(`Processing ${vins.length} VIN(s)...`);

    // placeholder — will connect to batch API
    const mockResults: BulkResult[] = vins.map((vin) => ({
      vin,
      status: "found" as const,
      year: 2020,
      make: "—",
      model: "—",
      trim: "—",
    }));

    setResults(mockResults);
    setLoading(false);
    toast.success(`${mockResults.length} VIN(s) processed`);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Batch VIN Input</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={vinList}
            onChange={(e) => setVinList(e.target.value)}
            placeholder={"Paste VINs here, one per line:\nWVWZZZAUZNP000001\n1FTFW1E50NFA00002\n..."}
            rows={12}
            className="w-full resize-none rounded-md border border-input bg-background p-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
          <div className="flex gap-2">
            <Button onClick={handleBulkSearch} disabled={loading} className="flex-1">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Process VINs
            </Button>
            <Button variant="outline" disabled={results.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Results {results.length > 0 && <Badge variant="secondary" className="ml-2">{results.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No results yet. Paste VINs and click "Process VINs".
            </p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded border border-border p-2 text-sm hover:bg-muted/50">
                  <span className="font-mono text-xs">{r.vin}</span>
                  <Badge variant={r.status === "found" ? "default" : r.status === "error" ? "destructive" : "secondary"}>
                    {r.status}
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
