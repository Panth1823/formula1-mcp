#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { F1DataService } from "./services/f1-data.service.js";
import { z } from "zod";

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
      sessionKey: z.string().optional(),
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
      sessionKey: z.string().optional(),
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
      sessionKey: z.string().optional(),
      driverNumber: z.string().optional(),
    },
    async ({ sessionKey, driverNumber }) => {
      const data = await f1Service.getTeamRadio(
        sessionKey || "",
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
      sessionKey: z.string().optional(),
    },
    async ({ sessionKey }) => {
      const data = await f1Service.getRaceControlMessages(sessionKey || "");
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
  console.error("Starting F1 MCP Server (stdio mode)...");
  const transport = new StdioServerTransport();
  (async () => {
    await server.connect(transport);
  })();

  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", reason);
  });
}

// HTTP server mode for MCP over HTTP transport
// Enabled when PORT is provided (typical deployment environments)
if (process.env.PORT) {
  const port = Number(process.env.PORT) || 3000;
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Health endpoint
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Well-known MCP config
  app.get("/.well-known/mcp-config", (_req, res) => {
    res.json({
      name: "f1-mcp-server",
      version: "1.0.0",
      endpoint: "/mcp/v1",
    });
  });

  // Minimal MCP JSON-RPC endpoint to respond to initialize
  app.post("/mcp/v1", (req, res) => {
    const body = req.body ?? {};
    const id = body.id ?? null;
    const method = body.method ?? "";

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

  app.listen(port, () => {
    console.error(`F1 MCP Server (HTTP) listening on :${port}`);
  });
}
