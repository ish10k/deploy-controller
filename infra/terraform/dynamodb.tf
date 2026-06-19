resource "aws_dynamodb_table" "organizations" {
  name         = "${var.name_prefix}-organizations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "organizationId"

  attribute {
    name = "organizationId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "workspaces" {
  name         = "${var.name_prefix}-workspaces"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "workspaceId"

  attribute {
    name = "workspaceId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "organization_memberships" {
  name         = "${var.name_prefix}-organization-memberships"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "organizationId"
  range_key    = "principalId"

  attribute {
    name = "organizationId"
    type = "S"
  }

  attribute {
    name = "principalId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "workspace_memberships" {
  name         = "${var.name_prefix}-workspace-memberships"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "workspaceId"
  range_key    = "principalId"

  attribute {
    name = "workspaceId"
    type = "S"
  }

  attribute {
    name = "principalId"
    type = "S"
  }
}

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

resource "aws_dynamodb_table" "publishers" {
  name         = "${var.name_prefix}-publishers"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "publisherId"

  attribute {
    name = "publisherId"
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

resource "aws_dynamodb_table" "deployment_runners" {
  name         = "${var.name_prefix}-deployment-runners"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "runnerId"

  attribute {
    name = "runnerId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "principals" {
  name         = "${var.name_prefix}-principals"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "principalId"

  attribute {
    name = "principalId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "roles" {
  name         = "${var.name_prefix}-roles"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "roleId"

  attribute {
    name = "roleId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "bootstrap" {
  name         = "${var.name_prefix}-bootstrap"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
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

resource "aws_dynamodb_table" "event_log" {
  name         = "${var.name_prefix}-event-log"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "eventBucket"
  range_key    = "occurredAtEventId"

  attribute {
    name = "eventBucket"
    type = "S"
  }

  attribute {
    name = "occurredAtEventId"
    type = "S"
  }

  attribute {
    name = "eventId"
    type = "S"
  }

  attribute {
    name = "actorPrincipalId"
    type = "S"
  }

  attribute {
    name = "resourceKey"
    type = "S"
  }

  global_secondary_index {
    name            = "eventId-index"
    hash_key        = "eventId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "actorPrincipalId-index"
    hash_key        = "actorPrincipalId"
    range_key       = "occurredAtEventId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "resourceKey-index"
    hash_key        = "resourceKey"
    range_key       = "occurredAtEventId"
    projection_type = "ALL"
  }
}

resource "aws_dynamodb_table" "webhooks" {
  name         = "${var.name_prefix}-webhooks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "webhookId"

  attribute {
    name = "webhookId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "webhook_deliveries" {
  name         = "${var.name_prefix}-webhook-deliveries"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "webhookDeliveryId"

  attribute {
    name = "webhookDeliveryId"
    type = "S"
  }
}
