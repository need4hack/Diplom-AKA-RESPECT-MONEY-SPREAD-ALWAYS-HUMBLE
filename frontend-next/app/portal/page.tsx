"use client";

import { useEffect, useRef, useState } from "react";
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
import { Loader2, Search, Calculator } from "lucide-react";
import { useCascade, CASCADE_CHAIN } from "@/hooks/useCascade";
import { vin as vinApi, valuation as valuationApi, type ValuationResult } from "@/lib/api";
import DamageMapSelector, {
  type DamageSelection,
} from "@/components/portal/DamageMapSelector";

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
  const damageSelectionsRef = useRef<DamageSelection[]>([]);

  /* Load first cascade field (years) on mount */
  useEffect(() => {
    cascade.loadField(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isNew) {
      setMileage(0);
    }
  }, [isNew]);

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
      const result = await valuationApi.calculate(
        cascade.foundVehicle.id,
        mileage,
        isNew
      );
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
                <label className="text-xs text-muted-foreground">VIN</label>
                <Input
                  value={vinValue}
                  onChange={(e) => setVinValue(e.target.value.toUpperCase())}
                  placeholder="Enter 17-character VIN"
                  maxLength={17}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Mileage (km)</label>
                <Input
                  type="number"
                  value={mileage}
                  onChange={(e) => setMileage(Number(e.target.value))}
                  min={0}
                  disabled={isNew}
                  className={isNew ? "bg-muted text-muted-foreground" : undefined}
                />
                {isNew && (
                  <p className="text-[11px] text-muted-foreground">
                    Mileage is locked to 0 for new vehicles.
                  </p>
                )}
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
                      <label className="text-xs text-muted-foreground">{field.label}</label>
                      <Select
                        key={`${field.key}-${fieldOptions.length ? 'loaded' : 'empty'}`}
                        value={fieldValue || undefined}
                        onValueChange={(val) => cascade.selectField(index, val)}
                        disabled={isDisabled}
                      >
                        <SelectTrigger className="h-9 w-full bg-background">
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
                  <label className="text-xs text-muted-foreground">Est. Mileage</label>
                  <Input
                    type="number"
                    value={valuationResult?.avg_mileage ?? 0}
                    readOnly
                    className="bg-muted/60"
                  />
                </div>
              </div>

              {/* Found vehicle indicator */}
              {cascade.foundVehicle && (
                <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    Found: {cascade.foundVehicle.year} {cascade.foundVehicle.make}{" "}
                    {cascade.foundVehicle.model} {cascade.foundVehicle.trim}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-300">
                    ID: {cascade.foundVehicle.id} • Today: {formatCurrency(cascade.foundVehicle.today_price)} • New: {formatCurrency(cascade.foundVehicle.new_price)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {cascade.foundVehicle && (
            <Card>
              <CardHeader className="pb-3">
                <div>
                  <CardTitle className="text-sm font-medium">
                    Damage Inspection Map
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mark damaged areas after the vehicle has been identified. Leave it
                    empty if the car is fully clean.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <DamageMapSelector
                  key={cascade.foundVehicle.id}
                  onChange={(next) => {
                    damageSelectionsRef.current = next;
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Vehicle Valuation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Vehicle Valuation (VV)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <Switch checked={isNew} onCheckedChange={setIsNew} />
                  <label className="text-sm text-muted-foreground">Is New?</label>
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
                  <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-center sm:block sm:items-start sm:p-4">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 sm:mb-1">HIGH</p>
                    <p className="text-lg sm:text-xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
                      {formatCurrency(valuationResult.high)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-center sm:block sm:items-start sm:p-4">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 sm:mb-1">MEDIUM</p>
                    <p className="text-lg sm:text-xl font-bold tracking-tight text-amber-700 dark:text-amber-300">
                      {formatCurrency(valuationResult.medium)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center sm:block sm:items-start sm:p-4">
                    <p className="text-xs font-medium text-red-700 dark:text-red-400 sm:mb-1">LOW</p>
                    <p className="text-lg sm:text-xl font-bold tracking-tight text-red-700 dark:text-red-300">
                      {formatCurrency(valuationResult.low)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 opacity-50">
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3 text-center sm:block sm:items-start sm:p-4">
                    <p className="text-xs font-medium text-muted-foreground sm:mb-1">HIGH</p>
                    <p className="text-lg sm:text-xl font-bold text-muted-foreground">$0</p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3 text-center sm:block sm:items-start sm:p-4">
                    <p className="text-xs font-medium text-muted-foreground sm:mb-1">MEDIUM</p>
                    <p className="text-lg sm:text-xl font-bold text-muted-foreground">$0</p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3 text-center sm:block sm:items-start sm:p-4">
                    <p className="text-xs font-medium text-muted-foreground sm:mb-1">LOW</p>
                    <p className="text-lg sm:text-xl font-bold text-muted-foreground">$0</p>
                  </div>
                </div>
              )}

              {/* Detailed breakdown */}
              {valuationResult && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Age:</span>{" "}
                    <span className="font-medium">{valuationResult.age} yrs</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Depreciation:</span>{" "}
                    <span className="font-medium">{valuationResult.depreciation_rate}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg Mileage:</span>{" "}
                    <span className="font-medium">{valuationResult.avg_mileage.toLocaleString()} km</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mileage Adj:</span>{" "}
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
