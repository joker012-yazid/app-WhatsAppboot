import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Request interface to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

// Simple UUID generator without external dependency
function generateUUID(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // Generate correlation ID for request tracing
  req.correlationId = req.headers['x-correlation-id'] as string || generateUUID();

  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  // Log incoming request
  console.log(`[${timestamp}] [${req.correlationId}] ${req.method} ${req.originalUrl}`, {
    ip,
    userAgent: userAgent.substring(0, 100), // Truncate for readability
    contentLength: req.headers['content-length'] || '0',
    contentType: req.headers['content-type'] || 'none',
    userId: (req as any).user?.id || 'anonymous',
    userRole: (req as any).user?.role || 'none'
  });

  // Capture response
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    const status = res.statusCode;

    // Log response
    console.log(`[${timestamp}] [${req.correlationId}] ${req.method} ${req.originalUrl} → ${status} (${duration}ms)`, {
      status,
      duration,
      responseSize: body ? body.length : 0,
      userId: (req as any).user?.id || 'anonymous'
    });

    // Add correlation ID to response headers
    res.setHeader('X-Correlation-ID', req.correlationId);

    // Log errors specifically
    if (status >= 400) {
      console.error(`[${req.correlationId}] ERROR RESPONSE:`, {
        method: req.method,
        url: req.originalUrl,
        status,
        duration,
        userId: (req as any).user?.id,
        body: status >= 500 ? undefined : body // Don't log sensitive data for 5xx errors
      });
    }

    // Add cache control headers for API responses to prevent Cloudflare caching
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    return originalSend.call(this, body);
  };

  // Handle request errors
  res.on('error', (err) => {
    console.error(`[${req.correlationId}] RESPONSE ERROR:`, {
      method: req.method,
      url: req.originalUrl,
      error: err.message,
      userId: (req as any).user?.id
    });
  });

  next();
}

// Rate limiting detection
export function detectRateLimit(req: Request, res: Response, next: NextFunction) {
  const originalSend = res.send;
  res.send = function(body) {
    if (res.statusCode === 429) {
      console.warn(`[${req.correlationId}] RATE LIMIT DETECTED:`, {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        userId: (req as any).user?.id,
        retryAfter: res.getHeader('retry-after')
      });
    }
    return originalSend.call(this, body);
  };
  next();
}