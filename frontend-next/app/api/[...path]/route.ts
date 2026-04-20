/**
 * Catch-all API proxy route handler.
 *
 * Forwards all /api/* requests to the appropriate backend service.
 * This approach avoids ERR_TOO_MANY_REDIRECTS caused by Next.js rewrites
 * + Django APPEND_SLASH interaction.
 *
 * Service routing:
 *   /api/vehicles/*  -> 127.0.0.1:8001
 *   /api/vin/*       -> 127.0.0.1:8002
 *   /api/valuation/* -> 127.0.0.1:8003
 *   /api/auth/*      -> 127.0.0.1:8004
 */

import { NextRequest, NextResponse } from "next/server";
import { appendRequestLog, type LoggedService } from "@/lib/request-stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const ACCESS_COOKIE = "carspecs_access";
const REFRESH_COOKIE = "carspecs_refresh";

const SERVICE_MAP: Record<string, string> = {
  vehicles: process.env.VEHICLE_SERVICE_URL || "http://127.0.0.1:8001",
  vin: process.env.VIN_SERVICE_URL || "http://127.0.0.1:8002",
  valuation: process.env.VALUATION_SERVICE_URL || "http://127.0.0.1:8003",
  auth: process.env.AUTH_SERVICE_URL || "http://127.0.0.1:8004",
};

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

type JwtActor = {
  userId: string | null;
  username: string | null;
  role: string | null;
};

function shouldTrackRequestCount(requestPath: string, method: string) {
  return (
    (requestPath === "/api/vin/decode/" && method === "POST") ||
    (requestPath === "/api/valuation/calculate/" && method === "POST")
  );
}

function shouldManageSessionCookies(requestPath: string) {
  return (
    requestPath === "/api/auth/login/" ||
    requestPath === "/api/auth/register/" ||
    requestPath === "/api/auth/refresh/"
  );
}

function shouldInjectAuthorization(requestPath: string) {
  return !(
    requestPath === "/api/auth/login/" ||
    requestPath === "/api/auth/register/" ||
    requestPath === "/api/auth/refresh/" ||
    requestPath === "/api/auth/logout/"
  );
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  return req.cookies.get(ACCESS_COOKIE)?.value ?? null;
}

function getAuthorizationHeader(req: NextRequest): string | null {
  const token = getBearerToken(req);
  return token ? `Bearer ${token}` : null;
}

function getJwtActor(req: NextRequest): JwtActor {
  const token = getBearerToken(req);
  if (!token) {
    return { userId: null, username: null, role: null };
  }

  const parts = token.split(".");
  if (parts.length < 2) {
    return { userId: null, username: null, role: null };
  }

  const payloadRaw = decodeBase64Url(parts[1]);
  if (!payloadRaw) {
    return { userId: null, username: null, role: null };
  }

  try {
    const payload = JSON.parse(payloadRaw) as {
      user_id?: string;
      username?: string;
      role?: string;
      sub?: string;
    };

    return {
      userId: payload.user_id ?? payload.sub ?? null,
      username: payload.username ?? null,
      role: payload.role ?? null,
    };
  } catch {
    return { userId: null, username: null, role: null };
  }
}

function getBackendUrl(path: string[]): string | null {
  if (path.length < 1) return null;
  const service = path[0];
  const baseUrl = SERVICE_MAP[service];
  if (!baseUrl) return null;

  const cleanPath = path.filter(Boolean).join("/");
  return `${baseUrl}/api/${cleanPath}/`;
}

function tryParseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function hasRefreshTokenInBody(body: string | undefined): boolean {
  if (!body) {
    return false;
  }

  const payload = tryParseJsonObject(body);
  return typeof payload?.refresh === "string" && payload.refresh.length > 0;
}

function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
}

function applyAuthCookies(response: NextResponse, payload: Record<string, unknown> | null) {
  if (!payload) {
    return;
  }

  if (typeof payload.access === "string" && payload.access.length > 0) {
    response.cookies.set(ACCESS_COOKIE, payload.access, AUTH_COOKIE_OPTIONS);
  }

  if (typeof payload.refresh === "string" && payload.refresh.length > 0) {
    response.cookies.set(REFRESH_COOKIE, payload.refresh, AUTH_COOKIE_OPTIONS);
  }
}

