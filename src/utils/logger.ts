/**
 * Structured logging with request IDs and correlation
 */

import { config } from '../config/index.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  sessionId?: string;
  userId?: string;
  [key: string]: any;
}

class Logger {
  private logLevel: LogLevel;
  private logFormat: 'json' | 'text';

  constructor() {
    this.logLevel = config.logLevel;
    this.logFormat = config.logFormat;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatLog(entry: LogEntry): string {
    if (this.logFormat === 'json') {
      return JSON.stringify(entry);
    }
    
    // Text format: [timestamp] [level] [requestId] message]
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
    ];
    
    if (entry.requestId) {
      parts.push(`[req:${entry.requestId}]`);
    }
    
    if (entry.sessionId) {
      parts.push(`[session:${entry.sessionId}]`);
    }
    
    if (entry.userId) {
      parts.push(`[user:${entry.userId}]`);
    }
    
    parts.push(entry.message);
    
    // Add extra fields
    const extraFields = Object.keys(entry)
      .filter(key => !['timestamp', 'level', 'message', 'requestId', 'sessionId', 'userId'].includes(key))
      .map(key => `${key}=${JSON.stringify(entry[key])}`)
      .join(' ');
    
    if (extraFields) {
      parts.push(extraFields);
    }
    
    return parts.join(' ');
  }

  private log(level: LogLevel, message: string, meta: Record<string, any> = {}): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };

    const formatted = this.formatLog(entry);
    
    // Always write to stderr to avoid interfering with MCP stdio protocol
    // which uses stdout for JSON-RPC communication
    process.stderr.write(formatted + '\n');
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, any>): void {
    this.log('error', message, meta);
  }

  // Helper to create a child logger with request context
  withContext(context: { requestId?: string; sessionId?: string; userId?: string }): Logger {
    const child = new Logger();
    const originalLog = child.log.bind(child);
    
    child.log = (level: LogLevel, message: string, meta: Record<string, any> = {}) => {
      originalLog(level, message, { ...context, ...meta });
    };
    
    return child;
  }
}

export const logger = new Logger();

