/**
 * Authentication middleware - API key validation
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { RequestWithId } from './request-id.js';

/**
 * API key authentication middleware
 */
export function authMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction
): Response | void {
  // Skip auth if not required
  if (!config.apiKeyRequired) {
    return next();
  }

  // Get API key from header
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    logger.warn('Missing API key', { requestId: req.requestId });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required',
      requestId: req.requestId,
    });
  }

  // Validate API key
  if (!config.apiKeys.includes(apiKey)) {
    logger.warn('Invalid API key', { requestId: req.requestId });
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key',
      requestId: req.requestId,
    });
  }

  // Attach user context (could extract from API key)
  (req as any).apiKey = apiKey;
  
  next();
}

