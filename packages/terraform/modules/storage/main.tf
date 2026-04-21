resource "random_string" "bucket_suffix" {
  count = var.bucket_name == null ? 1 : 0

  length  = 6
  lower   = true
  numeric = true
  special = false
  upper   = false
}

locals {
  bucket_prefix         = replace(lower(var.name_prefix), "_", "-")
  generated_bucket_name = substr("${local.bucket_prefix}-assets-${random_string.bucket_suffix[0].result}", 0, 63)
  bucket_name           = coalesce(var.bucket_name, local.generated_bucket_name)
}

resource "aws_s3_bucket" "this" {
  bucket        = local.bucket_name
  force_destroy = true

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-assets"
  })
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    id     = "transition-to-ia"
    status = "Enabled"

    filter {}

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
  }
}
