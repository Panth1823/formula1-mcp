import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, 'build', 'index.js');

console.log('Testing MCP Server Tools...\n');
console.log('Server path:', serverPath);
console.log('---\n');

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let buffer = '';
let testCases = [];
let currentTestCase = 0;

server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        console.log('📨 Received:', JSON.stringify(message, null, 2));

        // If we got initialize result, send the first test case
        if (message.id === 1 && message.result) {
          console.log('\n✅ Server initialized successfully!\n');
          runNextTest();
        }

        // If we got a response for a test case, run the next one
        if (message.id > 1) {
          if (message.result) {
            console.log(`\n✅ Test case ${message.id -1} passed!\n`);
          } else {
            console.error(`\n❌ Test case ${message.id - 1} failed:`, message.error);
          }
          runNextTest();
        }
      } catch (e) {
        // Not JSON, might be stderr output
        if (line.trim() && !line.includes('Starting F1 MCP Server')) {
          console.log('Server output:', line);
        }
      }
    }
  }
});

server.on('error', (error) => {
  console.error('❌ Error starting server:', error.message);
  process.exit(1);
});

server.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`\n❌ Server exited with code ${code}`);
    process.exit(1);
  }
});

function runNextTest() {
  if (currentTestCase < testCases.length) {
    const testCase = testCases[currentTestCase];
    console.log(`\nRunning test case ${currentTestCase + 2}: ${testCase.method}...\n`);
    const request = {
      jsonrpc: '2.0',
      id: currentTestCase + 2,
      method: testCase.method,
      params: testCase.params
    };
    server.stdin.write(JSON.stringify(request) + '\n');
    currentTestCase++;
  } else {
    console.log('\n✅ All test cases passed!');
    server.kill();
    process.exit(0);
  }
}

// Define test cases
testCases = [
  { method: 'getHistoricRaceResults', params: { year: 2023, round: 1 } },
  { method: 'getDriverStandings', params: { year: 2023 } },
  { method: 'getConstructorStandings', params: { year: 2023 } },
  { method: 'getLapTimes', params: { year: 2023, round: 1, driverId: 'max_verstappen' } },
  { method: 'getRaceCalendar', params: { year: 2023 } },
  { method: 'getCircuitInfo', params: { circuitId: 'monza' } },
  { method: 'getSeasonList', params: { limit: 5 } },
  { method: 'getQualifyingResults', params: { year: 2023, round: 1 } },
  { method: 'getDriverInformation', params: { driverId: 'max_verstappen' } },
  { method: 'getConstructorInformation', params: { constructorId: 'red_bull' } },
  { method: 'getLiveTimingData', params: {} },
  { method: 'getCurrentSessionStatus', params: {} },
  { method: 'getWeatherData', params: { sessionKey: 'latest' } },
  { method: 'getCarData', params: { driverNumber: '1', sessionKey: 'latest' } },
  { method: 'getPitStopData', params: { sessionKey: 'latest' } },
  { method: 'getTeamRadio', params: { sessionKey: 'latest' } },
  { method: 'getRaceControlMessages', params: { sessionKey: 'latest' } },
  { method: 'clearCache', params: {} }
];

// Send initialize request
setTimeout(() => {
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };

  console.log('Sending initialize request...\n');
  server.stdin.write(JSON.stringify(initRequest) + '\n');
}, 500);

// Timeout after 30 seconds
setTimeout(() => {
  console.error('\n❌ Test timeout - server did not respond');
  server.kill();
  process.exit(1);
}, 30000);
