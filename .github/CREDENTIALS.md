# Client source-CI credentials

The Client source workflows hold exactly one credential beyond the workflow's own
`GITHUB_TOKEN`: a GitHub App installation token used to check out the private `api`
submodule. This file records what that credential may reach, why, and what happens
when it is unavailable.

## What the checkout needs

`.gitmodules` declares one submodule, `api`, at
`https://github.com/git-malu/AnyWear-Service-API.git`. That repository is private, so
the default checkout credential cannot read it. Every job that runs `pnpm install`,
`pnpm run orval`, `pnpm run test:run` or `cargo check` checks it out recursively with
the App token:

| Workflow | Job | Checkout |
| --- | --- | --- |
| `build.yml` | `build` | `submodules: recursive` with the generated token |
| `build.yml` | `rust-check` | `submodules: recursive` with the generated token |
| `test.yml` | `test` | `submodules: recursive` with the generated token |
| `browser.yml` | `browser` | `submodules: recursive` with the generated token |

The repositories those checkouts read are therefore `AnyWear-Client` (the checkout
itself) and `AnyWear-Service-API` (the `api` submodule). Nothing else.

## The boundary

Each of the four token steps requests:

- `repositories: AnyWear-Client,AnyWear-Service-API` — an explicit allowlist, resolved
  against `owner: ${{ github.repository_owner }}`. Without `repositories`, the action
  creates a token that reaches **every** repository the App installation grants.
- `permission-contents: read` — the only permission asked for. Contents read covers
  `git fetch` of the two repositories above and nothing else. No Actions,
  Attestations, Pull requests or write grant is requested.

The action is
`actions/create-github-app-token@fee1f7d63c2ff003460e3d139729b119787bc349` (v2.2.2).
The pin is a commit, not the moving `v2` tag, so the credential-bearing step cannot
change under the workflow. The v3 line of the same action deprecates `app-id` in
favour of `client-id`; moving to it is a separate change from this reduction.

`scripts/source-ci-credential-boundary.mjs` holds the allowlist and validates the
workflows against it. `scripts/source-ci-credential-boundary.node-test.mjs` runs the
validator on the checked-in workflows and on mutated copies that widen the credential.
Both run in `pnpm run test:run`; no network, App installation or Service call is
involved, apart from the pinned action's own published metadata.

The Beta Client publication workflow, `.github/workflows/beta-deploy.yml`, carries no
App token: it uses a plain `actions/checkout@v4` at the built revision and assumes its
own role. It is outside this boundary and this change does not touch it.

## Caller secret mapping

`pipeline.yml` passes the one secret each called workflow declares:

```yaml
secrets:
  APP_PRIVATE_KEY: ${{ secrets.APP_PRIVATE_KEY }}
```

`secrets: inherit` is deliberately not used. A caller that inherits hands every secret
it can see to the called workflow, including secrets added later that have nothing to
do with the checkout, and it cannot be reviewed against the called workflow's declared
secrets.

## When the credential is unavailable

`APP_PRIVATE_KEY` is a repository secret, so it resolves to an empty value on events
that do not receive repository secrets:

- **Fork pull requests.** `pull_request` workflows from a fork run with a read-only
  `GITHUB_TOKEN` and no secrets. `generate-token` fails with the action's own
  `Input 'private-key' must be set` error and the job stops before any checkout.
- **Dependabot pull requests.** For the same reason, unless the secret is explicitly
  made available to Dependabot.
- **A repository or organisation without the secret configured**, including a fresh
  clone of this repository into another account.

Those paths fail loudly at the token step. They are not worked around: the private
`api` submodule cannot be fetched with the default credential, and handing untrusted
source a wider credential to make CI pass is exactly what this boundary prevents. To
run the Client checks on such a revision, run them locally where the submodule is
already initialised.

`vars.APP_ID` is a repository variable, which is readable in those contexts, so the
App ID itself is not the reason the step fails.

## App installation scope

The App installation's effective grants were not inspectable with the account used to
audit this change: `gh api /installation/repositories` and `gh api /user/installations`
both answer 403 for a user token. A restricted token request is a subset of whatever
the installation grants, so the reduction above holds whatever that configuration is,
but the installation configuration itself is not asserted here. To confirm the
installation grants in the GitHub UI, check the App's installation under the
organisation's settings and compare its repository selection with the two repositories
named above.
