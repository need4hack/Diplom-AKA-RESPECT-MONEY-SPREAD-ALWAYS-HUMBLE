import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/request-stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  const stats = await getDashboardStats();
  return NextResponse.json(stats);
}
