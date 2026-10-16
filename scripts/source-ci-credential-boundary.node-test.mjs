// Offline scope, permission and secret tests for the Client source-CI credential
// boundary. Every case but the first is a negative: the checked-in workflows must
// pass, and each way of widening the checkout credential must be rejected with a
// message naming the file and line.
//
// Run with `pnpm run test:run`, which includes this file in its `node --test` list.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  parseGitmodules,
  parseWorkflow,
  readSubmoduleRevision,
  sourceCiCredentialBoundary,
  sourceCiCredentialBoundaryWith,
  specificationRepositorySlug,
  validateSourceCiCredentialBoundary,
} from './source-ci-credential-boundary.mjs';

const repositoryRoot = new URL('../', import.meta.url);
const workflowsDirectory = new URL('.github/workflows/', repositoryRoot);
const gitmodulesPath = new URL('.gitmodules', repositoryRoot);
const workflowFiles = ['build.yml', 'test.yml', 'browser.yml', 'pipeline.yml', 'beta-deploy.yml'];
const tokenAction = `${sourceCiCredentialBoundary.tokenAction.repository}@${sourceCiCredentialBoundary.tokenAction.ref}`;

// The revision the specification checkout must pin, read from the `api` submodule's
// own checkout rather than from a literal a submodule bump can leave behind.
let cachedRevision;
async function specificationGitlink() {
  cachedRevision ??= readSubmoduleRevision(repositoryRoot, sourceCiCredentialBoundary.specificationPath);
  return cachedRevision;
}

/** The checked-in workflows, parsed fresh so one case cannot leak state into another. */
async function repositoryWorkflows() {
  const documents = [];
  for (const file of workflowFiles) {
    documents.push(parseWorkflow(await readFile(new URL(file, workflowsDirectory), 'utf8'), file));
  }
  return {
    documents,
    submoduleRepositories: parseGitmodules(await readFile(gitmodulesPath, 'utf8')),
    specificationRevision: await specificationGitlink(),
  };
}

/** Fails with the validator's own messages when a workflow leaves the boundary. */
function assertWithinBoundary(workflows) {
  assert.deepEqual(validateSourceCiCredentialBoundary(workflows), []);
}

function documentOf(documents, file) {
  const document = documents.find((candidate) => candidate.workflow.file === file);
  assert.ok(document, `expected a parsed ${file}`);
  return document;
}

function tokenStepOf(documents, file) {
  const step = documentOf(documents, file).steps.find((candidate) => candidate.uses.startsWith('actions/create-github-app-token@'));
  assert.ok(step, `expected an App-token step in ${file}`);
  return step;
}

function specificationCheckoutOf(documents, file) {
  const step = documentOf(documents, file).steps.find((candidate) => candidate.uses === 'actions/checkout@v4' && candidate.with?.has('repository'));
  assert.ok(step, `expected a specification checkout in ${file}`);
  return step;
}

function clientCheckoutOf(documents, file) {
  const step = documentOf(documents, file).steps.find((candidate) => candidate.uses === 'actions/checkout@v4' && !candidate.with?.has('repository'));
  assert.ok(step, `expected a Client checkout in ${file}`);
  return step;
}

test('checked-in Client source workflows stay inside the credential boundary', async () => {
  assertWithinBoundary(await repositoryWorkflows());
});

test('exactly one App-token step reaches exactly one repository', async () => {
  const { documents, specificationRevision } = await repositoryWorkflows();
  const steps = documents.flatMap((document) => document.steps);
  const tokenSteps = steps.filter((step) => step.uses.startsWith('actions/create-github-app-token@'));
  const specificationCheckouts = steps.filter((step) => step.uses === 'actions/checkout@v4' && step.with?.has('repository'));

  assert.equal(tokenSteps.length, 1, 'one credential-bearing step, in the one job that reads the specification');
  assert.equal(tokenSteps[0].file, 'build.yml');
  assert.equal(tokenSteps[0].job, sourceCiCredentialBoundary.secretCallerJob);
  assert.deepEqual(Object.fromEntries(tokenSteps[0].with), sourceCiCredentialBoundaryWith);
  assert.equal(tokenSteps[0].uses, tokenAction);

  assert.equal(specificationCheckouts.length, 1);
  const checkout = specificationCheckouts[0];
  assert.equal(checkout.file, 'build.yml');
  assert.equal(checkout.job, sourceCiCredentialBoundary.secretCallerJob);
  assert.equal(checkout.with.get('repository'), specificationRepositorySlug('git-malu'));
  assert.equal(checkout.with.get('ref'), specificationRevision);
  assert.equal(checkout.with.get('path'), sourceCiCredentialBoundary.specificationPath);
  assert.equal(checkout.with.get('token'), `\${{ steps.${tokenSteps[0].id}.outputs.token }}`);
  assert.equal(checkout.with.get('persist-credentials'), 'false');
});

