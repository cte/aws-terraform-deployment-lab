variable "name_prefix" {
  description = "Lowercase prefix used to name networking resources."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the representative VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Two public subnet CIDRs for the ALB and NAT gateway."
  type        = list(string)
  default     = ["10.0.0.0/24", "10.0.1.0/24"]
}

variable "private_subnet_cidrs" {
  description = "Two private subnet CIDRs for ECS, RDS, and ElastiCache."
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "tags" {
  description = "Common tags applied to networking resources."
  type        = map(string)
}
