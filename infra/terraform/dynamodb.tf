resource "aws_dynamodb_table" "components" {
  name         = "${var.name_prefix}-components"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "componentId"

  attribute {
    name = "componentId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "component_sets" {
  name         = "${var.name_prefix}-component-sets"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "componentSetId"

  attribute {
    name = "componentSetId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "releases" {
  name         = "${var.name_prefix}-releases"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "componentId"
  range_key    = "version"

  attribute {
    name = "componentId"
    type = "S"
  }

  attribute {
    name = "version"
    type = "S"
  }
}

resource "aws_dynamodb_table" "deploysets" {
  name         = "${var.name_prefix}-deploysets"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "deploySetId"

  attribute {
    name = "deploySetId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "environments" {
  name         = "${var.name_prefix}-environments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "environmentId"

  attribute {
    name = "environmentId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "environment_state" {
  name         = "${var.name_prefix}-environment-state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "environmentId"

  attribute {
    name = "environmentId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "deployment_executions" {
  name         = "${var.name_prefix}-deployment-executions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "environmentId"
  range_key    = "executionSortKey"

  attribute {
    name = "environmentId"
    type = "S"
  }

  attribute {
    name = "executionSortKey"
    type = "S"
  }

  attribute {
    name = "deploymentExecutionId"
    type = "S"
  }

  global_secondary_index {
    name            = "deploymentExecutionId-index"
    hash_key        = "deploymentExecutionId"
    projection_type = "ALL"
  }
}
