variable "name_prefix" {
  description = "Lowercase prefix used to name storage resources."
  type        = string
}

variable "bucket_name" {
  description = "Optional explicit S3 bucket name. Leave null to generate a unique name from the prefix."
  type        = string
  default     = null
}

variable "tags" {
  description = "Common tags applied to storage resources."
  type        = map(string)
}
