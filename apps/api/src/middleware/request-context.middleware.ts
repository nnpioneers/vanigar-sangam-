/**
 * Request Context Middleware
 *
 * Attaches a unique correlation ID (`requestId`) and start timestamp to every incoming request.
 * Propagates `X-Request-Id` to response headers for distributed tracing and error correlation.
 */

import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
    }
  }
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];
  const requestId =
    typeof incomingId === 'string' && incomingId.trim().length > 0
      ? incomingId.trim()
      : randomUUID();

  req.id = requestId;
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', requestId);

  next();
}
