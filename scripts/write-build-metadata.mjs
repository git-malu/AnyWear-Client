import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readBuildInterface } from './build-interface.mjs';
import { readClientVersion } from './client-version.mjs';

const commitPattern = /^[0-9a-f]{40}$/;

/**
 * The build identity recorded for `dist/build-metadata.json`.
 *
 * `readVersion` is injectable so the metadata contract can be tested against a
 * missing or malformed `client-version.json` without writing into the repository.
 */
export function createBuildMetadata(
  environment = process.env,
  now = new Date(),
  readVersion = readClientVersion,
) {
  const sourceCommit = environment.SOURCE_COMMIT_SHA ?? environment.GITHUB_SHA ?? 'local';
  if (sourceCommit !== 'local' && !commitPattern.test(sourceCommit)) {
    throw new Error('SOURCE_COMMIT_SHA/GITHUB_SHA must be a full lowercase 40-character commit SHA');
  }

  return {
    // Schema 3 adds the Client version identity. `source_commit` keeps its exact
    // schema-1 meaning and value, because consumers such as AnyWear-E2E read it
    // from the served file; schema 2 added the declared interface values.
    schema_version: 3,
    component: 'AnyWear-Client',
    source_commit: sourceCommit,
    built_at: now.toISOString(),
    client_version: readVersion(),
    interface: readBuildInterface(environment),
  };
}

export async function writeBuildMetadata(
  outputPath,
  environment = process.env,
  now = new Date(),
  readVersion = readClientVersion,
) {
  const metadata = createBuildMetadata(environment, now, readVersion);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  return metadata;
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  await writeBuildMetadata(resolve(repositoryRoot, 'dist', 'build-metadata.json'));
}
