# Ember Migration Lab

This repository is a small but real end-to-end AWS verification project for an
Ember migration effort.

It has two jobs:

1. Provision a representative AWS stack with Terraform so we can observe the
   real permissions and IAM roles required to stand it up.
2. Deploy a deliberately simple application that touches every major runtime
   component in that stack.

The result is a repo that covers infrastructure, application runtime, IAM
handoff, and an externally managed IAM validation path in one place.

## What Is In Here

- A `pnpm` workspace with `turbo` orchestration
- A root `.env` managed with `dotenvx`, with only `AWS_SECRET_ACCESS_KEY` encrypted
- A Vite + React + TanStack Router front-end using shadcn/ui and Tailwind 4
- A Fastify + Zod API
- A BullMQ worker backed by Redis
- Postgres for job metadata
- S3 for uploaded files and processed results
- Terraform modules for VPC, ALB, ECS/Fargate, ECR, S3, RDS, ElastiCache,
  CloudWatch Logs, Secrets Manager, SSM, and IAM lookups or creation
- CloudTrail-derived IAM policy drafts for the human Terraform runner
- An externally managed IAM validation harness that exercises this exact Terraform stack

## Architecture

The application is intentionally narrow: upload a text or CSV file, enqueue a
job, process it in a worker, and store the result.

Runtime flow:

1. A browser reaches the public ALB.
2. The ALB forwards traffic to the ECS `web` service.
3. The `web` service serves the React app and API.
4. The API stores uploads and result files in S3.
5. The API writes job state to Postgres and enqueues work in Redis.
6. The ECS `worker` service consumes BullMQ jobs from Redis.
7. The worker reads from S3, computes a summary, writes results back to S3,
   and updates Postgres.

Infrastructure flow:

- Terraform provisions the networking, data stores, compute, IAM lookups, and
  deployment scaffolding.
- The application image is built locally and pushed to ECR.
- ECS deploys the same image twice: once as `web`, once as `worker`.

## Repo Layout

```text
packages/app         Application source, Dockerfile, and local dev docs
packages/terraform   Terraform project, IAM handoff docs, policies, and validation scripts
```

Key files:

- [AWS_ACCOUNT_STATUS.md](./AWS_ACCOUNT_STATUS.md): verified AWS account state, blockers, and readiness checks
- [GETTING_STARTED.md](./GETTING_STARTED.md): concrete onboarding steps for a new engineer
- [packages/app/README.md](./packages/app/README.md): app-specific local development notes
- [packages/terraform/README.md](./packages/terraform/README.md): Terraform workflow notes
- [packages/terraform/iam-handoff.md](./packages/terraform/iam-handoff.md): concise IAM handoff
- [packages/terraform/terraform-runner-permissions.md](./packages/terraform/terraform-runner-permissions.md):
  CloudTrail-derived runner analysis
- [packages/terraform/external-iam-validation.md](./packages/terraform/external-iam-validation.md):
  externally managed IAM validation harness

## Workspace Tooling

The repo now runs as a `pnpm` workspace rooted here.

- `turbo` orchestrates package scripts from the workspace root.
- `dotenvx` protects the root `.env` file while allowing non-secret AWS values to stay
  in plaintext and keeping `AWS_SECRET_ACCESS_KEY` encrypted.
- `packages/app/.env` remains package-local and holds non-secret application config
  for local development.
- Commit the root `.env`. Keep `.env.keys` local and out of version control.

## AWS Auth

This repo currently supports four AWS auth paths:

1. Repo-managed root `.env` plus local `.env.keys`
2. AWS SSO via IAM Identity Center
3. A named shared-credentials profile backed by an access key
4. Ambient environment variables

The current default is option 1.

### Default Repo-Managed Credentials

The root workspace scripts use `dotenvx` and the root `.env` file:

```bash
pnpm aws:whoami
pnpm dev
pnpm dev:worker
pnpm terraform:init
pnpm terraform:plan
pnpm terraform:apply
```

This is the current local default because:

- [packages/terraform/terraform.tfvars](./packages/terraform/terraform.tfvars) sets `aws_profile = null`
- your local `packages/terraform/backend.hcl` should omit `profile`
- the root `pnpm` scripts inject AWS environment variables from the root `.env`

### Optional SSO Flow

If you want to use SSO instead, configure a profile with the AWS CLI:

```bash
aws configure sso --profile <sso-profile>
aws sso login --profile <sso-profile>
aws sts get-caller-identity --profile <sso-profile>
```

Then update:

- [packages/terraform/terraform.tfvars](./packages/terraform/terraform.tfvars) with `aws_profile = "<sso-profile>"`
- your local `packages/terraform/backend.hcl` with `profile = "<sso-profile>"`

For SSO-backed Terraform runs, use direct commands from
[packages/terraform](./packages/terraform) rather than the root `pnpm`
wrappers, because the root wrappers intentionally inject the repo-managed AWS
environment variables from `.env`.

### Optional Named Access-Key Profile

If you prefer a named shared-credentials profile instead of the repo-managed
root `.env`, configure it with:

```bash
aws configure --profile <access-key-profile>
aws sts get-caller-identity --profile <access-key-profile>
```

Then set the same `aws_profile` and backend `profile` values described above.

### Optional Ambient Environment Variables

If your shell already has AWS credentials exported, Terraform can use the
default AWS credential chain directly. In that case:

