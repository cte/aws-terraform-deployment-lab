output "ecs_execution_role_arn" {
  description = "ARN of the ECS task execution role."
  value       = var.create_roles ? aws_iam_role.ecs_execution[0].arn : data.aws_iam_role.ecs_execution[0].arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role."
  value       = var.create_roles ? aws_iam_role.ecs_task[0].arn : data.aws_iam_role.ecs_task[0].arn
}

output "rds_monitoring_role_arn" {
  description = "ARN of the RDS monitoring role when enabled."
  value = !var.enable_rds_monitoring ? null : (
    var.create_roles ? aws_iam_role.rds_monitoring[0].arn : data.aws_iam_role.rds_monitoring[0].arn
  )
}

output "role_requests" {
  description = "IAM role definitions that must be created outside Terraform when create_roles is false."
  value       = local.role_requests
}
