# OneRelease

This repository now uses a simple monorepo layout:

- `api/` contains the Python backend project
- `frontend/` contains the React control-plane UI
- `sdk/python/` contains the Python SDK for runners and publishers
- `runner-example/` contains an example custom runner package built on the SDK
- `infra/` contains Terraform and cloud infrastructure

To work on the backend:

```bash
cd api
pip install -e ".[dev]"
ONERELEASE_BACKEND=memory uvicorn src.interfaces.fastapi.app:app --reload
```

To work on the frontend:

```bash
cd frontend
pnpm install
pnpm dev
```

The frontend calls the backend through Vite at `/api`. By default the proxy targets `http://127.0.0.1:8000`; set `VITE_API_TARGET` before `pnpm dev` to point it elsewhere.

To work on the Python SDK:

```bash
cd sdk/python
pip install -e ".[dev]"
python -m unittest discover -s tests
```

## Local OIDC Docker Compose

Run the full local stack with:

```bash
docker compose up --build
```

Services:

- OneRelease API: `http://localhost:8000`
- OneRelease UI: `http://localhost:5173`
- Local OIDC / Keycloak: `http://localhost:5556`
- Postgres for Keycloak: `localhost:5432`
- Example package runner: `package-runner`
- Example docker compose runner: `docker-compose-runner`

Seeded local OIDC users all use password `password`:

- `admin@example.local`
- `deployer@example.local`
- `viewer@example.local`

The API is configured for OIDC mode with `ONERELEASE_BOOTSTRAP_ALLOWED_EMAIL=admin@example.local`. Human auth should use OIDC; machine actors use PATs issued by deployment runner / publisher create and rotate-token flows.
The two example runner containers use seeded PATs from local data so they can claim the example package and docker compose workloads immediately after boot.


