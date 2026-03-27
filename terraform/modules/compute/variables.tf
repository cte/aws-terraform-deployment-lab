variable "name_prefix" {
  description = "Lowercase prefix used to name compute resources."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the ECS service."
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security group ID attached to the ECS service."
  type        = string
}

variable "alb_target_group_arn" {
  description = "ALB target group ARN for the ECS service."
  type        = string
}

variable "execution_role_arn" {
  description = "Pre-created ECS task execution role ARN."
  type        = string
}

variable "task_role_arn" {
  description = "Pre-created ECS task role ARN."
  type        = string
}

variable "s3_bucket_name" {
  description = "Application bucket name injected into the task definition."
  type        = string
}

variable "db_secret_arn" {
  description = "Secrets Manager ARN containing the database password."
  type        = string
}

variable "db_endpoint" {
  description = "Database endpoint injected into the task definition."
  type        = string
}

variable "db_name" {
  description = "Database name injected into the task definition."
  type        = string
}

variable "db_user" {
  description = "Database username injected into the task definition."
  type        = string
}

variable "redis_endpoint" {
  description = "Redis endpoint injected into the task definition."
  type        = string
}

variable "image_tag" {
  description = "ECR image tag deployed by the ECS services."
  type        = string
  default     = "latest"
}

variable "container_port" {
  description = "Container port exposed through the ALB target group and used by the web process."
  type        = number
  default     = 80
}

variable "tags" {
  description = "Common tags applied to compute resources."
  type        = map(string)
}
