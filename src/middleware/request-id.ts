/**
 * Request ID middleware - generates and attaches request IDs to all requests
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestWithId extends Request {
  requestId?: string;
}

/**
 * Middleware to generate and attach request IDs
 */
export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction
): void {
  // Generate or use existing request ID
  const requestId = req.headers['x-request-id'] as string || randomUUID();
  req.requestId = requestId;
  
  // Add to response headers
  res.setHeader('X-Request-Id', requestId);
  
  next();
}

