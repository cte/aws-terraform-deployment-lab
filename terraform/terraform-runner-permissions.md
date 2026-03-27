# Terraform Runner Permissions

This document captures the AWS API surface used by the human Terraform runner for this stack.

For the concise IAM handoff that combines the runner policy and the pre-created
ECS service roles, see [iam-handoff.md](./iam-handoff.md).

## Method

- CloudTrail Event History was queried for account `144951176946`.
- The capture window was `2026-03-27T05:30:00Z` through `2026-03-27T08:30:00Z`.
- Events were filtered to:
  - `Username = cte`
  - CloudTrail `userAgent` containing `Terraform`
- This excludes manual AWS CLI work such as `aws logs tail`, `aws ecs update-service`, and ECR login/push.
- This also excludes AWS service-linked role activity such as `ecs-service-scheduler`.

## Important Limits

- CloudTrail Event History does not include S3 object-level backend state access unless S3 data events are separately enabled in a trail.
- This capture reflects `terraform init`, `plan`, `apply`, and later service replacements/updates for this test stack.
- It does not represent a full-stack `terraform destroy`.
- In this test account, `create_iam_roles = true`, so Terraform created the ECS IAM roles directly. An externally managed IAM environment with `create_iam_roles = false` can use a narrower IAM permission set.

## Observed Terraform API Actions

### Common read/identity actions

- `sts:GetCallerIdentity`

### EC2 / VPC / networking

- `ec2:AllocateAddress`
- `ec2:AssociateRouteTable`
- `ec2:AttachInternetGateway`
- `ec2:AuthorizeSecurityGroupEgress`
- `ec2:AuthorizeSecurityGroupIngress`
- `ec2:CreateInternetGateway`
- `ec2:CreateNatGateway`
- `ec2:CreateRoute`
- `ec2:CreateRouteTable`
- `ec2:CreateSecurityGroup`
- `ec2:CreateSubnet`
- `ec2:CreateVpc`
- `ec2:DescribeAddresses`
- `ec2:DescribeAddressesAttribute`
- `ec2:DescribeAvailabilityZones`
- `ec2:DescribeInternetGateways`
- `ec2:DescribeNatGateways`
- `ec2:DescribeNetworkAcls`
- `ec2:DescribeRouteTables`
- `ec2:DescribeSecurityGroups`
- `ec2:DescribeSubnets`
- `ec2:DescribeVpcAttribute`
- `ec2:DescribeVpcs`
- `ec2:ModifySubnetAttribute`
- `ec2:ModifyVpcAttribute`
- `ec2:RevokeSecurityGroupEgress`

### ECR

- `ecr:CreateRepository`
- `ecr:DescribeRepositories`
- `ecr:GetLifecyclePolicy`
- `ecr:ListTagsForResource`
- `ecr:PutLifecyclePolicy`

### ECS

- `ecs:CreateCluster`
- `ecs:CreateService`
- `ecs:DeleteService`
- `ecs:DeregisterTaskDefinition`
- `ecs:DescribeClusters`
- `ecs:DescribeServices`
- `ecs:DescribeTaskDefinition`
- `ecs:RegisterTaskDefinition`
- `ecs:UpdateService`

### ElastiCache

- `elasticache:CreateCacheParameterGroup`
- `elasticache:CreateCacheSubnetGroup`
- `elasticache:CreateReplicationGroup`
- `elasticache:DescribeCacheClusters`
- `elasticache:DescribeCacheParameterGroups`
- `elasticache:DescribeCacheParameters`
- `elasticache:DescribeCacheSubnetGroups`
- `elasticache:DescribeReplicationGroups`
- `elasticache:ListTagsForResource`
- `elasticache:ModifyCacheParameterGroup`

### ELBv2

- `elasticloadbalancing:CreateListener`
- `elasticloadbalancing:CreateLoadBalancer`
- `elasticloadbalancing:CreateTargetGroup`
- `elasticloadbalancing:DescribeCapacityReservation`
- `elasticloadbalancing:DescribeListenerAttributes`
- `elasticloadbalancing:DescribeListeners`
- `elasticloadbalancing:DescribeLoadBalancerAttributes`
- `elasticloadbalancing:DescribeLoadBalancers`
- `elasticloadbalancing:DescribeTags`
- `elasticloadbalancing:DescribeTargetGroupAttributes`
- `elasticloadbalancing:DescribeTargetGroups`
- `elasticloadbalancing:ModifyLoadBalancerAttributes`
- `elasticloadbalancing:ModifyTargetGroupAttributes`

