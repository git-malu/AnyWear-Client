import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export function assertClientPublication(env, phase, metadata) {
  requireCondition(phase === 'preflight' || phase === 'publish', 'Unknown publication validation phase');
  requireCondition(env.BETA_DEPLOY_ENABLED === 'true', 'Beta Client publication is disabled');
  requireCondition(env.GITHUB_REPOSITORY === 'git-malu/AnyWear-Client'
    && env.GITHUB_REPOSITORY_ID === '1176104200'
    && env.GITHUB_REF === 'refs/heads/main', 'Publication requires the original Client repository and main ref');
  requireCondition(env.GITHUB_EVENT_NAME === 'workflow_dispatch'
    && env.GITHUB_WORKFLOW_REF === 'git-malu/AnyWear-Client/.github/workflows/beta-deploy.yml@refs/heads/main', 'Publication requires the main Beta workflow dispatch');
  requireCondition(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '')
    && env.GITHUB_WORKFLOW_SHA === env.GITHUB_SHA, 'Publication requires the exact workflow source SHA');
  requireCondition(env.AWS_ACCOUNT_ID === '650880818323' && env.AWS_REGION === 'ap-east-1', 'Unexpected Beta account or region');
  requireCondition(env.CLIENT_PUBLISH_ROLE_ARN === 'arn:aws:iam::650880818323:role/beta-client-publish-role', 'A dedicated Beta Client publish role is required');
  requireCondition(/^[1-9]\d*$/.test(env.GITHUB_RUN_ID ?? '')
    && /^[1-9]\d*$/.test(env.GITHUB_RUN_ATTEMPT ?? ''), 'Missing Actions run identity');
  if (phase === 'publish') {
    requireCondition(metadata?.schema_version === 1
      && metadata.component === 'AnyWear-Client'
      && metadata.source_commit === env.GITHUB_SHA, 'Built Client metadata does not match the workflow source');
  }
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  try {
    const phase = process.argv[2];
    const metadata = phase === 'publish'
      ? JSON.parse(readFileSync(new URL('../../dist/build-metadata.json', import.meta.url), 'utf8'))
      : undefined;
    assertClientPublication(process.env, phase, metadata);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        `### Client publication identity (${phase})\n\n`
        + `- Client source: \`${process.env.GITHUB_SHA}\`\n`
        + `- Run/attempt: \`${process.env.GITHUB_RUN_ID}/${process.env.GITHUB_RUN_ATTEMPT}\`\n\n`);
    }
    console.log(`Validated Beta Client publication identity (${phase})`);
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