test('every job that does not read the specification holds no credential', async () => {
  const { documents } = await repositoryWorkflows();
  const jobsWithToken = new Set(documents
    .flatMap((document) => document.steps)
    .filter((step) => step.uses.startsWith('actions/create-github-app-token@'))
    .map((step) => `${step.file}:${step.job}`));
  assert.deepEqual([...jobsWithToken], ['build.yml:build']);
  for (const [file, job] of [['build.yml', 'rust-check'], ['test.yml', 'test'], ['browser.yml', 'browser']]) {
    const document = documentOf(documents, file);
    for (const step of document.steps.filter((candidate) => candidate.job === job)) {
      for (const value of step.with?.values() ?? []) {
        assert.doesNotMatch(value, /secrets\./, `${file}:${step.number} must not read a secret`);
      }
      assert.equal(step.with?.has('submodules') ?? false, false, `${file}:${step.number} must not fetch submodules`);
    }
  }
});

test('rejects an App-token action that is not pinned to an immutable commit', async () => {
  for (const uses of [
    'actions/create-github-app-token@v1',
    'actions/create-github-app-token@v2',
    'actions/create-github-app-token@main',
    `${tokenAction} # v2.2.2`,
    'actions/create-github-app-token@fee1f7d',
  ]) {
    const workflows = await repositoryWorkflows();
    tokenStepOf(workflows.documents, 'build.yml').uses = uses;
    assert.throws(
      () => assertWithinBoundary(workflows),
      /build\.yml:31 App-token step must be pinned to actions\/create-github-app-token@fee1f7d/,
      `expected ${uses} to be rejected`,
    );
  }
});

test('rejects an allowlist that names any repository but the specification', async () => {
  const cases = [
    ['AnyWear-Client,AnyWear-Service-API', /requests `AnyWear-Client`; the allowlist is exactly `AnyWear-Service-API`/],
    ['git-malu/AnyWear-Service-API', /requests `git-malu\/AnyWear-Service-API`; the allowlist is exactly `AnyWear-Service-API`/],
    ['AnyWear-Service-API,AnyWear-Service', /requests `AnyWear-Service`; the allowlist is exactly `AnyWear-Service-API`/],
  ];
  for (const [repositories, expected] of cases) {
    const workflows = await repositoryWorkflows();
    tokenStepOf(workflows.documents, 'build.yml').with.set('repositories', repositories);
    assert.throws(() => assertWithinBoundary(workflows), expected, `expected \`repositories: ${repositories}\` to be rejected`);
  }
});

test('rejects an App-token step that drops the allowlist entirely', async () => {
  const workflows = await repositoryWorkflows();
  tokenStepOf(workflows.documents, 'build.yml').with.delete('repositories');
  assert.throws(
    () => assertWithinBoundary(workflows),
    /build\.yml:31 App-token step must set `repositories: AnyWear-Service-API`, found nothing/,
  );
});

