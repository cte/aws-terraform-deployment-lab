locals {
  resource_prefix      = replace(lower(var.name_prefix), "_", "-")
  replication_group_id = substr("${local.resource_prefix}-redis", 0, 40)
}

resource "aws_elasticache_subnet_group" "this" {
  name        = "${local.resource_prefix}-redis-subnets"
  description = "Representative Redis subnet group."
  subnet_ids  = var.private_subnet_ids
}

resource "aws_elasticache_parameter_group" "this" {
  name        = "${local.resource_prefix}-redis7"
  family      = "redis7"
  description = "Representative Redis 7 parameter group."

  parameter {
    name  = "maxmemory-policy"
    value = "noeviction"
  }
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id       = local.replication_group_id
  description                = "Representative single-node Redis replication group."
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = "cache.t3.micro"
  num_cache_clusters         = 1
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.this.name
  parameter_group_name       = aws_elasticache_parameter_group.this.name
  security_group_ids         = [var.security_group_id]
  automatic_failover_enabled = false
  multi_az_enabled           = false
  auto_minor_version_upgrade = true
  apply_immediately          = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = merge(var.tags, {
    Name = "${local.resource_prefix}-redis"
  })
}
