package cli

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestParsePublishConfigUsesFlagsOverEnv(t *testing.T) {
	config, err := parsePublishConfig([]string{
		"--api-url", "http://api.example",
		"--workspace", "prod",
		"--token", "token-from-flag",
		"--component", "api",
		"--version", "1.2.3",
		"--artifact-key", "s3://bucket/api.tgz",
		"--artifact-digest", "sha256:abc",
		"--tag", "gitSha=abc",
		"--tag", "channel=stable",
	}, mapEnv(map[string]string{
		"ONERELEASE_API_BASE_URL": "http://env.example",
		"ONERELEASE_WORKSPACE_ID": "env",
		"ONERELEASE_TOKEN":        "env-token",
	}))
	if err != nil {
		t.Fatalf("parsePublishConfig returned error: %v", err)
	}

	if config.APIURL != "http://api.example" {
		t.Fatalf("APIURL = %q", config.APIURL)
	}
	if config.Workspace != "prod" {
		t.Fatalf("Workspace = %q", config.Workspace)
	}
	if config.Token != "token-from-flag" {
		t.Fatalf("Token = %q", config.Token)
	}
	if config.Tags["gitSha"] != "abc" || config.Tags["channel"] != "stable" {
		t.Fatalf("Tags = %#v", config.Tags)
	}
}

func TestParsePublishConfigUsesEnvAndDefaults(t *testing.T) {
	config, err := parsePublishConfig([]string{
		"--component", "api",
		"--version", "1.2.3",
		"--artifact-key", "s3://bucket/api.tgz",
		"--artifact-digest", "sha256:abc",
	}, mapEnv(map[string]string{
		"ONERELEASE_TOKEN": "env-token",
	}))
	if err != nil {
		t.Fatalf("parsePublishConfig returned error: %v", err)
	}
	if config.APIURL != defaultAPIURL {
		t.Fatalf("APIURL = %q", config.APIURL)
	}
	if config.Workspace != defaultWorkspace {
		t.Fatalf("Workspace = %q", config.Workspace)
	}
	if config.Token != "env-token" {
		t.Fatalf("token = %q", config.Token)
	}
}

func TestParsePublishConfigFallsBackToPublisherTokenEnv(t *testing.T) {
	config, err := parsePublishConfig([]string{
		"--component", "api",
		"--version", "1.2.3",
		"--artifact-key", "s3://bucket/api.tgz",
		"--artifact-digest", "sha256:abc",
	}, mapEnv(map[string]string{
		"ONERELEASE_PUBLISHER_TOKEN": "publisher-token",
	}))
	if err != nil {
		t.Fatalf("parsePublishConfig returned error: %v", err)
	}
	if config.Token != "publisher-token" {
		t.Fatalf("token = %q", config.Token)
	}
}

func TestParsePublishConfigValidatesRequiredFields(t *testing.T) {
	_, err := parsePublishConfig(nil, mapEnv(nil))
	if err == nil {
		t.Fatal("expected missing required field error")
	}
	if !strings.Contains(err.Error(), "token") {
		t.Fatalf("error = %q", err.Error())
	}
}

func TestParsePublishConfigRequiresSourcePair(t *testing.T) {
	_, err := parsePublishConfig(validPublishArgs("--source-key", "git://repo"), mapEnv(nil))
	if err == nil {
		t.Fatal("expected source pair error")
	}
	if !strings.Contains(err.Error(), "provided together") {
		t.Fatalf("error = %q", err.Error())
	}
}

func TestParsePublishConfigRejectsMalformedTags(t *testing.T) {
	_, err := parsePublishConfig(validPublishArgs("--tag", "broken"), mapEnv(nil))
	if err == nil {
		t.Fatal("expected tag error")
	}
	if !strings.Contains(err.Error(), "key=value") {
		t.Fatalf("error = %q", err.Error())
	}
}

func TestParsePublishConfigRejectsUnsupportedOutput(t *testing.T) {
	_, err := parsePublishConfig(validPublishArgs("--output", "yaml"), mapEnv(nil))
	if err == nil {
		t.Fatal("expected output error")
	}
	if !strings.Contains(err.Error(), "text or json") {
		t.Fatalf("error = %q", err.Error())
	}
}

