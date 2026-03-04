import { NextRequest } from "next/server"

export const runtime = "edge"
export const dynamic = "force-dynamic"

const POSTHOG_HOST = "https://us.i.posthog.com"
const POSTHOG_ASSETS = "https://us-assets.i.posthog.com"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, await params)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, await params)
}

async function proxy(request: NextRequest, params: { path: string[] }) {
  const path = params.path.join("/")
  const search = request.nextUrl.search

  const host = path.startsWith("static/") ? POSTHOG_ASSETS : POSTHOG_HOST
  const url = `${host}/${path}${search}`

  const headers = new Headers()
  const ct = request.headers.get("content-type")
  if (ct) headers.set("content-type", ct)
  const origin = request.headers.get("origin")
  if (origin) headers.set("origin", origin)

  const body = request.method === "POST" ? await request.arrayBuffer() : undefined

  const response = await fetch(url, {
    method: request.method,
    headers,
    body,
  })

  const responseHeaders = new Headers()
  response.headers.forEach((value, key) => {
    if (!["content-encoding", "transfer-encoding"].includes(key.toLowerCase())) {
      responseHeaders.set(key, value)
    }
  })

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  })
}
