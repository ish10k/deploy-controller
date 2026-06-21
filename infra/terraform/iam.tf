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
          aws_dynamodb_table.organizations.arn,
          aws_dynamodb_table.workspaces.arn,
          aws_dynamodb_table.organization_memberships.arn,
          aws_dynamodb_table.workspace_memberships.arn,
          aws_dynamodb_table.components.arn,
          aws_dynamodb_table.release_sets.arn,
          aws_dynamodb_table.releases.arn,
          aws_dynamodb_table.publishers.arn,
          aws_dynamodb_table.release-sets.arn,
          aws_dynamodb_table.environments.arn,
          aws_dynamodb_table.deployment_runners.arn,
          aws_dynamodb_table.principals.arn,
          aws_dynamodb_table.roles.arn,
          aws_dynamodb_table.bootstrap.arn,
          aws_dynamodb_table.environment_state.arn,
          aws_dynamodb_table.deployment_executions.arn,
          "${aws_dynamodb_table.deployment_executions.arn}/index/*",
          aws_dynamodb_table.event_log.arn,
          "${aws_dynamodb_table.event_log.arn}/index/*",
          aws_dynamodb_table.webhooks.arn,
          aws_dynamodb_table.webhook_deliveries.arn
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
