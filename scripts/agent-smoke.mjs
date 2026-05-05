/**
 * Agent smoke test — verifies the Playwright MCP testing pipeline is ready.
 *
 * Run: node scripts/agent-smoke.mjs
 *
 * Checks:
 *   1. Vite dev server is responsive at localhost:1420
 *   2. Required environment variables are set
 *
 * Exit code 0 = all checks pass, ready for agent-driven testing.
 * Exit code 1 = one or more checks failed.
 */

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:1420';

const requiredEnvVars = [
  'VITE_COGNITO_USER_POOL_ID',
  'VITE_COGNITO_CLIENT_ID',
];

const optionalEnvVars = [
  'VITE_API_BASE_URL',
  'VITE_COGNITO_IDENTITY_POOL_ID',
];

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✓ ${label}`);
  passed++;
}

function fail(label, detail) {
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  failed++;
}

async function checkDevServer() {
  console.log(`[1] Vite Dev Server (${DEV_SERVER_URL})`);
  try {
    const res = await fetch(DEV_SERVER_URL, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      ok(`Dev server responded with status ${res.status}`);
    } else {
      fail(`Dev server responded with status ${res.status}`, 'expected 2xx');
    }
  } catch (err) {
    fail('Dev server unreachable', err.message);
    console.log(`    Hint: Run "pnpm dev" in AnyWear-Client first.`);
  }
}

function checkEnvVars() {
  console.log('[2] Environment Variables');

  for (const key of requiredEnvVars) {
    if (process.env[key]) {
      ok(`${key} = ${process.env[key].substring(0, 8)}...`);
    } else {
      fail(`${key} is not set`, 'required for Cognito auth');
    }
  }

  for (const key of optionalEnvVars) {
    if (process.env[key]) {
      ok(`${key} = ${process.env[key]}`);
    } else {
      console.log(`  - ${key} (optional, not set)`);
    }
  }
}

async function main() {
  console.log('Agent Smoke Test — Playwright MCP Pipeline Verification\n');

  await checkDevServer();
  console.log('');
  checkEnvVars();

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('Pipeline ready. Agent can launch Playwright MCP and begin testing.');
    process.exit(0);
  } else {
    console.log('Pipeline not ready. Fix the failed checks above before testing.');
    process.exit(1);
  }
}

main();
