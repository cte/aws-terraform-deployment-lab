# AWS Account Status

This document captures the current known state of the shared AWS test account
and what is still required to make this Terraform stack deployable.

It is based on direct AWS CLI checks performed from this repo using the current
deploy credentials, plus actual Terraform behavior against the live account.

## Current Defaults

Current repo defaults:

- AWS account: `671922733475`
- workload region: `us-east-2`
- Terraform backend bucket: `ember-migration-tfstate-671922733475-us-east-2`
- Terraform backend key: `ember-migration/test/terraform.tfstate`
- Terraform mode: `create_iam_roles = false`
- assets bucket name: `ember-migration-assets`
- ECS execution role name: `ember-migration-ecs-execution-role`
- ECS task role name: `ember-migration-ecs-task-role`

Important consequence:

- Terraform is in externally managed IAM mode.
- Terraform will look up pre-created ECS roles by name.
- Terraform will not create those roles itself.

## Verified Working

The following are currently verified:

- AWS authentication works for the deploy principal:
  - `arn:aws:iam::671922733475:user/ember-terraform`
- Terraform backend access works against:
  - `ember-migration-tfstate-671922733475-us-east-2`
- Terraform backend initialization works via:
  - `pnpm terraform:init`
- ECR auth token retrieval works for the current deploy principal
- Terraform preflight reaches the IAM lookup stage successfully

This means local setup and baseline AWS access are working.

## Current Known Blockers

The stack is not yet deployable because these IAM dependencies are still
missing from the account:

- `ember-migration-ecs-execution-role`
- `ember-migration-ecs-task-role`
- `AWSServiceRoleForElasticLoadBalancing`
- `AWSServiceRoleForRDS`
- `AWSServiceRoleForElastiCache`

Current observed preflight behavior:

- credentials are valid
- backend bucket is reachable
- preflight then fails on:
  - missing `ember-migration-ecs-execution-role`

That is the expected first failure in the current configuration.

## Required IAM Resources

### ECS execution role

- Name: `ember-migration-ecs-execution-role`
- Trust principal: `ecs-tasks.amazonaws.com`
- Required actions:
  - `ecr:GetAuthorizationToken`
  - `ecr:BatchCheckLayerAvailability`
  - `ecr:GetDownloadUrlForLayer`
  - `ecr:BatchGetImage`
  - `logs:CreateLogStream`
  - `logs:PutLogEvents`
  - `secretsmanager:GetSecretValue`
  - `ssm:GetParameters`

### ECS task role

- Name: `ember-migration-ecs-task-role`
- Trust principal: `ecs-tasks.amazonaws.com`
- Required actions:
  - `s3:ListBucket` on `arn:aws:s3:::ember-migration-assets`
  - `s3:GetObject` on `arn:aws:s3:::ember-migration-assets/*`
  - `s3:PutObject` on `arn:aws:s3:::ember-migration-assets/*`
  - `s3:DeleteObject` on `arn:aws:s3:::ember-migration-assets/*`

Important correction versus the earliest handoff:

- `s3:ListBucket` is required
- the scope is now the fixed bucket `ember-migration-assets`

### AWS service-linked roles

These must exist in the account:

- `AWSServiceRoleForElasticLoadBalancing`
- `AWSServiceRoleForRDS`
- `AWSServiceRoleForElastiCache`

Alternative:

- instead of pre-creating those three service-linked roles, the account owner
  could temporarily allow:
  - `iam:CreateServiceLinkedRole`
  - on `arn:aws:iam::671922733475:user/ember-terraform`

## Validation Commands

These are the exact checks used to confirm the current state.

Identity:

```bash
pnpm aws:whoami
```

Terraform readiness:

```bash
pnpm exec dotenvx run -fk .env.keys -f .env -- \
  packages/terraform/scripts/preflight-external-iam.sh \
  --tfvars packages/terraform/terraform.tfvars \
  --backend-config packages/terraform/backend.hcl
```

Role existence checks:

```bash
pnpm exec dotenvx run -fk .env.keys -f .env -- \
  aws iam get-role --role-name ember-migration-ecs-execution-role

pnpm exec dotenvx run -fk .env.keys -f .env -- \
  aws iam get-role --role-name ember-migration-ecs-task-role

pnpm exec dotenvx run -fk .env.keys -f .env -- \
  aws iam get-role --role-name AWSServiceRoleForElasticLoadBalancing

pnpm exec dotenvx run -fk .env.keys -f .env -- \
  aws iam get-role --role-name AWSServiceRoleForRDS

pnpm exec dotenvx run -fk .env.keys -f .env -- \
  aws iam get-role --role-name AWSServiceRoleForElastiCache
```

If the IAM side is ready, preflight should pass and `pnpm terraform:plan`
should proceed past the IAM lookup stage.

## Observability Limits

The current deploy principal is restricted in IAM introspection.

In particular, it cannot inspect its own policy attachments through:

- `iam:GetUser`
- `iam:ListAttachedUserPolicies`
- `iam:ListGroupsForUser`

Practical consequence:

- we can directly verify whether required roles exist
- we can directly verify how Terraform behaves
- we cannot fully inspect the internal policy-attachment path that granted the
  deploy principal its current permissions

When in doubt, trust:

- direct `aws iam get-role` checks
- Terraform preflight output
- real `terraform plan` and `terraform apply` behavior

## Not Fully Re-Verified Here

The following are not the current blocker and were not fully re-audited in this
document:

- exact internal attachment of the Terraform runner policy
- full SSO permission-set wiring
- the full image-push permission surface beyond confirmed ECR auth token access

Those may still matter operationally, but they are not the current reason
Terraform is blocked.
