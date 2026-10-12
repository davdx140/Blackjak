import { NextResponse } from "next/server";
import { storageKind } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ storage: storageKind }, { headers: { "Cache-Control": "no-store" } });
}
