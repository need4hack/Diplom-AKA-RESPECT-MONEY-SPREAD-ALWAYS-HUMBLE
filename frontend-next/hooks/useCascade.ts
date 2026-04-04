"use client";

import { useState, useCallback, useRef } from "react";
import { vehicles, type VehicleRecord, type VinDecodeResponse } from "@/lib/api";

/* ─── Cascade chain definition ────────────────────────────── */

export interface CascadeField {
  key: string;       // API field name
  label: string;     // UI label
  placeholder: string;
}

export const CASCADE_CHAIN: CascadeField[] = [
  { key: "year",         label: "Year",          placeholder: "Select Year" },
  { key: "make",         label: "Make",          placeholder: "Select Make" },
  { key: "model",        label: "Model",         placeholder: "Select Model" },
  { key: "trim",         label: "Trim",          placeholder: "Select Trim" },
  { key: "body",         label: "Body Type",     placeholder: "Select Body" },
  { key: "drivetrain",   label: "Drive Train",   placeholder: "Select" },
  { key: "engine",       label: "Engine Size",   placeholder: "Select Engine" },
  { key: "transmission", label: "Transmission",  placeholder: "Select" },
  { key: "region",       label: "Region",        placeholder: "Select" },
  { key: "doors",        label: "Doors",         placeholder: "Select" },
  { key: "seats",        label: "Seats",         placeholder: "Select" },
  { key: "cylinder",     label: "Cylinders",     placeholder: "Select" },
  { key: "category",     label: "Vehicle Class", placeholder: "Select" },
];

/* ─── Normalize for fuzzy matching ────────────────────────── */

const MAKE_ALIASES: Record<string, string> = {
  "mercedes benz": "mercedes",
  "mercedes-benz": "mercedes",
  vw: "volkswagen",
  chevy: "chevrolet",
};

