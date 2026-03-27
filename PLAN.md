# Terraform Representative Production Environment — Implementation Plan

## Objective

Create a Terraform project that provisions a representative full-stack web application infrastructure in AWS. The primary goal is not to produce a production-ready deployment, but to exercise all the AWS services and IAM interactions we expect to need so that we can observe exactly which permissions and roles are required. All resources should be real but minimal (smallest viable instance sizes, no redundancy required).

---

## Goals

1. Provision real AWS infrastructure across all expected services
2. Surface every IAM permission Terraform requires in the process
3. Surface every IAM role that must be created for services to operate
4. Produce a record of all permissions actually used (via AWS IAM Access Analyzer or CloudTrail) so we can refine the policy we hand to the IAM administrator

---

## Project Structure

```
terraform/
├── main.tf
├── variables.tf
├── outputs.tf
├── versions.tf
├── terraform.tfvars
└── modules/
    ├── networking/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    ├── compute/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    ├── database/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    ├── cache/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    ├── storage/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    ├── loadbalancer/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    └── iam/
        ├── main.tf
        ├── variables.tf
        └── outputs.tf
```

---

## Authentication

This project uses SSO-based authentication via the AWS CLI. Before running any Terraform commands, authenticate with:

```bash
aws sso login --profile <profile-name>
```

Configure `versions.tf` to use the SSO profile:

```hcl
provider "aws" {
  profile = var.aws_profile
  region  = var.aws_region
}
```

No IAM access keys should be used or generated.

---

## Global Variables (`variables.tf`)

Define the following top-level variables:

| Variable | Description | Example Value |
|---|---|---|
| `aws_profile` | AWS CLI SSO profile name | `"lawfirm-dev"` |
| `aws_region` | AWS region | `"us-east-1"` |
| `project` | Project tag applied to all resources | `"ember-migration"` |
| `environment` | Environment tag | `"test"` |

All resources must include the following tags:

```hcl
tags = {
  Project     = var.project
  Environment = var.environment
  ManagedBy   = "terraform"
}
```

---

## Modules

### 1. Networking (`modules/networking`)

Provisions the VPC and all network infrastructure the other modules depend on.

**Resources to create:**
- `aws_vpc` — single VPC, CIDR `10.0.0.0/16`, DNS hostnames enabled
- `aws_subnet` — 2 public subnets, 2 private subnets across 2 availability zones
- `aws_internet_gateway` — attached to VPC
- `aws_nat_gateway` — 1 NAT gateway in a public subnet (with associated Elastic IP)
- `aws_route_table` — public and private route tables
- `aws_route_table_association` — associate subnets to route tables
- `aws_security_group` — one for the ALB (ingress 80/443 from internet), one for ECS tasks (ingress from ALB only), one for RDS (ingress from ECS SG only), one for ElastiCache (ingress from ECS SG only)

**Outputs:** VPC ID, subnet IDs (public and private), security group IDs

---

### 2. IAM (`modules/iam`)

**Note: These roles cannot be created by Terraform directly — they must be created out of band.** This module should be written as Terraform code but executed manually: extract the role definitions from the plan and submit them as an IAM request. Once the roles exist, reference them in Terraform using `data` sources rather than `resource` blocks.

**Roles to create out of band:**

**a) ECS Task Execution Role**
- Name: `ember-migration-ecs-execution-role`
- Trust policy: `ecs-tasks.amazonaws.com`
- Permissions:
  - `ecr:GetAuthorizationToken`
  - `ecr:BatchCheckLayerAvailability`
  - `ecr:GetDownloadUrlForLayer`
  - `ecr:BatchGetImage`
  - `logs:CreateLogStream`
  - `logs:PutLogEvents`
  - `secretsmanager:GetSecretValue`
  - `ssm:GetParameters`

**b) ECS Task Role**
- Name: `ember-migration-ecs-task-role`
- Trust policy: `ecs-tasks.amazonaws.com`
- Permissions: scoped to what the application itself needs at runtime (S3 read/write to specific bucket, SQS send/receive if applicable). Define these based on application requirements.

**c) RDS Monitoring Role** (if enhanced monitoring is enabled)
- Name: `ember-migration-rds-monitoring-role`
- Trust policy: `monitoring.rds.amazonaws.com`
- Managed policy: `arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole`

**Terraform data source pattern (after the roles exist):**

```hcl
data "aws_iam_role" "ecs_execution" {
  name = "ember-migration-ecs-execution-role"
}

data "aws_iam_role" "ecs_task" {
  name = "ember-migration-ecs-task-role"
}
```

---

### 3. Storage (`modules/storage`)

**Resources to create:**
- `aws_s3_bucket` — one bucket for application assets/uploads
- `aws_s3_bucket_versioning` — enabled
- `aws_s3_bucket_server_side_encryption_configuration` — AES256
- `aws_s3_bucket_public_access_block` — all public access blocked
- `aws_s3_bucket_lifecycle_configuration` — transition to IA after 90 days (optional but good practice)

