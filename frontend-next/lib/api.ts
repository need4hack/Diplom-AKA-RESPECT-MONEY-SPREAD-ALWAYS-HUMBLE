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
  damageSelections: unknown[];
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
  high: number;
  medium: number;
  low: number;
  currency: string;
}

export const valuation = {
  calculate: (vehicleId: number, mileage: number, isNew = false) =>
    request<ValuationResult>("/api/valuation/calculate", {
      method: "POST",
      body: JSON.stringify({
        vehicle_id: vehicleId,
        actual_mileage: mileage,
        is_new: isNew,
      }),
    }),
};