- set `aws_profile = null` in [packages/terraform/terraform.tfvars](./packages/terraform/terraform.tfvars)
- omit `profile` from your local `packages/terraform/backend.hcl`
- use direct commands from [packages/terraform](./packages/terraform) rather than the
  root `pnpm` wrappers if you do not want the repo-managed `.env` values injected

## Application Stack

Front-end:

- Vite
- React
- TanStack Router
- shadcn/ui
- Tailwind 4

Back-end:

- Fastify
- Zod
- BullMQ
- `pg`
- AWS SDK v3

Deployment shape:

- One Docker image
- One ECS `web` service
- One ECS `worker` service
- Shared ECR repository

## Terraform Stack

The Terraform project provisions:

- VPC with public and private subnets
- Internet gateway and NAT gateway
- Security groups for ALB, ECS, RDS, and Redis
- Application load balancer and target group
- ECS cluster, task definitions, and services
- ECR repository and lifecycle policy
- S3 application bucket
- RDS PostgreSQL
- ElastiCache Redis
- CloudWatch log group
- Secrets Manager secret for the generated database password
- SSM parameter for app config

Two IAM operating modes are supported:

- `create_iam_roles = true`: self-managed test accounts where Terraform creates
  the ECS roles directly
- `create_iam_roles = false`: environments where Terraform looks
  up pre-created roles by name

The externally managed IAM path also supports explicit role-name overrides if
the pre-created roles use names that differ from the defaults.

## IAM And Permission Artifacts

This repo now contains three distinct IAM outputs:

1. Runtime/service-role requirements for externally managed IAM:
   [packages/terraform/iam-handoff.md](./packages/terraform/iam-handoff.md)
2. CloudTrail-derived Terraform runner analysis:
   [packages/terraform/terraform-runner-permissions.md](./packages/terraform/terraform-runner-permissions.md)
3. Draft runner policies:
   [packages/terraform/policies/terraform-runner-external-iam.json](./packages/terraform/policies/terraform-runner-external-iam.json)
   and
   [packages/terraform/policies/terraform-runner-self-managed-bootstrap.json](./packages/terraform/policies/terraform-runner-self-managed-bootstrap.json)

These are intentionally separate because the Terraform runner, the ECS task
execution role, and the ECS task role solve different problems.

## Externally Managed IAM Validation Harness

The recommended validation path is not a second application. It is a harness
around this exact Terraform stack.

The harness lives in:

- [packages/terraform/scripts/preflight-external-iam.sh](./packages/terraform/scripts/preflight-external-iam.sh)
- [packages/terraform/scripts/run-external-iam-validation.sh](./packages/terraform/scripts/run-external-iam-validation.sh)
- [packages/terraform/external-iam-validation.tfvars.example](./packages/terraform/external-iam-validation.tfvars.example)
- [packages/terraform/external-iam-validation.md](./packages/terraform/external-iam-validation.md)

What it does:

- Confirms the pre-created IAM roles exist and have the expected trust
  principals
- Validates that `create_iam_roles = false`
- Initializes Terraform with a disposable backend key
- Produces a real plan against this repo
- Optionally bootstraps a fresh ECR repository, builds a `linux/amd64` image,
  applies the stack, waits for ECS to stabilize, and checks the ALB health
  endpoint

That gives us a real proof that externally managed IAM inputs wire correctly
into Terraform without introducing a second codebase that can drift.

## Local Development

Install the workspace dependencies once at the root:

```bash
pnpm install
```

Application:

```bash
cp packages/app/.env.example packages/app/.env
docker compose -f packages/app/docker-compose.yml up -d
pnpm aws:whoami
pnpm dev
pnpm dev:worker
```

Infrastructure:

```bash
pnpm terraform:init
pnpm terraform:plan
pnpm terraform:apply
```

The root `pnpm` scripts above use `dotenvx` and the root `.env` for
AWS credentials. See [packages/terraform/README.md](./packages/terraform/README.md)
for the direct Terraform workflow and alternate auth options.

## Deployment Notes

There are two important operational details worth calling out:

1. ECS/Fargate needs a `linux/amd64` image. Local Docker defaults on Apple
   Silicon can produce an incompatible manifest if the platform is not set
   explicitly.
2. A brand-new disposable environment does not have an ECR repository yet, so
   the validation harness bootstraps the repository first, then builds and
   pushes the image, then runs the full apply.

The safe image publish pattern is:

```bash
docker buildx build \
  --platform linux/amd64 \
  --push \
  -f packages/app/Dockerfile \
  -t <ecr-repository-url>:<tag> \
  .
```

## Current State

The repository currently includes:

- A working deployed application in the test account
- A documented IAM handoff
- CloudTrail-derived runner policy drafts
- An externally managed IAM validation harness
- A `pnpm` workspace root with `turbo` and `dotenvx`-managed AWS credentials
- Both repo-managed access-key auth and optional SSO/profile-based auth paths

The current test deployment is intentionally disposable. Treat any live ALB
hostname or account-specific values as environment data, not stable product
interfaces.

## Recommended Reading Order

If you are new to the repo, read in this order:

1. This file
2. [packages/terraform/iam-handoff.md](./packages/terraform/iam-handoff.md)
3. [packages/terraform/external-iam-validation.md](./packages/terraform/external-iam-validation.md)
4. [packages/terraform/README.md](./packages/terraform/README.md)
5. [packages/app/README.md](./packages/app/README.md)
