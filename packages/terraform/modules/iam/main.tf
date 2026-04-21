locals {
  ecs_execution_role_name  = coalesce(var.ecs_execution_role_name, "${var.project}-ecs-execution-role")
  ecs_task_role_name       = coalesce(var.ecs_task_role_name, "${var.project}-ecs-task-role")
  rds_monitoring_role_name = coalesce(var.rds_monitoring_role_name, "${var.project}-rds-monitoring-role")
  task_role_bucket_arns    = var.s3_bucket_arn != null ? [var.s3_bucket_arn] : ["*"]
  task_role_object_arns    = var.s3_bucket_arn != null ? ["${var.s3_bucket_arn}/*"] : ["*"]

  role_requests = {
    ecs_execution_role = {
      name            = local.ecs_execution_role_name
      trust_principal = "ecs-tasks.amazonaws.com"
      permissions = [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "secretsmanager:GetSecretValue",
        "ssm:GetParameters",
      ]
    }

    ecs_task_role = {
      name            = local.ecs_task_role_name
      trust_principal = "ecs-tasks.amazonaws.com"
      permissions = [
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
      ]
      resource_scope = {
        buckets = local.task_role_bucket_arns
        objects = local.task_role_object_arns
      }
      notes = "Tighten runtime permissions to the application's real needs before the role is created outside Terraform."
    }

    rds_monitoring_role = {
      name            = local.rds_monitoring_role_name
      trust_principal = "monitoring.rds.amazonaws.com"
      managed_policy  = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
      enabled         = var.enable_rds_monitoring
    }
  }
}

data "aws_iam_policy_document" "ecs_execution_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "ecs_task_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "rds_monitoring_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["monitoring.rds.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "ecs_execution" {
  statement {
    sid = "EcrImagePull"

    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
    ]

    resources = ["*"]
  }

  statement {
    sid = "CloudWatchLogs"

    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]

    resources = ["*"]
  }

  statement {
    sid = "AppSecrets"

    actions = [
      "secretsmanager:GetSecretValue",
      "ssm:GetParameters",
    ]

    resources = ["*"]
  }
}

data "aws_iam_policy_document" "ecs_task" {
  statement {
    sid = "S3BucketAccess"

    actions = [
      "s3:ListBucket",
    ]

    resources = local.task_role_bucket_arns
  }

  statement {
    sid = "S3ObjectAccess"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]

    resources = local.task_role_object_arns
  }
}

resource "aws_iam_role" "ecs_execution" {
  count = var.create_roles ? 1 : 0

  name               = local.ecs_execution_role_name
  assume_role_policy = data.aws_iam_policy_document.ecs_execution_assume_role.json

  tags = var.tags
}

resource "aws_iam_role_policy" "ecs_execution" {
  count = var.create_roles ? 1 : 0

  name   = "${local.ecs_execution_role_name}-inline"
  role   = aws_iam_role.ecs_execution[0].id
  policy = data.aws_iam_policy_document.ecs_execution.json
}

resource "aws_iam_role" "ecs_task" {
  count = var.create_roles ? 1 : 0

  name               = local.ecs_task_role_name
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume_role.json

  tags = var.tags
}

resource "aws_iam_role_policy" "ecs_task" {
  count = var.create_roles ? 1 : 0

  name   = "${local.ecs_task_role_name}-inline"
  role   = aws_iam_role.ecs_task[0].id
  policy = data.aws_iam_policy_document.ecs_task.json
}

resource "aws_iam_role" "rds_monitoring" {
  count = var.create_roles && var.enable_rds_monitoring ? 1 : 0

  name               = local.rds_monitoring_role_name
  assume_role_policy = data.aws_iam_policy_document.rds_monitoring_assume_role.json

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  count = var.create_roles && var.enable_rds_monitoring ? 1 : 0

  role       = aws_iam_role.rds_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

data "aws_iam_role" "ecs_execution" {
  count = var.create_roles ? 0 : 1

  name = local.ecs_execution_role_name
}

data "aws_iam_role" "ecs_task" {
  count = var.create_roles ? 0 : 1

  name = local.ecs_task_role_name
}

data "aws_iam_role" "rds_monitoring" {
  count = !var.create_roles && var.enable_rds_monitoring ? 1 : 0

  name = local.rds_monitoring_role_name
}
