# Source CI credentials

Client source CI holds one credential beyond the workflow's own `GITHUB_TOKEN`: a
GitHub App installation token, minted once, in one job. This note records what that
token may reach, why, and what happens when it is unavailable.

## What the credential is for

Generating the API client is the only step in Client source CI that reads content
from a private repository. `build.yml` runs `pnpm run orval`, which reads
`./api/anywear_openapi.yaml` (`orval.config.ts`), and then fails on
`git diff --exit-code` when the committed generated client does not match that
specification.

`.gitmodules` declares `api` at `https://github.com/git-malu/AnyWear-Service-API.git`,
which is private, so the default checkout credential cannot read it. The `build` job
therefore checks the specification out separately, with the App token:

| Step | What it does |
| --- | --- |
| `Checkout` | The Client repository, with the default `GITHUB_TOKEN`, no submodules |
| `Generate API specification token` | Mints the App token, scoped to one repository and one permission |
| `Checkout API specification` | Fetches `git-malu/AnyWear-Service-API` at the revision `.gitmodules` records, into `api/` |

`rust-check`, `test` and `browser` read no repository content: `cargo check` compiles
`src-tauri`, `pnpm run test:run` and `pnpm run test:browser` read the committed
generated client under `src/api/`, and the browser scenarios mock the Service, image
and identity boundaries. Those three jobs hold no App credential and fetch no
submodules, so they cannot leak one.

## The boundary

The single token step requests:

- `repositories: AnyWear-Service-API` — an explicit allowlist, resolved against
  `owner: ${{ github.repository_owner }}`. Without `repositories`, the action mints a
  token that reaches **every** repository the App installation grants.
- `permission-contents: read` — the only permission asked for. Contents read covers
  `git fetch` of that repository and nothing else. No Actions, Attestations, Pull
  requests or write grant is requested.

The action is
`actions/create-github-app-token@fee1f7d63c2ff003460e3d139729b119787bc349` (v2.2.2).
The pin is a commit, not the moving `v2` tag, so the credential-bearing step cannot
change under the workflow. The v3 line of the same action deprecates `app-id` in
favour of `client-id`; moving to it needs the App **Client ID**, which is not the
value of `vars.APP_ID`, and a new repository variable. That migration is a separate
change from this reduction.

`scripts/source-ci-credential-boundary.mjs` holds the allowlist and validates the
workflows against it. `scripts/source-ci-credential-boundary.node-test.mjs` runs the
validator on the checked-in workflows and on mutated copies that widen the credential.
Both run in `pnpm run test:run`; no network, App installation or Service call is
involved, apart from the pinned action's own published metadata.

The specification checkout pins its revision by full commit, so it fetches exactly the
revision that commit names. The node test compares that literal against the revision
the test names, which the maintainer updates with the submodule pointer; it does not
read the gitlink itself, so a submodule bump that changes neither the workflow literal
nor the test's revision passes this suite. `build.yml`'s own `Check codegen
consistency` step is what catches a specification revision the committed generated
client does not match: `pnpm run orval` regenerates the client and `git diff
--exit-code` fails when the result differs.

The Beta Client publication workflow, `.github/workflows/beta-deploy.yml`, carries no
App token: it uses a plain `actions/checkout@v4` at the built revision and assumes its
own role. It is outside this boundary and this change does not touch it.

## Caller secret mapping

`pipeline.yml` passes the one secret to the one workflow that declares it:

```yaml
  build:
    uses: ./.github/workflows/build.yml
    secrets:
      APP_PRIVATE_KEY: ${{ secrets.APP_PRIVATE_KEY }}

  test:
    uses: ./.github/workflows/test.yml

  browser:
    uses: ./.github/workflows/browser.yml
```

`secrets: inherit` is deliberately not used. A caller that inherits hands every secret
it can see to the called workflow, including secrets added later that have nothing to
do with the specification, and it cannot be reviewed against the called workflow's
declared secrets. `test.yml` and `browser.yml` declare no secret at all, because no
step in them uses one.

## When the credential is unavailable

`APP_PRIVATE_KEY` is a repository secret, so it resolves to an empty value on events
that do not receive repository secrets:

- **Fork pull requests.** `pull_request` workflows from a fork run with a read-only
  `GITHUB_TOKEN` and no secrets. `Generate API specification token` fails with
  `[@octokit/auth-app] privateKey option is required`, before any API call or
  checkout of the specification.
- **Dependabot pull requests.** For the same reason, unless the secret is explicitly
  made available to Dependabot.
- **A repository or organisation without the secret configured**, including a fresh
  clone of this repository into another account.

Those paths fail loudly at the token step. They are not worked around: the private
specification cannot be fetched with the default credential, `pnpm run orval` cannot
run without it, and handing untrusted source a wider credential to make CI pass is
exactly what this boundary prevents. To run the Client checks on such a revision, run
them locally where the submodule is already initialised.

`vars.APP_ID` is a repository variable. Context availability for variables on
fork-triggered runs is documented less clearly than it is for secrets, and this
repository has no fork run to observe; the outcome is fail-closed either way, since an
empty `app-id` is also a required-input failure.

## App installation scope

The App installation's effective grants were not inspectable with the account used to
audit this change: `gh api /installation/repositories` and `gh api /user/installations`
both answer 403 to a user token, and `gh api /app/installations` answers 401 without an
App JWT. A restricted token request cannot exceed the installation — GitHub cannot
grant an installation token access to a repository or a permission the installation was
not granted — so the request above is a subset of whatever the installation holds.

What that does **not** establish is the installation's own repository selection and
permission set, and therefore the residual excess, if any, on repositories this
workflow no longer names. To check it in the GitHub UI, read the App's installation
under the organisation's settings and compare its repository selection with the single
repository named above. One installation fact is evidenced from CI itself: the trusted
`main` run on `7b92ace` minted a token and fetched the private `AnyWear-Service-API`
revision successfully, so the installation covers that repository.