test('rejects every permission beyond a Contents read', async () => {
  for (const [key, value, expected] of [
    ['permission-contents', 'write', /must request `permission-contents: read`, found `permission-contents: write`/],
    ['permission-actions', 'read', /passes `permission-actions`, which is not one of the boundary inputs/],
    ['permission-attestations', 'read', /must request only `permission-contents`, found permission-contents, permission-attestations/],
    ['permission-metadata', 'read', /must request only `permission-contents`, found permission-contents, permission-metadata/],
    ['permission-pull-requests', 'write', /must request only `permission-contents`, found permission-contents, permission-pull-requests/],
    ['permission-workflows', 'write', /must request only `permission-contents`, found permission-contents, permission-workflows/],
  ]) {
    const workflows = await repositoryWorkflows();
    tokenStepOf(workflows.documents, 'build.yml').with.set(key, value);
    assert.throws(() => assertWithinBoundary(workflows), expected, `expected \`${key}: ${value}\` to be rejected`);
  }

  const workflows = await repositoryWorkflows();
  tokenStepOf(workflows.documents, 'build.yml').with.delete('permission-contents');
  assert.throws(
    () => assertWithinBoundary(workflows),
    /build\.yml:31 App-token step must request only `permission-contents`, found no permission input/,
  );
});

test('rejects a substituted App ID or a secret outside the boundary on a token step', async () => {
  for (const [key, value, expected] of [
    ['app-id', '${{ secrets.APP_ID }}', /App ID must not be read from a secret, found `secrets.APP_ID`/],
    ['app-id', '${{ vars.OTHER_APP_ID }}', /App ID must come from `vars.APP_ID`, found `vars.OTHER_APP_ID`/],
    ['private-key', '${{ secrets.SOME_OTHER_TOKEN }}', /must set `private-key: \$\{\{ secrets\.APP_PRIVATE_KEY \}\}`/],
    ['skip-token-revoke', 'true', /passes `skip-token-revoke`, which is not one of the boundary inputs/],
  ]) {
    const workflows = await repositoryWorkflows();
    tokenStepOf(workflows.documents, 'build.yml').with.set(key, value);
    assert.throws(() => assertWithinBoundary(workflows), expected, `expected \`${key}: ${value}\` to be rejected`);
  }
});

test('rejects a specification checkout that widens or loses its credential', async () => {
  for (const [mutate, expected] of [
    [(step) => step.with.set('token', '${{ secrets.GITHUB_TOKEN }}'), /must use a generated App token output, found `\$\{\{ secrets\.GITHUB_TOKEN \}\}`/],
    [(step) => step.with.delete('token'), /must use a generated App token output, found `nothing`/],
    [(step) => step.with.set('token', '${{ steps.other.outputs.token }}'), /no App-token step declares that id/],
    [(step) => step.with.set('persist-credentials', 'true'), /must set `persist-credentials: false`/],
  ]) {
    const workflows = await repositoryWorkflows();
    mutate(specificationCheckoutOf(workflows.documents, 'build.yml'));
    assert.throws(() => assertWithinBoundary(workflows), expected);
  }
});

test('rejects a specification checkout that is not pinned to the recorded revision', async () => {
  const { specificationRevision } = await repositoryWorkflows();
  for (const [ref, expected] of [
    ['main', /must pin its revision by full commit, found `ref: main`/],
    [specificationRevision.slice(0, 7), new RegExp(`must pin its revision by full commit, found \`ref: ${specificationRevision.slice(0, 7)}\``)],
    ['0'.repeat(40), /pins `0{40}`, but the `api` submodule is checked out at/],
  ]) {
    const workflows = await repositoryWorkflows();
    specificationCheckoutOf(workflows.documents, 'build.yml').with.set('ref', ref);
    assert.throws(() => assertWithinBoundary(workflows), expected, `expected \`ref: ${ref}\` to be rejected`);
  }

  const workflows = await repositoryWorkflows();
  specificationCheckoutOf(workflows.documents, 'build.yml').with.delete('ref');
  assert.throws(() => assertWithinBoundary(workflows), /must pin its revision by full commit, found `ref: nothing`/);
});

test('rejects a specification checkout that drifts from the submodule it stands in for', async () => {
  // The workflow literal and the submodule pointer must agree; a bump to one alone
  // is what this catches, and neither value is a literal in this test.
  const { documents, submoduleRepositories } = await repositoryWorkflows();
  const bumped = '1'.repeat(40);
  const violations = validateSourceCiCredentialBoundary({ documents, submoduleRepositories, specificationRevision: bumped });
  assert.equal(violations.length, 1);
  assert.match(violations[0], new RegExp('build\\.yml:47 specification checkout pins `[0-9a-f]{40}`, but the `api` submodule is checked out at `1{40}`'));

  const initialized = await specificationGitlink();
  assert.match(initialized, /^[0-9a-f]{40}$/, 'the api submodule must be initialised for this suite to check the pin');
});

