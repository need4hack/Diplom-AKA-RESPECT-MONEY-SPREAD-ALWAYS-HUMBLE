/**
 * Centralized API layer.
 *
 * IMPORTANT:
 * URLs must not have trailing slashes. The Next route handler proxy
 * adds them before forwarding to Django.
 */

export const PROFILE_SYNC_EVENT = "app:profile-sync-needed";
const AUTH_RETRY_EXCLUDED = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/logout",
]);

function shouldSyncProfile(url: string) {
  return url === "/api/vin/decode" || url === "/api/valuation/calculate";
}

function getErrorDetail(body: Record<string, unknown>, fallback: string) {
  if (typeof body.detail === "string" && body.detail.trim()) {
    return body.detail;
  }

  if (typeof body.error === "string" && body.error.trim()) {
    return body.error;
  }

  const firstEntry = Object.entries(body).find(([, value]) => value != null);
  if (!firstEntry) {
    return fallback;
  }

  const [field, value] = firstEntry;

  if (Array.isArray(value) && value.length > 0) {
    return `${field}: ${String(value[0])}`;
  }

  if (typeof value === "string" && value.trim()) {
    return `${field}: ${value}`;
  }

  return fallback;
}

function buildRequestHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers ?? {});

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

async function tryRefreshSession(): Promise<boolean> {
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
    credentials: "same-origin",
  });

  return response.ok;
}

