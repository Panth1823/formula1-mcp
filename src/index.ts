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

// Helper function to format MCP responses with proper error handling
function formatMCPResponse(data: any, context?: string) {
  try {
    // Handle null or undefined
    if (data === null || data === undefined) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ 
            message: "No data available",
            context: context || "unknown"
          })
        }]
      };
    }

    // Handle empty arrays
    if (Array.isArray(data) && data.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ 
            message: "No data available",
            context: context || "query returned empty results",
            suggestion: context?.includes('live') 
              ? "Live data is only available during active F1 sessions. Use historical data tools instead."
              : "Try adjusting your query parameters or check data availability."
          })
        }]
      };
    }

    // Ensure text is a string
    const textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    
    return {
      content: [{
        type: "text" as const,
        text: textContent
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ 
          error: "Response formatting error",
          message: error.message,
          context: context || "unknown"
        })
      }]
    };
  }
}

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
      try {
        const data = await f1Service.getHistoricRaceResults(year, round);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data) }],
        };
      } catch (error: any) {
        logger.error('getHistoricRaceResults error', { year, round, error: error.message });
        // Return empty race object structure
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ Results: [] }) }],
        };
      }
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
      try {
        const data = await f1Service.getQualifyingResults(year, round);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data) }],
        };
      } catch (error: any) {
        logger.error('getQualifyingResults error', { year, round, error: error.message });
        // Return empty qualifying object structure
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ QualifyingResults: [] }) }],
        };
      }
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
  
  // New Live Streaming Tools
  mcpServer.tool("getLiveCarData", {}, async () => {
    const data = await f1Service.getLiveCarData();
    // Service returns empty array if no live data, which is valid
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  });
  
  mcpServer.tool("getLivePositions", {}, async () => {
    const data = await f1Service.getLivePositions();
    // Service returns empty array if no live data, which is valid
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  });
  
  mcpServer.tool("getLiveRaceControl", {}, async () => {
    const data = await f1Service.getLiveRaceControl();
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  });
  
  mcpServer.tool("getLiveTeamRadio", {}, async () => {
    const data = await f1Service.getLiveTeamRadio();
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  });
  
  mcpServer.tool("getLiveWeather", {}, async () => {
    const data = await f1Service.getLiveWeather();
    // Service returns null if no live data, which is valid
    return formatMCPResponse(data || { message: "No weather data available" }, "live weather");
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
  app.post(`/mcp/${config.apiVersion}`, async (req: RequestWithId, res) => {
    const body = req.body ?? {};
    const id = body.id ?? null;
    const method = body.method ?? "";
    const params = body.params ?? {};

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

    if (method === "tools/list") {
      // Return list of available tools - manually maintained list
      const tools = [
        { name: "getLiveTimingData", description: "Get live F1 timing data", inputSchema: { type: "object", properties: {} } },
        { name: "getCurrentSessionStatus", description: "Get current F1 session status", inputSchema: { type: "object", properties: {} } },
        { name: "getDriverInfo", description: "Get driver bio information (Ergast API)", inputSchema: { type: "object", properties: { driverId: { type: "string", description: "Driver ID (e.g., 'hamilton', 'verstappen')" } }, required: ["driverId"] } },
        { name: "getHistoricalSessions", description: "Find historical F1 sessions", inputSchema: { type: "object", properties: {} } },
        { name: "getHistoricRaceResults", description: "Get historic race results", inputSchema: { type: "object", properties: { year: { type: "number" }, round: { type: "number" } }, required: ["year", "round"] } },
        { name: "getDriverStandings", description: "Get driver standings", inputSchema: { type: "object", properties: { year: { type: "number" } }, required: ["year"] } },
        { name: "getConstructorStandings", description: "Get constructor standings", inputSchema: { type: "object", properties: { year: { type: "number" } }, required: ["year"] } },
        { name: "getWeatherData", description: "Get weather data", inputSchema: { type: "object", properties: { sessionKey: { type: "string" } }, required: ["sessionKey"] } },
        { name: "getCarData", description: "Get car telemetry data (requires sessionKey, auto-adds speed>=0 filter)", inputSchema: { type: "object", properties: { sessionKey: { type: "string", description: "Required: Session key to query" }, driverNumber: { type: "string", description: "Driver number" }, filters: { type: "string", description: "Optional filters like 'speed>=300' or 'lap_number=1'" } }, required: ["sessionKey", "driverNumber"] } },
        { name: "getPitStopData", description: "Get pit stop data", inputSchema: { type: "object", properties: { sessionKey: { type: "string" } }, required: ["sessionKey"] } },
        { name: "getTeamRadio", description: "Get team radio communications (may not be available for all historical sessions)", inputSchema: { type: "object", properties: { sessionKey: { type: "string", description: "Session key" }, driverNumber: { type: "string", description: "Optional: Filter by specific driver number" } }, required: ["sessionKey"] } },
        { name: "getRaceControlMessages", description: "Get race control messages", inputSchema: { type: "object", properties: { sessionKey: { type: "string" } }, required: ["sessionKey"] } },
        { name: "getRaceCalendar", description: "Get F1 race calendar", inputSchema: { type: "object", properties: { year: { type: "number" } }, required: ["year"] } },
        { name: "getLapTimes", description: "Get lap times", inputSchema: { type: "object", properties: { year: { type: "number" }, round: { type: "number" }, driverId: { type: "string" } }, required: ["year", "round", "driverId"] } },
        { name: "getQualifyingResults", description: "Get qualifying results", inputSchema: { type: "object", properties: { year: { type: "number" }, round: { type: "number" } }, required: ["year", "round"] } },
        { name: "getCircuitInfo", description: "Get circuit information", inputSchema: { type: "object", properties: { circuitId: { type: "string" } }, required: ["circuitId"] } },
        { name: "getSeasonList", description: "Get list of F1 seasons", inputSchema: { type: "object", properties: {} } },
        { name: "getDriverInformation", description: "Get driver information", inputSchema: { type: "object", properties: { driverId: { type: "string" } }, required: ["driverId"] } },
        { name: "getConstructorInformation", description: "Get constructor information", inputSchema: { type: "object", properties: { constructorId: { type: "string" } }, required: ["constructorId"] } },
        { name: "clearCache", description: "Clear server cache", inputSchema: { type: "object", properties: {} } },
      ];
      
      return res.json({
        jsonrpc: "2.0",
        id,
        result: { tools },
      });
    }

    if (method === "tools/call") {
      try {
        const toolName = params.name;
        const toolArgs = params.arguments || {};
        
        let result;
        
        // Execute tool based on name
        switch (toolName) {
          case "getLiveTimingData": {
            const data = await f1Service.getLiveTimingData();
            result = {
              content: [{ type: "text", text: JSON.stringify(data.length > 0 ? data : { message: "No live F1 session data available" }) }],
            };
            break;
          }
          case "getCurrentSessionStatus": {
            const data = await f1Service.getCurrentSessionStatus();
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getDriverInfo": {
            const data = await f1Service.getDriverInfo(toolArgs.driverId);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getHistoricalSessions": {
            const data = await f1Service.getHistoricalSessions(toolArgs);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getHistoricRaceResults": {
            const data = await f1Service.getHistoricRaceResults(toolArgs.year, toolArgs.round);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getDriverStandings": {
            const data = await f1Service.getDriverStandings(toolArgs.year);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getConstructorStandings": {
            const data = await f1Service.getConstructorStandings(toolArgs.year);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getWeatherData": {
            const data = await f1Service.getWeatherData(toolArgs.sessionKey);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getCarData": {
            const data = await f1Service.getCarData(toolArgs.driverNumber, toolArgs.sessionKey, toolArgs.filters);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getPitStopData": {
            const data = await f1Service.getPitStopData(toolArgs.sessionKey, toolArgs.driverNumber);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getTeamRadio": {
            const data = await f1Service.getTeamRadio(toolArgs.sessionKey, toolArgs.driverNumber);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getRaceControlMessages": {
            const data = await f1Service.getRaceControlMessages(toolArgs.sessionKey);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getRaceCalendar": {
            const data = await f1Service.getRaceCalendar(toolArgs.year);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getLapTimes": {
            const data = await f1Service.getLapTimes(toolArgs.year, toolArgs.round, toolArgs.driverId);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getQualifyingResults": {
            const data = await f1Service.getQualifyingResults(toolArgs.year, toolArgs.round);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getCircuitInfo": {
            const data = await f1Service.getCircuitInfo(toolArgs.circuitId);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getSeasonList": {
            const data = await f1Service.getSeasonList(toolArgs.limit);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getDriverInformation": {
            const data = await f1Service.getDriverInformation(toolArgs.driverId);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "getConstructorInformation": {
            const data = await f1Service.getConstructorInformation(toolArgs.constructorId);
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          case "clearCache": {
            const data = await f1Service.clearCache();
            result = { content: [{ type: "text", text: JSON.stringify(data) }] };
            break;
          }
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }
        
        return res.json({
          jsonrpc: "2.0",
          id,
          result,
        });
      } catch (error: any) {
        logger.error('Tool call error', {
          requestId: req.requestId,
          error: error.message,
          stack: error.stack,
        });
        
        return res.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32000,
            message: error.message || "Tool execution failed",
          },
        });
      }
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
    const baseUrl = `http://localhost:${port}`;
    logger.info(`F1 MCP Server (HTTP) listening on :${port}`, {
      port,
      nodeEnv: config.nodeEnv,
      apiVersion: config.apiVersion,
    });
    logger.info(`MCP Endpoint: ${baseUrl}/mcp/${config.apiVersion}`);
    logger.info(`Discovery Endpoint: ${baseUrl}/.well-known/mcp-config`);
    logger.info(`Health Check: ${baseUrl}/health`);
    if (config.metricsEnabled) {
      logger.info(`Metrics: ${baseUrl}/metrics`);
    }
  });

  // Setup graceful shutdown
  setupGracefulShutdown(server);
}
