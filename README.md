[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/panth1823-formula1-mcp-badge.png)](https://mseep.ai/app/panth1823-formula1-mcp)

# The Formula1 MCP Server ! 🏎️💨

A TypeScript-based Formula 1 MCP server, bringing the thrill of **real-time and historical F1 racing data** straight to your fingertips via the Model Context Protocol.

**API Status:** ✅ 21/22 OpenF1 endpoints + 10 Ergast endpoints working  
**Last Tested:** November 10, 2025  
**Active Tools:** 29 MCP tools (All historical data FREE, live streaming requires paid OpenF1 account)  
**Access:** 🎉 **No authentication required** for historical data!

### Features

- ✅ **Free historical data access** - No authentication required!
- ✅ **Comprehensive F1 data** - Sessions, drivers, weather, telemetry (2023-present via OpenF1)
- ✅ **Legacy data** - Historical race information (1950-present via Ergast API)
- ✅ Access F1 session data via standardized REST APIs
- ✅ Real-time telemetry data (car speed, throttle, brake, RPM, DRS, gear)
- ✅ Driver and constructor standings
- ✅ Weather data (air/track temperature, humidity, wind, rainfall)
- ✅ Circuit information with coordinates
- ✅ Team radio communications with audio URLs
- ✅ Race control messages, flags, and penalties
- ✅ Pit stop data and tire strategy
- ✅ Lap times and sector analysis
- ✅ Position tracking and intervals
- ⚠️ **Live streaming** (MQTT) - Requires paid OpenF1 account (currently disabled)

## 📊 API Access & Pricing

### What's Free? (No Account Needed) ✅

**All historical data is completely free!** This includes:
- ✅ All sessions from 2023-present (OpenF1)
- ✅ All races from 1950-present (Ergast)
- ✅ Telemetry, lap times, positions, pit stops
- ✅ Team radio recordings, race control messages
- ✅ Weather data, driver info, overtakes
- ✅ Beta features: Session results, starting grid

### What Requires a Paid Account? ⚠️

**Only real-time streaming during live races:**
- ❌ MQTT WebSocket streaming (live updates)
- ❌ Real-time data during active F1 sessions
- 📝 [Apply for paid access](https://openf1.org/pricing) if needed

**Note:** REST API endpoints may still work during race weekends for delayed/recent data without a paid account (to be tested).

For detailed endpoint testing results, see **[OPENF1_API_ACCESS_REPORT.md](OPENF1_API_ACCESS_REPORT.md)**.

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

That's it! No API keys or authentication required for historical data.

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

### 🏎️ Live Data Tools

These tools return live data during active F1 sessions (race weekends). When no session is active, they return empty arrays or last available data.

**Note:** Real-time MQTT streaming requires a paid OpenF1 account. REST API access during race weekends may work without payment (to be tested).

#### 1. `getLiveCarData`
Get car telemetry for all drivers (speed, throttle, brake, RPM, DRS, gear).

**Parameters:** None  
**Returns:** Array of car telemetry data (empty if no active session)  
**Free Access:** ⚠️ To be tested during next race weekend

#### 2. `getLivePositions`
Get current track positions and gaps.

**Parameters:** None  
**Returns:** Array of position data with gaps (empty if no active session)  
**Free Access:** ⚠️ To be tested during next race weekend

#### 3. `getLiveRaceControl`
Get recent race control messages (flags, penalties, safety car).

**Parameters:** None  
**Returns:** Array of race control messages  
**Data Source:** MQTT stream (live) or REST API (fallback)

#### 4. `getLiveTeamRadio`
Get recent team radio communications with audio URLs.

**Parameters:** None  
**Returns:** Array of team radio messages  
**Data Source:** MQTT stream (live) or REST API (fallback)

#### 5. `getLiveWeather`
Get current weather conditions.

**Parameters:** None  
**Returns:** Weather data object  
**Data Source:** MQTT stream (live) or REST API (fallback)

#### 6. `getStreamingStatus`
Check streaming connection status and data availability.

**Parameters:** None  
**Returns:** Connection status and data counters

#### 7. `startStreaming`
Manually start the MQTT streaming connection.

**Parameters:** None  
**Requires:** MQTT_ENABLED=true and valid credentials

#### 8. `stopStreaming`
Stop streaming and clear live data cache.

**Parameters:** None

---

### Historical Data Tools

#### 1. `getLiveTimingData` (Enhanced)

Get real-time lap timing data for the current/latest session. Now uses streaming when active!

**Parameters:**

- None required

**Note:** Returns live data from MQTT stream if active, otherwise uses REST API. May return empty if no live session is active.

#### 2. `getCurrentSessionStatus`

Get status information about the current session.

**Parameters:**

- None required

**⚠️ Warning:** This endpoint may not work reliably. OpenF1 API doesn't have a standard `/session_status` endpoint.

#### 3. `getDriverInfo`

Get real-time driver information from OpenF1 (requires session context).

**Parameters:**

- `driverId` (string): Driver number (e.g., "1", "44", "33")

**Note:** For historical driver data, use `getDriverInformation` instead.

#### 4. `getHistoricalSessions` ⭐ **CRITICAL**

Find session keys for historical events. **You MUST use this first** to get `session_key` values needed for other tools.

**Parameters:**

- `year` (number, optional): Season year (e.g., 2023, 2024)
- `circuit_short_name` (string, optional): Circuit name (e.g., "Monaco", "Silverstone", "Monza")
- `country_name` (string, optional): Country name (e.g., "Italy", "Belgium")
- `session_name` (string, optional): Session type (e.g., "Race", "Qualifying", "Practice 1")

**Example:** Find 2024 Monaco Race: `year=2024, circuit_short_name="Monaco", session_name="Race"`

#### 5. `getHistoricRaceResults`

Get race results for a specific historical race.

**Parameters:**

- `year` (number): Season year (e.g., 2023)
- `round` (number): Race number (e.g., 1, 2, 3)

#### 6. `getDriverStandings`

Get driver championship standings.

**Parameters:**

- `year` (number): Season year (e.g., 2023)

#### 7. `getConstructorStandings`

Get constructor championship standings.

**Parameters:**

- `year` (number): Season year (e.g., 2023)

#### 8. `getLapTimes`

Get lap times for a specific driver.

**Parameters:**

- `year` (number): Season year (e.g., 2023)
- `round` (number): Race number (e.g., 1, 2, 3)
- `driverId` (string): Driver identifier (e.g., "max_verstappen", "lewis_hamilton")

#### 9. `getWeatherData`

Get weather data for a session.

**Parameters:**

- `sessionKey` (string, **REQUIRED**): Session identifier from `getHistoricalSessions`

**Returns:** Air/track temperature, humidity, pressure, wind speed/direction, rainfall

#### 10. `getCarData`

Get detailed car telemetry data.

**Parameters:**

- `driverNumber` (string, **REQUIRED**): Driver's car number (e.g., "1", "44", "33")
- `sessionKey` (string, **REQUIRED**): Session identifier from `getHistoricalSessions`
- `filters` (string, optional): Additional filters (e.g., "speed>=300")

**Returns:** Speed, throttle %, brake status, RPM, gear, DRS status (18K+ data points per session)

#### 11. `getPitStopData`

Get pit stop information.

**Parameters:**

- `driverNumber` (string, optional): Driver's car number
- `sessionKey` (string, optional): Session identifier

#### 12. `getTeamRadio`

Get team radio communications.

**Parameters:**

- `sessionKey` (string, **REQUIRED**): Session identifier from `getHistoricalSessions`
- `driverNumber` (string, optional): Driver's car number to filter

**Returns:** Radio message URLs and timestamps

#### 13. `getRaceControlMessages`

Get race control messages (flags, incidents, safety car periods).

**Parameters:**

- `sessionKey` (string, **REQUIRED**): Session identifier from `getHistoricalSessions`

**Returns:** Messages, categories, flags (yellow, red, safety car), driver numbers affected

#### 14. `getRaceCalendar`

Get the F1 race calendar.

**Parameters:**

- `year` (number): Season year (e.g., 2023)

#### 15. `getCircuitInfo`

Get detailed circuit information.

**Parameters:**

- `circuitId` (string): Circuit identifier (e.g., "monza", "spa")

#### 16. `getSeasonList`

Get a list of available F1 seasons.

**Parameters:**

- `limit` (number, optional): Number of seasons to return

#### 17. `getQualifyingResults`

Get qualifying session results.

**Parameters:**

- `year` (number): Season year (e.g., 2023)
- `round` (number): Race number (e.g., 1, 2, 3)

#### 18. `getDriverInformation`

Get detailed driver information from Ergast API.

**Parameters:**

- `driverId` (string): Driver identifier (e.g., "max_verstappen", "lewis_hamilton")

#### 19. `getConstructorInformation`

Get detailed constructor information from Ergast API.

**Parameters:**

- `constructorId` (string): Constructor identifier (e.g., "red_bull", "mercedes")

#### 20. `clearCache`

Clear the local cache for F1 data.

**Parameters:**

- None required

### Data Sources

- **Live Streaming:** [OpenF1 MQTT](https://openf1.org) - Real-time MQTT/WebSocket streaming with OAuth2
- **Live/Recent Data:** [OpenF1 API](https://openf1.org) - Real-time telemetry, positions, weather (REST)
- **Historical Data:** [Ergast API](http://ergast.com/mrd/) - Complete F1 history (1950-2024)

**Important:** Ergast API is scheduled to stop updates after 2024 season. Plan for alternative historical sources for 2025+.

## Documentation

- **[QUICK_START_STREAMING.md](QUICK_START_STREAMING.md)** - Get started with live streaming in 5 minutes
- **[LIVE_DATA_IMPLEMENTATION.md](LIVE_DATA_IMPLEMENTATION.md)** - Complete technical documentation
- **[COMPREHENSIVE_TEST_RESULTS.md](COMPREHENSIVE_TEST_RESULTS.md)** - API test results and validation
- **[API_USAGE_ANALYSIS.md](API_USAGE_ANALYSIS.md)** - Feature usage analysis

## Known Issues

1. **getCurrentSessionStatus** - May not work reliably (endpoint doesn't exist in official OpenF1 API)
2. **Monaco 2024** - Returns 0 sessions (data may not be available for all circuits)
3. **Sprint Races** - Not yet supported (Ergast endpoint returns rate limits)

## Examples

**Live Streaming (NEW!):**
- "What are the current positions in the race?" → Use `getLivePositions`
- "Show me live telemetry for Verstappen" → Use `getLiveCarData`
- "Latest race control messages" → Use `getLiveRaceControl`
- "Current weather conditions" → Use `getLiveWeather`
- "Is streaming active?" → Use `getStreamingStatus`

**Finding a Session:**
- "Find the 2024 Bahrain Grand Prix race session" → Use `getHistoricalSessions`
- "Get session key for 2023 Monaco qualifying" → Use `getHistoricalSessions`

**Historical Queries:**
- "Show 2023 Monaco GP results" → Use `getHistoricRaceResults`
- "Get current 2024 standings" → Use `getDriverStandings` + `getConstructorStandings`
- "Hamilton's lap times at Silverstone 2023" → Use `getLapTimes`

**Live Data (requires session_key):**
- "Weather at Silverstone" → Use `getHistoricalSessions` then `getWeatherData`
- "Verstappen's telemetry" → Use `getCarData` with driver number and session key
- "Team radio messages" → Use `getTeamRadio` with session key

**General Info:**
- "Show 2024 calendar" → Use `getRaceCalendar`
- "Tell me about Lewis Hamilton" → Use `getDriverInformation`
- "Info about Monza circuit" → Use `getCircuitInfo`

## Debug

Use [MCP Inspector](https://github.com/modelcontextprotocol/inspector) for debugging.

## Testing

The project includes comprehensive API testing with real-world validation:

```bash
# Test OpenF1 API (12 tests)
npm run test:openf1

# Test Ergast API (14 tests)  
npm run test:ergast

# Test both APIs (26 tests)
npm run test:apis
```

**Latest Test Results:** ✅ 26/26 tests passing (100%)  
See [COMPREHENSIVE_TEST_RESULTS.md](COMPREHENSIVE_TEST_RESULTS.md) for detailed results.

## Help

- Bugs? [Report here](https://github.com/Panth1823/formula1-mcp/issues)
- Questions? Open an issue
- Want to help? Submit a PR

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
