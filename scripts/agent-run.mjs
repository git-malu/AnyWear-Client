/**
 * Agent-Driven Test Harness — communicates with Playwright MCP via JSON-RPC over stdio.
 *
 * Usage: node scripts/agent-run.mjs
 *
 * Spawns @playwright/mcp server, sends tool calls, verifies behavior.
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

const BASE_URL = 'http://localhost:1420';
const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';

let msgId = 1;
let passed = 0;
let failed = 0;
let pendingResolve = null;
let pendingId = null;
let lineQueue = [];
let rl;

function ok(msg)  { console.log(`  ${PASS} ${msg}`); passed++; }
function fail(msg) { console.log(`  ${FAIL} ${msg}`); failed++; }

function onLine(line) {
  try {
    const data = JSON.parse(line.trim());
    if (pendingResolve && data.id === pendingId) {
      pendingResolve(data);
      pendingResolve = null;
      pendingId = null;
    } else {
      lineQueue.push(data);
    }
  } catch {}
}

function rpc(method, params = {}) {
  const id = msgId++;
  const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
  server.stdin.write(msg + '\n');
  return new Promise((resolve, reject) => {
    // Check queue first
    for (let i = 0; i < lineQueue.length; i++) {
      if (lineQueue[i].id === id) {
        resolve(lineQueue.splice(i, 1)[0]);
        return;
      }
    }
    pendingId = id;
    pendingResolve = resolve;
    setTimeout(() => {
      if (pendingResolve) {
        pendingResolve = null;
        pendingId = null;
        reject(new Error(`Timeout waiting for response to ${method}`));
      }
    }, 15000);
  });
}

let server;

async function main() {
  console.log('Agent-Driven Test — Playwright MCP (JSON-RPC)\n');

  // 1. Start MCP server
  console.log('[1] Starting Playwright MCP server...');
  server = spawn('npx', ['@playwright/mcp', '--browser', 'chromium', '--headless', '--isolated'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });

  rl = createInterface({ input: server.stdout });
  rl.on('line', onLine);

  server.stderr.on('data', (d) => {
    const txt = d.toString().trim();
    if (txt) console.log(`  [mcp] ${txt}`);
  });

  server.on('error', (err) => console.error('Server error:', err.message));
  server.on('close', (code) => console.log(`  [mcp] Server exited with code ${code}`));

  // Wait for server to start
  await new Promise(r => setTimeout(r, 3000));

  // 2. Initialize
  console.log('\n[2] Initializing MCP session...');
  try {
    const initResp = await rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'anywear-agent', version: '1.0' }
    });
    if (initResp.result && initResp.result.protocolVersion) {
      ok(`MCP session initialized (protocol ${initResp.result.protocolVersion})`);
      ok(`Server: ${initResp.result.serverInfo?.name} v${initResp.result.serverInfo?.version}`);
    } else {
      fail('Initialize response unexpected: ' + JSON.stringify(initResp).substring(0, 200));
    }
  } catch (e) {
    fail('MCP initialize failed: ' + e.message);
    server.kill();
    process.exit(1);
  }

  // Send initialized notification
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  await new Promise(r => setTimeout(r, 1000));

  // 3. List tools
  console.log('\n[3] Discovering tools...');
  const toolsResp = await rpc('tools/list');
  const tools = toolsResp?.result?.tools || [];
  ok(`Discovered ${tools.length} tools`);
  const toolNames = tools.map(t => t.name);
  console.log(`    ${toolNames.join(', ')}`);

  // 4. Navigate to login page
  console.log('\n[4] Navigate to /login');
  const navResp = await rpc('tools/call', {
    name: 'browser_navigate',
    arguments: { url: `${BASE_URL}/login` }
  });
  if (!navResp.result?.isError) ok('Navigated to /login');
  else fail('Navigation failed');

  await new Promise(r => setTimeout(r, 2000));

  // 5. Take ARIA snapshot
  console.log('\n[5] ARIA snapshot');
  const snapResp = await rpc('tools/call', {
    name: 'browser_snapshot',
    arguments: {}
  });
  const content = snapResp?.result?.content;
  if (content && !snapResp.result.isError) {
    const text = content.map(c => c.text).join('\n');
    ok('ARIA snapshot captured');
    // Show a snippet
    const snippet = text.substring(0, 1200);
    console.log(`    Snapshot (first 1200 chars):\n    ${snippet.replace(/\n/g, '\n    ')}`);

    // Verify expected elements
    if (text.toLowerCase().includes('email')) ok('Email field present');
    else fail('Email field not found');

    if (text.toLowerCase().includes('password')) ok('Password field present');
    else fail('Password field not found');

    if (text.toLowerCase().includes('sign in')) ok('Sign-in button present');
    else fail('Sign-in button not found');
  } else {
    fail('ARIA snapshot failed');
  }

  // 6. Check console
  console.log('\n[6] Console messages');
  const consoleResp = await rpc('tools/call', {
    name: 'browser_console_messages',
    arguments: {}
  });
  const consoleContent = consoleResp?.result?.content;
  if (consoleContent) {
    const consoleText = consoleContent.map(c => c.text).join('\n');
    const hasRealError = /Error:/.test(consoleText) && !/Errors: 0/.test(consoleText);
    if (hasRealError) {
      fail('Console errors detected');
      console.log(`    ${consoleText.substring(0, 500)}`);
    } else if (consoleText.includes('Errors: 0') || consoleText.includes('Errors:0')) {
      ok('No console errors (0 errors)');
    } else {
      ok('No error-level console messages');
    }
  }

  // 7. Screenshot
  console.log('\n[7] Screenshot');
  const ssResp = await rpc('tools/call', {
    name: 'browser_take_screenshot',
    arguments: { format: 'png', fullPage: false }
  });
  if (ssResp?.result?.content?.[0]?.data) {
    ok('Screenshot captured (inline)');
  } else if (ssResp?.result?.content?.[0]?.text?.includes('Screenshot')) {
    ok('Screenshot captured (saved to file)');
  } else if (ssResp?.result?.isError) {
    const errText = ssResp.result.content?.map(c => c.text).join('\n') || JSON.stringify(ssResp.result);
    fail('Screenshot failed: ' + errText.substring(0, 200));
  } else {
    fail('Screenshot failed: unexpected: ' + JSON.stringify(ssResp?.result).substring(0, 200));
  }

  // 8. Close
  console.log('\n[8] Closing browser...');
  await rpc('tools/call', { name: 'browser_close', arguments: {} }).catch(() => {});
  server.kill();

  // Summary
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('Some agent-driven tests failed.');
    process.exit(1);
  } else {
    console.log('All agent-driven tests passed.');
  }
}

main().catch(err => {
  console.error('Agent harness crashed:', err.message);
  if (server) server.kill();
  process.exit(1);
});
