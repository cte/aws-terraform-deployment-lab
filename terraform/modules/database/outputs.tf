output "db_endpoint" {
  description = "RDS endpoint address."
  value       = aws_db_instance.this.address
}

output "db_name" {
  description = "Initial database name."
  value       = aws_db_instance.this.db_name
}

output "db_username" {
  description = "Application database username."
  value       = local.db_username
}

output "secret_arn" {
  description = "ARN of the generated database password secret."
  value       = aws_secretsmanager_secret.db_password.arn
}
