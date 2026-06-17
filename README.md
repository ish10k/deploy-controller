# DeploySet Controller

This repository now uses a simple monorepo layout:

- `api/` contains the Python backend project
- `frontend/` contains the React control-plane UI
- `infra/` contains Terraform and cloud infrastructure

To work on the backend:

```bash
cd api
pip install -e ".[dev]"
DEPLOYSET_BACKEND=memory uvicorn src.interfaces.fastapi.app:app --reload
```

To work on the frontend:

```bash
cd frontend
pnpm install
pnpm dev
```

The frontend calls the backend through Vite at `/api`. By default the proxy targets `http://127.0.0.1:8000`; set `VITE_API_TARGET` before `pnpm dev` to point it elsewhere.
