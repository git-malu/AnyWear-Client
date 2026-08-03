import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const commitPattern = /^[0-9a-f]{40}$/;

export function createBuildMetadata(environment = process.env, now = new Date()) {
  const sourceCommit = environment.SOURCE_COMMIT_SHA ?? environment.GITHUB_SHA ?? 'local';
  if (sourceCommit !== 'local' && !commitPattern.test(sourceCommit)) {
    throw new Error('SOURCE_COMMIT_SHA/GITHUB_SHA must be a full lowercase 40-character commit SHA');
  }

  return {
    schema_version: 1,
    component: 'AnyWear-Client',
    source_commit: sourceCommit,
    built_at: now.toISOString(),
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
