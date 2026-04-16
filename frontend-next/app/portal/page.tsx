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
import { usePortalHistory } from "@/contexts/PortalHistoryContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import DamageMapSelector, {
  type DamageSelection,
} from "@/components/portal/DamageMapSelector";

const PORTAL_TEXT = {
  ru: {
    vinLookup: "Поиск по VIN",
    vin: "VIN",
    enterVin: "Введите 17-значный VIN",
    mileage: "Пробег (км)",
    mileageLocked: "Для нового автомобиля пробег фиксируется на 0.",
    autofilling: "Автозаполнение...",
    getVehicleDetails: "Получить данные автомобиля",
    enterVinError: "Введите VIN",
    invalidVin: (detail: string) => `Некорректный VIN: ${detail}`,
    vinLength: (length: number) => `VIN должен содержать 17 символов, сейчас: ${length}`,
    vinNotFound: "VIN не найден ни в одной базе",
    vinDecoded: "VIN декодирован",
    vinDecodeError: (detail: string) => `Ошибка декодирования VIN: ${detail}`,
    foundLocal: "Найден в локальной базе",
    foundVdsExt: "Найден через VDS Extended",
    foundVdsPattern: "Найден через шаблон VDS",
    foundNhtsa: "Декодирован через NHTSA API",
    foundFallback: "Только базовое WMI-декодирование",
    vehicleDetails: "Данные автомобиля (VD)",
    estMileage: "Оценочный пробег",
    found: "Найдено",
    today: "Сегодня",
    newPrice: "Новая",
    damageInspection: "Карта повреждений",
    damageInspectionHint:
      "Отметьте повреждённые зоны после идентификации автомобиля. Если автомобиль без повреждений, можно оставить пусто.",
    vehicleValuation: "Оценка автомобиля (VV)",
    isNew: "Новый автомобиль?",
    valuate: "Оценить",
    selectVehicleFirst: "Сначала выберите автомобиль",
    valuationCalculated: "Оценка рассчитана",
    valuationError: (detail: string) => `Ошибка оценки: ${detail}`,
    high: "ВЫСОКАЯ",
    medium: "СРЕДНЯЯ",
    low: "НИЗКАЯ",
    age: "Возраст",
    depreciation: "Износ",
    avgMileage: "Средний пробег",
    mileageAdj: "Коррекция пробега",
    yearsShort: "лет",
  },
  en: {
    vinLookup: "VIN Lookup",
    vin: "VIN",
    enterVin: "Enter 17-character VIN",
    mileage: "Mileage (km)",
    mileageLocked: "Mileage is locked to 0 for new vehicles.",
    autofilling: "Auto-filling...",
    getVehicleDetails: "Get Vehicle Details",
    enterVinError: "Enter a VIN number",
    invalidVin: (detail: string) => `Invalid VIN: ${detail}`,
    vinLength: (length: number) => `VIN must be 17 characters (currently: ${length})`,
    vinNotFound: "VIN not found in any database",
    vinDecoded: "VIN decoded",
    vinDecodeError: (detail: string) => `VIN decode error: ${detail}`,
    foundLocal: "Found in local database",
    foundVdsExt: "Found via VDS Extended",
    foundVdsPattern: "Found via VDS pattern",
    foundNhtsa: "Decoded via NHTSA API",
    foundFallback: "Basic WMI decoding only",
    vehicleDetails: "Vehicle Details (VD)",
    estMileage: "Est. Mileage",
    found: "Found",
    today: "Today",
    newPrice: "New",
    damageInspection: "Damage Inspection Map",
    damageInspectionHint:
      "Mark damaged areas after the vehicle has been identified. Leave it empty if the car is fully clean.",
    vehicleValuation: "Vehicle Valuation (VV)",
    isNew: "Is New?",
    valuate: "Valuate",
    selectVehicleFirst: "Select a vehicle first",
    valuationCalculated: "Valuation calculated",
    valuationError: (detail: string) => `Valuation error: ${detail}`,
    high: "HIGH",
    medium: "MEDIUM",
    low: "LOW",
    age: "Age",
    depreciation: "Depreciation",
    avgMileage: "Avg Mileage",
    mileageAdj: "Mileage Adj",
    yearsShort: "yrs",
  },
} as const;