### IAM

Observed in the self-managed test account only:

- `iam:CreateRole`
- `iam:GetRole`
- `iam:GetRolePolicy`
- `iam:ListAttachedRolePolicies`
- `iam:ListRolePolicies`
- `iam:PutRolePolicy`

### CloudWatch Logs

- `logs:CreateLogGroup`
- `logs:DescribeLogGroups`
- `logs:ListTagsForResource`
- `logs:PutRetentionPolicy`

### RDS

- `rds:CreateDBInstance`
- `rds:CreateDBParameterGroup`
- `rds:CreateDBSubnetGroup`
- `rds:DescribeDBEngineVersions`
- `rds:DescribeDBInstances`
- `rds:DescribeDBParameterGroups`
- `rds:DescribeDBParameters`
- `rds:DescribeDBSubnetGroups`
- `rds:ListTagsForResource`

### S3 infrastructure bucket

- `s3:CreateBucket`
- `s3:GetAccelerateConfiguration`
- `s3:GetBucketAcl`
- `s3:GetBucketCors`
- `s3:GetBucketEncryption`
- `s3:GetBucketLifecycle`
- `s3:GetBucketLogging`
- `s3:GetBucketObjectLockConfiguration`
- `s3:GetBucketPolicy`
- `s3:GetBucketPublicAccessBlock`
- `s3:GetBucketReplication`
- `s3:GetBucketRequestPayment`
- `s3:GetBucketTagging`
- `s3:GetBucketVersioning`
- `s3:GetBucketWebsite`
- `s3:PutBucketEncryption`
- `s3:PutBucketLifecycle`
- `s3:PutBucketPublicAccessBlock`
- `s3:PutBucketTagging`
- `s3:PutBucketVersioning`

### Secrets Manager

- `secretsmanager:CreateSecret`
- `secretsmanager:DescribeSecret`
- `secretsmanager:GetResourcePolicy`
- `secretsmanager:GetSecretValue`
- `secretsmanager:PutSecretValue`

### SSM Parameter Store

- `ssm:DescribeParameters`
- `ssm:GetParameter`
- `ssm:ListTagsForResource`
- `ssm:PutParameter`

## Backend State Permissions Not Visible In Event History

The backend in [backend.hcl](./backend.hcl) uses:

- Bucket: `ember-migration-tfstate-144951176946`
- Key: `ember-migration/test/terraform.tfstate`

At minimum, the Terraform runner also needs:

- `s3:ListBucket` on `arn:aws:s3:::ember-migration-tfstate-144951176946`
- `s3:GetObject` on `arn:aws:s3:::ember-migration-tfstate-144951176946/ember-migration/test/terraform.tfstate`
- `s3:PutObject` on `arn:aws:s3:::ember-migration-tfstate-144951176946/ember-migration/test/terraform.tfstate`

Not currently required by this backend configuration, but often needed in other setups:

- `s3:DeleteObject` for state cleanup or S3 lockfile workflows
- `dynamodb:*` lock-table permissions if a DynamoDB backend lock table is introduced later

## Externally Managed IAM Mode Delta

If `create_iam_roles = false`, Terraform should not need to create or update the ECS roles itself.

In that mode, start by removing:

- `iam:CreateRole`
- `iam:PutRolePolicy`

The remaining IAM read calls can likely be reduced to the role lookup path only:

- `iam:GetRole`
- `iam:ListAttachedRolePolicies`
- `iam:ListRolePolicies`

`iam:GetRolePolicy` was observed in the self-managed test run because Terraform was also managing inline role policies.

## Not Part Of The Terraform Runner Policy

These are separate concerns and should not be lumped into the Terraform runner policy:

- ECR image push permissions for application image publication
- ECS task execution role permissions
- ECS task role permissions
- Application runtime access to S3, Secrets Manager, SSM, Postgres, or Redis

## Practical Recommendation

Treat this document as the baseline for a Terraform runner policy that supports:

- Initial stack creation
- Normal `plan` / `apply`
- ECS service and task-definition rollouts
- Minor configuration updates such as log retention or ElastiCache parameter updates

Draft policy JSONs derived from this capture:

- [policies/terraform-runner-external-iam.json](./policies/terraform-runner-external-iam.json)
- [policies/terraform-runner-self-managed-bootstrap.json](./policies/terraform-runner-self-managed-bootstrap.json)

If the runner must also be allowed to do full environment teardown, capture one clean `terraform destroy` run and extend the policy from that CloudTrail data.
