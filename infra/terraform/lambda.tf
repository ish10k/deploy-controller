resource "aws_lambda_function" "deploy_controller" {
  function_name    = var.name_prefix
  role             = aws_iam_role.lambda.arn
  handler          = "src.interfaces.lambda_api.handler.handler"
  runtime          = "python3.12"
  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      DEPLOYSET_BACKEND            = "dynamodb"
      COMPONENTS_TABLE             = aws_dynamodb_table.components.name
      COMPONENT_SETS_TABLE         = aws_dynamodb_table.component_sets.name
      RELEASES_TABLE               = aws_dynamodb_table.releases.name
      RELEASE_SOURCES_TABLE        = aws_dynamodb_table.release_sources.name
      DEPLOYSETS_TABLE             = aws_dynamodb_table.deploysets.name
      ENVIRONMENTS_TABLE           = aws_dynamodb_table.environments.name
      DEPLOYMENT_RUNNERS_TABLE     = aws_dynamodb_table.deployment_runners.name
      PRINCIPALS_TABLE             = aws_dynamodb_table.principals.name
      BOOTSTRAP_TABLE              = aws_dynamodb_table.bootstrap.name
      ENVIRONMENT_STATE_TABLE      = aws_dynamodb_table.environment_state.name
      DEPLOYMENT_EXECUTIONS_TABLE  = aws_dynamodb_table.deployment_executions.name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda
  ]
}
