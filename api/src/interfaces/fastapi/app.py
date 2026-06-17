from fastapi import FastAPI
from fastapi.responses import JSONResponse

from src.domain.errors import DeploySetControllerError
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
        {"name": "Principals", "description": "Manage identity principals, bootstrap state, and whoami."},
        {"name": "Releases", "description": "Create and inspect component releases."},
        {"name": "Release Sources", "description": "Register external release publishers."},
        {"name": "DeploySets", "description": "Create and inspect DeploySets."},
        {"name": "Environments", "description": "Manage environments and environment state."},
        {"name": "Deployments", "description": "Plan and create deployment executions."},
        {"name": "Deployment Runners", "description": "Runner execution claiming and status reporting."},
    ],
)
app.include_router(router)


@app.exception_handler(DeploySetControllerError)
def deployset_controller_error_handler(_request, exc: DeploySetControllerError):
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})


