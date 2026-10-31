import { spawnSync } from 'node:child_process';

// Dated production-dependency security exception.
//
// The advisory GHSA-qwww-vcr4-c8h2 ("React Router: RSC Mode CSRF Bypass Allows
// Action Execution Before 400 Response") lists two vulnerable ranges:
// react-router `>= 7.12.0, < 7.18.2` and `>= 8.0.0, < 8.3.0`. This project
// installs react-router-dom 7.18.2, whose react-router is 7.18.2 — outside both
// ranges — and `pnpm audit --prod --audit-level low` no longer reports the
// advisory, so the `--ignore` below is inert. This is a stale-review renewal
// for a non-applicable advisory, not the suppression of an applicable one.
//
// The mechanism is kept because this repository may suppress a production
// advisory only through a dated, reviewed exception: the date gate forces the
// next review instead of letting an ignore list silently live forever. Renew or
// remove it at the next review; do not extend it without re-checking the
// installed version and the current advisory metadata.
//
// Reviewed 2026-10-31 for issue #232 (user decision 2026-10-31). Next review
// due 2026-11-30. Owner: AnyWear-Client maintainers.
const advisoryId = 'GHSA-qwww-vcr4-c8h2';
const expiresOn = '2026-11-30';
const expiresAt = Date.parse(`${expiresOn}T23:59:59Z`);

if (Date.now() > expiresAt) {
  console.error(`Security exception ${advisoryId} expired on ${expiresOn}. Re-check the installed React Router against the advisory, then renew or remove the exception.`);
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
