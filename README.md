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
app/         Application source, Dockerfile, and local dev docs
terraform/   Terraform project, IAM handoff docs, policies, and validation scripts
```

Key files:

- [app/README.md](./app/README.md): app-specific local development notes
- [terraform/README.md](./terraform/README.md): Terraform workflow notes
- [terraform/iam-handoff.md](./terraform/iam-handoff.md): concise IAM handoff
- [terraform/terraform-runner-permissions.md](./terraform/terraform-runner-permissions.md):
  CloudTrail-derived runner analysis
- [terraform/external-iam-validation.md](./terraform/external-iam-validation.md):
  externally managed IAM validation harness

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
   [terraform/iam-handoff.md](./terraform/iam-handoff.md)
2. CloudTrail-derived Terraform runner analysis:
   [terraform/terraform-runner-permissions.md](./terraform/terraform-runner-permissions.md)
3. Draft runner policies:
   [terraform/policies/terraform-runner-external-iam.json](./terraform/policies/terraform-runner-external-iam.json)
   and
   [terraform/policies/terraform-runner-self-managed-bootstrap.json](./terraform/policies/terraform-runner-self-managed-bootstrap.json)

These are intentionally separate because the Terraform runner, the ECS task
execution role, and the ECS task role solve different problems.

## Externally Managed IAM Validation Harness

The recommended validation path is not a second application. It is a harness
around this exact Terraform stack.

The harness lives in:

- [terraform/scripts/preflight-external-iam.sh](./terraform/scripts/preflight-external-iam.sh)
- [terraform/scripts/run-external-iam-validation.sh](./terraform/scripts/run-external-iam-validation.sh)
- [terraform/external-iam-validation.tfvars.example](./terraform/external-iam-validation.tfvars.example)
- [terraform/external-iam-validation.md](./terraform/external-iam-validation.md)

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

Application:

```bash
cd app
docker compose up -d
pnpm dev
pnpm dev:worker
```

Infrastructure:

```bash
cd terraform
aws sso login --profile <profile>
terraform init -backend-config=backend.hcl
terraform plan -out=tfplan
terraform apply tfplan
```

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
  -t <ecr-repository-url>:<tag> \
  app
```

## Current State

The repository currently includes:

- A working deployed application in the test account
- A documented IAM handoff
- CloudTrail-derived runner policy drafts
- An externally managed IAM validation harness

The current test deployment is intentionally disposable. Treat any live ALB
hostname or account-specific values as environment data, not stable product
interfaces.

## Recommended Reading Order

If you are new to the repo, read in this order:

1. This file
2. [terraform/iam-handoff.md](./terraform/iam-handoff.md)
3. [terraform/external-iam-validation.md](./terraform/external-iam-validation.md)
4. [terraform/README.md](./terraform/README.md)
5. [app/README.md](./app/README.md)
