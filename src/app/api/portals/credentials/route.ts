import { NextResponse } from "next/server";

const retiredResponse = {
  error: "Temporary-password portal credentials are retired. Issue a one-time claim code from Parent & Teacher Access instead.",
  code: "PORTAL_CREDENTIALS_RETIRED"
} as const;

export async function POST() {
  return NextResponse.json(retiredResponse, {
    status: 410,
    headers: { "cache-control": "no-store" }
  });
}