**Outputs:** bucket name, bucket ARN

---

### 4. Database (`modules/database`)

**Resources to create:**
- `aws_db_subnet_group` — using private subnets from networking module
- `aws_db_parameter_group` — default parameters, engine-specific (e.g. postgres16)
- `aws_db_instance` — minimal viable RDS instance:
  - Engine: PostgreSQL (latest supported version)
  - Instance class: `db.t3.micro`
  - Storage: 20GB gp2
  - Multi-AZ: false (test environment)
  - Publicly accessible: false
  - Deletion protection: false (test environment)
  - Skip final snapshot: true (test environment)
  - Password sourced from `aws_secretsmanager_secret`

**Secrets Manager:**
- `aws_secretsmanager_secret` — store DB credentials
- `aws_secretsmanager_secret_version` — initial password value (use a randomly generated value via `random_password`)

**Outputs:** DB endpoint, DB name, secret ARN

---

### 5. Cache (`modules/cache`)

**Resources to create:**
- `aws_elasticache_subnet_group` — using private subnets from networking module
- `aws_elasticache_parameter_group` — default Redis parameters
- `aws_elasticache_replication_group` — minimal Redis cluster:
  - Engine: Redis (latest supported version)
  - Node type: `cache.t3.micro`
  - Number of cache clusters: 1 (no replication for test)
  - At-rest encryption: enabled
  - In-transit encryption: enabled

**Outputs:** Redis primary endpoint

---

### 6. Load Balancer (`modules/loadbalancer`)

**Resources to create:**
- `aws_lb` — Application Load Balancer, internet-facing, in public subnets
- `aws_lb_target_group` — target type `ip` (for Fargate), health check on `/health`
- `aws_lb_listener` — port 80, forward to target group (HTTPS can be added later once ACM cert is available)

**Outputs:** ALB DNS name, target group ARN, listener ARN

---

### 7. Compute (`modules/compute`)

**Resources to create:**
- `aws_ecr_repository` — one repository for the application image
- `aws_ecr_lifecycle_policy` — retain last 10 images
- `aws_cloudwatch_log_group` — for ECS task logs, 30-day retention
- `aws_ecs_cluster` — single cluster
- `aws_ecs_task_definition` — Fargate launch type:
  - CPU: 256
  - Memory: 512
  - Container definition: use a public placeholder image (e.g. `nginx:latest`) so the task can launch without a real application image
  - Reference execution role and task role from IAM module data sources
  - Log configuration pointing to CloudWatch log group
  - Environment variables and secrets referencing SSM/Secrets Manager
- `aws_ecs_service` — desired count 1, Fargate launch type, in private subnets, load balancer attached

**Outputs:** ECS cluster name, ECS service name, ECR repository URL

---

## Terraform State

Store Terraform state remotely in S3 to support future collaboration:

```hcl
terraform {
  backend "s3" {
    bucket  = "<state-bucket-name>"
    key     = "ember-migration/test/terraform.tfstate"
    region  = "us-east-1"
    profile = "<sso-profile-name>"
    encrypt = true
  }
}
```

Create the state bucket manually before initializing Terraform (or as a bootstrap step separate from the main project). Use a bucket name agreed upon with the infrastructure owner.

---

## Execution Order

Run in this order to respect dependencies:

```bash
# 1. Authenticate
aws sso login --profile <profile-name>

# 2. Initialize
terraform init

# 3. Plan — review output carefully before applying
terraform plan -out=tfplan

# 4. Apply
terraform apply tfplan
```

To tear down all resources when done:

```bash
terraform destroy
```

---

## Permission & Role Capture

The goal of this exercise is to capture exactly what permissions were needed. After a successful `terraform apply`, do the following:

**Option A — IAM Access Analyzer (preferred)**
- Enable IAM Access Analyzer in the AWS account
- Review the policy findings to see what actions were exercised

**Option B — CloudTrail**
- Enable CloudTrail if not already enabled
- After apply, filter CloudTrail events by the SSO user's ARN
- Export the list of unique `eventName` values grouped by `eventSource`
- This gives a precise list of every API call Terraform made

The output of this exercise should be a refined IAM policy to hand back to the IAM administrator, replacing the broad service-level wildcards in the original policy with the actual actions used.

---

## Notes for Implementation Agent

- Do not create any IAM roles or policies as Terraform `resource` blocks — use `data` sources only, and document what needs to be created out of band
- Use `random_password` from the `hashicorp/random` provider for any secrets rather than hardcoding values
- All resources should use the `tags` pattern defined in Global Variables
- Keep instance sizes minimal — this is a test environment, not production
- `skip_final_snapshot = true` and `deletion_protection = false` on RDS for easy teardown
- The placeholder container image (`nginx:latest`) is intentional — the goal is to exercise the infrastructure provisioning permissions, not to run a real application
