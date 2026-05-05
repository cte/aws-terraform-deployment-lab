locals {
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  name_prefix   = replace(lower("${var.project}-${var.environment}"), "_", "-")
  database_name = substr(replace(lower("${var.project}_${var.environment}"), "-", "_"), 0, 63)
}

module "networking" {
  source = "./modules/networking"

  name_prefix = local.name_prefix
  tags        = local.tags
}

module "iam" {
  source = "./modules/iam"

  create_roles             = var.create_iam_roles
  project                  = var.project
  ecs_execution_role_name  = var.ecs_execution_role_name
  ecs_task_role_name       = var.ecs_task_role_name
  rds_monitoring_role_name = var.rds_monitoring_role_name
  s3_bucket_arn            = module.storage.bucket_arn
  enable_rds_monitoring    = false
  tags                     = local.tags
}

module "storage" {
  source = "./modules/storage"

  bucket_name = var.assets_bucket_name
  name_prefix = local.name_prefix
  tags        = local.tags
}

module "database" {
  source = "./modules/database"

  name_prefix          = local.name_prefix
  database_name        = local.database_name
  private_subnet_ids   = module.networking.private_subnet_ids
  db_security_group_id = module.networking.rds_security_group_id
  monitoring_interval  = 0
  monitoring_role_arn  = module.iam.rds_monitoring_role_arn
  tags                 = local.tags
}

module "cache" {
  source = "./modules/cache"

  name_prefix        = local.name_prefix
  private_subnet_ids = module.networking.private_subnet_ids
  security_group_id  = module.networking.cache_security_group_id
  tags               = local.tags
}

module "loadbalancer" {
  source = "./modules/loadbalancer"

  name_prefix           = local.name_prefix
  vpc_id                = module.networking.vpc_id
  public_subnet_ids     = module.networking.public_subnet_ids
  alb_security_group_id = module.networking.alb_security_group_id
  tags                  = local.tags

  depends_on = [module.networking]
}

module "compute" {
  source = "./modules/compute"

  name_prefix           = local.name_prefix
  private_subnet_ids    = module.networking.private_subnet_ids
  ecs_security_group_id = module.networking.ecs_security_group_id
  alb_target_group_arn  = module.loadbalancer.target_group_arn
  execution_role_arn    = module.iam.ecs_execution_role_arn
  task_role_arn         = module.iam.ecs_task_role_arn
  s3_bucket_name        = module.storage.bucket_name
  db_secret_arn         = module.database.secret_arn
  db_endpoint           = module.database.db_endpoint
  db_name               = module.database.db_name
  db_user               = module.database.db_username
  redis_endpoint        = module.cache.redis_primary_endpoint
  image_tag             = var.app_image_tag
  tags                  = local.tags
}
