/**
 * Catch-all API proxy route handler.
 *
 * Forwards all /api/* requests to the appropriate backend service.
 * This approach avoids ERR_TOO_MANY_REDIRECTS caused by Next.js rewrites
 * + Django APPEND_SLASH interaction.
 *
 * Service routing:
 *   /api/vehicles/* → 127.0.0.1:8001
 *   /api/vin/*      → 127.0.0.1:8002
 *   /api/valuation/* → 127.0.0.1:8003
 *   /api/auth/*     → 127.0.0.1:8004
 */

import { NextRequest, NextResponse } from "next/server";
import { appendRequestLog, type LoggedService } from "@/lib/request-stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const SERVICE_MAP: Record<string, string> = {
  vehicles:  process.env.VEHICLE_SERVICE_URL  || "http://127.0.0.1:8001",
  vin:       process.env.VIN_SERVICE_URL      || "http://127.0.0.1:8002",
  valuation: process.env.VALUATION_SERVICE_URL || "http://127.0.0.1:8003",
  auth:      process.env.AUTH_SERVICE_URL      || "http://127.0.0.1:8000",
};

function getBackendUrl(path: string[]): string | null {
  if (path.length < 1) return null;
  const service = path[0]; // "vehicles", "vin", "valuation", "auth"
  const baseUrl = SERVICE_MAP[service];
  if (!baseUrl) return null;
  // Filter out any empty strings to prevent double slashes
  const cleanPath = path.filter(Boolean).join("/");
  // Always add one trailing slash — Django requires it (APPEND_SLASH)
  return `${baseUrl}/api/${cleanPath}/`;
}

async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const service = path[0] as LoggedService | undefined;
  const backendUrl = getBackendUrl(path);

  if (!backendUrl) {
    return NextResponse.json({ detail: "Unknown service" }, { status: 404 });
  }

  // Preserve query string
  const url = new URL(req.url);
  const fullUrl = url.search ? `${backendUrl}${url.search}` : backendUrl;
  const requestPath = `/api/${path.filter(Boolean).join("/")}/`;
  const startedAt = Date.now();

  try {
    // Forward headers (except host)
    const headers = new Headers();
    req.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "host") {
        headers.set(key, value);
      }
    });

    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
      redirect: "follow",
      cache: "no-store",
    };

    // Forward body for non-GET requests
    if (req.method !== "GET" && req.method !== "HEAD") {
      fetchOptions.body = await req.text();
    }

    const response = await fetch(fullUrl, fetchOptions);
    const durationMs = Date.now() - startedAt;

    // Forward response
    const responseBody = await response.text();

    if (service) {
      await appendRequestLog({
        timestamp: new Date().toISOString(),
        service,
        method: req.method,
        path: requestPath,
        status: response.status,
        duration_ms: durationMs,
      });
    }

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
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
      });
    }

    console.error(`[API Proxy Error] ${req.method} ${fullUrl}:`, error);
    return NextResponse.json(
      { detail: `Backend service unavailable: ${path[0]}` },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
