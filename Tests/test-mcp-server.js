import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * @typedef {Object} TestResult
 * @property {string} name
 * @property {string} tool
 * @property {'PASS' | 'FAIL' | 'WARN'} status
 * @property {string} [error]
 * @property {number} [responseTime]
 * @property {number} [dataPoints]
 * @property {Object} [data]
 * @property {string} [validation]
 */

/** @type {TestResult[]} */
const results = [];

let client;
let serverProcess;

/**
 * Start the MCP server
 */
async function startMCPServer() {
  console.log('🚀 Starting MCP Server...\n');
  
  return new Promise((resolve, reject) => {
    // Start the server process
    serverProcess = spawn('node', ['build/index.js'], {
      env: {
        ...process.env,
        MCP_STANDALONE: '1',
        NODE_ENV: 'test',
        LOG_LEVEL: 'error', // Reduce noise
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let startupOutput = '';

    serverProcess.stdout.on('data', (data) => {
      startupOutput += data.toString();
      // Check if server has started
      if (startupOutput.includes('connected') || startupOutput.includes('F1 MCP Server')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const message = data.toString();
      if (message.includes('Error') || message.includes('error')) {
        console.error('Server Error:', message);
      }
    });

    serverProcess.on('error', (error) => {
      reject(new Error(`Failed to start server: ${error.message}`));
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      resolve(); // Proceed even if we don't see the startup message
    }, 3000);
  });
}

/**
 * Connect MCP client to server
 */
async function connectMCPClient() {
  console.log('🔌 Connecting MCP Client...\n');
  
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['build/index.js'],
    env: {
      ...process.env,
      MCP_STANDALONE: '1',
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
    },
  });

  client = new Client({
    name: 'f1-mcp-test-client',
    version: '1.0.0',
  }, {
    capabilities: {}
  });

  await client.connect(transport);
  console.log('✅ MCP Client Connected\n');
}

/**
 * Call an MCP tool and validate response
 */
async function testTool(name, toolName, params = {}, validator) {
  const startTime = Date.now();
  
  try {
    console.log(`🔍 Testing: ${name}`);
    console.log(`   Tool: ${toolName}`);
    if (Object.keys(params).length > 0) {
      console.log(`   Params:`, JSON.stringify(params, null, 2));
    }
    
    const result = await client.callTool({
      name: toolName,
      arguments: params,
    });
    
    const responseTime = Date.now() - startTime;
    
    // Parse the result
    let data;
    try {
      const content = result.content[0];
      if (content.type === 'text') {
        data = JSON.parse(content.text);
      } else {
        throw new Error('Unexpected content type');
      }
    } catch (parseError) {
      console.log(`   ❌ FAIL - Failed to parse response: ${parseError.message}`);
      return {
        name,
        tool: toolName,
        status: 'FAIL',
        error: `Parse error: ${parseError.message}`,
        responseTime,
      };
    }
    
    // Validate the data
    const validation = validator(data);
    
    if (!validation.valid) {
      console.log(`   ❌ FAIL - Validation: ${validation.message}`);
      return {
        name,
        tool: toolName,
        status: 'FAIL',
        error: validation.message,
        responseTime,
        dataPoints: validation.dataPoints,
      };
    }
    
    console.log(`   ✅ PASS - ${validation.message}`);
    console.log(`   ⏱️  Response time: ${responseTime}ms`);
    if (validation.details) {
      console.log(`   📊 Details:`, JSON.stringify(validation.details, null, 2));
    }
    
    return {
      name,
      tool: toolName,
      status: 'PASS',
      validation: validation.message,
      responseTime,
      dataPoints: validation.dataPoints,
      data: validation.details,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.log(`   ❌ FAIL - ${error.message}`);
    
    return {
      name,
      tool: toolName,
      status: 'FAIL',
      error: error.message,
      responseTime,
    };
  }
}

/**
 * Test Live Data Tools
 */
async function testLiveDataTools() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║              LIVE DATA TOOLS TEST                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  // Test 1: Get Live Timing Data
  results.push(await testTool(
    '1. Get Live Timing Data',
    'getLiveTimingData',
    {},
    (data) => {
      if (data.message && data.message.includes('No live F1 session')) {
        return { valid: true, message: 'No active session (expected)', dataPoints: 0 };
      }
      
      if (!Array.isArray(data)) {
        return { valid: false, message: 'Response is not an array' };
      }
      
      const drivers = new Set(data.map(d => d.driver_number));
      return {
        valid: true,
        message: `${data.length} timing points for ${drivers.size} driver(s)`,
        dataPoints: data.length,
        details: { drivers: drivers.size }
      };
    }
  ));
  
  // Test 2: Get Current Session Status
  results.push(await testTool(
    '2. Get Current Session Status',
    'getCurrentSessionStatus',
    {},
    (data) => {
      if (Array.isArray(data) && data.length === 0) {
        return { valid: true, message: 'No active session', dataPoints: 0 };
      }
      
      if (!Array.isArray(data)) {
        return { valid: false, message: 'Response is not an array' };
      }
      
      const latest = data[data.length - 1];
      return {
        valid: true,
        message: `Session status: ${latest?.status || 'Unknown'}`,
        dataPoints: data.length,
        details: { status: latest?.status }
      };
    }
  ));
  
  // Test 3: Get Live Car Data
  results.push(await testTool(
    '3. Get Live Car Data',
    'getLiveCarData',
    {},
    (data) => {
      if (!Array.isArray(data)) {
        return { valid: false, message: 'Response is not an array' };
      }
      
      if (data.length === 0) {
        return { valid: true, message: 'No car data (no active session)', dataPoints: 0 };
      }
      
      const drivers = new Set(data.map(d => d.driver_number));
      const maxSpeed = Math.max(...data.map(d => d.speed || 0));
      
      return {
        valid: true,
        message: `${data.length} telemetry points for ${drivers.size} driver(s)`,
        dataPoints: data.length,
        details: { drivers: drivers.size, maxSpeed: Math.round(maxSpeed) }
      };
    }
  ));
  
  // Test 4: Get Live Positions
  results.push(await testTool(
    '4. Get Live Positions',
    'getLivePositions',
    {},
    (data) => {
      if (!Array.isArray(data)) {
        return { valid: false, message: 'Response is not an array' };
      }
      
      if (data.length === 0) {
        return { valid: true, message: 'No position data (no active session)', dataPoints: 0 };
      }
      
      const drivers = new Set(data.map(d => d.driver_number));
      
      return {
        valid: true,
        message: `${data.length} position updates for ${drivers.size} driver(s)`,
        dataPoints: data.length,
        details: { drivers: drivers.size }
      };
    }
  ));
  
  // Test 5: Get Live Weather
  results.push(await testTool(
    '5. Get Live Weather',
    'getLiveWeather',
    {},
    (data) => {
      if (data.message && data.message.includes('No weather')) {
        return { valid: true, message: 'No weather data available', dataPoints: 0 };
      }
      
      if (!data.air_temperature) {
        return { valid: false, message: 'Missing air_temperature field' };
      }
      
      return {
        valid: true,
        message: `Air: ${data.air_temperature}°C, Track: ${data.track_temperature}°C`,
        dataPoints: 1,
        details: {
          airTemp: data.air_temperature,
          trackTemp: data.track_temperature,
          humidity: data.humidity
        }
      };
    }
  ));
  
  // Test 6: Get Streaming Status
  results.push(await testTool(
    '6. Get Streaming Status',
    'getStreamingStatus',
    {},
    (data) => {
      if (typeof data.enabled !== 'boolean') {
        return { valid: false, message: 'Missing enabled field' };
      }
      
      return {
        valid: true,
        message: `Streaming ${data.enabled ? 'enabled' : 'disabled'}, ${data.connected ? 'connected' : 'disconnected'}`,
        dataPoints: 1,
        details: {
          enabled: data.enabled,
          connected: data.connected,
          dataAvailable: data.dataAvailable
        }
      };
    }
  ));
}

/**
 * Test Historical Data Tools
 */
async function testHistoricalDataTools() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║           HISTORICAL DATA TOOLS TEST                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  // Test 7: Get Historical Sessions
  results.push(await testTool(
    '7. Get Historical Sessions (2024 Bahrain)',
    'getHistoricalSessions',
    { year: 2024, country_name: 'Bahrain', session_name: 'Race' },
    (data) => {
      if (!Array.isArray(data)) {
        return { valid: false, message: 'Response is not an array' };
      }
      
      if (data.length === 0) {
        return { valid: false, message: 'No sessions found' };
      }
      
      const session = data[0];
      if (!session.session_key || !session.circuit_short_name) {
        return { valid: false, message: 'Missing session_key or circuit_short_name' };
      }
      
      return {
        valid: true,
        message: `Found ${data.length} session(s), key: ${session.session_key}, circuit: ${session.circuit_short_name}`,
        dataPoints: data.length,
        details: {
          sessionKey: session.session_key,
          circuit: session.circuit_short_name
        }
      };
    }
  ));
  
  // Test 8: Get Weather Data (Historical)
  results.push(await testTool(
    '8. Get Weather Data (Abu Dhabi 2023)',
    'getWeatherData',
    { sessionKey: '9165' },
    (data) => {
      if (!Array.isArray(data)) {
        return { valid: false, message: 'Response is not an array' };
      }
      
      if (data.length === 0) {
        return { valid: false, message: 'No weather data' };
      }
      
      const avgAir = (data.reduce((sum, d) => sum + d.air_temperature, 0) / data.length).toFixed(1);
      const avgTrack = (data.reduce((sum, d) => sum + d.track_temperature, 0) / data.length).toFixed(1);
      
      return {
        valid: true,
        message: `${data.length} readings, Avg Air: ${avgAir}°C, Track: ${avgTrack}°C`,
        dataPoints: data.length,
        details: { avgAir, avgTrack }
      };
    }
  ));
  
  // Test 9: Get Car Data (High Speed)
  results.push(await testTool(
    '9. Get Car Data (Verstappen >300 km/h)',
    'getCarData',
    { driverNumber: '1', sessionKey: '9165', filters: 'speed>=300' },
    (data) => {
      if (!Array.isArray(data)) {
        return { valid: false, message: 'Response is not an array' };
      }
      
      if (data.length === 0) {
        return { valid: true, message: 'No high-speed data', dataPoints: 0 };
      }
      
      const maxSpeed = Math.max(...data.map(d => d.speed || 0));
      const maxRpm = Math.max(...data.map(d => d.rpm || 0));
      
      return {
        valid: true,
        message: `${data.length} points, Max speed: ${Math.round(maxSpeed)} km/h, RPM: ${maxRpm}`,
        dataPoints: data.length,
        details: { maxSpeed: Math.round(maxSpeed), maxRpm }
      };
    }
  ));
  
  // Test 10: Get Team Radio
  results.push(await testTool(
    '10. Get Team Radio (Verstappen)',
    'getTeamRadio',
    { sessionKey: '9165', driverNumber: '1' },
    (data) => {
      if (!Array.isArray(data)) {
        return { valid: false, message: 'Response is not an array' };
      }
      
      if (data.length === 0) {
        return { valid: false, message: 'No team radio found' };
      }
      
      const hasValidUrls = data.every(d => d.recording_url && d.recording_url.startsWith('http'));
      
      return {
        valid: true,
        message: `${data.length} radio messages, URLs valid: ${hasValidUrls ? 'Yes' : 'No'}`,
        dataPoints: data.length,
        details: { validUrls: hasValidUrls }
      };
    }
  ));
  
  // Test 11: Get Race Control Messages
  results.push(await testTool(
    '11. Get Race Control Messages',
    'getRaceControlMessages',
    { sessionKey: '9165' },
    (data) => {
      if (!Array.isArray(data)) {
        return { valid: false, message: 'Response is not an array' };
      }
      
      if (data.length === 0) {
        return { valid: false, message: 'No race control messages' };
      }
      
      const flags = data.filter(d => d.flag);
      const categories = new Set(data.map(d => d.category));
      
      return {
        valid: true,
        message: `${data.length} messages, ${flags.length} flags, ${categories.size} categories`,
        dataPoints: data.length,
        details: { flags: flags.length, categories: categories.size }
      };
    }
  ));
  
  // Test 12: Get Pit Stop Data
  results.push(await testTool(
    '12. Get Pit Stop Data',
    'getPitStopData',
    { sessionKey: '9165' },
    (data) => {
      if (!Array.isArray(data)) {
        return { valid: false, message: 'Response is not an array' };
      }
      
      if (data.length === 0) {
        return { valid: false, message: 'No pit stop data' };
      }
      
      const validStops = data.filter(d => d.pit_duration && d.pit_duration > 0);
      const avgDuration = validStops.length > 0 
        ? (validStops.reduce((sum, d) => sum + d.pit_duration, 0) / validStops.length).toFixed(2)
        : 0;
      
      return {
        valid: true,
        message: `${data.length} stops, Avg: ${avgDuration}s`,
        dataPoints: data.length,
        details: { validStops: validStops.length, avgDuration }
      };
    }
  ));
}

/**
 * Test Ergast API Tools
 */
async function testErgastTools() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║            ERGAST API TOOLS TEST                          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  // Test 13: Get Race Calendar
  results.push(await testTool(
    '13. Get Race Calendar (2024)',
    'getRaceCalendar',
    { year: 2024 },
    (data) => {
      if (!Array.isArray(data)) {
        return { valid: false, message: 'Response is not an array' };
      }
      
      if (data.length === 0) {
        return { valid: false, message: 'No races found' };
      }
      
      const countries = new Set(data.map(d => d.Circuit?.Location?.country));
      
      return {
        valid: true,
        message: `${data.length} races in ${countries.size} countries`,
        dataPoints: data.length,
        details: { races: data.length, countries: countries.size }
      };
    }
  ));
  
  // Test 14: Get Historic Race Results
  results.push(await testTool(
    '14. Get Historic Race Results (2023 Abu Dhabi)',
    'getHistoricRaceResults',
    { year: 2023, round: 24 },
    (data) => {
      if (!data.Results || !Array.isArray(data.Results)) {
        return { valid: false, message: 'Missing or invalid Results array' };
      }
      
      const winner = data.Results[0];
      
      return {
        valid: true,
        message: `${data.Results.length} drivers, Winner: ${winner.Driver?.familyName || 'Unknown'}`,
        dataPoints: data.Results.length,
        details: { 
          drivers: data.Results.length,
          winner: winner.Driver?.familyName
        }
      };
    }
  ));
  
  // Test 15: Get Driver Standings
  results.push(await testTool(
    '15. Get Driver Standings (2023)',
    'getDriverStandings',
    { year: 2023 },
    (data) => {
      if (!data.DriverStandings || !Array.isArray(data.DriverStandings)) {
        return { valid: false, message: 'Missing or invalid DriverStandings array' };
      }
      
      const champion = data.DriverStandings[0];
      
      return {
        valid: true,
        message: `${data.DriverStandings.length} drivers, Champion: ${champion.Driver?.familyName || 'Unknown'} (${champion.points} pts)`,
        dataPoints: data.DriverStandings.length,
        details: {
          drivers: data.DriverStandings.length,
          champion: champion.Driver?.familyName,
          points: champion.points
        }
      };
    }
  ));
  
  // Test 16: Get Driver Information
  results.push(await testTool(
    '16. Get Driver Information (Verstappen)',
    'getDriverInformation',
    { driverId: 'max_verstappen' },
    (data) => {
      if (!data.givenName || !data.familyName) {
        return { valid: false, message: 'Missing driver name fields' };
      }
      
      return {
        valid: true,
        message: `${data.givenName} ${data.familyName}, #${data.permanentNumber || 'N/A'}`,
        dataPoints: 1,
        details: {
          name: `${data.givenName} ${data.familyName}`,
          number: data.permanentNumber,
          nationality: data.nationality
        }
      };
    }
  ));
  
  // Test 17: Get Qualifying Results
  results.push(await testTool(
    '17. Get Qualifying Results (2023 Abu Dhabi)',
    'getQualifyingResults',
    { year: 2023, round: 24 },
    (data) => {
      if (!data.QualifyingResults || !Array.isArray(data.QualifyingResults)) {
        return { valid: false, message: 'Missing or invalid QualifyingResults array' };
      }
      
      const polePosition = data.QualifyingResults[0];
      
      return {
        valid: true,
        message: `${data.QualifyingResults.length} drivers, Pole: ${polePosition.Driver?.familyName || 'Unknown'}`,
        dataPoints: data.QualifyingResults.length,
        details: {
          drivers: data.QualifyingResults.length,
          pole: polePosition.Driver?.familyName
        }
      };
    }
  ));
}

