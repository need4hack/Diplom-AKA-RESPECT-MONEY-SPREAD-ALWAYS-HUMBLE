/**
 * Centralized API layer.
 *
 * IMPORTANT:
 * URLs must not have trailing slashes. The Next route handler proxy
 * adds them before forwarding to Django.
 */

import { getAccessToken } from "@/lib/auth";

function buildRequestHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers ?? {});

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Attach the current access token for all browser-side API calls so
  // the proxy can attribute activity to the authenticated user.
  if (!headers.has("Authorization")) {
    const accessToken = getAccessToken();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  return headers;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: buildRequestHeaders(init),
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
    request<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  register: (data: RegisterPayload) =>
    request<TokenResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  refresh: (refreshToken: string) =>
    request<{ access: string; refresh?: string }>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh: refreshToken }),
    }),

  me: (token: string) =>
    request<UserProfile>("/api/auth/me", {
      headers: authHeaders(token),
    }),
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
  calculate: (vehicleId: number, mileage: number) =>
    request<ValuationResult>("/api/valuation/calculate", {
      method: "POST",
      body: JSON.stringify({ vehicle_id: vehicleId, actual_mileage: mileage }),
    }),
};
