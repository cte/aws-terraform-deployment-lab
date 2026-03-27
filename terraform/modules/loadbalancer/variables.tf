variable "name_prefix" {
  description = "Lowercase prefix used to name load balancer resources."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for the load balancer and target group."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for the ALB."
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security group ID attached to the ALB."
  type        = string
}

variable "tags" {
  description = "Common tags applied to load balancer resources."
  type        = map(string)
}
