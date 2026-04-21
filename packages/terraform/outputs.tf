output "vpc_id" {
  description = "Representative environment VPC ID."
  value       = module.networking.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs used by the ALB and NAT gateway."
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs used by ECS, RDS, and ElastiCache."
  value       = module.networking.private_subnet_ids
}

output "alb_dns_name" {
  description = "Public DNS name of the application load balancer."
  value       = module.loadbalancer.alb_dns_name
}

output "bucket_name" {
  description = "S3 bucket for representative application assets/uploads."
  value       = module.storage.bucket_name
}

output "db_endpoint" {
  description = "RDS endpoint address."
  value       = module.database.db_endpoint
}

output "db_secret_arn" {
  description = "Secrets Manager ARN containing the generated database password."
  value       = module.database.secret_arn
}

output "redis_primary_endpoint" {
  description = "Primary Redis endpoint address."
  value       = module.cache.redis_primary_endpoint
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = module.compute.ecs_cluster_name
}

output "ecs_service_name" {
  description = "ECS web service name."
  value       = module.compute.web_service_name
}

output "ecs_worker_service_name" {
  description = "ECS worker service name."
  value       = module.compute.worker_service_name
}

output "ecr_repository_url" {
  description = "ECR repository URL for the application image."
  value       = module.compute.ecr_repository_url
}

output "role_request_summary" {
  description = "Role definitions that must exist before planning/applying when IAM is managed outside Terraform."
  value       = module.iam.role_requests
}
