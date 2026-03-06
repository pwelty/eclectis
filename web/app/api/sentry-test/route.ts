import { NextResponse } from "next/server"

export async function GET() {
  throw new Error("Sentry test error — safe to ignore")
  return NextResponse.json({ ok: true })
}
