from fastapi import FastAPI
from fastapi.responses import JSONResponse

from src.domain.errors import ReleaseSetControllerError
from src.interfaces.fastapi.routes import router

app = FastAPI(
    title="ReleaseSet Controller",
    description=(
        "Control-plane API for managing components, release sets, releases, environments, and deployments."
    ),
    version="0.1.0",
    openapi_tags=[
        {"name": "Components", "description": "Manage deployable components and release sets."},
        {"name": "Principals", "description": "Manage identity principals, bootstrap state, and whoami."},
        {"name": "Releases", "description": "Create and inspect component releases."},
        {"name": "Publishers", "description": "Register external release publishers."},
        {"name": "ReleaseSets", "description": "Create and inspect release sets."},
        {"name": "Environments", "description": "Manage environments and environment state."},
        {"name": "Deployments", "description": "Plan and create deployments."},
        {"name": "Deployment Runners", "description": "Runner execution claiming and status reporting."},
    ],
)
app.include_router(router)


@app.exception_handler(ReleaseSetControllerError)
def release_set_controller_error_handler(_request, exc: ReleaseSetControllerError):
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})



