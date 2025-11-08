[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/panth1823-formula1-mcp-badge.png)](https://mseep.ai/app/panth1823-formula1-mcp)

# The Formula1 MCP Server ! 🏎️💨

A TypeScript-based Formula 1 MCP server, bringing the thrill of real-time and historical F1 racing data straight to your fingertips via the Model Context Protocol. Faster than Verstappen on a hot lap! (Okay, maybe not _that_ fast, but it's trying!)

### Resources

- Access F1 session data via standardized URIs
- Real-time telemetry data
- Historical race information
- Driver and constructor standings
- Weather data
- Circuit information

## Getting Started

### Installation

1. Clone the repo:

```bash
git clone https://github.com/Panth1823/formula1-mcp
cd formula1-mcp
```

2. Install:

```bash
npm install
```

3. Build:

```bash
npm run build
```

### Usage

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "formula1": {
      "command": "node",
      "args": ["<path-to-your-cloned-repo>/build/index.js"],
      "cwd": "<path-to-your-cloned-repo>",
      "enabled": true
    }
  }
}
```

Config locations:
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

## Available Tools

### 1. `getLiveTimingData`

Get real-time timing data for the current session.

**Parameters:**

- None required

### 2. `getCurrentSessionStatus`

Get status information about the current session.

**Parameters:**

- None required

### 3. `getDriverInfo`

Get information about a specific driver.

**Parameters:**

- `driverId` (string): Driver identifier (e.g., "max_verstappen", "lewis_hamilton")

### 4. `getHistoricalSessions`

Find session keys for historical events.

**Parameters:**

- `year` (number, optional): Season year (e.g., 2023)
- `circuit_short_name` (string, optional): Circuit name (e.g., "monza", "spa")
- `country_name` (string, optional): Country name (e.g., "Italy", "Belgium")
- `session_name` (string, optional): Session type (e.g., "Race", "Qualifying")

### 5. `getHistoricRaceResults`

Get race results for a specific historical race.

**Parameters:**

- `year` (number): Season year (e.g., 2023)
- `round` (number): Race number (e.g., 1, 2, 3)

### 6. `getDriverStandings`

Get driver championship standings.

**Parameters:**

- `year` (number): Season year (e.g., 2023)

### 7. `getConstructorStandings`

Get constructor championship standings.

**Parameters:**

- `year` (number): Season year (e.g., 2023)

### 8. `getLapTimes`

Get lap times for a specific driver.

**Parameters:**

- `year` (number): Season year (e.g., 2023)
- `round` (number): Race number (e.g., 1, 2, 3)
- `driverId` (string): Driver identifier (e.g., "max_verstappen", "lewis_hamilton")

### 9. `getWeatherData`

Get weather data for a session.

**Parameters:**

- `sessionKey` (string, optional): Session identifier

### 10. `getCarData`

Get detailed car telemetry data.

**Parameters:**

- `driverNumber` (string): Driver's car number (e.g., "44", "33")
- `sessionKey` (string, optional): Session identifier
- `filters` (string, optional): Data filters

### 11. `getPitStopData`

Get pit stop information.

**Parameters:**

- `driverNumber` (string, optional): Driver's car number
- `sessionKey` (string, optional): Session identifier

### 12. `getTeamRadio`

Get team radio communications.

**Parameters:**

- `driverNumber` (string, optional): Driver's car number
- `sessionKey` (string, optional): Session identifier

### 13. `getRaceControlMessages`

Get race control messages.

**Parameters:**

- `sessionKey` (string, optional): Session identifier

### 14. `getRaceCalendar`

Get the F1 race calendar.

**Parameters:**

- `year` (number): Season year (e.g., 2023)

### 15. `getCircuitInfo`

Get detailed circuit information.

**Parameters:**

- `circuitId` (string): Circuit identifier (e.g., "monza", "spa")

### 16. `getSeasonList`

Get a list of available F1 seasons.

**Parameters:**

- `limit` (number, optional): Number of seasons to return

### 17. `getQualifyingResults`

Get qualifying session results.

**Parameters:**

- `year` (number): Season year (e.g., 2023)
- `round` (number): Race number (e.g., 1, 2, 3)

### 18. `getDriverInformation`

Get detailed driver information from Ergast API.

**Parameters:**

- `driverId` (string): Driver identifier (e.g., "max_verstappen", "lewis_hamilton")

### 19. `getConstructorInformation`

Get detailed constructor information from Ergast API.

**Parameters:**

- `constructorId` (string): Constructor identifier (e.g., "red_bull", "mercedes")

### 20. `clearCache`

Clear the local cache for F1 data.

**Parameters:**

- None required

### Data Sources

- Live data: F1 Live Timing API (OpenF1)
- Historical: Ergast API (FastF1)

## Examples

- "Show 2023 Monaco GP results"
- "Get current standings"
- "Weather at Silverstone"
- "Hamilton's lap times"
- "Show 2024 calendar"
- "Verstappen's info"
- "Japanese GP qualifying"

## Debug

Use [MCP Inspector](https://github.com/modelcontextprotocol/inspector) for debugging.

## Help

- Bugs? [Report here](https://github.com/Panth1823/formula1-mcp/issues)
- Questions? Open an issue
- Want to help? Submit a PR

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
