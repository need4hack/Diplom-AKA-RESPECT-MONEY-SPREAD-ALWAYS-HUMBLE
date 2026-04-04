"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Search, Calculator, CarFront } from "lucide-react";
import { useCascade, CASCADE_CHAIN } from "@/hooks/useCascade";
import { vin as vinApi, valuation as valuationApi, type ValuationResult } from "@/lib/api";
import { EmptyPlaceholder } from "@/components/ui/empty-placeholder";

/* ─── helpers ─────────────────────────────────────────────── */

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/* ─── page component ──────────────────────────────────────── */

export default function PortalPage() {
  const cascade = useCascade();

  const [vinValue, setVinValue] = useState("");
  const [mileage, setMileage] = useState(0);
  const [isNew, setIsNew] = useState(false);
  const [vinLoading, setVinLoading] = useState(false);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuationResult, setValuationResult] = useState<ValuationResult | null>(null);

  /* Load first cascade field (years) on mount */
  useEffect(() => {
    cascade.loadField(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── VIN Decode ──────────────────────────────────────────── */

  async function handleVinDecode() {
    const vinClean = vinValue.trim().toUpperCase();

    if (!vinClean) {
      toast.error("Enter a VIN number");
      return;
    }
    if (vinClean.length !== 17) {
      toast.error(`VIN must be 17 characters (currently: ${vinClean.length})`);
      return;
    }

    setVinLoading(true);
    setValuationResult(null);

    try {
      const result = await vinApi.decode(vinClean);

      if (!result.is_valid) {
        toast.error(`Invalid VIN: ${result.errors?.join(", ") || "unknown error"}`);
        return;
      }

      if (result.source === "not_found") {
        toast.warning("VIN not found in any database");
        return;
      }

      const sourceLabels: Record<string, string> = {
        local_db: "Found in local database",
        local_db_vds_ext: "Found via VDS Extended",
        local_db_vds: "Found via VDS pattern",
        nhtsa_api: "Decoded via NHTSA API",
        fallback_wmi: "Basic WMI decoding only",
      };

      toast.success(sourceLabels[result.source] || "VIN decoded");

      if (result.vehicle) {
        await cascade.autoFillFromVin(result.vehicle);
      }
    } catch (err: unknown) {
      const error = err as { detail?: string };
      toast.error(`VIN decode error: ${error?.detail || "Unknown error"}`);
    } finally {
      setVinLoading(false);
    }
  }

  /* ── Valuation ───────────────────────────────────────────── */

  async function handleValuate() {
    if (!cascade.foundVehicle) {
      toast.error("Select a vehicle first");
      return;
    }

    setValuationLoading(true);

    try {
      const result = await valuationApi.calculate(cascade.foundVehicle.id, mileage);
      setValuationResult(result);
      toast.success("Valuation calculated");
    } catch (err: unknown) {
      const error = err as { detail?: string };
      toast.error(`Valuation error: ${error?.detail || "Unknown error"}`);
    } finally {
      setValuationLoading(false);
    }
  }

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">

        {/* ── Left sidebar: VIN + Mileage ──────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">VIN Lookup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">VIN</label>
                <Input
                  value={vinValue}
                  onChange={(e) => setVinValue(e.target.value.toUpperCase())}
                  placeholder="Enter 17-character VIN"
                  maxLength={17}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Mileage (km)</label>
                <Input
                  type="number"
                  value={mileage}
                  onChange={(e) => setMileage(Number(e.target.value))}
                  min={0}
                />
              </div>
              <Button
                onClick={handleVinDecode}
                className="w-full"
                disabled={vinLoading || cascade.autoFilling}
              >
                {vinLoading || cascade.autoFilling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {cascade.autoFilling ? "Auto-filling..." : "Get Vehicle Details"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Right content: Cascade + Valuation ───────────── */}
        <div className="space-y-6">

          {/* Vehicle Details — cascade grid */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Vehicle Details (VD)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                {CASCADE_CHAIN.map((field, index) => {
                  const fieldOptions = cascade.options[field.key] || [];
                  const fieldValue = cascade.values[field.key] || "";
                  const isLoading = cascade.loadingFields[field.key];
                  const isDisabled = !fieldOptions.length && !isLoading;

                  return (
                    <div key={field.key} className="space-y-1">
                      <label className="text-xs text-zinc-500">{field.label}</label>
                      <Select
                        key={`${field.key}-${fieldOptions.length ? 'loaded' : 'empty'}`}
                        value={fieldValue || undefined}
                        onValueChange={(val) => cascade.selectField(index, val)}
                        disabled={isDisabled}
                      >
                        <SelectTrigger className="w-full h-9 bg-white">
                          <SelectValue placeholder={isLoading ? "Loading..." : `— ${field.placeholder} —`} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {fieldOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}

                {/* Est. Mileage (read-only output) */}
                <div className="space-y-1">
                  <label className="text-xs text-zinc-500">Est. Mileage</label>
                  <Input
                    type="number"
                    value={valuationResult?.avg_mileage ?? 0}
                    readOnly
                    className="bg-zinc-50"
                  />
                </div>
              </div>

              {/* Found vehicle indicator */}
              {cascade.foundVehicle && (
                <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <p className="text-sm font-medium text-emerald-800">
                    ✅ Found: {cascade.foundVehicle.year} {cascade.foundVehicle.make}{" "}
                    {cascade.foundVehicle.model} {cascade.foundVehicle.trim}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    ID: {cascade.foundVehicle.id} • Today: {formatCurrency(cascade.foundVehicle.today_price)} • New: {formatCurrency(cascade.foundVehicle.new_price)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vehicle Valuation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Vehicle Valuation (VV)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <Switch checked={isNew} onCheckedChange={setIsNew} />
                  <label className="text-sm text-zinc-600">Is New?</label>
                </div>
                <Button
                  onClick={handleValuate}
                  disabled={!cascade.foundVehicle || valuationLoading}
                >
                  {valuationLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Calculator className="mr-2 h-4 w-4" />
                  )}
                  Valuate
                </Button>
              </div>

              {/* Valuation Results */}
              {valuationLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <Skeleton className="h-[90px] w-full rounded-lg" />
                  <Skeleton className="h-[90px] w-full rounded-lg" />
                  <Skeleton className="h-[90px] w-full rounded-lg" />
                </div>
              ) : valuationResult ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="text-center p-3 sm:p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex sm:block justify-between items-center sm:items-start">
                    <p className="text-xs font-medium text-emerald-600 sm:mb-1">HIGH</p>
                    <p className="text-lg sm:text-xl font-bold text-emerald-700 tracking-tight">
                      {formatCurrency(valuationResult.high)}
                    </p>
                  </div>
                  <div className="text-center p-3 sm:p-4 rounded-lg bg-amber-50 border border-amber-200 flex sm:block justify-between items-center sm:items-start">
                    <p className="text-xs font-medium text-amber-600 sm:mb-1">MEDIUM</p>
                    <p className="text-lg sm:text-xl font-bold text-amber-700 tracking-tight">
                      {formatCurrency(valuationResult.medium)}
                    </p>
                  </div>
                  <div className="text-center p-3 sm:p-4 rounded-lg bg-red-50 border border-red-200 flex sm:block justify-between items-center sm:items-start">
                    <p className="text-xs font-medium text-red-600 sm:mb-1">LOW</p>
                    <p className="text-lg sm:text-xl font-bold text-red-700 tracking-tight">
                      {formatCurrency(valuationResult.low)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 opacity-50">
                  <div className="text-center p-3 sm:p-4 rounded-lg bg-zinc-50 border border-zinc-200 flex sm:block justify-between items-center sm:items-start">
                    <p className="text-xs font-medium text-zinc-500 sm:mb-1">HIGH</p>
                    <p className="text-lg sm:text-xl font-bold text-zinc-400">$0</p>
                  </div>
                  <div className="text-center p-3 sm:p-4 rounded-lg bg-zinc-50 border border-zinc-200 flex sm:block justify-between items-center sm:items-start">
                    <p className="text-xs font-medium text-zinc-500 sm:mb-1">MEDIUM</p>
                    <p className="text-lg sm:text-xl font-bold text-zinc-400">$0</p>
                  </div>
                  <div className="text-center p-3 sm:p-4 rounded-lg bg-zinc-50 border border-zinc-200 flex sm:block justify-between items-center sm:items-start">
                    <p className="text-xs font-medium text-zinc-500 sm:mb-1">LOW</p>
                    <p className="text-lg sm:text-xl font-bold text-zinc-400">$0</p>
                  </div>
                </div>
              )}

              {/* Detailed breakdown */}
              {valuationResult && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-zinc-400">Age:</span>{" "}
                    <span className="font-medium">{valuationResult.age} yrs</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Depreciation:</span>{" "}
                    <span className="font-medium">{valuationResult.depreciation_rate}%</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Avg Mileage:</span>{" "}
                    <span className="font-medium">{valuationResult.avg_mileage.toLocaleString()} km</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Mileage Adj:</span>{" "}
                    <Badge variant={valuationResult.mileage_delta > 0 ? "destructive" : "default"}>
                      {valuationResult.mileage_delta > 0 ? "-" : "+"}{formatCurrency(valuationResult.mileage_adjustment)}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
