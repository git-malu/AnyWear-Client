// Contract and validator for the Client source-CI checkout credential boundary.
//
// Client source CI checks out one repository recursively: this Client repository
// and the private `api` submodule it declares in .gitmodules. The jobs need
// nothing else and need no write access to anything. The constants below are the
// allowlist the workflows must request; `validateSourceCiCredentialBoundary`
// reports every way a workflow departs from it.
//
// The `with:` values are the literal strings a workflow must contain, so the
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
  // Repositories the App token may reach, as the bare names the pinned action
  // resolves against `owner`. AnyWear-Client is the checkout itself;
  // AnyWear-Service-API is the private `api` submodule.
  repositories: ['git-malu/AnyWear-Client', 'git-malu/AnyWear-Service-API'],
  // The only permission the token asks for.
  permissions: { contents: 'read' },
  // The only secret a Client source workflow may carry.
  secret: 'APP_PRIVATE_KEY',
};

export const sourceCiCredentialBoundaryWith = {
  ...sourceCiCredentialBoundary.tokenAction.inputs,
  repositories: sourceCiCredentialBoundary.repositories.map((repository) => repository.replace(/^[^/]+\//, '')).join(','),
  ...Object.fromEntries(
    Object.entries(sourceCiCredentialBoundary.permissions).map(([name, level]) => [`permission-${name}`, level]),
  ),
};

class SourceCiCredentialBoundaryError extends Error {}

const tokenStepPattern = /^actions\/create-github-app-token@(.+)$/;
const tokenOutputPattern = /^\$\{\{\s*steps\.([A-Za-z0-9_-]+)\.outputs\.token\s*\}\}$/;
const appIdVariablePattern = /\$\{\{\s*vars\.([A-Za-z0-9_]+)\s*\}\}/g;
const secretReferencePattern = /\$\{\{\s*secrets\.([A-Za-z0-9_]+)\s*\}\}/g;

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

/** Scalar `key: value` members of an entries list, taking `name` from the `- ` line. */
function entryValues(entries, nameValue) {
  const pairs = new Map();
  if (nameValue !== undefined) pairs.set('name', nameValue);
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
 * workflow-level `permissions` block, each job and its steps, the secrets a job
 * maps into the workflow it calls, and the secrets a `workflow_call` workflow
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
      const grants = entriesAt(entry.block ?? [], 0, 2);
      workflow.permissions = { number: entry.number, grants: entryValues(grants), inline: entry.value };
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
        const inherit = secrets?.value === 'inherit' || secretEntries.some((secret) => secret.value === 'inherit');
        workflow.callers.push({
          job: job.key,
          number: uses.number,
          uses: `uses: ${uses.value ?? ''}`,
          secretsInherit: inherit,
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

function secretReferences(value) {
  return [...value.matchAll(secretReferencePattern)].map((match) => match[1]);
}

function variableReferences(value) {
  return [...value.matchAll(appIdVariablePattern)].map((match) => match[1]);
}

const boundarySecret = `\${{ secrets.${sourceCiCredentialBoundary.secret} }}`;

/**
 * Reports every way the parsed workflows depart from the credential boundary.
 * `submoduleRepositories` maps a submodule path to the repository its .gitmodules
 * URL names, so a submodule origin outside the allowlist is a violation.
 */
export function validateSourceCiCredentialBoundary({ documents, submoduleRepositories = new Map() }) {
  const violations = [];
  const steps = documents.flatMap((document) => document.steps);
  const stepIds = new Set(steps.map((step) => step.id).filter(Boolean));
  const allowlist = sourceCiCredentialBoundary.repositories;
  const allowlistNames = allowlist.map((repository) => repository.replace(/^[^/]+\//, ''));
  const expectedTokenAction = `${sourceCiCredentialBoundary.tokenAction.repository}@${sourceCiCredentialBoundary.tokenAction.ref}`;
  const expectedInputs = Object.entries(sourceCiCredentialBoundaryWith);

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

    // A caller reaches its called workflow through an exact secret mapping; the
    // called workflow declares that one secret as required.
    for (const call of workflow.calls) {
      if (call.name !== sourceCiCredentialBoundary.secret) {
        violations.push(violation(workflow.file, call.number, `called workflow must declare only \`${sourceCiCredentialBoundary.secret}\`, found \`${call.name}\``));
      }
      if (call.required !== 'true') {
        violations.push(violation(workflow.file, call.number, `called workflow must declare secret \`${call.name}\` as \`required: true\``));
      }
    }
    for (const caller of workflow.callers) {
      if (caller.secretsInherit) {
        violations.push(violation(workflow.file, caller.number, `job \`${caller.job}\` must map the required secret explicitly instead of \`secrets: inherit\``));
      }
      const mapped = caller.mappedSecrets;
      if (!caller.secretsInherit && mapped.length !== 1) {
        violations.push(violation(workflow.file, caller.number, `job \`${caller.job}\` must pass exactly the required secret, found ${mapped.length === 0 ? 'none' : mapped.map((secret) => secret.key).join(', ')}`));
      }
      for (const secret of mapped) {
        if (secret.value !== boundarySecret) {
          violations.push(violation(workflow.file, caller.number, `job \`${caller.job}\` must pass \`${secret.key}: ${boundarySecret}\`, found \`${secret.key}: ${secret.value}\``));
        }
      }
    }
  }

  for (const step of steps) {
    if (tokenStepPattern.test(step.uses)) {
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
        if (!allowlistNames.includes(name)) {
          violations.push(violation(step.file, step.number, `App-token step requests \`${name}\`, which is outside the allowed repositories ${allowlist.join(', ')}`));
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
    }

    if (step.with?.has('submodules') && step.with.get('submodules') !== 'recursive') {
      violations.push(violation(step.file, step.number, `checkout must use \`submodules: recursive\`, found \`submodules: ${step.with.get('submodules')}\``));
    }

    if (step.with?.get('submodules') === 'recursive') {
      const token = step.with.get('token');
      if (!token) {
        violations.push(violation(step.file, step.number, 'recursive checkout must use the App token; the default credential cannot read the private `api` submodule'));
        continue;
      }
      const tokenMatch = tokenOutputPattern.exec(token);
      if (!tokenMatch) {
        violations.push(violation(step.file, step.number, `recursive checkout must use the generated App token output, found \`${token}\``));
      } else if (!stepIds.has(tokenMatch[1])) {
        violations.push(violation(step.file, step.number, `recursive checkout reads \`${token}\`, but no step declares id \`${tokenMatch[1]}\``));
      }
    }

    if (step.with?.has('token') && step.with.get('submodules') !== 'recursive') {
      violations.push(violation(step.file, step.number, `checkout that consumes the App token must check out submodules recursively, found \`submodules: ${step.with.get('submodules') ?? 'nothing'}\``));
    }

    if (step.with) {
      for (const value of step.with.values()) {
        for (const name of secretReferences(value)) {
          if (name !== sourceCiCredentialBoundary.secret) {
            violations.push(violation(step.file, step.number, `step reads \`secrets.${name}\`, which is outside the credential boundary`));
          }
        }
      }
    }
  }

  for (const [path, repository] of submoduleRepositories) {
    if (!allowlist.includes(repository)) {
      violations.push(violation('.gitmodules', 1, `submodule \`${path}\` points at \`${repository}\`, which is outside the allowed repositories ${allowlist.join(', ')}`));
    }
  }

  return violations;
}