const PORTAL_FIELD_TEXT = {
  ru: {
    year: { label: "Год", placeholder: "Выберите год" },
    make: { label: "Марка", placeholder: "Выберите марку" },
    model: { label: "Модель", placeholder: "Выберите модель" },
    trim: { label: "Комплектация", placeholder: "Выберите комплектацию" },
    body: { label: "Тип кузова", placeholder: "Выберите кузов" },
    drivetrain: { label: "Привод", placeholder: "Выберите" },
    engine: { label: "Объем двигателя", placeholder: "Выберите двигатель" },
    transmission: { label: "Трансмиссия", placeholder: "Выберите" },
    region: { label: "Регион", placeholder: "Выберите" },
    doors: { label: "Двери", placeholder: "Выберите" },
    seats: { label: "Сиденья", placeholder: "Выберите" },
    cylinder: { label: "Цилиндры", placeholder: "Выберите" },
    category: { label: "Класс автомобиля", placeholder: "Выберите" },
  },
  en: {
    year: { label: "Year", placeholder: "Select Year" },
    make: { label: "Make", placeholder: "Select Make" },
    model: { label: "Model", placeholder: "Select Model" },
    trim: { label: "Trim", placeholder: "Select Trim" },
    body: { label: "Body Type", placeholder: "Select Body" },
    drivetrain: { label: "Drive Train", placeholder: "Select" },
    engine: { label: "Engine Size", placeholder: "Select Engine" },
    transmission: { label: "Transmission", placeholder: "Select" },
    region: { label: "Region", placeholder: "Select" },
    doors: { label: "Doors", placeholder: "Select" },
    seats: { label: "Seats", placeholder: "Select" },
    cylinder: { label: "Cylinders", placeholder: "Select" },
    category: { label: "Vehicle Class", placeholder: "Select" },
  },
} as const;

/* ─── helpers ─────────────────────────────────────────────── */


/* ─── page component ──────────────────────────────────────── */

