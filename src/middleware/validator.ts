/**
 * Input validation and sanitization middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { RequestWithId } from './request-id.js';

/**
 * Sanitize string input to prevent injection attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove null bytes and control characters
  return input
    .replace(/\0/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize keys too
      const cleanKey = sanitizeString(key);
      sanitized[cleanKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Validate and sanitize request body
 */
export function validateBodyMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction
): Response | void {
  try {
    if (req.body && typeof req.body === 'object') {
      // Sanitize body
      req.body = sanitizeObject(req.body);
      
      // Check for suspicious patterns (basic prompt injection detection)
      const bodyStr = JSON.stringify(req.body).toLowerCase();
      const suspiciousPatterns = [
        /ignore\s+(previous|above|all)\s+instructions?/i,
        /system\s*:\s*you\s+are/i,
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i, // Event handlers
      ];
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(bodyStr)) {
          logger.warn('Suspicious input detected', {
            requestId: req.requestId,
            pattern: pattern.toString(),
          });
          
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid input detected',
            requestId: req.requestId,
          });
        }
      }
    }
    
    next();
  } catch (error) {
    logger.error('Validation error', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid request body',
      requestId: req.requestId,
    });
  }
}

/**
 * Validate query parameters
 */
export function validateQueryMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction
): Response | void {
  try {
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    next();
  } catch (error) {
    logger.error('Query validation error', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid query parameters',
      requestId: req.requestId,
    });
  }
}

