/**
 * Rate limiting middleware
 * Uses in-memory store (can be upgraded to Redis for distributed systems)
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { RequestWithId } from './request-id.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private windowMs: number,
    private maxRequests: number
  ) {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  public getKey(req: Request): string {
    // Use API key if available, otherwise use IP address
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
      return `api_key:${apiKey}`;
    }
    
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      // Create new entry
      const resetAt = now + this.windowMs;
      this.store.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt,
      };
    }

    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Create rate limiter instance
const rateLimiter = new RateLimiter(
  config.rateLimitWindowMs,
  config.rateLimitMaxRequests
);

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction
): Response | void {
  if (!config.rateLimitEnabled) {
    return next();
  }

  const key = rateLimiter.getKey(req);
  const result = rateLimiter.check(key);

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', config.rateLimitMaxRequests.toString());
  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
  res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

  if (!result.allowed) {
    logger.warn('Rate limit exceeded', {
      requestId: req.requestId,
      key: key.split(':')[0], // Don't log full key
    });

    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      requestId: req.requestId,
      retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
    });
  }

  next();
}

// Export rate limiter for cleanup on shutdown
export { rateLimiter };

