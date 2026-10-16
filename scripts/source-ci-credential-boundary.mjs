// Contract and validator for the Client source-CI checkout credential boundary.
//
// Client source CI reads one private repository: the published OpenAPI
// specification, which generates the client the build checks for consistency.
// Everything else it reads is this public repository, or a public action. The
// constants below are the allowlist the workflows must request and the only
// consumer allowed to hold the resulting token;
// `validateSourceCiCredentialBoundary` reports every way a workflow departs from
// them.
//
// The `with:` strings are the literal values a workflow must contain, so the
// strings asserted here are the ones the pinned action receives in CI.

export const sourceCiCredentialBoundary = {
  // The App-token action, pinned to an immutable commit: the moving `v2` tag has
  // resolved to this commit since the v2.2.2 release.
  tokenAction: {
    repository: 'actions/create-github-app-token',
    ref: 'fee1f7d63c2ff003460e3d139729b119787bc349',
    version: 'v2.2.2',
    inputs: {
      'app-id': '${{ vars.APP_ID }}',
      'private-key': '${{ secrets.APP_PRIVATE_KEY }}',
      owner: '${{ github.repository_owner }}',
    },
  },
  // The one repository the token may reach, as the bare name the pinned action
  // resolves against `owner`, and where it is checked out.
  specificationRepository: 'AnyWear-Service-API',
  specificationPath: 'api',
  // The only permission any token step asks for.
  permissions: { contents: 'read' },
  // The only secret a Client source workflow may carry, and the only caller job
  // that maps it.
  secret: 'APP_PRIVATE_KEY',
  secretCallerJob: 'build',
};

export const sourceCiCredentialBoundaryWith = {
  ...sourceCiCredentialBoundary.tokenAction.inputs,
  repositories: sourceCiCredentialBoundary.specificationRepository,
  ...Object.fromEntries(
    Object.entries(sourceCiCredentialBoundary.permissions).map(([name, level]) => [`permission-${name}`, level]),
  ),
};

/** The `owner/repo` the specification checkout names, for an owner-qualified comparison. */
export function specificationRepositorySlug(owner) {
  return `${owner}/${sourceCiCredentialBoundary.specificationRepository}`;
}

/** Submodule path → repository its .gitmodules URL names. */
export function parseGitmodules(text) {
  const repositories = new Map();
  let path;
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const pathMatch = /^path\s*=\s*(.+)$/.exec(line);
    if (pathMatch) {
      path = pathMatch[1].trim();
      continue;
    }
    const urlMatch = /^url\s*=\s*(.+)$/.exec(line);
    if (urlMatch) {
      if (path === undefined) throw new SourceCiCredentialBoundaryError(`.gitmodules declares a url before its path: ${line}`);
      const url = urlMatch[1].trim().replace(/\.git$/, '');
      const ownerAndName = /^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+\/[^/]+)$/.exec(url);
      if (!ownerAndName) throw new SourceCiCredentialBoundaryError(`.gitmodules url is not a GitHub repository: ${line}`);
      repositories.set(path, ownerAndName[1]);
      path = undefined;
    }
  }
  if (path !== undefined) throw new SourceCiCredentialBoundaryError(`.gitmodules declares path '${path}' without a url`);
  return repositories;
}

export class SourceCiCredentialBoundaryError extends Error {}

const tokenStepPattern = /^actions\/create-github-app-token@(.+)$/;
const appIdVariablePattern = /\$\{\{\s*vars\.([A-Za-z0-9_]+)\s*\}\}/g;
const secretReferencePattern = /\$\{\{\s*secrets\.([A-Za-z0-9_]+)\s*\}\}/g;
const fullCommitPattern = /^[0-9a-f]{40}$/;

function violation(file, line, message) {
  return `${file}:${line} ${message}`;
}