test('rejects a checkout of any repository other than the specification', async () => {
  const workflows = await repositoryWorkflows();
  specificationCheckoutOf(workflows.documents, 'build.yml').with.set('repository', 'git-malu/AnyWear-Service');
  assert.throws(
    () => assertWithinBoundary(workflows),
    /checkout fetches `git-malu\/AnyWear-Service`, which is not `git-malu\/AnyWear-Service-API`/,
  );
});

test('rejects a specification checkout that lands somewhere other than the submodule path', async () => {
  const workflows = await repositoryWorkflows();
  specificationCheckoutOf(workflows.documents, 'build.yml').with.set('path', 'spec');
  assert.throws(() => assertWithinBoundary(workflows), /must use `path: api`, found `path: spec`/);
});

test('rejects a Client checkout that takes a credential or fetches submodules', async () => {
  for (const [mutate, expected] of [
    [(step) => step.with.set('token', '${{ steps.generate-token.outputs.token }}'), /Client checkout must use the default credential/],
    [(step) => step.with.set('submodules', 'recursive'), /Client checkout must not fetch submodules; the specification checkout reads `git-malu\/AnyWear-Service-API` with the App token/],
    [(step) => step.with.set('path', 'spec'), /Client checkout must not set `path`/],
  ]) {
    const workflows = await repositoryWorkflows();
    mutate(clientCheckoutOf(workflows.documents, 'build.yml'));
    assert.throws(() => assertWithinBoundary(workflows), expected);
  }

  const workflows = await repositoryWorkflows();
  const rustCheckout = documentOf(workflows.documents, 'build.yml').steps
    .find((step) => step.job === 'rust-check' && step.uses === 'actions/checkout@v4');
  rustCheckout.with.set('submodules', 'true');
  assert.throws(
    () => assertWithinBoundary(workflows),
    /build\.yml:97 the Client checkout must not fetch submodules/,
    'a job that reads no repository content must not fetch submodules under any spelling',
  );
});

test('rejects a checkout that fetches repository content by submodules rather than the boundary checkout', async () => {
  const workflows = await repositoryWorkflows();
  documentOf(workflows.documents, 'test.yml').steps
    .find((step) => step.uses === 'actions/checkout@v4')
    .with.set('submodules', 'recursive');
  assert.throws(
    () => assertWithinBoundary(workflows),
    /test\.yml:19 the Client checkout must not fetch submodules; the specification checkout reads `git-malu\/AnyWear-Service-API` with the App token/,
  );
});

test('rejects a caller that inherits secrets, substitutes one, or maps one the callee does not declare', async () => {
  const cases = [
    ['inherit', /pipeline\.yml:15 job `build` must map the required secret explicitly instead of `secrets: inherit`/],
    ['substituted', /job `build` must pass `APP_PRIVATE_KEY: \$\{\{ secrets\.APP_PRIVATE_KEY \}\}`, found `APP_PRIVATE_KEY: \$\{\{ secrets.SOME_OTHER_TOKEN \}\}`/],
    ['wrong-key', /job `build` passes `OTHER_KEY`, which is outside the credential boundary/],
    ['unmapped', /job `build` does not receive `APP_PRIVATE_KEY`, but its called workflow declares it/],
    ['extra', /job `test` receives `APP_PRIVATE_KEY`, but its called workflow declares no secret/],
  ];
  for (const [variant, expected] of cases) {
    const workflows = await repositoryWorkflows();
    const callers = documentOf(workflows.documents, 'pipeline.yml').workflow.callers;
    const build = callers.find((caller) => caller.job === 'build');
    const unitTest = callers.find((caller) => caller.job === 'test');
    if (variant === 'inherit') {
      build.secretsInherit = true;
      build.mappedSecrets = [];
    } else if (variant === 'substituted') {
      build.mappedSecrets = [{ key: 'APP_PRIVATE_KEY', value: '${{ secrets.SOME_OTHER_TOKEN }}' }];
    } else if (variant === 'wrong-key') {
      build.mappedSecrets = [{ key: 'OTHER_KEY', value: '${{ secrets.APP_PRIVATE_KEY }}' }];
    } else if (variant === 'unmapped') {
      build.mappedSecrets = [];
    } else {
      unitTest.mappedSecrets = [{ key: 'APP_PRIVATE_KEY', value: '${{ secrets.APP_PRIVATE_KEY }}' }];
    }
    assert.throws(() => assertWithinBoundary(workflows), expected, `expected the \`${variant}\` caller to be rejected`);
  }
});

