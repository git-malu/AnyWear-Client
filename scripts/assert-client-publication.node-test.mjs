import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertClientPublication } from '../.github/scripts/assert-client-publication.mjs';

const source = 'a'.repeat(40);
const environment = {
  BETA_DEPLOY_ENABLED: 'true',
  GITHUB_REPOSITORY: 'git-malu/AnyWear-Client',
  GITHUB_REPOSITORY_ID: '1176104200',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_WORKFLOW_REF: 'git-malu/AnyWear-Client/.github/workflows/beta-deploy.yml@refs/heads/main',
  GITHUB_SHA: source,
  GITHUB_WORKFLOW_SHA: source,
  AWS_ACCOUNT_ID: '650880818323',
  AWS_REGION: 'ap-east-1',
  CLIENT_PUBLISH_ROLE_ARN: 'arn:aws:iam::650880818323:role/beta-client-publish-role',
  GITHUB_RUN_ID: '123',
  GITHUB_RUN_ATTEMPT: '1',
};
const metadata = { schema_version: 1, component: 'AnyWear-Client', source_commit: source };

test('ordinary Client publication needs no migration window or issue-comment inputs', () => {
  assert.doesNotThrow(() => assertClientPublication(environment, 'preflight'));
  assert.doesNotThrow(() => assertClientPublication(environment, 'publish', metadata));
});

test('rejects an untrusted source, disabled publisher or wrong AWS scope', async (t) => {
  const invalidInputs = [
    ['BETA_DEPLOY_ENABLED', 'false'],
    ['GITHUB_REPOSITORY', 'other/AnyWear-Client'],
    ['GITHUB_REPOSITORY_ID', '123'],
    ['GITHUB_REF', 'refs/heads/feature'],
    ['GITHUB_EVENT_NAME', 'pull_request'],
    ['GITHUB_WORKFLOW_REF', 'git-malu/AnyWear-Client/.github/workflows/other.yml@refs/heads/main'],
    ['GITHUB_SHA', 'main'],
    ['GITHUB_WORKFLOW_SHA', 'b'.repeat(40)],
    ['AWS_ACCOUNT_ID', '123456789012'],
    ['AWS_REGION', 'us-east-1'],
    ['CLIENT_PUBLISH_ROLE_ARN', 'arn:aws:iam::650880818323:role/beta-github-actions-pipeline-role'],
    ['CLIENT_PUBLISH_ROLE_ARN', ''],
    ['GITHUB_RUN_ID', ''],
    ['GITHUB_RUN_ATTEMPT', '0'],
  ];
  for (const [key, value] of invalidInputs) {
    await t.test(`${key}=${value}`, () => {
      assert.throws(() => assertClientPublication({ ...environment, [key]: value }, 'preflight'));
    });
  }
});

test('rejects missing, malformed or different built Client identity before publication', () => {
  for (const input of [undefined, null, {}, { ...metadata, source_commit: 'b'.repeat(40) },
    { ...metadata, source_commit: 'local' }, { ...metadata, schema_version: 2 },
    { ...metadata, component: 'AnyWear-Service' }]) {
    assert.throws(() => assertClientPublication(environment, 'publish', input), /Built Client metadata/);
  }
  assert.throws(() => assertClientPublication(environment, 'unknown'), /Unknown publication/);
});

test('workflow CLI reads actual build metadata and fails before publication when unavailable or invalid', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anywear-client-publication-'));
  const script = join(directory, '.github', 'scripts', 'assert-client-publication.mjs');
  const output = join(directory, 'dist', 'build-metadata.json');
  try {
    await mkdir(join(directory, '.github', 'scripts'), { recursive: true });
    await mkdir(join(directory, 'dist'));
    await copyFile(new URL('../.github/scripts/assert-client-publication.mjs', import.meta.url), script);
    const run = (phase) => spawnSync(process.execPath, [script, phase], {
      env: { ...process.env, ...environment, GITHUB_STEP_SUMMARY: '' }, encoding: 'utf8',
    });
    assert.equal(run('preflight').status, 0);
    assert.equal(run('publish').status, 1);
    await writeFile(output, '{invalid json');
    assert.equal(run('publish').status, 1);
    await writeFile(output, JSON.stringify({ ...metadata, source_commit: 'b'.repeat(40) }));
    assert.equal(run('publish').status, 1);
    await writeFile(output, JSON.stringify(metadata));
    assert.equal(run('publish').status, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