/** `key: value` for one line, without quotes or a trailing comment. */
function keyValue(text) {
  const match = /^([A-Za-z0-9_.-]+):(?:\s+(.*))?$/.exec(text);
  if (!match) return undefined;
  let value = match[2] ?? '';
  const isQuoted = value.length > 1
    && ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"')));
  if (isQuoted) return { key: match[1], value: value.slice(1, -1) };
  const commentAt = value.search(/\s#/);
  if (commentAt >= 0) value = value.slice(0, commentAt);
  return { key: match[1], value: value.trim() };
}

function childLines(block) {
  return block.filter((line) => line.text !== '' && !line.text.startsWith('#'));
}

function lineIndent(line) {
  return line.match(/^ */)[0].length;
}

function isBlank(line) {
  return line.text === '';
}

function isCommentLine(line) {
  return line.text.startsWith('#');
}

/**
 * Entries of one mapping level, beginning at `start`. An entry is either a nested
 * block (`key:` on its own line, with the block in `block`) or a scalar member
 * (`key: value`, with the text in `value`).
 */
function entriesAt(lines, start, indent) {
  const entries = [];
  let cursor = start;
  while (cursor < lines.length) {
    if (isBlank(lines[cursor]) || isCommentLine(lines[cursor])) {
      cursor += 1;
      continue;
    }
    if (lines[cursor].indent < indent) break;
    if (lines[cursor].indent > indent) {
      cursor += 1;
      continue;
    }
    const header = /^([A-Za-z0-9_.-]+):$/.exec(lines[cursor].text);
    if (!header) {
      const scalar = keyValue(lines[cursor].text);
      if (!scalar) throw new SourceCiCredentialBoundaryError(`Unsupported workflow syntax on line ${lines[cursor].number}: ${lines[cursor].text}`);
      entries.push({ key: scalar.key, number: lines[cursor].number, value: scalar.value, block: null });
      cursor += 1;
      continue;
    }
    // An entry's block starts one level deeper and runs to the next line at or above
    // this entry's own level. Deeper lines inside it belong to it, so a sibling key of
    // a nested mapping is never absorbed into the entry before it, and an entry followed
    // by a deeper sibling (a job before its first step) keeps that sibling.
    let content = cursor + 1;
    while (content < lines.length && (isBlank(lines[content]) || isCommentLine(lines[content]))) content += 1;
    const hasBlock = content < lines.length && lines[content].indent === indent + 2;
    let end = cursor + 1;
    if (hasBlock) {
      end = content;
      while (end < lines.length && (isBlank(lines[end]) || isCommentLine(lines[end]) || lines[end].indent > indent)) end += 1;
    }
    entries.push({
      key: header[1],
      number: lines[cursor].number,
      value: undefined,
      block: hasBlock
        ? trimBlankEdges(lines.slice(cursor + 1, end)).filter((line) => !isCommentLine(line))
        : null,
    });
    cursor = hasBlock ? end : cursor + 1;
  }
  return entries;
}

/** Scalar `key: value` entries of an entries list, taking `name` from the `- ` line. */
function entryValues(entries) {
  const pairs = new Map();
  for (const entry of entries) {
    if (entry.value === undefined) continue;
    pairs.set(entry.key, entry.value);
  }
  return pairs;
}

/** Lines of the block belonging to the entry at `start` of `block`. */
function entryLines(block, start) {
  const indent = block[start].indent;
  let end = start + 1;
  while (end < block.length) {
    if (isBlank(block[end]) || isCommentLine(block[end])) {
      end += 1;
      continue;
    }
    if (block[end].indent <= indent) break;
    end += 1;
  }
  return trimBlankEdges(block.slice(start + 1, end)).filter((line) => !isCommentLine(line));
}

/** `- name: value` step entries of a `steps:` block, with their nested options. */
function stepEntries(lines, start) {
  const entries = [];
  let cursor = start;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (isBlank(line) || isCommentLine(line)) {
      cursor += 1;
      continue;
    }
    if (!line.text.startsWith('- ') && line.text !== '-') {
      throw new SourceCiCredentialBoundaryError(`Expected a workflow step on line ${line.number}: ${line.text}`);
    }
    let end = cursor + 1;
    while (end < lines.length && !(lines[end].text.startsWith('- ') || lines[end].text === '-')) end += 1;
    entries.push({
      first: { ...line, text: line.text.replace(/^-\s*/, '') },
      options: trimBlankEdges(lines.slice(cursor + 1, end)).filter((option) => !isCommentLine(option)),
      number: line.number,
    });
    cursor = end;
  }
  return entries;
}

function trimBlankEdges(lines) {
  const result = [...lines];
  while (result.length > 0 && isBlank(result[0])) result.shift();
  while (result.length > 0 && isBlank(result[result.length - 1])) result.pop();
  return result;
}

