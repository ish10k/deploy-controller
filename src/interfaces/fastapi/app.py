from fastapi import FastAPI

from src.interfaces.fastapi.routes import router

app = FastAPI(title="DeploySet Controller")
app.include_router(router)
