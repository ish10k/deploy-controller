from fastapi import FastAPI

from src.interfaces.fastapi.routes import router

app = FastAPI(
    title="DeploySet Controller",
    description=(
        "Control-plane API for managing components, ComponentSets, releases, DeploySets, environments, "
        "and deployment executions."
    ),
    version="0.1.0",
    openapi_tags=[
        {"name": "Components", "description": "Manage deployable components and component sets."},
        {"name": "Releases", "description": "Create and inspect component releases."},
        {"name": "DeploySets", "description": "Create and inspect DeploySets."},
        {"name": "Environments", "description": "Manage environments and environment state."},
        {"name": "Deployments", "description": "Plan and create deployment executions."},
        {"name": "Adapters", "description": "Adapter execution claiming and status reporting."},
    ],
)
app.include_router(router)