/** Scalar members of a step: `name` sits on the `- ` line, the rest one level in. */
function stepFields(step) {
  const fields = entryValues(entriesAt([step.first], 0, step.first.indent));
  for (const [key, value] of entryValues(entriesAt(step.options, 0, step.first.indent + 2))) fields.set(key, value);
  return fields;
}

/**
 * Reads the parts of a workflow file the credential boundary governs: the
 * workflow-level `permissions` block, each job and its steps, the secrets a caller
 * job maps into the workflow it calls, and the secrets a `workflow_call` workflow
 * declares. Only the flow-style subset this repository's workflows use is
 * supported; anything else raises, so an unreadable contract fails the check
 * rather than passing silently.
 */
export function parseWorkflow(text, file) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((raw, index) => ({ number: index + 1, indent: lineIndent(raw), text: raw.trim() }));

  const workflow = { file, permissions: null, jobs: [], calls: [], callers: [] };
  const steps = [];
  const knownTopLevelKeys = ['name', 'on', 'run-name', 'permissions', 'concurrency', 'env', 'defaults', 'jobs'];
  const topLevel = entriesAt(lines, 0, 0);
  for (const entry of topLevel) {
    if (!knownTopLevelKeys.includes(entry.key)) {
      throw new SourceCiCredentialBoundaryError(`Unsupported top-level workflow key on line ${entry.number}: ${entry.key}`);
    }
  }

  for (const entry of topLevel) {
    if (entry.key === 'permissions') {
      workflow.permissions = { number: entry.number, grants: entryValues(entriesAt(entry.block ?? [], 0, 2)), inline: entry.value };
    }

    if (entry.key === 'on') {
      // `workflow_call` is a mapping; the other triggers are inline values.
      for (const call of entriesAt(entry.block ?? [], 0, 2).filter((trigger) => trigger.key === 'workflow_call')) {
        for (const secrets of entriesAt(call.block ?? [], 0, 4).filter((section) => section.key === 'secrets')) {
          for (const secret of entriesAt(secrets.block ?? [], 0, 6)) {
            const required = entriesAt(secret.block ?? [], 0, 8).find((option) => option.key === 'required');
            workflow.calls.push({ name: secret.key, required: required?.value, number: secret.number });
          }
        }
      }
    }

    if (entry.key !== 'jobs') continue;
    for (const job of entriesAt(entry.block ?? [], 0, 2)) {
      workflow.jobs.push({ id: job.key, number: job.number, workflow: workflow.file });
      const jobEntries = entriesAt(job.block ?? [], 0, 4);
      const uses = jobEntries.find((jobEntry) => jobEntry.key === 'uses');
      if (uses) {
        const secrets = jobEntries.find((jobEntry) => jobEntry.key === 'secrets');
        const secretEntries = secrets ? entriesAt(secrets.block ?? [], 0, 6) : [];
        workflow.callers.push({
          job: job.key,
          number: uses.number,
          uses: `uses: ${uses.value ?? ''}`,
          secretsInherit: secrets?.value === 'inherit' || secretEntries.some((secret) => secret.value === 'inherit'),
          mappedSecrets: secretEntries
            .filter((secret) => secret.value !== undefined && secret.value !== 'inherit')
            .map((secret) => ({ key: secret.key, value: secret.value })),
        });
      }
      const stepsEntry = jobEntries.find((jobEntry) => jobEntry.key === 'steps');
      if (!stepsEntry || !stepsEntry.block) continue;
      const firstStep = childLines(stepsEntry.block)[0];
      if (!firstStep) continue;
      for (const step of stepEntries(stepsEntry.block, stepsEntry.block.indexOf(firstStep))) {
        const fields = stepFields(step);
        const withLine = step.options.find((line) => line.text === 'with:');
        steps.push({
          file: workflow.file,
          number: step.number,
          job: job.key,
          name: fields.get('name') ?? '',
          id: fields.get('id') ?? '',
          uses: fields.get('uses') ?? '',
          with: withLine ? entryValues(entriesAt(entryLines(step.options, step.options.indexOf(withLine)), 0, withLine.indent + 2)) : null,
        });
      }
    }
  }

  return { workflow, steps };
}

