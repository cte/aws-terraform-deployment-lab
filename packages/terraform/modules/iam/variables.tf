variable "project" {
  description = "Project name used to derive IAM role names."
  type        = string
}

variable "ecs_execution_role_name" {
  description = "Optional override for the ECS execution role name."
  type        = string
  default     = null
}

variable "ecs_task_role_name" {
  description = "Optional override for the ECS task role name."
  type        = string
  default     = null
}

variable "rds_monitoring_role_name" {
  description = "Optional override for the RDS monitoring role name."
  type        = string
  default     = null
}

variable "create_roles" {
  description = "When true, create the IAM roles in this account instead of looking them up."
  type        = bool
  default     = false
}

variable "s3_bucket_arn" {
  description = "Bucket ARN granted to the ECS task role when Terraform creates the role."
  type        = string
  default     = null
}

variable "enable_rds_monitoring" {
  description = "Whether to create or resolve the RDS monitoring role."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Common tags applied to IAM roles created by Terraform."
  type        = map(string)
  default     = {}
}
