variable "aws_profile" {
  description = "Optional AWS shared config/credentials profile name used by the AWS provider. Leave null to use the default AWS credential chain."
  type        = string
  default     = null
}

variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
}

variable "project" {
  description = "Project tag applied to all resources."
  type        = string
}

variable "environment" {
  description = "Environment tag applied to all resources."
  type        = string
}

variable "create_iam_roles" {
  description = "When true, Terraform creates the ECS and optional RDS roles in the target account instead of looking up pre-existing roles."
  type        = bool
  default     = false
}

variable "ecs_execution_role_name" {
  description = "Optional override for the externally managed ECS execution role name. Defaults to <project>-ecs-execution-role."
  type        = string
  default     = null
}

variable "ecs_task_role_name" {
  description = "Optional override for the externally managed ECS task role name. Defaults to <project>-ecs-task-role."
  type        = string
  default     = null
}

variable "rds_monitoring_role_name" {
  description = "Optional override for the externally managed RDS monitoring role name. Defaults to <project>-rds-monitoring-role."
  type        = string
  default     = null
}

variable "assets_bucket_name" {
  description = "Optional explicit S3 bucket name for application assets. Leave null to let the storage module generate a unique bucket name."
  type        = string
  default     = null
}

variable "app_image_tag" {
  description = "Tag pushed to the application ECR repository and deployed by ECS."
  type        = string
  default     = "latest"
}