async function request<T>(url: string, init?: RequestInit, hasRetriedAuth = false): Promise<T> {
  const shouldRequestProfileSync =
    typeof window !== "undefined" && shouldSyncProfile(url);

  const res = await fetch(url, {
    ...init,
    headers: buildRequestHeaders(init),
    credentials: "same-origin",
  });

  if (res.status === 401 && !hasRetriedAuth && !AUTH_RETRY_EXCLUDED.has(url)) {
    const refreshed = await tryRefreshSession().catch(() => false);
    if (refreshed) {
      return request<T>(url, init, true);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({} as Record<string, unknown>));

    if (shouldRequestProfileSync) {
      window.dispatchEvent(new CustomEvent(PROFILE_SYNC_EVENT));
    }

    throw {
      status: res.status,
      detail: getErrorDetail(body, res.statusText),
      body,
    };
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const responseText = await res.text();
  const data = responseText ? (JSON.parse(responseText) as T) : (undefined as T);

  if (shouldRequestProfileSync) {
    window.dispatchEvent(new CustomEvent(PROFILE_SYNC_EVENT));
  }

  return data;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface TokenResponse {
  access: string;
  refresh: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  api_key: string | null;
  request_count: number;
  request_limit: number;
}

export type DamageSeverity = "scratch" | "dent" | "replace";

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface AdminUserRecord {
  id: string;
  username: string;
  email: string;
  role: string;
  api_key: string | null;
  request_count: number;
  request_limit: number;
  remaining_requests: number;
  is_active: boolean;
  created_at: string;
}

export interface AdminUserCreatePayload {
  username: string;
  email: string;
  password: string;
  role?: string;
  request_limit?: number;
}

export const auth = {
  login: (data: LoginPayload) =>
    request<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  register: (data: RegisterPayload) =>
    request<TokenResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  refresh: () =>
    request<{ access: string; refresh?: string }>("/api/auth/refresh", {
      method: "POST",
      body: "{}",
    }),

  me: () => request<UserProfile>("/api/auth/me"),

  changePassword: (data: ChangePasswordPayload) =>
    request<{ ok: boolean }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: () =>
    request<{ ok: boolean }>("/api/auth/logout", {
      method: "POST",
      body: "{}",
    }),
};

export interface ReportRecord {
  id: number;
  createdAt: string;
  vin: string;
  vehicleId: number;
  year: number;
  make: string;
  model: string;
  trim: string;
  mileage: number;
  isNew: boolean;
  damageCount: number;
  todayPrice: number;
  newPrice: number;
  high: number;
  medium: number;
  low: number;
  vehicleSnapshot: Record<string, unknown>;
  damageSelections: DamageSelectionPayload[];
  damageSummary?: DamageSummary | null;
}

export type CreateReportPayload = Omit<ReportRecord, "id" | "createdAt">;

export const reports = {
  list: () => request<ReportRecord[]>("/api/auth/reports"),

  create: (data: CreateReportPayload) =>
    request<ReportRecord>("/api/auth/reports", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  clear: () =>
    request<{ deleted: number }>("/api/auth/reports", {
      method: "DELETE",
    }),

  remove: (reportId: number) =>
    request<void>(`/api/auth/reports/${reportId}`, {
      method: "DELETE",
    }),
};

export const adminUsers = {
  list: () => request<AdminUserRecord[]>("/api/auth/users"),

  create: (data: AdminUserCreatePayload) =>
    request<AdminUserRecord>("/api/auth/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    userId: string,
    data: Partial<Pick<AdminUserRecord, "request_count" | "request_limit">>,
  ) =>
    request<AdminUserRecord>(`/api/auth/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  remove: (userId: string) =>
    request<void>(`/api/auth/users/${userId}`, {
      method: "DELETE",
    }),

  regenerateApiKey: (userId: string) =>
    request<{ id: string; username: string; api_key: string | null }>(
      `/api/auth/users/${userId}/regenerate-api-key`,
      {
        method: "POST",
        body: "{}",
      },
    ),
};

export interface VehicleOption {
  value: string;
  label?: string;
}

export interface MasterFieldRecord {
  name: string;
  label: string;
  data_type: string;
  editable: boolean;
}

export interface MasterValueRecord {
  value: string | number | boolean | null;
  display_value: string;
  occurrences: number;
}

export interface MasterRecordPayload {
  region?: string | null;
  year?: number | null;
  logo?: string | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  body?: string | null;
  engine?: string | null;
  transmission?: string | null;
  cylinder?: number | null;
  doors?: number | null;
  seats?: number | null;
  axle?: number | null;
  mileage?: string | null;
  depreciation?: string | null;
  category?: string | null;
  fuel?: string | null;
  drivetrain?: string | null;
  new_price?: number | null;
  today_price?: number | null;
  is_active?: boolean;
}

export const vehicles = {
  years: () => request<number[]>("/api/vehicles/years"),

  makes: (year: number) =>
    request<string[]>(`/api/vehicles/makes?year=${year}`),

  models: (year: number, make: string) =>
    request<string[]>(
      `/api/vehicles/models?year=${year}&make=${encodeURIComponent(make)}`
    ),

  trims: (year: number, make: string, model: string) =>
    request<string[]>(
      `/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`
    ),

  cascadeOptions: (field: string, params: Record<string, string | number>) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)])
    ).toString();

    const url = qs
      ? `/api/vehicles/options/${field}?${qs}`
      : `/api/vehicles/options/${field}`;

    return request<{ value: string }[]>(url);
  },

  search: (params: Record<string, string | number>) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)])
    ).toString();

    return request<VehicleRecord[]>(`/api/vehicles/search?${qs}`);
  },

  backbone: (
    page: number,
    pageSize: number,
    search?: string,
    filters?: Record<string, unknown>
  ) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    if (search) {
      params.append("search", search);
    }

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, String(value));
        }
      });
    }

    return request<{
      count: number;
      next: string | null;
      previous: string | null;
      results: VehicleRecord[];
    }>(`/api/vehicles/backbone/?${params.toString()}`);
  },

  bulkUpdate: (ids: number[], fields: Partial<VehicleRecord>) =>
    request<{ updated: number }>("/api/vehicles/backbone/bulk/", {
      method: "PATCH",
      body: JSON.stringify({ ids, fields }),
    }),

  masterFields: () =>
    request<MasterFieldRecord[]>("/api/vehicles/masters/fields"),

  masterValues: (
    fieldName: string,
    page: number,
    pageSize: number,
    search?: string,
  ) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    if (search) {
      params.append("search", search);
    }

    return request<{
      count: number;
      results: MasterValueRecord[];
    }>(`/api/vehicles/masters/${fieldName}/values?${params.toString()}`);
  },

  createMasterValue: (fieldName: string, value: string) =>
    request<{ id: number; field: string; value: string | number | boolean | null; is_active: boolean }>(
      `/api/vehicles/masters/${fieldName}/values`,
      {
        method: "POST",
        body: JSON.stringify({ value }),
      },
    ),

  createMasterRecord: (data: MasterRecordPayload) =>
    request<VehicleRecord & Record<string, unknown>>("/api/vehicles/masters/records", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export interface VehicleRecord {
  id: number;
  year: number;
  make: string;
  model: string;
  trim: string;
  body: string;
  engine: string;
  transmission: string;
  today_price: number;
  new_price: number;
  region: string;
  is_active: boolean;
}

export interface VinDecodeResponse {
  is_valid: boolean;
  vin: string;
  source: string;
  manufacturer?: string;
  year_from_vin?: number;
  errors?: string[];
  vehicle?: {
    modelyear?: string;
    year_from_vin?: number;
    make?: string;
    manufacturer?: string;
    model_name?: string;
    trim?: string;
    body?: string;
    engine?: string;
    transmission?: string;
    drivetrain?: string;
    type?: string;
    category?: string;
    [key: string]: unknown;
  };
}

export const vin = {
  decode: (vinCode: string) =>
    request<VinDecodeResponse>("/api/vin/decode", {
      method: "POST",
      body: JSON.stringify({ vin: vinCode }),
    }),
};

export interface ValuationResult {
  vehicle_id: number;
  vehicle_name: string;
  today_price: number;
  new_price: number;
  year: number;
  age: number;
  depreciation_name: string;
  depreciation_rate: number;
  mileage_category: string;
  actual_mileage: number;
  avg_mileage: number;
  mileage_delta: number;
  mileage_adjustment: number;
  base_high: number;
  base_medium: number;
  base_low: number;
  high: number;
  medium: number;
  low: number;
  currency: string;
  damage_summary?: DamageSummary | null;
}

export interface DamageSource {
  market: string;
  title: string;
  url: string;
  accessed_on: string;
}

export interface DamagePricingPart {
  source_part_id: string;
  part_family: string;
  part_family_label: string;
  market: string;
  currency: string;
  vehicle_reference_price_aed: number;
  repair_scope: string;
  pricing_mode: string;
  min_price: number;
  max_price: number;
  typical_price: number;
  part_value_pct_of_vehicle_min: number;
  part_value_pct_of_vehicle_max: number;
  part_value_pct_of_vehicle_typical: number;
  part_value_pct_notes: string;
  confidence: string;
  source_count: number;
  sources: DamageSource[];
  notes: string;
}

export interface DamageSelectionPayload {
  key: string;
  id: string;
  label: string;
  severity: DamageSeverity;
}

export interface DamageSelectedEntry extends DamagePricingPart {
  severity: DamageSeverity;
  severity_label: string;
  severity_price_multiplier: number;
  severity_pct_multiplier: number;
  adjusted_min_price: number;
  adjusted_max_price: number;
  adjusted_typical_price: number;
  adjusted_part_value_pct_min: number;
  adjusted_part_value_pct_max: number;
  adjusted_part_value_pct_typical: number;
}

export interface DamageProfile {
  generated_at: string;
  source_document: string;
  market: string;
  currency: string;
  make: string;
  make_profile: Record<string, unknown> | null;
  parts: DamagePricingPart[];
}

export interface DamageSummary {
  market: string;
  currency: string;
  make: string;
  generated_at: string;
  source_document: string;
  selected_part_count: number;
  unique_part_families: string[];
  selected_parts: DamagePricingPart[];
  selected_entries: DamageSelectedEntry[];
  missing_part_ids: string[];
  severity_breakdown: Record<DamageSeverity, number>;
  total_min_price: number;
  total_max_price: number;
  total_typical_price: number;
  total_pct_min: number;
  total_pct_max: number;
  total_pct_typical: number;
  high_adjustment: number;
  medium_adjustment: number;
  low_adjustment: number;
}

export const valuation = {
  calculate: (
    vehicleId: number,
    mileage: number,
    isNew = false,
    damageSelections: DamageSelectionPayload[] = [],
  ) =>
    request<ValuationResult>("/api/valuation/calculate", {
      method: "POST",
      body: JSON.stringify({
        vehicle_id: vehicleId,
        actual_mileage: mileage,
        is_new: isNew,
        damage_part_ids: damageSelections.map((selection) => selection.id),
        damage_selections: damageSelections,
      }),
    }),

  damageProfile: (make: string, market = "GCC") =>
    request<DamageProfile>(
      `/api/valuation/damage-profile?make=${encodeURIComponent(make)}&market=${encodeURIComponent(market)}`,
    ),
};
