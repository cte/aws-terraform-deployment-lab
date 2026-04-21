# IAM Handoff

Use this document when `create_iam_roles = false` and IAM will be managed outside Terraform.

It separates the asks into:

1. The human or CI Terraform runner policy
2. The pre-created ECS service roles the stack expects to look up by name

For the CloudTrail-derived runner analysis behind this handoff, see
[terraform-runner-permissions.md](./terraform-runner-permissions.md).

## 1. Terraform Runner Policy

Attach this policy to the human or CI principal that runs `terraform init`,
`terraform plan`, and `terraform apply`:

- Primary policy: [policies/terraform-runner-external-iam.json](./policies/terraform-runner-external-iam.json)

Important notes:

- This policy was derived from the successful test deployment and rollout of this stack.
- It includes the S3 backend state access that CloudTrail Event History does not show directly.
- It is intended for environments where IAM roles are pre-created and Terraform reads them by name rather than creating them.
- It does not include the additional permissions that would be required for a full `terraform destroy`.

Do not use the self-managed bootstrap variant unless Terraform is explicitly allowed to create the ECS IAM roles:

- Self-managed only: [policies/terraform-runner-self-managed-bootstrap.json](./policies/terraform-runner-self-managed-bootstrap.json)

## 2. Pre-Created ECS Service Roles

Terraform expects these roles to already exist when `create_iam_roles = false`.

### ECS task execution role

- Name: `ember-migration-ecs-execution-role`
- Trust principal: `ecs-tasks.amazonaws.com`
- Purpose: lets ECS pull the image, publish logs, and resolve startup configuration from SSM and Secrets Manager
- Required actions:
  - `ecr:GetAuthorizationToken`
  - `ecr:BatchCheckLayerAvailability`
  - `ecr:GetDownloadUrlForLayer`
  - `ecr:BatchGetImage`
  - `logs:CreateLogStream`
  - `logs:PutLogEvents`
  - `secretsmanager:GetSecretValue`
  - `ssm:GetParameters`
- Scope to the environment-specific resources created by Terraform:
  - ECR repository: `<project>-<environment>/app`
  - CloudWatch log group: `/ecs/<project>-<environment>/app`
  - SSM parameter: `/<project>-<environment>/app/config`
  - Secrets Manager secret: `<project>-<environment>/database/password-*`

### ECS task role

- Name: `ember-migration-ecs-task-role`
- Trust principal: `ecs-tasks.amazonaws.com`
- Purpose: application runtime access to the assets bucket for uploads and processed results
- Current minimum actions used by the deployed app:
  - `s3:ListBucket`
  - `s3:GetObject`
  - `s3:PutObject`
  - `s3:DeleteObject`
- Scope:
  - Bucket ARN: `arn:aws:s3:::ember-migration-assets`
  - Object ARN pattern: `arn:aws:s3:::ember-migration-assets/*`

### RDS monitoring role

- Name: `ember-migration-rds-monitoring-role`
- Trust principal: `monitoring.rds.amazonaws.com`
- Managed policy: `arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole`
- Only needed if enhanced RDS monitoring is enabled later

## 3. What Is Not Included Here

These should stay separate from the Terraform runner and ECS-role handoff:

- ECR image push permissions used by application image publication
- Developer or release automation permissions outside Terraform
- Application-level database users and SQL grants
- Any future destroy-only permissions
