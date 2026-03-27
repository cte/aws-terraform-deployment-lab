data "aws_region" "current" {}

locals {
  resource_prefix      = replace(lower(var.name_prefix), "_", "-")
  repository_name      = "${local.resource_prefix}/app"
  cluster_name         = "${local.resource_prefix}-cluster"
  web_service_name     = "${local.resource_prefix}-web"
  worker_service_name  = "${local.resource_prefix}-worker"
  web_task_family      = "${local.resource_prefix}-web"
  worker_task_family   = "${local.resource_prefix}-worker"
  container_name       = "app"
  container_image      = "${aws_ecr_repository.this.repository_url}:${var.image_tag}"
  app_environment_name = lookup(var.tags, "Environment", "unknown")

  app_config = jsonencode({
    queueName      = "${local.resource_prefix}-jobs"
    uploadPrefix   = "uploads"
    resultPrefix   = "results"
    maxUploadBytes = 2097152
  })

  common_environment = [
    {
      name  = "APP_NAME"
      value = local.resource_prefix
    },
    {
      name  = "APP_ENVIRONMENT"
      value = local.app_environment_name
    },
    {
      name  = "AWS_REGION"
      value = data.aws_region.current.name
    },
    {
      name  = "HOST"
      value = "0.0.0.0"
    },
    {
      name  = "PORT"
      value = tostring(var.container_port)
    },
    {
      name  = "S3_BUCKET"
      value = var.s3_bucket_name
    },
    {
      name  = "DB_HOST"
      value = var.db_endpoint
    },
    {
      name  = "DB_PORT"
      value = "5432"
    },
    {
      name  = "DB_NAME"
      value = var.db_name
    },
    {
      name  = "DB_USER"
      value = var.db_user
    },
    {
      name  = "DB_SSL_ENABLED"
      value = "true"
    },
    {
      name  = "REDIS_HOST"
      value = var.redis_endpoint
    },
    {
      name  = "REDIS_PORT"
      value = "6379"
    },
    {
      name  = "REDIS_TLS_ENABLED"
      value = "true"
    },
  ]

  common_secrets = [
    {
      name      = "DB_PASSWORD"
      valueFrom = var.db_secret_arn
    },
    {
      name      = "APP_CONFIG"
      valueFrom = aws_ssm_parameter.app_config.arn
    },
  ]
}

resource "aws_ecr_repository" "this" {
  name                 = local.repository_name
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(var.tags, {
    Name = "${local.resource_prefix}-app-ecr"
  })
}

resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Retain the last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${local.resource_prefix}/app"
  retention_in_days = 30

  tags = merge(var.tags, {
    Name = "${local.resource_prefix}-ecs-logs"
  })
}

resource "aws_ecs_cluster" "this" {
  name = local.cluster_name

  tags = merge(var.tags, {
    Name = local.cluster_name
  })
}

resource "aws_ssm_parameter" "app_config" {
  name  = "/${local.resource_prefix}/app/config"
  type  = "String"
  value = local.app_config

  tags = merge(var.tags, {
    Name = "${local.resource_prefix}-app-config"
  })
}

resource "aws_ecs_task_definition" "web" {
  family                   = local.web_task_family
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = local.container_name
      image     = local.container_image
      essential = true
      command = [
        "node",
        "--import",
        "tsx",
        "server/index.ts",
      ]
      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]
      environment = local.common_environment
      secrets     = local.common_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.this.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "web"
        }
      }
    }
  ])

  tags = merge(var.tags, {
    Name = "${local.resource_prefix}-web-task"
  })
}

resource "aws_ecs_task_definition" "worker" {
  family                   = local.worker_task_family
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = local.container_name
      image     = local.container_image
      essential = true
      command = [
        "node",
        "--import",
        "tsx",
        "server/worker.ts",
      ]
      environment = local.common_environment
      secrets     = local.common_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.this.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "worker"
        }
      }
    }
  ])

  tags = merge(var.tags, {
    Name = "${local.resource_prefix}-worker-task"
  })
}

resource "aws_ecs_service" "web" {
  name                               = local.web_service_name
  cluster                            = aws_ecs_cluster.this.id
  task_definition                    = aws_ecs_task_definition.web.arn
  desired_count                      = 1
  launch_type                        = "FARGATE"
  health_check_grace_period_seconds  = 120
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.alb_target_group_arn
    container_name   = local.container_name
    container_port   = var.container_port
  }

  depends_on = [aws_cloudwatch_log_group.this]

  tags = merge(var.tags, {
    Name = local.web_service_name
  })
}

resource "aws_ecs_service" "worker" {
  name                               = local.worker_service_name
  cluster                            = aws_ecs_cluster.this.id
  task_definition                    = aws_ecs_task_definition.worker.arn
  desired_count                      = 1
  launch_type                        = "FARGATE"
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  depends_on = [aws_cloudwatch_log_group.this]

  tags = merge(var.tags, {
    Name = local.worker_service_name
  })
}
