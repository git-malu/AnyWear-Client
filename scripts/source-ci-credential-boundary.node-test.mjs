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
  sourceCiCredentialBoundary,
  sourceCiCredentialBoundaryWith,
  validateSourceCiCredentialBoundary,
} from './source-ci-credential-boundary.mjs';

const workflowsDirectory = new URL('../.github/workflows/', import.meta.url);
const gitmodulesPath = new URL('../.gitmodules', import.meta.url);
const tokenAction = `${sourceCiCredentialBoundary.tokenAction.repository}@${sourceCiCredentialBoundary.tokenAction.ref}`;

/** The checked-in workflows, parsed fresh so one case cannot leak state into another. */
async function repositoryWorkflows() {
  const documents = [];
  for (const file of ['build.yml', 'test.yml', 'browser.yml', 'pipeline.yml', 'beta-deploy.yml']) {
    documents.push(parseWorkflow(await readFile(new URL(file, workflowsDirectory), 'utf8'), file));
  }
  return { documents, submoduleRepositories: parseGitmodules(await readFile(gitmodulesPath, 'utf8')) };
}

/** Fails with the validator's own messages when a workflow leaves the boundary. */
function assertWithinBoundary({ documents, submoduleRepositories }) {
  const violations = validateSourceCiCredentialBoundary({ documents, submoduleRepositories });
  assert.deepEqual(violations, []);
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

function recursiveCheckoutOf(documents, file) {
  const step = documentOf(documents, file).steps.find((candidate) => candidate.with?.get('submodules') === 'recursive');
  assert.ok(step, `expected a recursive checkout in ${file}`);
  return step;
}

test('checked-in Client source workflows stay inside the credential boundary', async () => {
  assertWithinBoundary(await repositoryWorkflows());
});

test('parses every App-token step, recursive checkout, caller and declared secret', async () => {
  const { documents } = await repositoryWorkflows();
  const steps = documents.flatMap((document) => document.steps);
  const tokenSteps = steps.filter((step) => step.uses.startsWith('actions/create-github-app-token@'));
  const recursiveCheckouts = steps.filter((step) => step.with?.get('submodules') === 'recursive');
  const callers = documents.flatMap((document) => document.workflow.callers);
  const declaredSecrets = documents.flatMap((document) => document.workflow.calls);

  assert.equal(tokenSteps.length, 4, 'build.yml has two App-token steps, test.yml and browser.yml one each');
  assert.deepEqual([...new Set(tokenSteps.map((step) => step.uses))], [tokenAction]);
  for (const step of tokenSteps) {
    assert.deepEqual(Object.fromEntries(step.with), sourceCiCredentialBoundaryWith, `${step.file}:${step.number}`);
  }
  assert.equal(recursiveCheckouts.length, 4);
  for (const checkout of recursiveCheckouts) {
    assert.equal(checkout.with.get('token'), '${{ steps.generate-token.outputs.token }}');
    assert.equal(checkout.with.get('persist-credentials'), 'false');
  }
  assert.deepEqual(callers.map((caller) => caller.job), ['build', 'test', 'browser']);
  for (const caller of callers) {
    assert.equal(caller.secretsInherit, false);
    assert.deepEqual(caller.mappedSecrets, [{ key: 'APP_PRIVATE_KEY', value: '${{ secrets.APP_PRIVATE_KEY }}' }]);
  }
  assert.deepEqual(declaredSecrets, [
    { name: 'APP_PRIVATE_KEY', required: 'true', number: 6 },
    { name: 'APP_PRIVATE_KEY', required: 'true', number: 6 },
    { name: 'APP_PRIVATE_KEY', required: 'true', number: 6 },
  ]);
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
      /build\.yml:22 App-token step must be pinned to actions\/create-github-app-token@fee1f7d/,
      `expected ${uses} to be rejected`,
    );
  }
});