test('rejects a called workflow that stops declaring the required secret', async () => {
  const optional = await repositoryWorkflows();
  documentOf(optional.documents, 'build.yml').workflow.calls = [{ name: 'APP_PRIVATE_KEY', required: 'false', number: 7 }];
  assert.throws(
    () => assertWithinBoundary(optional),
    /build\.yml:7 called workflow must declare secret `APP_PRIVATE_KEY` as `required: true`/,
  );

  const substituted = await repositoryWorkflows();
  documentOf(substituted.documents, 'build.yml').workflow.calls = [{ name: 'GITHUB_TOKEN', required: 'true', number: 7 }];
  assert.throws(
    () => assertWithinBoundary(substituted),
    /build\.yml:7 called workflow must declare only `APP_PRIVATE_KEY`, found `GITHUB_TOKEN`/,
  );

  const emptied = await repositoryWorkflows();
  documentOf(emptied.documents, 'build.yml').workflow.calls = [];
  assert.throws(
    () => assertWithinBoundary(emptied),
    /build\.yml:1 `build\.yml` must declare secret `APP_PRIVATE_KEY`/,
  );
});

test('rejects a workflow that does not declare read-only contents permission', async () => {
  for (const [grants, expected] of [
    [[], /build\.yml:9 workflow permissions must be exactly `contents: read`, found \{\}/],
    [[['contents', 'write']], /found \{"contents":"write"\}/],
    [[['contents', 'read'], ['id-token', 'write']], /found \{"contents":"read","id-token":"write"\}/],
    [[['actions', 'read']], /found \{"actions":"read"\}/],
  ]) {
    const workflows = await repositoryWorkflows();
    documentOf(workflows.documents, 'build.yml').workflow.permissions = { number: 9, grants: new Map(grants), inline: undefined };
    assert.throws(() => assertWithinBoundary(workflows), expected, `expected ${JSON.stringify(grants)} to be rejected`);
  }

  const missing = await repositoryWorkflows();
  documentOf(missing.documents, 'build.yml').workflow.permissions = null;
  assert.throws(() => assertWithinBoundary(missing), /build\.yml:1 workflow must declare `permissions: contents: read`/);

  const inline = await repositoryWorkflows();
  documentOf(inline.documents, 'build.yml').workflow.permissions = { number: 9, grants: new Map(), inline: 'read-all' };
  assert.throws(() => assertWithinBoundary(inline), /must declare `permissions: contents: read` as a mapping, found `read-all`/);
});

test('rejects a specification origin or submodule that the allowlist does not name', async () => {
  const { documents, specificationRevision } = await repositoryWorkflows();
  const renamed = validateSourceCiCredentialBoundary({
    documents,
    submoduleRepositories: new Map([['api', 'git-malu/AnyWear-Service']]),
    specificationRevision,
  });
  assert.match(renamed.join('\n'), /`api` points at `git-malu\/AnyWear-Service`, and the allowlist names `AnyWear-Service-API`/);

  const extra = validateSourceCiCredentialBoundary({
    documents,
    submoduleRepositories: new Map([['api', 'git-malu/AnyWear-Service-API'], ['extra', 'git-malu/AnyWear-E2E']]),
    specificationRevision,
  });
  assert.match(extra.join('\n'), /submodule `extra` points at `git-malu\/AnyWear-E2E`, which no checkout in the boundary fetches/);

  const absent = validateSourceCiCredentialBoundary({
    documents,
    submoduleRepositories: new Map(),
    specificationRevision,
  });
  assert.match(absent.join('\n'), /`\.gitmodules` declares no `api` submodule/);
});

