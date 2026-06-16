resource "aws_iam_role" "lambda" {
  name = "${var.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "lambda" {
  name = "${var.name_prefix}-lambda-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.lambda.arn}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.components.arn,
          aws_dynamodb_table.releases.arn,
          aws_dynamodb_table.deploysets.arn,
          aws_dynamodb_table.environments.arn,
          aws_dynamodb_table.environment_targets.arn,
          aws_dynamodb_table.target_resolutions.arn,
          aws_dynamodb_table.environment_state.arn,
          aws_dynamodb_table.deployment_executions.arn,
          "${aws_dynamodb_table.deployment_executions.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket",
          "ecr:BatchGetImage",
          "ecr:DescribeImages"
        ]
        Resource = "*"
      }
    ]
  })
}

