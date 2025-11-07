#!/usr/bin/env node

import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { F1DataService } from "./services/f1-data.service.js";
import { z } from "zod";

const server = new McpServer({
  name: "f1-mcp-server",
  version: "1.0.0",
});

const f1Service = F1DataService.getInstance();

// Live data endpoints
server.tool("getLiveTimingData", {}, async () => {
  const data = await f1Service.getLiveTimingData();
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
});

server.tool("getCurrentSessionStatus", {}, async () => {
  const data = await f1Service.getCurrentSessionStatus();
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
});

server.tool("getDriverInfo", { driverId: z.string() }, async ({ driverId }) => {
  const data = await f1Service.getDriverInfo(driverId);
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
});

// Tool to find historical session keys
server.tool(
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
server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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

server.tool(
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
server.tool("clearCache", {}, async () => {
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

console.error("Starting F1 MCP Server...");

const app = express();
app.use(express.json());

// To support multiple simultaneous connections we have a lookup object from
// sessionId to transport
const transports: { [sessionId: string]: SSEServerTransport } = {};

app.get("/sse", async (_: Request, res: Response) => {
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
  res.on("close", () => {
    delete transports[transport.sessionId];
  });
  await server.connect(transport);
});

app.post("/messages", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No transport found for sessionId");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.error(`F1 MCP Server listening on port ${port}`);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
