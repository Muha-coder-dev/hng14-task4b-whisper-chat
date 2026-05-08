import { NextResponse } from 'next/server';

async function handleRequest(req: Request, method: string) {
  try {
    const url = new URL(req.url);
    // This safely captures the path AND the search query (e.g. ?q=username)
    const endpoint = url.pathname.replace('/api/proxy/', '') + url.search;
    
    const options: RequestInit = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        // Pass the auth token from the frontend to Koyeb
        'Authorization': req.headers.get('Authorization') || ''
      }
    };

    if (method !== 'GET') {
      options.body = JSON.stringify(await req.json());
    }

    const response = await fetch(`https://whisperbox.koyeb.app/${endpoint}`, options);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
    
  } catch (error: any) {
    console.error("PROXY ERROR:", error);
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}

// Export both GET and POST to handle all API needs!
export async function GET(req: Request) { return handleRequest(req, 'GET'); }
export async function POST(req: Request) { return handleRequest(req, 'POST'); }