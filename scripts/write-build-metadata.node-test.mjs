import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createBuildMetadata, writeBuildMetadata } from './write-build-metadata.mjs';

test('creates reviewable Client build identity metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anywear-client-metadata-'));
  const outputPath = join(directory, 'build-metadata.json');

  try {
    const metadata = await writeBuildMetadata(
      outputPath,
      { SOURCE_COMMIT_SHA: 'a'.repeat(40) },
      new Date('2026-08-03T00:00:00.000Z'),
    );

    assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), metadata);
    assert.equal(metadata.source_commit, 'a'.repeat(40));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects mutable or abbreviated source references', () => {
  assert.throws(
    () => createBuildMetadata({ SOURCE_COMMIT_SHA: 'main' }),
    /full lowercase 40-character commit SHA/,
  );
});