test('rejects a token without an allowlist or with a repository outside it', async () => {
  const cases = [
    ['AnyWear-Client,AnyWear-Service-API,AnyWear-Service', /test\.yml:22 App-token step requests `AnyWear-Service`, which is outside the allowed repositories/],
    ['git-malu/AnyWear-Client', /test\.yml:22 App-token step requests `git-malu\/AnyWear-Client`, which is outside the allowed repositories/],
  ];
  for (const [repositories, expected] of cases) {
    const workflows = await repositoryWorkflows();
    tokenStepOf(workflows.documents, 'test.yml').with.set('repositories', repositories);
    assert.throws(() => assertWithinBoundary(workflows), expected, `expected \`repositories: ${repositories}\` to be rejected`);
  }
});

test('rejects an App-token step that drops the allowlist entirely', async () => {
  const workflows = await repositoryWorkflows();
  tokenStepOf(workflows.documents, 'test.yml').with.delete('repositories');
  assert.throws(
    () => assertWithinBoundary(workflows),
    /test\.yml:22 App-token step must set `repositories: AnyWear-Client,AnyWear-Service-API`, found nothing/,
  );
});

test('rejects every permission beyond a Contents read', async () => {
  for (const [key, value, expected] of [
    ['permission-contents', 'write', /browser\.yml:20 App-token step must request `permission-contents: read`, found `permission-contents: write`/],
    ['permission-actions', 'read', /browser\.yml:20 App-token step passes `permission-actions`, which is not one of the boundary inputs/],
    ['permission-attestations', 'read', /must request only `permission-contents`, found permission-contents, permission-attestations/],
    ['permission-metadata', 'read', /must request only `permission-contents`, found permission-contents, permission-metadata/],
    ['permission-pull-requests', 'write', /must request only `permission-contents`, found permission-contents, permission-pull-requests/],
    ['permission-workflows', 'write', /must request only `permission-contents`, found permission-contents, permission-workflows/],
  ]) {
    const workflows = await repositoryWorkflows();
    tokenStepOf(workflows.documents, 'browser.yml').with.set(key, value);
    assert.throws(() => assertWithinBoundary(workflows), expected, `expected \`${key}: ${value}\` to be rejected`);
  }

  const workflows = await repositoryWorkflows();
  tokenStepOf(workflows.documents, 'browser.yml').with.delete('permission-contents');
  assert.throws(
    () => assertWithinBoundary(workflows),
    /browser\.yml:20 App-token step must request only `permission-contents`, found no permission input/,
  );
});

test('rejects anonymous values or secrets outside the boundary on an App-token step', async () => {
  for (const [key, value, expected] of [
    ['app-id', '${{ secrets.APP_ID }}', /App ID must not be read from a secret, found `secrets.APP_ID`/],
    ['app-id', '${{ vars.OTHER_APP_ID }}', /App ID must come from `vars.APP_ID`, found `vars.OTHER_APP_ID`/],
    ['private-key', '${{ secrets.SOME_OTHER_TOKEN }}', /step reads `secrets.SOME_OTHER_TOKEN`, which is outside the credential boundary/],
    ['skip-token-revoke', 'true', /passes `skip-token-revoke`, which is not one of the boundary inputs/],
  ]) {
    const workflows = await repositoryWorkflows();
    tokenStepOf(workflows.documents, 'browser.yml').with.set(key, value);
    assert.throws(() => assertWithinBoundary(workflows), expected, `expected \`${key}: ${value}\` to be rejected`);
  }
});

test('rejects a recursive checkout that falls back to a broader credential', async () => {
  for (const [mutate, expected] of [
    [(step) => step.with.delete('token'), /test\.yml:33 recursive checkout must use the App token/],
    [(step) => step.with.set('token', '${{ secrets.GITHUB_TOKEN }}'), /test\.yml:33 recursive checkout must use the generated App token output/],
    [(step) => step.with.set('token', '${{ steps.other.outputs.token }}'), /test\.yml:33 recursive checkout reads `\$\{\{ steps\.other\.outputs\.token \}\}`, but no step declares id `other`/],
    [(step) => step.with.set('submodules', 'true'), /test\.yml:33 checkout must use `submodules: recursive`, found `submodules: true`/],
  ]) {
    const workflows = await repositoryWorkflows();
    mutate(recursiveCheckoutOf(workflows.documents, 'test.yml'));
    assert.throws(() => assertWithinBoundary(workflows), expected);
  }
});

