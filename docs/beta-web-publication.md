# Beta web publication

The manual [Beta workflow](../.github/workflows/beta-deploy.yml) publishes the
reviewed `main` Client revision independently of Infra source. It reads the stable
`ClientBucketName` and `ClientDistributionId` outputs from
`AnyWearPlatformStack-beta`, `ApiBaseUrl` from `AnyWearWorkloadStack-beta`, and the
`/anywear/beta/cognito_user_pool_id` and `cognito_client_id` SSM parameters. The
build's `SOURCE_COMMIT_SHA` remains the exact workflow SHA. There is no Infra
checkout or Client-owned Infra pin.

## Protected Beta configuration

Before activating the new role's consumer, the manager reviews and reads back the
`beta` environment's actual protection rules and deployment branch policy. Use
reviewed protection rules and a `main`-restricted policy where the repository plan
supports them. If required reviewers or branch policies are unavailable, record
the limitation and the accepted explicit freeze, dispatch review and handoff
procedure in the issue before activation. The workflow still enforces `main` and
the exact assigned SHA. An environment named `beta` alone does not prove configured
protections. Configure these variables after the new role has been provisioned and
its effective policy reviewed. Missing configuration fails before AWS credentials
are assumed; there is no legacy-role fallback.

| Variable | Value |
| --- | --- |
| `ENABLE_BETA_DEPLOY` | `true` only during an assigned Client publish window; retain the existing repository activation gate |
| `AWS_ACCOUNT_ID` | `650880818323` |
| `AWS_REGION` | `ap-east-1` |
| `CLIENT_PUBLISH_ROLE_ARN` | `arn:aws:iam::650880818323:role/beta-client-publish-role` |
| `CLIENT_PUBLISH_WINDOW_ID` | Unique manager-assigned identifier; letters, digits, `.`, `_`, `-`, maximum 128 characters |
| `CLIENT_PUBLISH_WINDOW_CLIENT_SHA` | Full lowercase 40-character reviewed Client SHA on `main` |
| `CLIENT_PUBLISH_WINDOW_EXPIRES_AT` | Future UTC deadline, exactly `YYYY-MM-DDTHH:mm:ssZ` |
| `CLIENT_PUBLISH_WINDOW_RECORD_URL` | AnyWear issue-comment URL recording the manager assignment |

Infra owns the role and trusts the immutable Client repository identity only for
the protected Beta environment. The Client principal needs `DescribeStacks` on
the two named stacks, `GetParameter` on the two named Cognito parameters,
`ListBucket` and object `GetObject`/`PutObject`/`DeleteObject` on the existing Client
bucket, and `CreateInvalidation` on its distribution. It cannot deploy CDK/CFN,
assume infrastructure deployment roles or push Service images.

## Manager-assigned window and handoff

1. Record the exact Client SHA, current Service/Infra tuple, owner, window ID,
   deadline, permitted publish, recovery input and handoff condition in the owning
   AnyWear issue. Freeze conflicting Infra, Service and E2E mutation triggers,
   merges and dispatches. Inventory Actions jobs, local tasks, CFN/ECS operations
   and nested helpers; verify cessation. A timeout or switch change alone does not
   prove that a prior writer stopped.
2. Set and read back the protected environment variables above and the existing
   activation switches. Verify the configured environment protections or the
   manager's recorded supported operational gates. Dispatch `beta-deploy.yml` from
   `main` with the exact `writer_window` ID. Review the actual run ID/attempt and SHA
   through the configured approval procedure.
3. The workflow validates its configuration snapshot before AWS access and again
   immediately before S3 publication. It requires the selected SHA, exact window,
   valid deadline and dedicated role. Its concurrency group serializes only Client
   runs; it does not coordinate Infra, Service or E2E. Environment variables are
   captured for the job, so changing them after a run starts cannot revoke that
   snapshot. Stop/cancel an unwanted run and verify all resulting operations finish
   before assigning a successor. An expiry blocks the next check; it does not abort
   an already-started S3 sync or CloudFront request.
4. Record the successful run/attempt, source, bucket/distribution and invalidation
   ID from the summary. Confirm invalidation completion and observe the served
   `build-metadata.json` Client SHA and endpoints. A successful upload or requested
   invalidation alone is not runtime qualification. The issue worker coordinates
   exact-tuple E2E evidence in `AnyWear-E2E`.
5. Disable the Client activation switches, clear the window variables and read back
   configuration. Verify no Client job or cloud publication remains in flight,
   record the handoff, then release the next writer. Every retry, rerun or recovery
   requires a fresh manager assignment and window ID after verified cessation;
   never reuse a stale window just because its deadline has not elapsed.

For the #54 migration, new roles are added and exercised before the shared role's
Client subject/permissions are retired. The initial Infra reconciliation retains
the running Client. A Client publish requires its own reviewed selection and
window. [Accepted ADR-0021](https://github.com/git-malu/AnyWear-Meta/blob/a8eba148cfef4c124c46010276e66e4c8c41e420/architecture/ADR/0021-shared-infrastructure-repository.md)
defines the freeze, handoff, retirement and final qualification gates.
