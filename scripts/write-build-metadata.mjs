import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readBuildInterface } from './build-interface.mjs';

const commitPattern = /^[0-9a-f]{40}$/;

export function createBuildMetadata(environment = process.env, now = new Date()) {
  const sourceCommit = environment.SOURCE_COMMIT_SHA ?? environment.GITHUB_SHA ?? 'local';
  if (sourceCommit !== 'local' && !commitPattern.test(sourceCommit)) {
    throw new Error('SOURCE_COMMIT_SHA/GITHUB_SHA must be a full lowercase 40-character commit SHA');
  }

  return {
    // Schema 2 adds the declared interface values. `source_commit` keeps its
    // exact schema-1 meaning and value, because consumers such as AnyWear-E2E
    // read it from the served file.
    schema_version: 2,
    component: 'AnyWear-Client',
    source_commit: sourceCommit,
    built_at: now.toISOString(),
    interface: readBuildInterface(environment),
  };
}

export async function writeBuildMetadata(outputPath, environment = process.env, now = new Date()) {
  const metadata = createBuildMetadata(environment, now);
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
