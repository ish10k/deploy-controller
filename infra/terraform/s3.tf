resource "aws_s3_bucket" "artifacts" {
  bucket = var.artifact_bucket_name != "" ? var.artifact_bucket_name : "${var.name_prefix}-artifacts"
}

