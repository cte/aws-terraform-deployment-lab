variable "name_prefix" {
  description = "Lowercase prefix used to name database resources."
  type        = string
}

variable "database_name" {
  description = "Initial database name for PostgreSQL."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the database subnet group."
  type        = list(string)
}

variable "db_security_group_id" {
  description = "Security group ID attached to the RDS instance."
  type        = string
}

variable "monitoring_interval" {
  description = "Enhanced monitoring interval in seconds. Set to 0 to disable."
  type        = number
  default     = 0
}

variable "monitoring_role_arn" {
  description = "Externally managed enhanced monitoring role ARN."
  type        = string
  default     = null
}

variable "tags" {
  description = "Common tags applied to database resources."
  type        = map(string)
}
