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
      DEPLOYSET_BACKEND              = "dynamodb"
      ORGANIZATIONS_TABLE            = aws_dynamodb_table.organizations.name
      WORKSPACES_TABLE               = aws_dynamodb_table.workspaces.name
      ORGANIZATION_MEMBERSHIPS_TABLE = aws_dynamodb_table.organization_memberships.name
      WORKSPACE_MEMBERSHIPS_TABLE    = aws_dynamodb_table.workspace_memberships.name
      COMPONENTS_TABLE               = aws_dynamodb_table.components.name
      COMPONENT_SETS_TABLE           = aws_dynamodb_table.releases.name
      VERSIONS_TABLE                 = aws_dynamodb_table.versions.name
      PUBLISHERS_TABLE               = aws_dynamodb_table.publishers.name
      DEPLOYSETS_TABLE               = aws_dynamodb_table.releases.name
      ENVIRONMENTS_TABLE             = aws_dynamodb_table.environments.name
      DEPLOYMENT_RUNNERS_TABLE       = aws_dynamodb_table.deployment_runners.name
      PRINCIPALS_TABLE               = aws_dynamodb_table.principals.name
      ROLES_TABLE                    = aws_dynamodb_table.roles.name
      BOOTSTRAP_TABLE                = aws_dynamodb_table.bootstrap.name
      ENVIRONMENT_STATE_TABLE        = aws_dynamodb_table.environment_state.name
      DEPLOYMENT_EXECUTIONS_TABLE    = aws_dynamodb_table.deployment_executions.name
      EVENT_LOG_TABLE                = aws_dynamodb_table.event_log.name
      WEBHOOKS_TABLE                 = aws_dynamodb_table.webhooks.name
      WEBHOOK_DELIVERIES_TABLE       = aws_dynamodb_table.webhook_deliveries.name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda
  ]
}