func TestPublishVersionSendsExpectedRequest(t *testing.T) {
	var receivedPath string
	var receivedAuth string
	var receivedPayload map[string]any

	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		receivedPath = r.URL.Path
		receivedAuth = r.Header.Get("Authorization")
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		if err := json.NewDecoder(r.Body).Decode(&receivedPayload); err != nil {
			t.Errorf("decode request: %v", err)
		}
		return jsonResponse(http.StatusOK, `{"workspaceId":"ws-1","componentId":"api","version":"1.2.3","artifact":{"key":"s3://bucket/api.tgz","digest":"sha256:abc"},"createdAt":"2026-06-24T10:00:00Z","createdBy":"service:publisher","tags":{"gitSha":"abc"}}`), nil
	})}

	config, err := parsePublishConfig([]string{
		"--api-url", "http://api.example",
		"--workspace", "ws-1",
		"--token", "secret",
		"--component", "api",
		"--version", "1.2.3",
		"--artifact-key", "s3://bucket/api.tgz",
		"--artifact-digest", "sha256:abc",
		"--source-key", "git://repo",
		"--source-digest", "sha256:def",
		"--description", "API version",
		"--notes", "release notes",
		"--tag", "gitSha=abc",
	}, mapEnv(nil))
	if err != nil {
		t.Fatalf("parsePublishConfig returned error: %v", err)
	}

	result, err := (apiClient{BaseURL: config.APIURL, Token: config.Token, HTTPClient: client}).PublishVersion(context.Background(), config)
	if err != nil {
		t.Fatalf("PublishVersion returned error: %v", err)
	}

	if receivedPath != "/workspaces/ws-1/versions" {
		t.Fatalf("path = %q", receivedPath)
	}
	if receivedAuth != "Bearer secret" {
		t.Fatalf("Authorization = %q", receivedAuth)
	}
	if _, ok := receivedPayload["workspaceId"]; ok {
		t.Fatalf("payload should not include workspaceId: %#v", receivedPayload)
	}
	if receivedPayload["componentId"] != "api" || receivedPayload["version"] != "1.2.3" {
		t.Fatalf("payload = %#v", receivedPayload)
	}
	if receivedPayload["description"] != "API version" || receivedPayload["notes"] != "release notes" {
		t.Fatalf("payload = %#v", receivedPayload)
	}
	if result.ComponentID != "api" || result.Version != "1.2.3" || result.CreatedBy != "service:publisher" {
		t.Fatalf("result = %#v", result)
	}
}

func TestPublishVersionFormatsAPIErrors(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return jsonResponse(http.StatusConflict, `{"message":"Version already exists with different content: api/1.2.3"}`), nil
	})}

	config, err := parsePublishConfig(validPublishArgs("--api-url", "http://api.example"), mapEnv(nil))
	if err != nil {
		t.Fatalf("parsePublishConfig returned error: %v", err)
	}
	_, err = (apiClient{BaseURL: config.APIURL, Token: config.Token, HTTPClient: client}).PublishVersion(context.Background(), config)
	if err == nil {
		t.Fatal("expected API error")
	}
	if !strings.Contains(err.Error(), "HTTP 409") || !strings.Contains(err.Error(), "different content") {
		t.Fatalf("error = %q", err.Error())
	}
}

func TestRunPublishJSONOutput(t *testing.T) {
	originalNewAPIClient := newAPIClient
	t.Cleanup(func() { newAPIClient = originalNewAPIClient })
	newAPIClient = func(baseURL string, token string, timeout time.Duration) apiClient {
		return apiClient{
			BaseURL: baseURL,
			Token:   token,
			HTTPClient: &http.Client{Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
				return jsonResponse(http.StatusOK, `{"workspaceId":"default","componentId":"api","version":"1.2.3","artifact":{"key":"s3://bucket/api.tgz","digest":"sha256:abc"},"createdAt":"2026-06-24T10:00:00Z","createdBy":"service:publisher","tags":{}}`), nil
			})},
		}
	}

	var stdout strings.Builder
	var stderr strings.Builder
	code := Run(validRunArgs("--api-url", "http://api.example", "--output", "json"), mapEnv(nil), &stdout, &stderr)
	if code != 0 {
		t.Fatalf("code = %d stderr = %s", code, stderr.String())
	}
	if !strings.Contains(stdout.String(), `"componentId": "api"`) {
		t.Fatalf("stdout = %s", stdout.String())
	}
}

func TestPublishConfigTimeoutFlag(t *testing.T) {
	config, err := parsePublishConfig(validPublishArgs("--timeout", "5s"), mapEnv(nil))
	if err != nil {
		t.Fatalf("parsePublishConfig returned error: %v", err)
	}
	if config.Timeout != 5*time.Second {
		t.Fatalf("Timeout = %s", config.Timeout)
	}
}

func validRunArgs(extra ...string) []string {
	return append([]string{"publish"}, validPublishArgs(extra...)...)
}

func validPublishArgs(extra ...string) []string {
	args := []string{
		"--token", "secret",
		"--component", "api",
		"--version", "1.2.3",
		"--artifact-key", "s3://bucket/api.tgz",
		"--artifact-digest", "sha256:abc",
	}
	return append(args, extra...)
}

func mapEnv(values map[string]string) getenvFunc {
	return func(name string) string {
		return values[name]
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func jsonResponse(statusCode int, body string) *http.Response {
	return &http.Response{
		StatusCode: statusCode,
		Status:     http.StatusText(statusCode),
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}
