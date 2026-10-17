import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createBuildMetadata, writeBuildMetadata } from './write-build-metadata.mjs';

const declaredInterface = {
  VITE_API_BASE_URL: 'https://api.beta.anywear.example',
  VITE_COGNITO_USER_POOL_ID: 'ap-east-1_AbCdEfGhI',
  VITE_COGNITO_CLIENT_ID: 'abcdefghijklmnopqrstuvwxyz',
};

test('creates reviewable Client build identity metadata with the compiled interface', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anywear-client-metadata-'));
  const outputPath = join(directory, 'build-metadata.json');

  try {
    const metadata = await writeBuildMetadata(
      outputPath,
      { SOURCE_COMMIT_SHA: 'a'.repeat(40), ...declaredInterface },
      new Date('2026-08-03T00:00:00.000Z'),
    );

    assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), metadata);
    assert.equal(metadata.source_commit, 'a'.repeat(40));
    assert.equal(metadata.schema_version, 2);
    assert.equal(metadata.component, 'AnyWear-Client');
    assert.deepEqual(metadata.interface, {
      api_base_url: declaredInterface.VITE_API_BASE_URL,
      cognito_user_pool_id: declaredInterface.VITE_COGNITO_USER_POOL_ID,
      cognito_client_id: declaredInterface.VITE_COGNITO_CLIENT_ID,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('keeps source_commit byte-compatible and the served file strict JSON', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anywear-client-metadata-'));
  const outputPath = join(directory, 'build-metadata.json');

  try {
    await writeBuildMetadata(outputPath, { GITHUB_SHA: 'b'.repeat(40), ...declaredInterface });
    const text = await readFile(outputPath, 'utf8');
    const parsed = JSON.parse(text);

    // A consumer reading only `source_commit` must see the same value and type
    // it saw in schema 1.
    assert.equal(parsed.source_commit, 'b'.repeat(40));
    assert.equal(typeof parsed.source_commit, 'string');
    // Strict JSON, and the file ends with one newline.
    assert.deepEqual(JSON.parse(text), parsed);
    assert.ok(text.endsWith('}\n'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects mutable or abbreviated source references', () => {
  assert.throws(
    () => createBuildMetadata({ SOURCE_COMMIT_SHA: 'main', ...declaredInterface }),
    /full lowercase 40-character commit SHA/,
  );
  assert.throws(
    () => createBuildMetadata({ SOURCE_COMMIT_SHA: 'abc1234', ...declaredInterface }),
    /full lowercase 40-character commit SHA/,
  );
});

test('rejects missing or malformed declared interface values', () => {
  for (const [key, value] of [
    ['VITE_API_BASE_URL', undefined],
    ['VITE_API_BASE_URL', ''],
    ['VITE_API_BASE_URL', 'api.beta.anywear.example'],
    ['VITE_API_BASE_URL', 'http://api.beta.anywear.example'],
    ['VITE_API_BASE_URL', 'https://'],
    ['VITE_API_BASE_URL', 'https://api beta anywear'],
    ['VITE_COGNITO_USER_POOL_ID', undefined],
    ['VITE_COGNITO_USER_POOL_ID', ''],
    ['VITE_COGNITO_USER_POOL_ID', 'ap-east-1'],
    ['VITE_COGNITO_USER_POOL_ID', 'AP-EAST-1_AbCdEfGhI'],
    ['VITE_COGNITO_USER_POOL_ID', 'ap-east-1_'],
    ['VITE_COGNITO_CLIENT_ID', undefined],
    ['VITE_COGNITO_CLIENT_ID', ''],
    ['VITE_COGNITO_CLIENT_ID', 'abcdefghijklmnopqrstuvwxy'],
    ['VITE_COGNITO_CLIENT_ID', 'abcdefghijklmnopqrstuvwxyz1'],
    ['VITE_COGNITO_CLIENT_ID', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'],
  ]) {
    assert.throws(
      () => createBuildMetadata({ SOURCE_COMMIT_SHA: 'a'.repeat(40), ...declaredInterface, [key]: value }),
      new RegExp(`${key} must be`),
      `expected \`${key}=${value === undefined ? 'undefined' : value}\` to be rejected`,
    );
  }

  for (const key of Object.keys(declaredInterface)) {
    const environment = { SOURCE_COMMIT_SHA: 'a'.repeat(40), ...declaredInterface };
    delete environment[key];
    assert.throws(
      () => createBuildMetadata(environment),
      new RegExp(`${key} must be`),
      `expected a build without ${key} to be rejected`,
    );
  }
});
