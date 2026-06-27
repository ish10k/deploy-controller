# OneRelease CLI

Go-native `onerelease` CLI. The first supported workflow is creating component versions.

## Build

```bash
cd cli
go build -o onerelease ./cmd/onerelease
```

The output is a single native executable.

## Publish

```bash
./onerelease publish \
  --token "$ONERELEASE_TOKEN" \
  --component api \
  --version 1.2.3 \
  --artifact-key s3://bucket/api.tgz \
  --artifact-digest sha256:abc123 \
  --tag gitSha=abc123
```

By default the CLI uses `http://localhost:8000` and workspace `default`, which matches the local Docker Compose API published from the repository root.

Configuration precedence is flags, then environment variables, then defaults:

- `--api-url` / `ONERELEASE_API_BASE_URL`, default `http://localhost:8000`
- `--workspace` / `ONERELEASE_WORKSPACE_ID`, default `default`
- `--token` / `ONERELEASE_TOKEN`

Optional publish metadata:

```bash
./onerelease publish \
  --token "$ONERELEASE_TOKEN" \
  --component api \
  --version 1.2.3 \
  --artifact-key s3://bucket/api.tgz \
  --artifact-digest sha256:abc123 \
  --source-key git+https://example.com/org/repo \
  --source-digest sha256:def456 \
  --description "API release" \
  --notes "Built by CI" \
  --tag gitSha=abc123 \
  --tag channel=stable \
  --output json
```

For CI, prefer storing the API token in an environment variable:

```bash
export ONERELEASE_API_BASE_URL=http://localhost:8000
export ONERELEASE_WORKSPACE_ID=default
export ONERELEASE_TOKEN=onerelease_pat_...

./onerelease publish \
  --component api \
  --version "$VERSION" \
  --artifact-key "$ARTIFACT_KEY" \
  --artifact-digest "$ARTIFACT_DIGEST" \
  --tag gitSha="$GIT_SHA"
```

## Test

```bash
cd cli
go test ./...
```
