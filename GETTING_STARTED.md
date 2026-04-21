# Getting Started

This is the fastest way to get a new engineer productive in this repo.

It covers:

- local prerequisites
- how the repo-managed AWS credentials work
- how to load the encrypted AWS keypair
- how to mirror that keypair into a local AWS CLI profile
- how to verify the current Terraform setup

## Current Defaults

At the time of writing, this repo is configured against the shared test account with:

- AWS account: `671922733475`
- workload region: `us-east-2`
- Terraform backend bucket: `ember-migration-tfstate-671922733475-us-east-2`
- Terraform mode: `create_iam_roles = false`

Important consequence:

- Terraform expects pre-created IAM roles to exist.
- If those roles are not present yet, `terraform plan` will fail on IAM role lookup.
- That is an AWS-account readiness problem, not a local setup problem.

## Prerequisites

Install the local tools first.

On macOS with Homebrew:

```bash
brew install node awscli terraform jq
brew install pnpm
brew install --cask docker
```

Notes:

- `pnpm` is used at the workspace root.
- `aws` must be AWS CLI v2.
- `jq` is used by some validation scripts.
- Docker Desktop is one option. OrbStack is also fine if you already use it.

## Clone And Install

```bash
git clone <repo-url>
cd aws-terraform-deployment-lab
pnpm install
```

## AWS Credentials In This Repo

This repo uses a committed root [`.env`](./.env) file plus a local `.env.keys` file.

How it works:

- [`.env`](./.env) contains the AWS access key ID and region in plaintext.
- `AWS_SECRET_ACCESS_KEY` is encrypted inside [`.env`](./.env).
- `.env.keys` contains the decryption key and is not meant to be committed.
- The root `pnpm` scripts use `dotenvx` to decrypt and inject the AWS vars at runtime.

What you need from a coworker:

- the repo itself
- a local copy of `.env.keys`

Place `.env.keys` at the repo root:

```bash
cp /path/from/coworker/.env.keys ./.env.keys
chmod 600 ./.env.keys
```

Do not commit `.env.keys`.

## Verify Decryption Works

There is no separate manual decrypt step. `dotenvx` decrypts the secret when a command runs.

The simplest verification is:

```bash
pnpm aws:whoami
```

Expected result:

- it should return the caller identity for the shared deploy user
- currently that should be `arn:aws:iam::671922733475:user/ember-terraform`

You can also verify that the repo-managed AWS environment is available without printing the secret:

```bash
pnpm exec dotenvx run -fk .env.keys -f .env -- bash -lc 'printf "AWS_ACCESS_KEY_ID=%s\nAWS_REGION=%s\n" "$AWS_ACCESS_KEY_ID" "$AWS_REGION"'
```

## Optional: Create A Local AWS CLI Profile From The Repo Keypair

The repo does not require a named AWS CLI profile by default.
The root scripts use the decrypted env directly.

Still, it is often useful to mirror the same keypair into a local CLI profile for ad hoc `aws` commands.

This command is the tested way to do that from the encrypted repo credentials:

```bash
PROFILE=ember-migration \
pnpm exec dotenvx run -fk .env.keys -f .env -- bash -lc '
  aws configure set region "$AWS_REGION" --profile "$PROFILE"
  aws configure set output json --profile "$PROFILE"
  aws configure set aws_access_key_id "$AWS_ACCESS_KEY_ID" --profile "$PROFILE"
  aws configure set aws_secret_access_key "$AWS_SECRET_ACCESS_KEY" --profile "$PROFILE"
'
```

Then verify the profile:

```bash
aws sts get-caller-identity --profile ember-migration
```

That should return the same `ember-terraform` IAM user as `pnpm aws:whoami`.

## Which AWS Auth Path To Use

There are two practical paths:

1. Repo-managed env, which is the current default.
2. A named AWS CLI profile backed by the same keypair.

Use the repo-managed env path if you want the least friction:

```bash
pnpm aws:whoami
pnpm terraform:init
pnpm terraform:plan
```

Use a named profile if you want direct `aws` and `terraform` commands outside the root wrappers.

If you switch Terraform to use a named profile:

1. update [terraform.tfvars](./packages/terraform/terraform.tfvars) to set:

```hcl
aws_profile = "ember-migration"
```

2. update [backend.hcl](./packages/terraform/backend.hcl) to add:

```hcl
profile = "ember-migration"
```

3. run Terraform directly from [packages/terraform](./packages/terraform) instead of the root `pnpm terraform:*` wrappers

Reason:

- the root wrappers intentionally inject the repo-managed `.env`
- if you want Terraform to respect a named profile instead, use direct commands

## Local App Setup

The application package has its own non-secret local env file.

Create it once:

```bash
cp packages/app/.env.example packages/app/.env
```

Start local Postgres and Redis:

```bash
docker compose -f packages/app/docker-compose.yml up -d
```

Run the web app from the repo root:

```bash
pnpm dev
```

Run the worker in a second shell:

```bash
pnpm dev:worker
```

## Terraform Setup

The current repo already includes a real backend config in [backend.hcl](./packages/terraform/backend.hcl) and current defaults in [terraform.tfvars](./packages/terraform/terraform.tfvars).

Initialize Terraform:

```bash
pnpm terraform:init
pnpm terraform:validate
```

Run a readiness check before planning:

```bash
pnpm exec dotenvx run -fk .env.keys -f .env -- \
  packages/terraform/scripts/preflight-external-iam.sh \
  --tfvars packages/terraform/terraform.tfvars \
  --backend-config packages/terraform/backend.hcl
```

What this checks:

- AWS credentials work
- the backend bucket is reachable
- Terraform is in externally managed IAM mode
- the expected ECS roles exist

If the AWS side is ready, the script should pass.
If the AWS side is not ready yet, it will usually fail on missing IAM roles such as:

- `ember-migration-ecs-execution-role`
- `ember-migration-ecs-task-role`

That failure means the account setup is incomplete, not that your local machine is misconfigured.

If preflight passes, run:

```bash
pnpm terraform:plan
```

## Useful Commands

Identity:

```bash
pnpm aws:whoami
aws sts get-caller-identity --profile ember-migration
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

## Common Pitfalls

- Missing `.env.keys`
  - symptom: repo-managed AWS commands fail because `dotenvx` cannot decrypt the secret

- Using the root `pnpm terraform:*` wrappers while expecting Terraform to use an AWS profile
  - symptom: Terraform still uses the repo-managed env instead of your profile
  - fix: use direct Terraform commands from `packages/terraform` when using profile-based auth

- Forgetting `packages/app/.env`
  - symptom: local app startup fails or uses bad defaults

- Assuming Terraform failure means local misconfiguration
  - current most likely failure mode is missing externally managed IAM roles in AWS

## Where To Look Next

- AWS account status: [AWS_ACCOUNT_STATUS.md](./AWS_ACCOUNT_STATUS.md)
- Root overview: [README.md](./README.md)
- Terraform workflow: [packages/terraform/README.md](./packages/terraform/README.md)
- App workflow: [packages/app/README.md](./packages/app/README.md)
- IAM handoff: [packages/terraform/iam-handoff.md](./packages/terraform/iam-handoff.md)
