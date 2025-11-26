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

// Helper to handle params (Next.js 15+ params is a Promise)
async function getPath(params: { path: string[] } | Promise<{ path: string[] }>): Promise<string[]> {
  const resolved = await params;
  return resolved.path;
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } | Promise<{ path: string[] }> }) {
  const pathSegments = await getPath(params);
  return proxyRequest(request, pathSegments, 'GET');
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } | Promise<{ path: string[] }> }) {
  const pathSegments = await getPath(params);
  return proxyRequest(request, pathSegments, 'POST');
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } | Promise<{ path: string[] }> }) {
  const pathSegments = await getPath(params);
  return proxyRequest(request, pathSegments, 'PUT');
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } | Promise<{ path: string[] }> }) {
  const pathSegments = await getPath(params);
  return proxyRequest(request, pathSegments, 'PATCH');
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } | Promise<{ path: string[] }> }) {
  const pathSegments = await getPath(params);
  return proxyRequest(request, pathSegments, 'DELETE');
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string,
) {
  try {
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

    // Preserve Content-Type from backend
    const contentType = response.headers.get('content-type');
    if (contentType) {
      responseHeaders.set('content-type', contentType);
    }

    // Get response body
    const responseBody = await response.text();

    // If response is not OK, ensure we return proper JSON error
    if (!response.ok) {
      let errorData: any;
      try {
        errorData = JSON.parse(responseBody);
      } catch {
        // If response is not JSON, wrap it
        errorData = { message: responseBody || response.statusText || 'Request failed' };
      }
      
      // Log error for debugging
      console.error(`[API Proxy] Backend error: ${response.status} ${method} ${path}`, errorData);
      
      return NextResponse.json(errorData, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('[API Proxy] Error proxying request:', error);
    const errorMessage = error?.message || 'Unknown error';
    
    // Check if it's a connection error
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      return NextResponse.json(
        { 
          message: 'Backend API server is not running. Please start the API server on port 4000.',
          error: 'Connection refused',
          path: pathSegments.join('/'),
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        message: 'Failed to proxy request to backend API',
        error: errorMessage,
        path: pathSegments.join('/'),
      },
      { status: 502 }
    );
  }
}

