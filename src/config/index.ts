/**
 * Configuration management for F1 MCP Server
 * Loads from environment variables with sensible defaults
 */

export interface ServerConfig {
  // Server
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  apiVersion: string;
  
  // Security
  apiKeyRequired: boolean;
  apiKeys: string[];
  jwtSecret?: string;
  enableCors: boolean;
  corsOrigin: string;
  
  // Rate Limiting
  rateLimitEnabled: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  
  // Redis (for session store & caching)
  redisEnabled: boolean;
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  redisDb: number;
  
  // Postgres (for persistent storage)
  postgresEnabled: boolean;
  postgresHost: string;
  postgresPort: number;
  postgresUser: string;
  postgresPassword: string;
  postgresDatabase: string;
  
  // Cache
  cacheEnabled: boolean;
  cacheTTL: number; // seconds
  liveCacheTTL: number; // seconds
  
  // Monitoring
  metricsEnabled: boolean;
  metricsPort: number;
  
  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logFormat: 'json' | 'text';
  
  // External APIs
  openf1BaseUrl: string;
  fastf1BaseUrl: string;
  
  // Graceful Shutdown
  shutdownTimeoutMs: number;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseStringArray(value: string | undefined, defaultValue: string[]): string[] {
  if (!value) return defaultValue;
  return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

export function loadConfig(): ServerConfig {
  const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
  
  return {
    // Server
    port: parseNumber(process.env.PORT, 3000),
    nodeEnv,
    apiVersion: process.env.API_VERSION || 'v1',
    
    // Security
    apiKeyRequired: parseBoolean(process.env.API_KEY_REQUIRED, false),
    apiKeys: parseStringArray(process.env.API_KEYS, []),
    jwtSecret: process.env.JWT_SECRET,
    enableCors: parseBoolean(process.env.ENABLE_CORS, true),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    
    // Rate Limiting
    rateLimitEnabled: parseBoolean(process.env.RATE_LIMIT_ENABLED, true),
    rateLimitWindowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 60000), // 1 minute
    rateLimitMaxRequests: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
    
    // Redis
    redisEnabled: parseBoolean(process.env.REDIS_ENABLED, false),
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseNumber(process.env.REDIS_PORT, 6379),
    redisPassword: process.env.REDIS_PASSWORD,
    redisDb: parseNumber(process.env.REDIS_DB, 0),
    
    // Postgres
    postgresEnabled: parseBoolean(process.env.POSTGRES_ENABLED, false),
    postgresHost: process.env.POSTGRES_HOST || 'localhost',
    postgresPort: parseNumber(process.env.POSTGRES_PORT, 5432),
    postgresUser: process.env.POSTGRES_USER || 'postgres',
    postgresPassword: process.env.POSTGRES_PASSWORD || 'postgres',
    postgresDatabase: process.env.POSTGRES_DATABASE || 'f1_mcp',
    
    // Cache
    cacheEnabled: parseBoolean(process.env.CACHE_ENABLED, true),
    cacheTTL: parseNumber(process.env.CACHE_TTL, 300), // 5 minutes
    liveCacheTTL: parseNumber(process.env.LIVE_CACHE_TTL, 10), // 10 seconds
    
    // Monitoring
    metricsEnabled: parseBoolean(process.env.METRICS_ENABLED, false),
    metricsPort: parseNumber(process.env.METRICS_PORT, 9090),
    
    // Logging
    logLevel: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
    logFormat: (process.env.LOG_FORMAT || 'text') as 'json' | 'text',
    
    // External APIs
    openf1BaseUrl: process.env.OPENF1_BASE_URL || 'https://api.openf1.org/v1',
    fastf1BaseUrl: process.env.FASTF1_BASE_URL || 'https://api.jolpi.ca/ergast/f1',
    
    // Graceful Shutdown
    shutdownTimeoutMs: parseNumber(process.env.SHUTDOWN_TIMEOUT_MS, 30000), // 30 seconds
  };
}

export const config = loadConfig();

