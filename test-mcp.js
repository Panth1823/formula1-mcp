#!/usr/bin/env node

/**
 * Simple test script to verify MCP server is working
 * This sends an initialize request and lists available tools
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, 'build', 'index.js');

console.log('Testing MCP Server...\n');
console.log('Server path:', serverPath);
console.log('---\n');

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let buffer = '';

server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        console.log('📨 Received:', JSON.stringify(message, null, 2));
        
        // If we got initialize result, send list_tools request
        if (message.id === 1 && message.result) {
          console.log('\n✅ Server initialized successfully!\n');
          console.log('Sending list_tools request...\n');
          
          const listToolsRequest = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {}
          };
          
          server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
        }
        
        // If we got tools list, we're done
        if (message.id === 2 && message.result) {
          console.log('✅ Tools listed successfully!\n');
          console.log(`Found ${message.result.tools?.length || 0} tools:`);
          if (message.result.tools) {
            message.result.tools.forEach((tool, i) => {
              console.log(`  ${i + 1}. ${tool.name}`);
            });
          }
          console.log('\n✅ MCP Server is working correctly!');
          server.kill();
          process.exit(0);
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

// Timeout after 10 seconds
setTimeout(() => {
  console.error('\n❌ Test timeout - server did not respond');
  server.kill();
  process.exit(1);
}, 10000);