test('rejects the boundary credential on any step but the specification checkout', async () => {
  for (const [file, mutate, expected] of [
    ['browser.yml', (document) => document.steps.find((step) => step.uses === 'pnpm/action-setup@v6').with.set('token', '${{ secrets.APP_PRIVATE_KEY }}'), /browser\.yml:30 step reads `secrets\.APP_PRIVATE_KEY`; only the specification checkout in `build\.yml` carries that credential/],
    ['test.yml', (document) => document.steps.find((step) => step.uses === 'actions/setup-node@v4').with.set('auth-token', '${{ secrets.APP_PRIVATE_KEY }}'), /test\.yml:24 step reads `secrets\.APP_PRIVATE_KEY`; only the specification checkout/],
    ['build.yml', (document) => document.steps.find((step) => step.job === 'rust-check' && step.uses === 'actions/checkout@v4').with.set('token', '${{ secrets.APP_PRIVATE_KEY }}'), /build\.yml:97/],
  ]) {
    const workflows = await repositoryWorkflows();
    mutate(documentOf(workflows.documents, file));
    assert.throws(() => assertWithinBoundary(workflows), expected);
  }

  const workflows = await repositoryWorkflows();
  documentOf(workflows.documents, 'test.yml').steps.find((step) => step.uses === 'actions/setup-node@v4').with.set('auth-token', '${{ secrets.SOME_OTHER }}');
  assert.throws(
    () => assertWithinBoundary(workflows),
    /test\.yml:24 step reads `secrets\.SOME_OTHER`, which is outside the credential boundary/,
  );
});

test('rejects a specification checkout that reads the secret directly or fetches submodules', async () => {
  for (const [mutate, expected] of [
    [(step) => step.with.set('extra-token', '${{ secrets.APP_PRIVATE_KEY }}'), /build\.yml:47 specification checkout reads `secrets\.APP_PRIVATE_KEY` directly/],
    [(step) => step.with.set('submodules', 'recursive'), /build\.yml:47 specification checkout must not fetch submodules; found `submodules: recursive`/],
  ]) {
    const workflows = await repositoryWorkflows();
    mutate(specificationCheckoutOf(workflows.documents, 'build.yml'));
    assert.throws(() => assertWithinBoundary(workflows), expected);
  }
});

test('fails closed when the credential surface is emptied or a call resolves elsewhere', async () => {
  const emptied = await repositoryWorkflows();
  for (const document of emptied.documents) document.steps = [];
  assert.throws(
    () => assertWithinBoundary(emptied),
    /no App-token step was found; the boundary is unverified/,
    'removing the token steps must not silently satisfy a suite that matches nothing',
  );

  const moved = await repositoryWorkflows();
  const caller = documentOf(moved.documents, 'pipeline.yml').workflow.callers.find((candidate) => candidate.job === 'build');
  caller.uses = 'uses: ./.github/workflows/browser.yml';
  assert.throws(
    () => assertWithinBoundary(moved),
    /the credential-bearing workflow is `build\.yml`, and job `build` resolves to `browser\.yml`/,
  );
});

test('the boundary names the one repository and one permission the request carries', async () => {
  const submoduleRepositories = parseGitmodules(await readFile(gitmodulesPath, 'utf8'));
  assert.deepEqual([...submoduleRepositories], [['api', 'git-malu/AnyWear-Service-API']]);
  assert.equal(sourceCiCredentialBoundary.specificationRepository, 'AnyWear-Service-API');
  assert.equal(sourceCiCredentialBoundary.specificationPath, 'api');
  assert.equal(specificationRepositorySlug('git-malu'), 'git-malu/AnyWear-Service-API');
  assert.deepEqual(sourceCiCredentialBoundaryWith, {
    'app-id': '${{ vars.APP_ID }}',
    'private-key': '${{ secrets.APP_PRIVATE_KEY }}',
    owner: '${{ github.repository_owner }}',
    repositories: 'AnyWear-Service-API',
    'permission-contents': 'read',
  });
  assert.deepEqual(sourceCiCredentialBoundary.permissions, { contents: 'read' });
});

