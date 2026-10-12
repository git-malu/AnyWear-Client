# Beta web publication

The manual [Beta workflow](../.github/workflows/beta-deploy.yml) publishes the
reviewed `main` Client revision independently of Infra source. It reads the stable
`ClientBucketName` and `ClientDistributionId` outputs from
`AnyWearPlatformStack-beta`, `ApiBaseUrl` from `AnyWearWorkloadStack-beta`, and the
`/anywear/beta/cognito_user_pool_id` and `cognito_client_id` SSM parameters. The
build's `SOURCE_COMMIT_SHA` remains the exact workflow SHA. Client does not check
out or pin Infra.

## Environment and role configuration

| Beta variable | Value |
| --- | --- |
| `ENABLE_BETA_DEPLOY` | `true` to enable the manual publisher; `false` suspends new runs |
| `AWS_ACCOUNT_ID` | `650880818323` |
| `AWS_REGION` | `ap-east-1` |
| `CLIENT_PUBLISH_ROLE_ARN` | `arn:aws:iam::650880818323:role/beta-client-publish-role` |

The job uses the `beta` environment and GitHub OIDC. Infra owns the dedicated role,
whose trust is limited to the immutable Client repository identity and the Beta
environment. The role needs `DescribeStacks` on the two named stacks,
`GetParameter` on the two Cognito parameters, `ListBucket` and object
`GetObject`/`PutObject`/`DeleteObject` on the existing Client bucket, and
`CreateInvalidation` on its distribution. It cannot deploy CDK/CFN, assume
infrastructure deployment roles or push Service images. Missing role configuration
fails before AWS access; there is no shared-role fallback.

Read back the environment's actual protection rules and branch policy before
activation. Use supported environment protections and a `main` branch policy;
record provider limitations and operational coordination where needed. An
environment named `beta` alone does not prove configured protections. Source delivery
does not provision the role or configure those protections.

## Publish and verify

1. Select the reviewed Client revision on `main` and dispatch `beta-deploy.yml`
   from that branch. Publication has no migration window token, issue-comment URL
   or deadline inputs. Release coordination belongs in the operation record,
   rather than a permanent dependency on an Issue or receipt.
2. Before AWS access, the workflow checks the original repository identity, manual
   main workflow, exact workflow/source SHA, account, region and dedicated role.
   Checkout is pinned to that SHA. After OIDC assumption, it verifies the actual
   account and role/session through STS before resolving the deployed interfaces.
3. The existing build writes `dist/build-metadata.json`. Immediately before S3
   publication, the workflow checks that the file's schema, component and
   `source_commit` match the running Client workflow. Missing, invalid or different
   metadata stops publication. It then syncs the built assets and requests a
   CloudFront invalidation.
4. Record the successful run/attempt, source, bucket/distribution and invalidation
   ID from the summary. Confirm invalidation completion and observe the served
   `build-metadata.json` Client SHA and endpoints. An upload or invalidation request
   alone is not runtime qualification; `AnyWear-E2E` qualifies the actual deployed
   Client, Service components and Infra tuple.

The `beta-client-publish` concurrency group serializes Client publication and does
not cancel an active upload. It is local to this repository, independently of
Infra's deployment queue. Coordinate conflicting maintenance/deployment operations
and verify prior jobs/cloud operations finish before changing ownership. Disabling
an activation variable does not revoke a job's existing configuration snapshot or
stop an already-started upload. A retry or recovery uses the ordinary main workflow
and the same source/role/build verification; no new scheduling token is required.

## Migration status

The [revised AnyWear #54 plan](https://github.com/git-malu/AnyWear/issues/54#issuecomment-6059823426)
uses one explicitly authorized Beta maintenance stop, migration and restart. The
initial Infra reconciliation retains the running Client until an independent
Client selection is published. Old `CLIENT_PUBLISH_WINDOW_*` variables are unused
by this workflow and can be removed during authorized configuration reconciliation.
Role provisioning, effective old-authority retirement, actual independent
publication and final E2E remain runtime delivery evidence, separate from this
source change.