async function trackAuthenticatedRequest(req: NextRequest) {
  const authServiceUrl = SERVICE_MAP.auth;
  const authorizationHeader = getAuthorizationHeader(req);

  if (!authServiceUrl || !authorizationHeader) {
    return;
  }

  try {
    await fetch(`${authServiceUrl}/api/auth/track-request/`, {
      method: "POST",
      headers: {
        Authorization: authorizationHeader,
      },
      cache: "no-store",
    });
  } catch (error) {
    console.error("[API Proxy] Failed to track request count:", error);
  }
}

async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const service = path[0] as LoggedService | undefined;
  const backendUrl = getBackendUrl(path);

  if (!backendUrl) {
    return NextResponse.json({ detail: "Unknown service" }, { status: 404 });
  }

  const url = new URL(req.url);
  const fullUrl = url.search ? `${backendUrl}${url.search}` : backendUrl;
  const requestPath = `/api/${path.filter(Boolean).join("/")}/`;
  const startedAt = Date.now();
  const actor = getJwtActor(req);

  if (requestPath === "/api/auth/logout/" && req.method === "POST") {
    const logoutResponse = NextResponse.json({ ok: true }, { status: 200 });
    clearAuthCookies(logoutResponse);
    return logoutResponse;
  }

  try {
    const headers = new Headers();
    req.headers.forEach((value, key) => {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey === "host" || normalizedKey === "cookie" || normalizedKey === "content-length") {
        return;
      }
      headers.set(key, value);
    });

    if (!headers.has("Authorization") && shouldInjectAuthorization(requestPath)) {
      const authorizationHeader = getAuthorizationHeader(req);
      if (authorizationHeader) {
        headers.set("Authorization", authorizationHeader);
      }
    }

    let requestBody: string | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      requestBody = await req.text();

      if (requestPath === "/api/auth/refresh/" && !hasRefreshTokenInBody(requestBody)) {
        const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
        if (refreshToken) {
          requestBody = JSON.stringify({ refresh: refreshToken });
          headers.set("Content-Type", "application/json");
        }
      }
    }

    const response = await fetch(fullUrl, {
      method: req.method,
      headers,
      body: requestBody,
      redirect: "follow",
      cache: "no-store",
    });

    const durationMs = Date.now() - startedAt;
    const responseBody = await response.text();

    if (service) {
      await appendRequestLog({
        timestamp: new Date().toISOString(),
        service,
        method: req.method,
        path: requestPath,
        status: response.status,
        duration_ms: durationMs,
        user_id: actor.userId,
        username: actor.username,
        role: actor.role,
      });
    }

    if (response.ok && actor.userId && shouldTrackRequestCount(requestPath, req.method)) {
      await trackAuthenticatedRequest(req);
    }

    const nextResponse =
      response.status === 204
        ? new NextResponse(null, {
            status: response.status,
            statusText: response.statusText,
          })
        : new NextResponse(responseBody, {
            status: response.status,
            statusText: response.statusText,
            headers: {
              "Content-Type":
                response.headers.get("Content-Type") || "application/json",
            },
          });

    if (shouldManageSessionCookies(requestPath)) {
      const payload = tryParseJsonObject(responseBody);
      if (response.ok) {
        applyAuthCookies(nextResponse, payload);
      } else if (requestPath === "/api/auth/refresh/" && response.status === 401) {
        clearAuthCookies(nextResponse);
      }
    }

    return nextResponse;
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    if (service) {
      await appendRequestLog({
        timestamp: new Date().toISOString(),
        service,
        method: req.method,
        path: requestPath,
        status: 502,
        duration_ms: durationMs,
        user_id: actor.userId,
        username: actor.username,
        role: actor.role,
      });
    }

    console.error(`[API Proxy Error] ${req.method} ${fullUrl}:`, error);
    return NextResponse.json(
      { detail: `Backend service unavailable: ${path[0]}` },
      { status: 502 },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