test('the Client publication path keeps its default credential and is untouched', async () => {
  const { documents } = await repositoryWorkflows();
  const publisher = documentOf(documents, 'beta-deploy.yml');
  assert.deepEqual(publisher.steps.filter((step) => step.uses.startsWith('actions/create-github-app-token@')), []);
  assert.deepEqual(publisher.steps.filter((step) => step.with?.has('submodules')), []);
  assert.deepEqual(publisher.workflow.calls, []);
  const checkout = publisher.steps.find((step) => step.uses === 'actions/checkout@v4');
  assert.equal(checkout.with.has('token'), false);
  assert.equal(checkout.with.has('repository'), false);
});

test('the pinned App-token action accepts every input the boundary passes', async (t) => {
  // The action's own metadata and bundled implementation at the pinned commit are the
  // authority for what it accepts. This reaches the network; without it the other
  // cases still cover the boundaries the workflows must stay inside.
  const pinned = sourceCiCredentialBoundary.tokenAction;
  const source = async (path) => {
    const response = await fetch(`https://raw.githubusercontent.com/${pinned.repository}/${pinned.ref}/${path}`, {
      signal: AbortSignal.timeout(20_000),
    });
    assert.equal(response.status, 200, `${pinned.repository}@${pinned.ref}/${path} must be readable`);
    return response.text();
  };

  let action;
  let implementation;
  try {
    [action, implementation] = await Promise.all([source('action.yml'), source('dist/main.cjs')]);
  } catch (error) {
    t.diagnostic(`Pinned action metadata was not reachable: ${error.message}`);
    return;
  }

  // Every input the workflow passes must be an input the action declares.
  for (const key of Object.keys(sourceCiCredentialBoundaryWith)) {
    assert.match(action, new RegExp(`^\\s{2}${key}:$`, 'm'), `action.yml must declare input \`${key}\``);
  }
  assert.match(action, /^\s{2}permission-contents:\n(?:\s+.*\n)*?\s+description: "[^"]*'read' or 'write'\."/m);

  // Runtime behaviour at the pin: the allowlist is applied to the named owner, and the
  // requested permission set is exactly what the workflow asks for.
  assert.ok(implementation.includes("Inputs 'owner' and 'repositories' are set. Creating token for the following repositories"));
  assert.ok(implementation.includes('"GET /repos/{owner}/{repo}/installation"'));
  assert.ok(implementation.includes('"POST /app/installations/{installation_id}/access_tokens"'));
  assert.ok(implementation.includes('var repositories = getInput("repositories").split(/[\\n,]+/).map((s) => s.trim())'));
  assert.ok(implementation.includes('repositoryNames: parsedRepositoryNames,\n    permissions: permissions2'));

  // The v3 line deprecates `app-id` for `client-id`, so a pin inside v2 is the version
  // whose declared inputs this boundary is written against.
  assert.equal(pinned.version, 'v2.2.2');
});

test('an unreadable workflow or .gitmodules is reported instead of passing silently', async () => {
  assert.throws(
    () => parseWorkflow('name: X\nfoo: bar\n', 'broken.yml'),
    /Unsupported top-level workflow key on line 2: foo/,
    'an unknown top-level key means the file was not read as expected',
  );
  assert.throws(
    () => parseWorkflow('name: X\njobs:\n  build:\n    steps:\n      - run\n', 'broken.yml'),
    /Unsupported workflow syntax on line 5: run/,
    'a step that is not `- key: value` must not be read as a boundary-shaped file',
  );
  assert.throws(
    () => parseWorkflow('name: X\njobs:\n  build:\n    steps:\n      with: x\n', 'broken.yml'),
    /Expected a workflow step on line 5: with: x/,
    'a steps block that is not a sequence must not be read as steps',
  );
  assert.throws(
    () => parseGitmodules('[submodule "api"]\n\turl = https://github.com/git-malu/AnyWear-Service-API.git\n'),
    /declares a url before its path/,
  );
  assert.throws(
    () => parseGitmodules('[submodule "api"]\n\tpath = api\n\turl = git@gitlab.com:git-malu/AnyWear-Service-API.git\n'),
    /url is not a GitHub repository/,
  );
  assert.throws(
    () => parseGitmodules('[submodule "api"]\n\tpath = api\n'),
    /declares path 'api' without a url/,
  );
});
