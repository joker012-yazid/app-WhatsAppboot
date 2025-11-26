/**
 * Next.js API Route Proxy
 * 
 * This route proxies all API requests to the backend API server.
 * It handles cookie rewriting to ensure cookies work when web app and API
 * run on different origins (e.g., localhost:3000 vs localhost:4000).
 * 
 * In development, this allows cookies to be set correctly even when
 * the backend API is on a different port.
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'GET');
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'POST');
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'PUT');
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'PATCH');
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'DELETE');
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string,
) {
  const path = `/api/${pathSegments.join('/')}`;
  const url = new URL(path, API_BASE);
  
  // Forward query parameters
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  // Prepare headers
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    // Don't forward host, connection, and other hop-by-hop headers
    if (
      !['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(
        key.toLowerCase(),
      )
    ) {
      headers.set(key, value);
    }
  });

  // Forward cookies from the request
  const cookies = request.cookies.getAll();
  if (cookies.length > 0) {
    headers.set(
      'cookie',
      cookies.map((c) => `${c.name}=${c.value}`).join('; '),
    );
  }

  // Get request body if present
  let body: BodyInit | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      body = await request.text();
    } catch {
      // No body
    }
  }

  // Make the proxied request
  const response = await fetch(url.toString(), {
    method,
    headers,
    body,
  });

  // Create response with proxied status and headers
  const responseHeaders = new Headers();
  response.headers.forEach((value, key) => {
    // Rewrite Set-Cookie headers to remove domain restriction
    // This allows cookies to work when proxying between different origins
    if (key.toLowerCase() === 'set-cookie') {
      // Remove domain attribute to allow cookie to be set for current origin
      const cookieValue = value
        .split(';')
        .map((part) => part.trim())
        .filter((part) => !part.toLowerCase().startsWith('domain='))
        .join('; ');
      responseHeaders.append('set-cookie', cookieValue);
    } else {
      responseHeaders.set(key, value);
    }
  });

  // Get response body
  const responseBody = await response.text();

  return new NextResponse(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