function normalize(str: unknown): string {
  if (str == null) return "";
  let s = String(str).toLowerCase().trim().replace(/[-_.,!?'"]/g, " ").replace(/\s+/g, " ");
  return MAKE_ALIASES[s] || s;
}

function getAutoFillTarget(fieldKey: string, v: NonNullable<VinDecodeResponse["vehicle"]>): string | null {
  let val: unknown = null;
  switch (fieldKey) {
    case "year":     val = v.modelyear || v.year_from_vin || v.year; break;
    case "make":     val = v.make || v.manufacturer; break;
    case "model":    val = v.model || v.model_name; break;
    case "trim":     val = v.trim || v.series; break;
    case "body":     val = v.body_class || v.body; break;
    case "engine":   val = v.displacement_l ? `${v.displacement_l}L` : (v.engine || v.engine_model); break;
    case "transmission": val = v.transmission_style || v.transmission; break;
    case "category": val = v.vehicle_type || v.type || v.category; break;
    default:         val = v[fieldKey]; break;
  }
  return val ? normalize(val) : null;
}

/* ─── Hook types ──────────────────────────────────────────── */

export interface CascadeState {
  /** Currently selected values by field key */
  values: Record<string, string>;
  /** Available options per field key */
  options: Record<string, string[]>;
  /** Which fields are currently loading */
  loadingFields: Record<string, boolean>;
  /** Found vehicle (after all fields selected) */
  foundVehicle: VehicleRecord | null;
  /** Average mileage from the last search */
  estMileage: number;
  /** True while doing VIN auto-fill */
  autoFilling: boolean;
  /** Select a value for a field */
  selectField: (index: number, value: string) => Promise<void>;
  /** Load options for a field index */
  loadField: (index: number, autoFillData?: NonNullable<VinDecodeResponse["vehicle"]> | null) => Promise<void>;
  /** Reset from a given index */
  resetFrom: (fromIndex: number) => void;
  /** Start auto-fill from VIN data */
  autoFillFromVin: (vehicleData: NonNullable<VinDecodeResponse["vehicle"]>) => Promise<void>;
}

/* ─── The Hook ────────────────────────────────────────────── */

export function useCascade(): CascadeState {
  const [values, setValues] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});
  const [foundVehicle, setFoundVehicle] = useState<VehicleRecord | null>(null);
  const [estMileage, setEstMileage] = useState(0);
  const [autoFilling, setAutoFilling] = useState(false);

  /* ref to always read fresh values inside async chains */
  const valuesRef = useRef(values);
  valuesRef.current = values;

  /* ── build query params from selections up to (not including) index ── */
  const buildParams = useCallback((upToIndex: number): Record<string, string> => {
    const params: Record<string, string> = {};
    for (let i = 0; i < upToIndex; i++) {
      const key = CASCADE_CHAIN[i].key;
      const v = valuesRef.current[key];
      if (v) params[key] = v;
    }
    return params;
  }, []);

  /* ── reset fields from a given index ──────────────────────── */
  const resetFrom = useCallback((fromIndex: number) => {
    // SYNC UPDATE to ref
    const nextRef = { ...valuesRef.current };
    for (let i = fromIndex; i < CASCADE_CHAIN.length; i++) {
      delete nextRef[CASCADE_CHAIN[i].key];
    }
    valuesRef.current = nextRef;

    setValues((prev) => {
      const next = { ...prev };
      for (let i = fromIndex; i < CASCADE_CHAIN.length; i++) {
        delete next[CASCADE_CHAIN[i].key];
      }
      return next;
    });
    setOptions((prev) => {
      const next = { ...prev };
      for (let i = fromIndex; i < CASCADE_CHAIN.length; i++) {
        delete next[CASCADE_CHAIN[i].key];
      }
      return next;
    });
    setFoundVehicle(null);
  }, []);

  /* ── when ALL fields selected → search for vehicle ───────── */
  const onAllFieldsSelected = useCallback(async (currentValues: Record<string, string>) => {
    try {
      const results = await vehicles.search(currentValues);
      if (results.length > 0) {
        setFoundVehicle(results[0]);
        console.log(`✅ Found ${results.length} vehicle(s):`, results[0]);
      } else {
        setFoundVehicle(null);
        console.warn("⚠️ No vehicles found for these filters.");
      }
    } catch (err) {
      console.error("[Search Error]:", err);
      setFoundVehicle(null);
    }
  }, []);

  /* ── load options for a specific field index ──────────────── */
  const loadField = useCallback(
    async (index: number, autoFillData: NonNullable<VinDecodeResponse["vehicle"]> | null = null) => {
      if (index >= CASCADE_CHAIN.length) {
        await onAllFieldsSelected(valuesRef.current);
        return;
      }

      const { key } = CASCADE_CHAIN[index];

      setLoadingFields((prev) => ({ ...prev, [key]: true }));

      try {
        const params = buildParams(index);
        const data = await vehicles.cascadeOptions(key, params);
        const optionValues = data.map((d) => String(d.value));

        setOptions((prev) => ({ ...prev, [key]: optionValues }));

        let autoFilled = false;

        /* 1. Try auto-fill from VIN data */
        if (autoFillData) {
          const targetVal = getAutoFillTarget(key, autoFillData);
          if (targetVal) {
            const matched = optionValues.find((opt) => {
              const optN = normalize(opt);
              return (
                optN === targetVal ||
                (key === "make" && (optN.includes(targetVal) || targetVal.includes(optN)))
              );
            });

            if (matched) {
              // SYNC UPDATE
              valuesRef.current = { ...valuesRef.current, [key]: matched };
              setValues((prev) => ({ ...prev, [key]: matched }));
              autoFilled = true;
              await loadField(index + 1, autoFillData);
            } else {
              autoFillData = null; // stop further auto-fill
            }
          } else {
            autoFillData = null;
          }
        }

        /* 2. Auto-select if exactly 1 option */
        if (!autoFilled && optionValues.length === 1) {
          // SYNC UPDATE
          valuesRef.current = { ...valuesRef.current, [key]: optionValues[0] };
          setValues((prev) => ({ ...prev, [key]: optionValues[0] }));
          await loadField(index + 1, autoFillData);
        }
      } catch (err) {
        console.error(`[Cascade Error] ${key}:`, err);
      } finally {
        setLoadingFields((prev) => ({ ...prev, [key]: false }));
      }
    },
    [buildParams, onAllFieldsSelected]
  );

  /* ── select a value manually ─────────────────────────────── */
  const selectField = useCallback(
    async (index: number, value: string) => {
      const { key } = CASCADE_CHAIN[index];

      resetFrom(index + 1);

      // SYNC UPDATE
      valuesRef.current = { ...valuesRef.current, [key]: value };
      setValues((prev) => ({ ...prev, [key]: value }));

      if (value) {
        await loadField(index + 1);
      }
    },
    [resetFrom, loadField]
  );

  /* ── auto-fill from VIN decode result ────────────────────── */
  const autoFillFromVin = useCallback(
    async (vehicleData: NonNullable<VinDecodeResponse["vehicle"]>) => {
      setAutoFilling(true);
      resetFrom(0);
      // small delay for state to clean up
      await new Promise((r) => setTimeout(r, 50));
      valuesRef.current = {};
      await loadField(0, vehicleData);
      setAutoFilling(false);
    },
    [resetFrom, loadField]
  );

  return {
    values,
    options,
    loadingFields,
    foundVehicle,
    estMileage,
    autoFilling,
    selectField,
    loadField,
    resetFrom,
    autoFillFromVin,
  };
}
