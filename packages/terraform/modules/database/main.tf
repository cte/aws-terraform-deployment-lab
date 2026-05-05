locals {
  resource_prefix = replace(lower(var.name_prefix), "_", "-")
  db_username     = "appuser"
}

data "aws_rds_engine_version" "postgres" {
  engine  = "postgres"
  version = "16"
  latest  = true
}

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${local.resource_prefix}/database/password"
  description             = "Representative PostgreSQL password for the Terraform exercise."
  recovery_window_in_days = 0

  tags = merge(var.tags, {
    Name = "${local.resource_prefix}-db-password"
  })
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

resource "aws_db_subnet_group" "this" {
  name       = "${local.resource_prefix}-db-subnets"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.tags, {
    Name = "${local.resource_prefix}-db-subnets"
  })
}

resource "aws_db_parameter_group" "this" {
  name        = "${local.resource_prefix}-${data.aws_rds_engine_version.postgres.parameter_group_family}"
  family      = data.aws_rds_engine_version.postgres.parameter_group_family
  description = "Representative PostgreSQL parameter group."

  tags = merge(var.tags, {
    Name = "${local.resource_prefix}-${data.aws_rds_engine_version.postgres.parameter_group_family}"
  })
}

resource "aws_db_instance" "this" {
  identifier              = "${local.resource_prefix}-postgres"
  engine                  = "postgres"
  engine_version          = data.aws_rds_engine_version.postgres.version_actual
  instance_class          = "db.t3.micro"
  allocated_storage       = 20
  storage_type            = "gp2"
  storage_encrypted       = true
  db_name                 = var.database_name
  username                = local.db_username
  password                = random_password.db.result
  db_subnet_group_name    = aws_db_subnet_group.this.name
  parameter_group_name    = aws_db_parameter_group.this.name
  vpc_security_group_ids  = [var.db_security_group_id]
  multi_az                = false
  publicly_accessible     = false
  deletion_protection     = false
  skip_final_snapshot     = true
  backup_retention_period = 0
  apply_immediately       = true
  monitoring_interval     = var.monitoring_interval
  monitoring_role_arn     = var.monitoring_interval > 0 ? var.monitoring_role_arn : null

  tags = merge(var.tags, {
    Name = "${local.resource_prefix}-postgres"
  })
}
