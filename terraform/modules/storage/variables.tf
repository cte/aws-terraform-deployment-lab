variable "name_prefix" {
  description = "Lowercase prefix used to name storage resources."
  type        = string
}

variable "tags" {
  description = "Common tags applied to storage resources."
  type        = map(string)
}
