/**
 * Centralized API layer — all backend calls go through here.
 *
 * IMPORTANT: URLs must NOT have trailing slashes!
 * The Route Handler proxy (app/api/[...path]/route.ts) adds them
 * before forwarding to Django. If we include trailing slashes here,
 * Next.js issues a 308 redirect → ERR_TOO_MANY_REDIRECTS.
 */

/* ─── helpers ──────────────────────────────────────────────── */

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, detail: body?.detail ?? res.statusText, body };
  }

  return res.json();
}

function authHeaders(token?: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ─── Auth Service (/api/auth) ────────────────────────────── */

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

export const auth = {
  login: (data: LoginPayload) =>
    request<TokenResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),

  register: (data: RegisterPayload) =>
    request<TokenResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),

  refresh: (refreshToken: string) =>
    request<{ access: string; refresh?: string }>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh: refreshToken }),
    }),

  me: (token: string) =>
    request<UserProfile>("/api/auth/me", { headers: authHeaders(token) }),
};

/* ─── Vehicle Service (/api/vehicles) ─────────────────────── */

export interface VehicleOption {
  value: string;
  label?: string;
}

export const vehicles = {
  years: () =>
    request<number[]>("/api/vehicles/years"),

  makes: (year: number) =>
    request<string[]>(`/api/vehicles/makes?year=${year}`),

  models: (year: number, make: string) =>
    request<string[]>(`/api/vehicles/models?year=${year}&make=${encodeURIComponent(make)}`),

  trims: (year: number, make: string, model: string) =>
    request<string[]>(
      `/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`
    ),

  /** Generic cascade options — used by the cascade chain */
  cascadeOptions: (field: string, params: Record<string, string | number>) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString();
    const url = qs
      ? `/api/vehicles/options/${field}?${qs}`
      : `/api/vehicles/options/${field}`;
    return request<{ value: string }[]>(url);
  },

  search: (params: Record<string, string | number>) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString();
    return request<VehicleRecord[]>(`/api/vehicles/search?${qs}`);
  },

  backbone: (page: number, pageSize: number, search?: string, filters?: Record<string, any>) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    
    if (search) params.append("search", search);
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, String(value));
        }
      });
    }

    return request<{ count: number; next: string | null; previous: string | null; results: VehicleRecord[] }>(
      `/api/vehicles/backbone/?${params.toString()}`
    );
  },

  bulkUpdate: (ids: number[], fields: Partial<VehicleRecord>) => {
    return request<{ updated: number }>(`/api/vehicles/backbone/bulk/`, {
      method: "PATCH",
      body: JSON.stringify({ ids, fields }),
    });
  },
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

/* ─── VIN Service (/api/vin) ──────────────────────────────── */

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

/* ─── Valuation Service (/api/valuation) ──────────────────── */

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
  calculate: (vehicleId: number, mileage: number) =>
    request<ValuationResult>("/api/valuation/calculate", {
      method: "POST",
      body: JSON.stringify({ vehicle_id: vehicleId, actual_mileage: mileage }),
    }),
};
