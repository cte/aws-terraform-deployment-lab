variable "name_prefix" {
  description = "Lowercase prefix used to name cache resources."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the cache subnet group."
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID attached to the Redis replication group."
  type        = string
}

variable "tags" {
  description = "Common tags applied to cache resources."
  type        = map(string)
}