export default function PortalPage() {
  const cascade = useCascade();
  const { addEntry } = usePortalHistory();
  const { language, formatAedPrice } = usePreferences();
  const text = PORTAL_TEXT[language];
  const fieldText = PORTAL_FIELD_TEXT[language];

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
      toast.error(text.enterVinError);
      return;
    }
    if (vinClean.length !== 17) {
      toast.error(text.vinLength(vinClean.length));
      return;
    }

    setVinLoading(true);
    setValuationResult(null);

    try {
      const result = await vinApi.decode(vinClean);

      if (!result.is_valid) {
        toast.error(text.invalidVin(result.errors?.join(", ") || "unknown error"));
        return;
      }

      if (result.source === "not_found") {
        toast.warning(text.vinNotFound);
        return;
      }

      const sourceLabels: Record<string, string> = {
        local_db: text.foundLocal,
        local_db_vds_ext: text.foundVdsExt,
        local_db_vds: text.foundVdsPattern,
        nhtsa_api: text.foundNhtsa,
        fallback_wmi: text.foundFallback,
      };

      toast.success(sourceLabels[result.source] || text.vinDecoded);

      if (result.vehicle) {
        await cascade.autoFillFromVin(result.vehicle);
      }
    } catch (err: unknown) {
      const error = err as { detail?: string };
      toast.error(text.vinDecodeError(error?.detail || "Unknown error"));
    } finally {
      setVinLoading(false);
    }
  }

  /* ── Valuation ───────────────────────────────────────────── */

  async function handleValuate() {
    if (!cascade.foundVehicle) {
      toast.error(text.selectVehicleFirst);
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
      void addEntry({
        vin: vinValue.trim().toUpperCase(),
        vehicleId: result.vehicle_id,
        year: cascade.foundVehicle.year,
        make: cascade.foundVehicle.make,
        model: cascade.foundVehicle.model,
        trim: cascade.foundVehicle.trim,
        mileage,
        isNew,
        damageCount: damageSelectionsRef.current.length,
        todayPrice: result.today_price,
        newPrice: result.new_price,
        high: result.high,
        medium: result.medium,
        low: result.low,
        vehicleSnapshot: {
          foundVehicle: cascade.foundVehicle,
          valuation: result,
          mileage,
          isNew,
        },
        damageSelections: damageSelectionsRef.current,
      });
      toast.success(text.valuationCalculated);
    } catch (err: unknown) {
      const error = err as { detail?: string };
      toast.error(text.valuationError(error?.detail || "Unknown error"));
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
              <CardTitle className="text-sm font-medium">{text.vinLookup}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{text.vin}</label>
                <Input
                  value={vinValue}
                  onChange={(e) => setVinValue(e.target.value.toUpperCase())}
                  placeholder={text.enterVin}
                  maxLength={17}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{text.mileage}</label>
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
                    {text.mileageLocked}
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
                {cascade.autoFilling ? text.autofilling : text.getVehicleDetails}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Right content: Cascade + Valuation ───────────── */}
        <div className="space-y-6">

          {/* Vehicle Details — cascade grid */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{text.vehicleDetails}</CardTitle>
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
                      <label className="text-xs text-muted-foreground">
                        {fieldText[field.key as keyof typeof fieldText]?.label ?? field.label}
                      </label>
                      <Select
                        key={`${field.key}-${fieldOptions.length ? 'loaded' : 'empty'}`}
                        value={fieldValue || undefined}
                        onValueChange={(val) => cascade.selectField(index, val)}
                        disabled={isDisabled}
                      >
                        <SelectTrigger className="h-9 w-full bg-background">
                          <SelectValue
                            placeholder={
                              isLoading
                                ? language === "ru"
                                  ? "Загрузка..."
                                  : "Loading..."
                                : `— ${fieldText[field.key as keyof typeof fieldText]?.placeholder ?? field.placeholder} —`
                            }
                          />
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
                  <label className="text-xs text-muted-foreground">{text.estMileage}</label>
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
                    {text.found}: {cascade.foundVehicle.year} {cascade.foundVehicle.make}{" "}
                    {cascade.foundVehicle.model} {cascade.foundVehicle.trim}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-300">
                    ID: {cascade.foundVehicle.id} • {text.today}: {formatAedPrice(cascade.foundVehicle.today_price)} • {text.newPrice}: {formatAedPrice(cascade.foundVehicle.new_price)}
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
                    {text.damageInspection}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {text.damageInspectionHint}
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
              <CardTitle className="text-sm font-medium">{text.vehicleValuation}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <Switch checked={isNew} onCheckedChange={setIsNew} />
                  <label className="text-sm text-muted-foreground">{text.isNew}</label>
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
                  {text.valuate}
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
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 sm:mb-1">{text.high}</p>
                    <p className="text-lg sm:text-xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
                      {formatAedPrice(valuationResult.high)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-center sm:block sm:items-start sm:p-4">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 sm:mb-1">{text.medium}</p>
                    <p className="text-lg sm:text-xl font-bold tracking-tight text-amber-700 dark:text-amber-300">
                      {formatAedPrice(valuationResult.medium)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center sm:block sm:items-start sm:p-4">
                    <p className="text-xs font-medium text-red-700 dark:text-red-400 sm:mb-1">{text.low}</p>
                    <p className="text-lg sm:text-xl font-bold tracking-tight text-red-700 dark:text-red-300">
                      {formatAedPrice(valuationResult.low)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 opacity-50">
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3 text-center sm:block sm:items-start sm:p-4">
                    <p className="text-xs font-medium text-muted-foreground sm:mb-1">{text.high}</p>
                    <p className="text-lg sm:text-xl font-bold text-muted-foreground">{formatAedPrice(0)}</p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3 text-center sm:block sm:items-start sm:p-4">
                    <p className="text-xs font-medium text-muted-foreground sm:mb-1">{text.medium}</p>
                    <p className="text-lg sm:text-xl font-bold text-muted-foreground">{formatAedPrice(0)}</p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3 text-center sm:block sm:items-start sm:p-4">
                    <p className="text-xs font-medium text-muted-foreground sm:mb-1">{text.low}</p>
                    <p className="text-lg sm:text-xl font-bold text-muted-foreground">{formatAedPrice(0)}</p>
                  </div>
                </div>
              )}

              {/* Detailed breakdown */}
              {valuationResult && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{text.age}:</span>{" "}
                    <span className="font-medium">{valuationResult.age} {text.yearsShort}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{text.depreciation}:</span>{" "}
                    <span className="font-medium">{valuationResult.depreciation_rate}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{text.avgMileage}:</span>{" "}
                    <span className="font-medium">{valuationResult.avg_mileage.toLocaleString()} km</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{text.mileageAdj}:</span>{" "}
                    <Badge variant={valuationResult.mileage_delta > 0 ? "destructive" : "default"}>
                      {valuationResult.mileage_delta > 0 ? "-" : "+"}{formatAedPrice(valuationResult.mileage_adjustment)}
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