/**
 * Print comprehensive summary
 */
function printSummary() {
  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║           MCP SERVER - COMPREHENSIVE TEST SUMMARY         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const totalTime = results.reduce((sum, r) => sum + (r.responseTime || 0), 0);
  const avgTime = (totalTime / results.length).toFixed(0);
  const totalDataPoints = results.reduce((sum, r) => sum + (r.dataPoints || 0), 0);
  
  console.log(`📊 OVERALL RESULTS:`);
  console.log(`   ✅ Passed:  ${passed}/${results.length} (${((passed/results.length)*100).toFixed(1)}%)`);
  console.log(`   ❌ Failed:  ${failed}/${results.length} (${((failed/results.length)*100).toFixed(1)}%)`);
  console.log(`   ⏱️  Average response time: ${avgTime}ms`);
  console.log(`   ⏱️  Total test time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`   📈 Total data points retrieved: ${totalDataPoints.toLocaleString()}\n`);
  
  if (failed > 0) {
    console.log('❌ FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   - ${r.name}`);
      console.log(`     Tool: ${r.tool}`);
      console.log(`     Error: ${r.error}`);
    });
    console.log();
  }
  
  // Detailed results table
  console.log('📋 DETAILED TEST RESULTS:\n');
  console.log('Test                                      Tool                      Status  Time(ms)  Data Pts');
  console.log('─'.repeat(110));
  
  results.forEach(r => {
    const name = r.name.padEnd(41);
    const tool = r.tool.padEnd(29);
    const status = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
    const time = (r.responseTime || 0).toString().padStart(7);
    const points = (r.dataPoints?.toString() || '-').padStart(8);
    
    console.log(`${name} ${tool} ${status}  ${time}  ${points}`);
  });
  
  console.log('\n');
}

