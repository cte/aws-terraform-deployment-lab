# Representative AWS Terraform Stack

This directory provisions a minimal but real AWS environment that exercises the services listed in [PLAN.md](../PLAN.md).

## Before Terraform

1. Create the remote state bucket separately.
2. Copy `backend.hcl.example` to `backend.hcl` and replace the placeholder values.
3. Update `terraform.tfvars` for the target SSO profile, region, project, and environment.
4. Decide how IAM roles should be managed:
   - Set `create_iam_roles = true` for a self-managed test account.
   - Set `create_iam_roles = false` if the roles will be pre-created and looked up by name.

## Workflow

```bash
aws sso login --profile <profile-name>
terraform init -backend-config=backend.hcl
terraform plan -out=tfplan
terraform apply tfplan
```

Use `terraform destroy` when the capture exercise is complete.

## Notes

- When `create_iam_roles = true`, Terraform creates the ECS roles directly in the target account. When it is `false`, the root module uses `data.aws_iam_role` lookups and the referenced roles must already exist.
- See `iam-handoff.md` for the IAM handoff, and `terraform-runner-permissions.md` for the CloudTrail-derived runner analysis behind it.
- The compute module now deploys separate ECS `web` and `worker` services from the module-created ECR repository. Push an image tag such as `latest` to that repository before `terraform apply`, or the services will fail to start.
- Backend settings are kept outside Terraform variables because backend blocks cannot interpolate input variables.
