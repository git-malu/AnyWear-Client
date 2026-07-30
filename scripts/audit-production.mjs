import { spawnSync } from 'node:child_process';

const advisoryId = 'GHSA-qwww-vcr4-c8h2';
const expiresOn = '2026-10-28';
const expiresAt = Date.parse(`${expiresOn}T23:59:59Z`);

if (Date.now() > expiresAt) {
  console.error(`Security exception ${advisoryId} expired on ${expiresOn}. Upgrade React Router or renew the review.`);
  process.exit(1);
}

const isWindows = process.platform === 'win32';
const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm';
const args = isWindows
  ? ['/d', '/s', '/c', `pnpm audit --prod --audit-level low --ignore ${advisoryId}`]
  : ['audit', '--prod', '--audit-level', 'low', '--ignore', advisoryId];
const result = spawnSync(
  command,
  args,
  { stdio: 'inherit' },
);

if (result.error) {
  console.error('Unable to run pnpm audit:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
