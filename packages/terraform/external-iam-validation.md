# Externally Managed IAM Validation Harness

This harness validates the externally managed IAM path against the Terraform in this repository.

It does not create a separate app or fork the stack. Instead, it:

1. Verifies the expected pre-created IAM roles exist
2. Runs `terraform init`, `validate`, and `plan` against this repo with `create_iam_roles = false`
3. Optionally bootstraps a disposable environment, builds and pushes the app image, and runs a full `apply`

## Files

- Example input vars: [external-iam-validation.tfvars.example](./external-iam-validation.tfvars.example)
- Preflight checks: [scripts/preflight-external-iam.sh](./scripts/preflight-external-iam.sh)
- Runner: [scripts/run-external-iam-validation.sh](./scripts/run-external-iam-validation.sh)

## Inputs

Copy [external-iam-validation.tfvars.example](./external-iam-validation.tfvars.example) to `external-iam-validation.tfvars` and set:

- `aws_profile`
- `aws_region`
- `project`
- `environment`
- `create_iam_roles = false`
- `app_image_tag`

`aws_profile` is optional. When it is omitted or set to `null`, the scripts and
Terraform use the default AWS credential chain.

Optional role-name overrides are supported if the pre-created roles use names that differ from the defaults:

- `ecs_execution_role_name`
- `ecs_task_role_name`
- `rds_monitoring_role_name`

## Backend

Use a separate backend key for the disposable validation environment. For example:

```hcl
bucket  = "replace-with-state-bucket-name"
key     = "ember-migration/validation/terraform.tfstate"
region  = "us-east-2"
# Optional when using a named profile instead of environment variables.
profile = "aws-profile-name"
encrypt = true
```

Omit `profile` when the backend should use environment variables instead of a
named profile.

## Plan-Only Validation

```bash
packages/terraform/scripts/run-external-iam-validation.sh \
  --tfvars packages/terraform/external-iam-validation.tfvars \
  --backend-config packages/terraform/backend.external-iam-validation.hcl
```

This mode is non-destructive. It confirms the pre-created roles are wired correctly enough for Terraform to initialize and plan.

## Full Disposable Deploy Validation

```bash
packages/terraform/scripts/run-external-iam-validation.sh \
  --tfvars packages/terraform/external-iam-validation.tfvars \
  --backend-config packages/terraform/backend.external-iam-validation.hcl \
  --apply
```

What the script does in `--apply` mode:

1. Runs the external-IAM preflight checks
2. Initializes Terraform and produces a plan
3. Bootstraps the ECR repository for the disposable environment with a targeted apply
4. Builds and pushes a `linux/amd64` app image
5. Applies the full stack
6. Waits for ECS to stabilize and checks the ALB `/health` endpoint

To tear the disposable environment down at the end of the same run:

```bash
packages/terraform/scripts/run-external-iam-validation.sh \
  --tfvars packages/terraform/external-iam-validation.tfvars \
  --backend-config packages/terraform/backend.external-iam-validation.hcl \
  --apply \
  --destroy-after
```

## Notes

- The harness validates the exact Terraform modules used by the main stack.
- It expects pre-created IAM roles to exist before the run starts.
- The ECR bootstrap step is needed because a brand-new environment does not have an application repository yet.
