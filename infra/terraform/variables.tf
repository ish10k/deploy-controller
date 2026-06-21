variable "aws_region" {
  type    = string
  default = "eu-west-2"
}

variable "name_prefix" {
  type    = string
  default = "release-controller"
}

variable "lambda_zip_path" {
  type        = string
  description = "Path to a prebuilt Lambda deployment zip."
  default     = "../../dist/release-controller.zip"
}

variable "artifact_bucket_name" {
  type        = string
  description = "Artifact bucket name. If empty, Terraform creates one from name_prefix."
  default     = ""
}

variable "ecr_registry" {
  type        = string
  description = "ECR registry used for derived ECS artifact locations."
}