/**
 * Cleanup
 */
async function cleanup() {
  console.log('\n🧹 Cleaning up...\n');
  
  try {
    if (client) {
      await client.close();
      console.log('✅ MCP Client disconnected');
    }
  } catch (error) {
    console.error('Error disconnecting client:', error.message);
  }
  
  if (serverProcess) {
    serverProcess.kill();
    console.log('✅ Server process terminated');
  }
}

/**
 * Main test runner
 */
async function runMCPServerTests() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   F1 MCP SERVER - LOCAL IMPLEMENTATION TEST               ║');
  console.log('║   Testing actual MCP server tools via SDK client          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  console.log(`Started: ${new Date().toISOString()}\n`);
  
  try {
    // Build the project first
    console.log('🔨 Building project...\n');
    const { execSync } = await import('child_process');
    try {
      execSync('npm run build', { stdio: 'inherit' });
      console.log('✅ Build successful\n');
    } catch (buildError) {
      console.error('❌ Build failed:', buildError.message);
      process.exit(1);
    }
    
    // Connect to the server
    await connectMCPClient();
    
    // Run all test suites
    await testLiveDataTools();
    await testHistoricalDataTools();
    await testErgastTools();
    
    // Print summary
    printSummary();
    
    console.log(`Completed: ${new Date().toISOString()}\n`);
    
    // Cleanup
    await cleanup();
    
    // Exit with appropriate code
    const failed = results.filter(r => r.status === 'FAIL').length;
    process.exit(failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Test suite failed with error:', error);
    await cleanup();
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Test interrupted by user');
  await cleanup();
  process.exit(130);
});

process.on('SIGTERM', async () => {
  console.log('\n\n⚠️  Test terminated');
  await cleanup();
  process.exit(143);
});

// Run the tests
runMCPServerTests();
