# Representative AWS Terraform Stack

This directory provisions the representative AWS environment implemented in this
repository.

## Before Terraform

1. Create the remote state bucket separately.
2. Copy `backend.hcl.example` to `backend.hcl` and replace the placeholder values.
3. Update `terraform.tfvars` for the target auth method, region, project, and environment.
4. Decide how IAM roles should be managed:
   - Set `create_iam_roles = true` for a self-managed test account.
   - Set `create_iam_roles = false` if the roles will be pre-created and looked up by name.

## AWS Auth Options

This repo now supports all of the following:

- Repo-managed credentials via the workspace-root `.env` and `dotenvx`
- Named AWS SSO profiles
- Named shared-credentials profiles backed by long-lived access keys
- The default AWS credential chain via environment variables

### Option 1: Workspace-root `dotenvx`

From the workspace root:

```bash
pnpm aws:whoami
pnpm terraform:init
pnpm terraform:plan
```

This path uses the root `.env` plus the local `.env.keys` file, with only
`AWS_SECRET_ACCESS_KEY` encrypted, and lets Terraform consume the default AWS
credential chain.

This is the current repo-local default. In the current recommended local setup:

- `terraform.tfvars` sets `aws_profile = null`
- `backend.hcl` omits `profile`

### Option 2: AWS SSO profile

```bash
aws configure sso --profile fresh-account-sso
aws sso login --profile fresh-account-sso
aws sts get-caller-identity --profile fresh-account-sso
```

Then set in `terraform.tfvars`:

```hcl
aws_profile = "fresh-account-sso"
aws_region  = "us-east-2"
```

And in `backend.hcl`:

```hcl
profile = "fresh-account-sso"
```

When using SSO, prefer direct Terraform commands from this package instead of
the workspace-root `pnpm terraform:*` wrappers, because those wrappers inject
the repo-managed AWS environment variables from the root `.env`.

### Option 3: Shared profile backed by an access key

```bash
aws configure --profile fresh-account-key
aws sts get-caller-identity --profile fresh-account-key
```

Then set in `terraform.tfvars`:

```hcl
aws_profile = "fresh-account-key"
aws_region  = "us-east-2"
```

And in `backend.hcl`:

```hcl
profile = "fresh-account-key"
```

### Option 4: Environment variables

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-2
aws sts get-caller-identity
```

Then omit `aws_profile` from `terraform.tfvars` or set it to `null`:

```hcl
aws_profile = null
aws_region  = "us-east-2"
```

And omit `profile` from `backend.hcl`.

## Workflow

Workspace-root wrappers:

```bash
pnpm terraform:init
pnpm terraform:validate
pnpm terraform:plan
pnpm terraform:apply
```

These wrappers are intended for the repo-managed root `.env` path.

Direct Terraform commands from this package:

```bash
terraform init -backend-config=backend.hcl
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
```

Use `terraform destroy` when the capture exercise is complete.

## Notes

- When `create_iam_roles = true`, Terraform creates the ECS roles directly in the target account. When it is `false`, the root module uses `data.aws_iam_role` lookups and the referenced roles must already exist.
- See `iam-handoff.md` for the IAM handoff, and `terraform-runner-permissions.md` for the CloudTrail-derived runner analysis behind it.
- `aws_profile` is optional. When it is null or omitted, Terraform falls back to the default AWS credential chain.
- The compute module now deploys separate ECS `web` and `worker` services from the module-created ECR repository. Push an image tag such as `latest` to that repository before `terraform apply`, or the services will fail to start.
- Backend settings are kept outside Terraform variables because backend blocks cannot interpolate input variables.
