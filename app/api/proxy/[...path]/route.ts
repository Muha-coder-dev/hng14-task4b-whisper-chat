import { type NextRequest, NextResponse } from 'next/server';

const KOYEB_BASE = process.env.KOYEB_API_URL ?? 'https://whisperbox.koyeb.app';

/**
 * Koyeb free tier goes to sleep after inactivity — cold starts take 20–40s.
 * We use a 45s timeout to survive the wakeup, otherwise Node drops it silently.
 */
const UPSTREAM_TIMEOUT_MS = 45_000;

type Context = { params: Promise<{ path: string[] }> };

async function handleRequest(req: NextRequest, ctx: Context, method: string) {
  try {
    // Use params.path (the correct, robust way) and append the original query string
    const { path } = await ctx.params;
    const endpoint = path.join('/') + req.nextUrl.search;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': req.headers.get('Authorization') ?? '',
    };

    const options: RequestInit = { method, headers };

    if (method !== 'GET' && method !== 'HEAD') {
      // Safely parse body — some requests may arrive with no body
      const text = await req.text();
      if (text) options.body = text;
    }

    // Abort if Koyeb takes longer than the timeout (cold start protection)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    options.signal = controller.signal;

    let upstream: Response;
    try {
      upstream = await fetch(`${KOYEB_BASE}/${endpoint}`, options);
    } finally {
      clearTimeout(timer);
    }

    // Preserve the upstream status code exactly
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error';
    console.error(`[PROXY ${method}] Error:`, message);
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

// All HTTP methods the Koyeb API may require
export async function GET(req: NextRequest, ctx: Context) { return handleRequest(req, ctx, 'GET'); }
export async function POST(req: NextRequest, ctx: Context) { return handleRequest(req, ctx, 'POST'); }
export async function PUT(req: NextRequest, ctx: Context) { return handleRequest(req, ctx, 'PUT'); }
export async function PATCH(req: NextRequest, ctx: Context) { return handleRequest(req, ctx, 'PATCH'); }
export async function DELETE(req: NextRequest, ctx: Context) { return handleRequest(req, ctx, 'DELETE'); }