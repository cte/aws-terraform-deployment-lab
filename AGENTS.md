# AGENTS.md

Use this file as the short operational reference for working in this repo.
It captures the auth model, Terraform defaults, AWS gotchas, and the current
account blockers that matter during day-to-day work.

It is intentionally practical. Use it together with:

- [README.md](./README.md)
- [GETTING_STARTED.md](./GETTING_STARTED.md)
- [packages/terraform/README.md](./packages/terraform/README.md)

## Repo Shape

This is a `pnpm` workspace monorepo.

- `packages/app`: Vite + React + TanStack Router front-end, Fastify + Zod API, BullMQ worker
- `packages/terraform`: Terraform project plus IAM handoff docs and validation scripts

The root `package.json` is the main operator entrypoint.

## Default Auth Model

The current default auth path is:

- root [`.env`](./.env)
- local `.env.keys`
- `dotenvx`
- AWS default credential chain

Important consequence:

- the root `pnpm` wrappers inject AWS credentials from the repo-managed `.env`
- Terraform currently uses `aws_profile = null`
- [packages/terraform/backend.hcl](./packages/terraform/backend.hcl) currently omits `profile`

Root wrappers that use the repo-managed AWS env:

- `pnpm aws:whoami`
- `pnpm terraform:init`
- `pnpm terraform:validate`
- `pnpm terraform:plan`
- `pnpm terraform:apply`
- `pnpm terraform:destroy`
- `pnpm dev`
- `pnpm dev:worker`

## Running AWS CLI Commands

For ad hoc AWS CLI work, prefer the same auth path the repo uses:

```bash
pnpm exec dotenvx run -fk .env.keys -f .env -- aws sts get-caller-identity
```

General pattern:

```bash
pnpm exec dotenvx run -fk .env.keys -f .env -- aws <service> <operation> ...
```

This keeps CLI behavior aligned with the root scripts and avoids confusion about
which credentials are active.

## `dotenvx` JSON Gotcha

`dotenvx run` prints a banner line before command output, for example:

```text
⟐ injected env (5) from .env · dotenvx@...
```

That breaks `jq` and any tooling expecting clean JSON on stdout.

If piping AWS CLI JSON into `jq`, strip the first banner line first:

```bash
pnpm exec dotenvx run -fk .env.keys -f .env -- aws iam list-roles --output json \
  | sed '1{/^⟐ injected env /d;}' \
  | jq .
```

Same rule applies when capturing output inside shell scripts.

## Optional Local AWS CLI Profile

The repo does not require a named profile, but it can be useful for manual work.

Tested pattern for creating a local profile from the encrypted repo credentials:

```bash
PROFILE=ember-migration \
pnpm exec dotenvx run -fk .env.keys -f .env -- bash -lc '
  aws configure set region "$AWS_REGION" --profile "$PROFILE"
  aws configure set output json --profile "$PROFILE"
  aws configure set aws_access_key_id "$AWS_ACCESS_KEY_ID" --profile "$PROFILE"
  aws configure set aws_secret_access_key "$AWS_SECRET_ACCESS_KEY" --profile "$PROFILE"
'
```

Verify it with:

```bash
aws sts get-caller-identity --profile ember-migration
```

If you choose the profile-based path, avoid the root `pnpm terraform:*` wrappers.
Use direct Terraform commands from `packages/terraform` instead.

Reason:

- the root wrappers intentionally inject repo-managed AWS env vars
- those env vars will win over a named profile unless you bypass the wrappers

## Current Terraform Defaults

Current backend:

- bucket: `ember-migration-tfstate-671922733475-us-east-2`
- key: `ember-migration/test/terraform.tfstate`
- region: `us-east-2`

Current workload defaults from [terraform.tfvars](./packages/terraform/terraform.tfvars):

- `aws_region = "us-east-2"`
- `project = "ember-migration"`
- `environment = "test"`
- `create_iam_roles = false`
- `assets_bucket_name = "ember-migration-assets"`
- `ecs_execution_role_name = "ember-migration-ecs-execution-role"`
- `ecs_task_role_name = "ember-migration-ecs-task-role"`

Important consequence:

- Terraform is in external-IAM mode
- Terraform will look up pre-created ECS roles by name
- Terraform will not create the ECS roles itself

## Recommended Terraform Workflow

Initialize and validate:

```bash
pnpm terraform:init
pnpm terraform:validate
```

Before planning, run the external-IAM preflight:

```bash
pnpm exec dotenvx run -fk .env.keys -f .env -- \
  packages/terraform/scripts/preflight-external-iam.sh \
  --tfvars packages/terraform/terraform.tfvars \
  --backend-config packages/terraform/backend.hcl
```

Then:

```bash
pnpm terraform:plan
```

## Current AWS Reality

Current deploy principal:

- `arn:aws:iam::671922733475:user/ember-terraform`

Verified working:

- repo-managed AWS credentials
- Terraform backend access
- ECR auth token retrieval
- Terraform backend in `us-east-2`

Current known blockers for a full Terraform deploy:

- missing `ember-migration-ecs-execution-role`
- missing `ember-migration-ecs-task-role`
- missing `AWSServiceRoleForElasticLoadBalancing`
- missing `AWSServiceRoleForRDS`
- missing `AWSServiceRoleForElastiCache`

Because `create_iam_roles = false`, these missing roles are the expected first
failure point in preflight and plan.

## Observability Limits

The current deploy principal is restricted in IAM introspection.

Notably, it cannot read its own user attachments via:

- `iam:GetUser`
- `iam:ListAttachedUserPolicies`
- `iam:ListGroupsForUser`

So when validating AWS setup, rely on:

- direct existence checks (`aws iam get-role ...`)
- Terraform preflight behavior
- actual `terraform plan` / `apply` failures

Do not assume you can fully inspect how permissions were granted internally.

## Local App Workflow

Create package-local app config:

```bash
cp packages/app/.env.example packages/app/.env
```

Start local services:

```bash
docker compose -f packages/app/docker-compose.yml up -d
```

Run web:

```bash
pnpm dev
```

Run worker:

```bash
pnpm dev:worker
```

## Useful Commands

Identity:

```bash
pnpm aws:whoami
```

Terraform:

```bash
pnpm terraform:init
pnpm terraform:validate
pnpm terraform:plan
pnpm terraform:apply
```

Formatting:

```bash
pnpm terraform:fmt
pnpm format
```

## If You Change Auth Strategy

If switching from repo-managed env to SSO or a named profile:

1. update [packages/terraform/terraform.tfvars](./packages/terraform/terraform.tfvars)
2. update [packages/terraform/backend.hcl](./packages/terraform/backend.hcl)
3. use direct Terraform commands from [packages/terraform](./packages/terraform)
4. do not rely on the root wrappers unless you also want the root `.env` injected
