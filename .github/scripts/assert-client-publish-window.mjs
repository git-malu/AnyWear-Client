import { appendFileSync } from 'node:fs';

// This validates the protected environment snapshot. It is deliberately not a
// cross-repository lock or proof that the manager has stopped other writers.
const env = process.env;
const phase = process.argv[2];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  requireCondition(phase === 'preflight' || phase === 'publish', 'Unknown publish window validation phase');
  requireCondition(env.BETA_DEPLOY_ENABLED === 'true', 'Beta Client publication is disabled');
  requireCondition(env.GITHUB_REPOSITORY === 'git-malu/AnyWear-Client'
    && env.GITHUB_REPOSITORY_ID === '1176104200'
    && env.GITHUB_REF === 'refs/heads/main', 'Publication requires the original Client repository and main ref');
  requireCondition(env.AWS_ACCOUNT_ID === '650880818323' && env.AWS_REGION === 'ap-east-1', 'Unexpected Beta account or region');
  requireCondition(env.CLIENT_PUBLISH_ROLE_ARN === 'arn:aws:iam::650880818323:role/beta-client-publish-role', 'A dedicated Beta Client publish role is required');
  requireCondition(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(env.CLIENT_PUBLISH_WINDOW_ID ?? '')
    && env.CLIENT_PUBLISH_WINDOW_INPUT === env.CLIENT_PUBLISH_WINDOW_ID, 'Missing or mismatched manager-assigned publish window');
  requireCondition(/^[a-f0-9]{40}$/.test(env.CLIENT_PUBLISH_WINDOW_CLIENT_SHA ?? '')
    && env.GITHUB_SHA === env.CLIENT_PUBLISH_WINDOW_CLIENT_SHA, 'Client source does not match the assigned publish window');
  requireCondition(/^https:\/\/github\.com\/git-malu\/AnyWear\/issues\/[1-9]\d*#issuecomment-[1-9]\d*$/.test(env.CLIENT_PUBLISH_WINDOW_RECORD_URL ?? ''), 'A manager assignment issue-comment URL is required');
  requireCondition(/^[1-9]\d*$/.test(env.GITHUB_RUN_ID ?? '')
    && /^[1-9]\d*$/.test(env.GITHUB_RUN_ATTEMPT ?? ''), 'Missing Actions run identity');

  const deadline = env.CLIENT_PUBLISH_WINDOW_EXPIRES_AT ?? '';
  const expiry = Date.parse(deadline);
  requireCondition(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(deadline)
    && Number.isFinite(expiry)
    && new Date(expiry).toISOString() === deadline.replace('Z', '.000Z')
    && Date.now() < expiry, 'Publish window is missing, malformed or expired');

  const summary = `### Client publish window (${phase})\n\n`
    + `- Assignment: ${env.CLIENT_PUBLISH_WINDOW_RECORD_URL}\n`
    + `- Window: \`${env.CLIENT_PUBLISH_WINDOW_ID}\`\n`
    + `- Client source: \`${env.GITHUB_SHA}\`\n`
    + `- Run/attempt: \`${env.GITHUB_RUN_ID}/${env.GITHUB_RUN_ATTEMPT}\`\n`
    + `- Expires: \`${deadline}\`\n\n`;
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, summary);
  console.log(`Validated Client publish window ${env.CLIENT_PUBLISH_WINDOW_ID} (${phase})`);
} catch (error) {
  console.error(`::error::${error.message}`);
  process.exitCode = 1;
}
