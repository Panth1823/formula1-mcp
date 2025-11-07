#!/usr/bin/env node

/**
 * Comprehensive test runner for historic MCP tools.
 * Spawns the built MCP server, initializes the connection,
 * then calls each historic-focused tool and logs the results.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, 'build', 'index.js');

const HISTORIC_TESTS = [
  {
    name: 'getHistoricalSessions',
    description: 'Fetch historical sessions for 2023 races',
    arguments: { year: 2023, session_name: 'Race' },
  },
  {
    name: 'getHistoricRaceResults',
    description: 'Fetch race results for 2023 round 1',
    arguments: { year: 2023, round: 1 },
  },
  {
    name: 'getDriverStandings',
    description: 'Fetch driver standings for 2023 season',
    arguments: { year: 2023 },
  },
  {
    name: 'getConstructorStandings',
    description: 'Fetch constructor standings for 2023 season',
    arguments: { year: 2023 },
  },
  {
    name: 'getLapTimes',
    description: 'Fetch lap times for Verstappen, 2023 round 1',
    arguments: { year: 2023, round: 1, driverId: 'max_verstappen' },
  },
  {
    name: 'getRaceCalendar',
    description: 'Fetch race calendar for 2023 season',
    arguments: { year: 2023 },
  },
  {
    name: 'getQualifyingResults',
    description: 'Fetch qualifying results for 2023 round 1',
    arguments: { year: 2023, round: 1 },
  },
  {
    name: 'getSeasonList',
    description: 'Fetch a list of seasons',
    arguments: { limit: 10 },
  },
  {
    name: 'getDriverInformation',
    description: 'Fetch driver information for Lewis Hamilton',
    arguments: { driverId: 'hamilton' },
  },
  {
    name: 'getConstructorInformation',
    description: 'Fetch constructor information for Mercedes',
    arguments: { constructorId: 'mercedes' },
  },
];

console.log('🚀 Historic MCP Tool Test Runner');
console.log('Server path:', serverPath);
console.log('Total tests:', HISTORIC_TESTS.length);
console.log('---');

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit'],
});

const requestQueue = [];
let buffer = '';
let nextRequestId = 1;
let initialized = false;
let testIndex = 0;

const summary = HISTORIC_TESTS.map((test) => ({
  name: test.name,
  description: test.description,
  success: false,
  error: null,
  dataPreview: null,
}));

function sendRequest(message) {
  server.stdin.write(JSON.stringify(message) + '\n');
}

function sendInitialize() {
  console.log('ℹ️  Sending initialize request...');
  sendRequest({
    jsonrpc: '2.0',
    id: nextRequestId++,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {
        name: 'historic-tool-tester',
        version: '1.0.0',
      },
    },
  });
}

function runNextTest() {
  if (testIndex >= HISTORIC_TESTS.length) {
    console.log('\n✅ All tests dispatched. Waiting for remaining responses...');
    return;
  }

  const test = HISTORIC_TESTS[testIndex];
  const requestId = nextRequestId++;

  console.log(`\n🔍 [${testIndex + 1}/${HISTORIC_TESTS.length}] Testing ${test.name}`);
  console.log(`    ${test.description}`);

  requestQueue.push({ id: requestId, index: testIndex });
  testIndex += 1;

  sendRequest({
    jsonrpc: '2.0',
    id: requestId,
    method: 'tools/call',
    params: {
      name: test.name,
      arguments: test.arguments,
    },
  });
}

function handleInitializeResult(message) {
  console.log('✅ Server initialized (protocol version:', message.result.protocolVersion, ')');
  initialized = true;
  runNextTest();
}

function handleToolResult(message) {
  const queueEntryIndex = requestQueue.findIndex((entry) => entry.id === message.id);
  if (queueEntryIndex === -1) {
    console.warn('⚠️ Received response for unknown request id:', message.id);
    return;
  }

  const { index } = requestQueue.splice(queueEntryIndex, 1)[0];
  const test = HISTORIC_TESTS[index];
  const entry = summary[index];

  if (message.error) {
    entry.success = false;
    entry.error = message.error;
    console.error(`❌ ${test.name} failed:`, message.error.message || message.error);
  } else if (!message.result || !message.result.content || message.result.content.length === 0) {
    entry.success = false;
    entry.error = { message: 'Empty result content' };
    console.warn(`⚠️ ${test.name} returned empty content.`);
  } else {
    const content = message.result.content[0];
    if (content.type === 'text') {
      try {
        const parsed = JSON.parse(content.text);
        entry.dataPreview = Array.isArray(parsed)
          ? parsed.slice(0, 3)
          : typeof parsed === 'object'
          ? Object.fromEntries(Object.entries(parsed).slice(0, 5))
          : parsed;
        entry.success = true;
        console.log(`✅ ${test.name} succeeded. Preview:`, entry.dataPreview);
      } catch (error) {
        entry.success = true;
        entry.dataPreview = content.text.slice(0, 200);
        console.log(`✅ ${test.name} succeeded (non-JSON response). Preview:`, entry.dataPreview);
      }
    } else {
      entry.success = true;
      entry.dataPreview = content;
      console.log(`✅ ${test.name} succeeded with non-text content.`);
    }
  }

  runNextTest();
}

function printSummary() {
  console.log('\n=== Historic Tool Test Summary ===');
  summary.forEach((entry, idx) => {
    const status = entry.success ? 'PASS' : 'FAIL';
    console.log(`\n${idx + 1}. ${entry.name} – ${status}`);
    console.log(`   ${entry.description}`);
    if (entry.success) {
      console.log('   Data preview:', entry.dataPreview);
    } else if (entry.error) {
      console.log('   Error:', entry.error);
    }
  });
}

server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;

    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      console.warn('⚠️ Non-JSON output from server:', line);
      continue;
    }

    if (message.id === 0 || message.method === 'notifications/initialized') {
      continue;
    }

    if (!initialized && message.id && message.result) {
      handleInitializeResult(message);
      continue;
    }

    if (message.id) {
      handleToolResult(message);
    }
  }
});

server.on('exit', (code) => {
  if (code !== null && code !== 0) {
    console.error(`
❌ MCP server exited with code ${code}`);
    process.exit(code);
  }
});

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Shutting down...');
  printSummary();
  server.kill();
  process.exit(0);
});

process.on('exit', () => {
  printSummary();
});

sendInitialize();

