from fastapi import FastAPI
from fastapi.responses import JSONResponse

from src.domain.errors import ReleaseControllerError
from src.interfaces.fastapi.routes import router

app = FastAPI(
    title="Release Controller",
    description=(
        "Control-plane API for managing components, releases, versions, environments, and deployments."
    ),
    version="0.1.0",
    openapi_tags=[
        {"name": "Components", "description": "Manage deployable components and releases."},
        {"name": "Principals", "description": "Manage identity principals, bootstrap state, and whoami."},
        {"name": "Versions", "description": "Create and inspect component versions."},
        {"name": "Publishers", "description": "Register external version publishers."},
        {"name": "Releases", "description": "Create and inspect releases."},
        {"name": "Environments", "description": "Manage environments and environment state."},
        {"name": "Deployments", "description": "Plan and create deployments."},
        {"name": "Deployment Runners", "description": "Runner execution claiming and status reporting."},
    ],
)
app.include_router(router)


@app.exception_handler(ReleaseControllerError)
def release_controller_error_handler(_request, exc: ReleaseControllerError):
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})