function secretReferences(value) {
  return [...value.matchAll(secretReferencePattern)].map((match) => match[1]);
}

function variableReferences(value) {
  return [...value.matchAll(appIdVariablePattern)].map((match) => match[1]);
}

const boundarySecret = `\${{ secrets.${sourceCiCredentialBoundary.secret} }}`;

/**
 * Reports every way the parsed workflows depart from the credential boundary.
 *
 * `submoduleRepositories` maps a submodule path to the repository its .gitmodules
 * URL names, so a checkout that fetches a repository the allowlist does not name is
 * a violation; `specificationRevision` is the gitlink the specification checkout must
 * pin.
 */
export function validateSourceCiCredentialBoundary({ documents, submoduleRepositories = new Map(), specificationRevision }) {
  const violations = [];
  const steps = documents.flatMap((document) => document.steps);
  const workflowFiles = new Set(documents.map((document) => document.workflow.file));
  const expectedTokenAction = `${sourceCiCredentialBoundary.tokenAction.repository}@${sourceCiCredentialBoundary.tokenAction.ref}`;
  const expectedInputs = Object.entries(sourceCiCredentialBoundaryWith);
  const credentialWorkflow = `${sourceCiCredentialBoundary.secretCallerJob}.yml`;
  const declaredSpecification = submoduleRepositories.get(sourceCiCredentialBoundary.specificationPath);
  const specificationOwner = declaredSpecification ? declaredSpecification.replace(/\/.*$/, '') : undefined;
  for (const { workflow } of documents) {
    if (!workflow.permissions) {
      violations.push(violation(workflow.file, 1, 'workflow must declare `permissions: contents: read`'));
    } else if (workflow.permissions.inline !== undefined) {
      violations.push(violation(workflow.file, workflow.permissions.number, `workflow must declare \`permissions: contents: read\` as a mapping, found \`${workflow.permissions.inline}\``));
    } else {
      const grants = [...workflow.permissions.grants.entries()];
      if (grants.length !== 1 || grants[0][0] !== 'contents' || grants[0][1] !== 'read') {
        violations.push(violation(workflow.file, workflow.permissions.number, `workflow permissions must be exactly \`contents: read\`, found ${JSON.stringify(Object.fromEntries(grants))}`));
      }
    }

    // A called workflow declares the one secret and nothing else, and only the
    // credential-bearing one declares anything at all.
    const declaresCredential = workflow.file === credentialWorkflow;
    if (declaresCredential && workflow.calls.length === 0) {
      violations.push(violation(workflow.file, 1, `\`${credentialWorkflow}\` must declare secret \`${sourceCiCredentialBoundary.secret}\``));
    }
    for (const call of workflow.calls) {
      if (!declaresCredential) {
        violations.push(violation(workflow.file, call.number, `\`${workflow.file}\` declares secret \`${call.name}\`, but it holds no credential; only \`${credentialWorkflow}\` does`));
      }
      if (call.name !== sourceCiCredentialBoundary.secret) {
        violations.push(violation(workflow.file, call.number, `called workflow must declare only \`${sourceCiCredentialBoundary.secret}\`, found \`${call.name}\``));
      }
      if (call.required !== 'true') {
        violations.push(violation(workflow.file, call.number, `called workflow must declare secret \`${call.name}\` as \`required: true\``));
      }
    }

    // Only the one caller job reaches that secret, through an exact mapping.
    for (const caller of workflow.callers) {
      const resolved = caller.uses.replace(/^uses:\s*\.\/\.github\/workflows\//, '');
      if (!workflowFiles.has(resolved)) {
        violations.push(violation(workflow.file, caller.number, `job \`${caller.job}\` calls \`${caller.uses}\`, which is not one of the workflow files under review`));
      }
      const carriesCredential = resolved === credentialWorkflow;
      if (carriesCredential !== (caller.job === sourceCiCredentialBoundary.secretCallerJob)) {
        violations.push(violation(workflow.file, caller.number, `the credential-bearing workflow is \`${credentialWorkflow}\`, and job \`${caller.job}\` resolves to \`${resolved}\``));
      }
      const passesSecret = caller.secretsInherit || caller.mappedSecrets.length > 0;
      if (passesSecret !== carriesCredential) {
        violations.push(violation(workflow.file, caller.number, `job \`${caller.job}\` ${passesSecret ? 'receives' : 'does not receive'} \`${sourceCiCredentialBoundary.secret}\`, but its called workflow ${carriesCredential ? 'declares it' : 'declares no secret'}`));
      }
      if (caller.secretsInherit) {
        violations.push(violation(workflow.file, caller.number, `job \`${caller.job}\` must map the required secret explicitly instead of \`secrets: inherit\``));
      }
      for (const secret of caller.mappedSecrets) {
        if (secret.key !== sourceCiCredentialBoundary.secret) {
          violations.push(violation(workflow.file, caller.number, `job \`${caller.job}\` passes \`${secret.key}\`, which is outside the credential boundary`));
        }
        if (secret.value !== boundarySecret) {
          violations.push(violation(workflow.file, caller.number, `job \`${caller.job}\` must pass \`${secret.key}: ${boundarySecret}\`, found \`${secret.key}: ${secret.value}\``));
        }
      }
    }
  }

  const tokenSteps = steps.filter((step) => tokenStepPattern.test(step.uses));
  if (tokenSteps.length === 0) {
    violations.push(violation('.github/workflows', 1, 'no App-token step was found; the boundary is unverified, so an emptied credential surface must be stated explicitly'));
  }

  for (const step of steps) {
    const tokenActionRef = tokenStepPattern.exec(step.uses);
    if (tokenActionRef) {
      if (step.uses !== expectedTokenAction) {
        violations.push(violation(step.file, step.number, `App-token step must be pinned to ${expectedTokenAction}, found ${step.uses}`));
      }
      if (!step.with) {
        violations.push(violation(step.file, step.number, 'App-token step must declare a `with:` block'));
        continue;
      }
      for (const [key, value] of expectedInputs) {
        const actual = step.with.get(key);
        if (actual !== value) {
          violations.push(violation(step.file, step.number, `App-token step must set \`${key}: ${value}\`, found ${actual === undefined ? 'nothing' : `\`${key}: ${actual}\``}`));
        }
      }
      for (const key of step.with.keys()) {
        if (!(key in sourceCiCredentialBoundaryWith)) {
          violations.push(violation(step.file, step.number, `App-token step passes \`${key}\`, which is not one of the boundary inputs ${Object.keys(sourceCiCredentialBoundaryWith).join(', ')}`));
        }
      }
      const requested = (step.with.get('repositories') ?? '').split(/[\n,]+/).map((name) => name.trim()).filter((name) => name !== '');
      if (requested.length === 0) {
        violations.push(violation(step.file, step.number, 'App-token step must request an explicit repository allowlist; without `repositories` the token reaches every repository the installation grants'));
      }
      for (const name of requested) {
        if (name !== sourceCiCredentialBoundary.specificationRepository) {
          violations.push(violation(step.file, step.number, `App-token step requests \`${name}\`; the allowlist is exactly \`${sourceCiCredentialBoundary.specificationRepository}\``));
        }
      }
      const permissionKeys = [...step.with.keys()].filter((key) => key.startsWith('permission-'));
      if (permissionKeys.length !== 1 || permissionKeys[0] !== 'permission-contents') {
        violations.push(violation(step.file, step.number, `App-token step must request only \`permission-contents\`, found ${permissionKeys.length === 0 ? 'no permission input' : permissionKeys.join(', ')}`));
      }
      for (const key of permissionKeys) {
        if (step.with.get(key) !== 'read') {
          violations.push(violation(step.file, step.number, `App-token step must request \`${key}: read\`, found \`${key}: ${step.with.get(key)}\``));
        }
      }
      for (const name of secretReferences(step.with.get('app-id') ?? '')) {
        violations.push(violation(step.file, step.number, `App ID must not be read from a secret, found \`secrets.${name}\``));
      }
      for (const name of variableReferences(step.with.get('app-id') ?? '')) {
        if (name !== 'APP_ID') {
          violations.push(violation(step.file, step.number, `App ID must come from \`vars.APP_ID\`, found \`vars.${name}\``));
        }
      }
      continue;
    }

    // Every other checkout reads public content with the default credential.
    if (step.uses.startsWith('actions/checkout@')) {
      const repository = step.with?.get('repository') ?? '';
      if (repository === '') {
        if (step.with?.has('token')) {
          violations.push(violation(step.file, step.number, 'the Client checkout must use the default credential; only the specification checkout carries the App token'));
        }
        if (step.with?.get('path') !== undefined) {
          violations.push(violation(step.file, step.number, `the Client checkout must not set \`path\`; the specification is checked out at \`${sourceCiCredentialBoundary.specificationPath}\``));
        }
        if (specificationOwner !== undefined && step.with?.get('submodules') !== undefined && step.with.get('submodules') !== 'false') {
          violations.push(violation(step.file, step.number, `the Client checkout must not fetch submodules; the specification checkout reads \`${specificationOwner}/${sourceCiCredentialBoundary.specificationRepository}\` with the App token`));
        }
        continue;
      }
      const expectedSlug = specificationRepositorySlug(repository.replace(/\/.*$/, ''));
      if (repository !== expectedSlug) {
        violations.push(violation(step.file, step.number, `checkout fetches \`${repository}\`, which is not \`${specificationOwner ?? 'the owner'}/${sourceCiCredentialBoundary.specificationRepository}\``));
      }
      if (step.with?.get('path') !== sourceCiCredentialBoundary.specificationPath) {
        violations.push(violation(step.file, step.number, `specification checkout must use \`path: ${sourceCiCredentialBoundary.specificationPath}\`, found \`path: ${step.with?.get('path') ?? 'nothing'}\``));
      }
      if (specificationRevision !== undefined) {
        const ref = step.with?.get('ref') ?? '';
        if (!fullCommitPattern.test(ref)) {
          violations.push(violation(step.file, step.number, `specification checkout must pin its revision by full commit, found \`ref: ${ref || 'nothing'}\``));
        } else if (ref !== specificationRevision) {
          violations.push(violation(step.file, step.number, `specification checkout pins \`${ref}\`, but \`.gitmodules\` records \`${specificationRevision}\``));
        }
      }
      const token = step.with?.get('token') ?? '';
      if (!/^\$\{\{\s*steps\.[A-Za-z0-9_-]+\.outputs\.token\s*\}\}$/.test(token)) {
        violations.push(violation(step.file, step.number, `specification checkout must use a generated App token output, found \`${token || 'nothing'}\``));
      } else if (!tokenSteps.some((candidate) => candidate.id !== '' && token.includes(`steps.${candidate.id}.outputs.token`))) {
        violations.push(violation(step.file, step.number, `specification checkout reads \`${token}\`, but no App-token step declares that id`));
      }
      if (step.with?.get('persist-credentials') !== 'false') {
        violations.push(violation(step.file, step.number, `specification checkout must set \`persist-credentials: false\`, found \`${step.with?.get('persist-credentials') ?? 'nothing'}\``));
      }
      continue;
    }

    if (step.with?.has('submodules') && step.with.get('submodules') !== 'false') {
      violations.push(violation(step.file, step.number, `only the specification checkout fetches repository content, and it uses \`path\`/\`repository\`; found \`submodules: ${step.with.get('submodules')}\``));
    }
    for (const value of step.with?.values() ?? []) {
      for (const name of secretReferences(value)) {
        if (name !== sourceCiCredentialBoundary.secret) {
          violations.push(violation(step.file, step.number, `step reads \`secrets.${name}\`, which is outside the credential boundary`));
        }
      }
    }
  }

  // The allowlist must name exactly what the specification checkout fetches.
  if (declaredSpecification === undefined) {
    violations.push(violation('.gitmodules', 1, `\`.gitmodules\` declares no \`${sourceCiCredentialBoundary.specificationPath}\` submodule; the allowlist would name a repository this checkout does not read`));
  } else if (declaredSpecification !== specificationRepositorySlug(specificationOwner)) {
    violations.push(violation('.gitmodules', 1, `\`${sourceCiCredentialBoundary.specificationPath}\` points at \`${declaredSpecification}\`, and the allowlist names \`${sourceCiCredentialBoundary.specificationRepository}\``));
  }
  for (const [path, repository] of submoduleRepositories) {
    if (path === sourceCiCredentialBoundary.specificationPath) continue;
    violations.push(violation('.gitmodules', 1, `submodule \`${path}\` points at \`${repository}\`, which no checkout in the boundary fetches`));
  }

  return violations;
}
