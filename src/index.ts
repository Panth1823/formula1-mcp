#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { F1DataService } from "./services/f1-data.service.js";
import { z } from "zod";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { requestIdMiddleware, RequestWithId } from "./middleware/request-id.js";
import { rateLimitMiddleware } from "./middleware/rate-limiter.js";
import { authMiddleware } from "./middleware/auth.js";
import { validateBodyMiddleware, validateQueryMiddleware } from "./middleware/validator.js";
import { setupGracefulShutdown } from "./utils/graceful-shutdown.js";
import { metrics, trackRequestMetrics } from "./utils/metrics.js";

const f1Service = F1DataService.getInstance();

// Helper function to register all tools on a server instance
function registerAllTools(mcpServer: McpServer) {
  // Live data endpoints
  mcpServer.tool("getLiveTimingData", {}, async () => {
    const data = await f1Service.getLiveTimingData();
    if (data.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              message:
                "No live F1 session data available at the moment. Please check back during a race weekend.",
            }),
          },
        ],
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  });

  mcpServer.tool("getCurrentSessionStatus", {}, async () => {
    const data = await f1Service.getCurrentSessionStatus();
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  });

  mcpServer.tool("getDriverInfo", { driverId: z.string() }, async ({ driverId }) => {
    const data = await f1Service.getDriverInfo(driverId);
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  });

  // Tool to find historical session keys
  mcpServer.tool(
    "getHistoricalSessions",
    {
      year: z.number().optional(),
      circuit_short_name: z.string().optional(),
      session_name: z.string().optional(),
      country_name: z.string().optional(),
      location: z.string().optional(),
    },
    async (filters) => {
      const data = await f1Service.getHistoricalSessions(filters);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  // Historic data endpoints
  mcpServer.tool(
    "getHistoricRaceResults",
    {
      year: z.number(),
      round: z.number(),
    },
    async ({ year, round }) => {
      const data = await f1Service.getHistoricRaceResults(year, round);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  mcpServer.tool(
    "getDriverStandings",
    {
      year: z.number(),
    },
    async ({ year }) => {
      const data = await f1Service.getDriverStandings(year);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  mcpServer.tool(
    "getConstructorStandings",
    {
      year: z.number(),
    },
    async ({ year }) => {
      const data = await f1Service.getConstructorStandings(year);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  mcpServer.tool(
    "getLapTimes",
    {
      year: z.number(),
      round: z.number(),
      driverId: z.string(),
    },
    async ({ year, round, driverId }) => {
      const data = await f1Service.getLapTimes(year, round, driverId);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  // New OpenF1 API tools
  mcpServer.tool(
    "getWeatherData",
    {
      sessionKey: z.string().describe('Session key from getHistoricalSessions. Required for accurate weather data.'),
    },
    async ({ sessionKey }) => {
      const data = await f1Service.getWeatherData(sessionKey);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  mcpServer.tool(
    "getCarData",
    {
      driverNumber: z.string(),
      sessionKey: z.string().describe('Session key from getHistoricalSessions. Required for car telemetry data.'),
      filters: z.string().optional(),
    },
    async ({ driverNumber, sessionKey, filters }) => {
      const data = await f1Service.getCarData(driverNumber, sessionKey, filters);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  mcpServer.tool(
    "getPitStopData",
    {
      sessionKey: z.string().optional(),
      driverNumber: z.string().optional(),
    },
    async ({ sessionKey, driverNumber }) => {
      const data = await f1Service.getPitStopData(sessionKey, driverNumber);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  mcpServer.tool(
    "getTeamRadio",
    {
      sessionKey: z.string().describe('Session key from getHistoricalSessions'),
      driverNumber: z.string().optional().describe('Filter by specific driver number'),
    },
    async ({ sessionKey, driverNumber }) => {
      const data = await f1Service.getTeamRadio(
        sessionKey,
        driverNumber || ""
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  mcpServer.tool(
    "getRaceControlMessages",
    {
      sessionKey: z.string().describe('Session key from getHistoricalSessions'),
    },
    async ({ sessionKey }) => {
      const data = await f1Service.getRaceControlMessages(sessionKey);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  // New Ergast API tools
  mcpServer.tool(
    "getRaceCalendar",
    {
      year: z.number(),
    },
    async ({ year }) => {
      const data = await f1Service.getRaceCalendar(year);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  mcpServer.tool(
    "getCircuitInfo",
    {
      circuitId: z.string(),
    },
    async ({ circuitId }) => {
      const data = await f1Service.getCircuitInfo(circuitId);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  mcpServer.tool(
    "getSeasonList",
    {
      limit: z.number().optional(),
    },
    async ({ limit }) => {
      const data = await f1Service.getSeasonList(limit);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  mcpServer.tool(
    "getQualifyingResults",
    {
      year: z.number(),
      round: z.number(),
    },
    async ({ year, round }) => {
      const data = await f1Service.getQualifyingResults(year, round);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  mcpServer.tool(
    "getDriverInformation",
    {
      driverId: z.string(),
    },
    async ({ driverId }) => {
      const data = await f1Service.getDriverInformation(driverId);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  mcpServer.tool(
    "getConstructorInformation",
    {
      constructorId: z.string(),
    },
    async ({ constructorId }) => {
      const data = await f1Service.getConstructorInformation(constructorId);
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
      };
    }
  );

  // Utility tools
  mcpServer.tool("clearCache", {}, async () => {
    f1Service.clearCache();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ message: "Cache cleared successfully" }),
        },
      ],
    };
  });
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "f1-mcp-server",
    version: "1.0.0",
  });
  registerAllTools(server);
  return server;
}

// Optional standalone stdio bootstrap for local development.
// Enable by running with MCP_STANDALONE=1
if (process.env.MCP_STANDALONE === "1") {
  const server = createServer();
  logger.info("Starting F1 MCP Server (stdio mode)...");
  const transport = new StdioServerTransport();
  (async () => {
    await server.connect(transport);
    logger.info("F1 MCP Server connected (stdio mode)");
  })();

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", {
      error: err.message,
      stack: err.stack,
    });
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });
}

// HTTP server mode for MCP over HTTP transport
// Enabled when PORT is provided (typical deployment environments)
if (process.env.PORT || config.port) {
  const port = config.port;
  const app = express();

  // Trust proxy (for rate limiting IP detection)
  app.set('trust proxy', true);

  // Middleware setup
  app.use(express.json({ limit: "1mb" }));
  app.use(requestIdMiddleware);
  app.use(trackRequestMetrics);
  app.use(validateBodyMiddleware);
  app.use(validateQueryMiddleware);

  // CORS
  if (config.enableCors) {
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', config.corsOrigin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Request-Id');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });
  }

  // Rate limiting (before auth to prevent brute force)
  app.use(rateLimitMiddleware);

  // Authentication (only for API endpoints, not health checks)
  app.use((req, res, next) => {
    // Skip auth for health and well-known endpoints
    if (req.path.startsWith('/health') || req.path.startsWith('/.well-known')) {
      return next();
    }
    authMiddleware(req, res, next);
  });

  // Health check endpoints
  app.get("/health", (req: RequestWithId, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  });

  // Liveness probe - simple check that server is running
  app.get("/health/live", (req: RequestWithId, res) => {
    res.status(200).json({
      status: "alive",
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  });

  // Readiness probe - check if server is ready to accept requests
  app.get("/health/ready", (req: RequestWithId, res) => {
    // Add checks for dependencies (Redis, Postgres, etc.) here
    const checks: Record<string, boolean> = {
      server: true,
      // Add more checks as needed
      // redis: redisClient.isReady(),
      // postgres: postgresClient.isConnected(),
    };

    const allReady = Object.values(checks).every(v => v === true);

    if (allReady) {
      res.status(200).json({
        status: "ready",
        checks,
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      });
    } else {
      res.status(503).json({
        status: "not ready",
        checks,
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
      });
    }
  });

  // Metrics endpoint (Prometheus format)
  if (config.metricsEnabled) {
    app.get("/metrics", (_req, res) => {
      res.set('Content-Type', 'text/plain');
      res.send(metrics.exportPrometheus());
    });
  }

  // Well-known MCP config
  app.get("/.well-known/mcp-config", (_req, res) => {
    res.json({
      name: "f1-mcp-server",
      version: "1.0.0",
      apiVersion: config.apiVersion,
      endpoint: `/mcp/${config.apiVersion}`,
    });
  });

  // MCP JSON-RPC endpoint
  app.post(`/mcp/${config.apiVersion}`, (req: RequestWithId, res) => {
    const body = req.body ?? {};
    const id = body.id ?? null;
    const method = body.method ?? "";

    logger.debug('MCP request', {
      requestId: req.requestId,
      method,
      id,
    });

    if (method === "initialize") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-06-18",
          serverInfo: { name: "f1-mcp-server", version: "1.0.0" },
          capabilities: {},
        },
      });
    }

    return res.status(200).json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: "Method not found" },
    });
  });

  // 404 handler
  app.use((req: RequestWithId, res) => {
    res.status(404).json({
      error: "Not Found",
      message: `Route ${req.method} ${req.path} not found`,
      requestId: req.requestId,
    });
  });

  // Error handler
  app.use((err: Error, req: RequestWithId, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error', {
      requestId: req.requestId,
      error: err.message,
      stack: err.stack,
    });

    res.status(500).json({
      error: "Internal Server Error",
      message: config.nodeEnv === 'development' ? err.message : 'An unexpected error occurred',
      requestId: req.requestId,
    });
  });

  const server = app.listen(port, () => {
    logger.info(`F1 MCP Server (HTTP) listening on :${port}`, {
      port,
      nodeEnv: config.nodeEnv,
      apiVersion: config.apiVersion,
    });
  });

  // Setup graceful shutdown
  setupGracefulShutdown(server);
}
