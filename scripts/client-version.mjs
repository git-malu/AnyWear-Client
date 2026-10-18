// The Client's version identity, read from the repository root.
//
// `client-version.json` is the single source of truth: Vite compiles
// `client_version` into `__CLIENT_VERSION__`, `pnpm build` records it in
// `dist/build-metadata.json`, and the monotonicity check compares it across
// revisions. A missing or malformed file fails the build and the checks instead
// of compiling a Client that cannot state which version it is.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The repository's client version file. */
export const CLIENT_VERSION_FILE = new URL('../client-version.json', import.meta.url);

/** The only supported shape of `client-version.json`. */
export const CLIENT_VERSION_SCHEMA_VERSION = 1;

export class ClientVersionError extends Error {}

/** Validates one decoded `client-version.json` document and returns its version. */
export function parseClientVersion(source) {
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new ClientVersionError('client-version.json must be valid JSON');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ClientVersionError('client-version.json must contain a JSON object');
  }
  if (parsed.schema_version !== CLIENT_VERSION_SCHEMA_VERSION) {
    throw new ClientVersionError(
      `client-version.json schema_version must be ${CLIENT_VERSION_SCHEMA_VERSION}`,
    );
  }
  if (typeof parsed.client_version !== 'number'
    || !Number.isSafeInteger(parsed.client_version)
    || parsed.client_version < 0) {
    throw new ClientVersionError('client-version.json client_version must be a non-negative safe integer');
  }
  return parsed.client_version;
}

/** Reads and validates a `client-version.json`; a missing or malformed file throws. */
export function readClientVersion(file = CLIENT_VERSION_FILE) {
  const location = file instanceof URL ? fileURLToPath(file) : file;
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    throw new ClientVersionError(`client-version.json is missing or unreadable at ${location}`);
  }
  return parseClientVersion(source);
}