test('rejects a checkout that consumes the App token without the private submodule', async () => {
  const workflows = await repositoryWorkflows();
  recursiveCheckoutOf(workflows.documents, 'browser.yml').with.set('submodules', 'false');
  assert.throws(
    () => assertWithinBoundary(workflows),
    /browser\.yml:31 checkout that consumes the App token must check out submodules recursively/,
  );
});

test('rejects a caller that inherits secrets or passes a secret outside the boundary', async () => {
  const cases = [
    ['inherit', /pipeline\.yml:26 job `test` must map the required secret explicitly instead of `secrets: inherit`/],
    ['missing', /job `test` must pass exactly the required secret, found none/],
    ['other', /job `test` must pass `APP_PRIVATE_KEY: \${{ secrets.APP_PRIVATE_KEY }}`, found `APP_PRIVATE_KEY: \${{ secrets.SOME_OTHER_TOKEN }}`/],
  ];
  for (const [variant, expected] of cases) {
    const workflows = await repositoryWorkflows();
    const caller = documentOf(workflows.documents, 'pipeline.yml').workflow.callers.find((candidate) => candidate.job === 'test');
    if (variant === 'inherit') {
      caller.secretsInherit = true;
      caller.mappedSecrets = [];
    } else if (variant === 'missing') {
      caller.mappedSecrets = [];
    } else {
      caller.mappedSecrets = [{ key: 'APP_PRIVATE_KEY', value: '${{ secrets.SOME_OTHER_TOKEN }}' }];
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

test('rejects a submodule origin outside the allowlist', async () => {
  const { documents } = await repositoryWorkflows();
  const violations = validateSourceCiCredentialBoundary({
    documents,
    submoduleRepositories: new Map([['api', 'git-malu/AnyWear-Service'], ['extra', 'git-malu/AnyWear-E2E']]),
  });
  assert.equal(violations.length, 2);
  for (const violation of violations) assert.match(violation, /^\.gitmodules:1 submodule `(api|extra)` points at `git-malu\/AnyWear-(Service|E2E)`, which is outside the allowed repositories/);
  assertWithinBoundary({ documents, submoduleRepositories: new Map([['api', 'git-malu/AnyWear-Service-API']]) });
});

test('the boundary names the repositories the recursive checkout actually reaches', async () => {
  const submoduleRepositories = parseGitmodules(await readFile(gitmodulesPath, 'utf8'));
  assert.deepEqual([...submoduleRepositories], [['api', 'git-malu/AnyWear-Service-API']]);
  assert.deepEqual(sourceCiCredentialBoundary.repositories, ['git-malu/AnyWear-Client', 'git-malu/AnyWear-Service-API']);
  assert.deepEqual(sourceCiCredentialBoundaryWith, {
    'app-id': '${{ vars.APP_ID }}',
    'private-key': '${{ secrets.APP_PRIVATE_KEY }}',
    owner: '${{ github.repository_owner }}',
    repositories: 'AnyWear-Client,AnyWear-Service-API',
    'permission-contents': 'read',
  });
});

test('the Client publication path keeps its default credential and is untouched', async () => {
  const { documents } = await repositoryWorkflows();
  const publisher = documentOf(documents, 'beta-deploy.yml');
  assert.deepEqual(publisher.steps.filter((step) => step.uses.startsWith('actions/create-github-app-token@')), []);
  assert.deepEqual(publisher.steps.filter((step) => step.with?.get('submodules') === 'recursive'), []);
  const checkout = publisher.steps.find((step) => step.uses === 'actions/checkout@v4');
  assert.equal(checkout.with.has('token'), false);
  assert.equal(checkout.with.has('submodules'), false);
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

  // Every input the workflows pass must be an input the action declares.
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
