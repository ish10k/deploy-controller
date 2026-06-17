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

## Local OIDC Docker Compose

Run the full local stack with:

```bash
docker compose up --build
```

Services:

- Settle API: `http://localhost:8000`
- Settle UI: `http://localhost:5173`
- Local OIDC / Keycloak: `http://localhost:5556`
- Postgres for Keycloak: `localhost:5432`

Seeded local OIDC users all use password `password`:

- `admin@example.local`
- `deployer@example.local`
- `viewer@example.local`

The API is configured for OIDC mode with `SETTLE_BOOTSTRAP_ALLOWED_EMAIL=admin@example.local`. Human auth should use OIDC; machine actors use PATs issued by deployment runner / release source create and rotate-token flows.
