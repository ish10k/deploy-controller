package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	defaultAPIURL    = "http://localhost:8000"
	defaultWorkspace = "default"
	defaultTimeout   = 30 * time.Second
)

type getenvFunc func(string) string

type publishConfig struct {
	APIURL         string
	Workspace      string
	Token          string
	Component      string
	Version        string
	ArtifactKey    string
	ArtifactDigest string
	SourceKey      string
	SourceDigest   string
	Description    string
	Notes          string
	Tags           map[string]string
	Timeout        time.Duration
	Output         string
}

type stringList []string

func (items *stringList) String() string {
	return strings.Join(*items, ",")
}

func (items *stringList) Set(value string) error {
	*items = append(*items, value)
	return nil
}

func Run(args []string, getenv getenvFunc, stdout io.Writer, stderr io.Writer) int {
	if len(args) == 0 {
		printUsage(stderr)
		return 2
	}

	switch args[0] {
	case "publish":
		return runPublish(args[1:], getenv, stdout, stderr)
	case "-h", "--help", "help":
		printUsage(stdout)
		return 0
	default:
		fmt.Fprintf(stderr, "error: unknown command %q\n\n", args[0])
		printUsage(stderr)
		return 2
	}
}

func runPublish(args []string, getenv getenvFunc, stdout io.Writer, stderr io.Writer) int {
	config, err := parsePublishConfig(args, getenv)
	if err != nil {
		fmt.Fprintf(stderr, "error: %s\n", err)
		return 2
	}

	client := newAPIClient(config.APIURL, config.Token, config.Timeout)
	result, err := client.PublishVersion(context.Background(), config)
	if err != nil {
		fmt.Fprintf(stderr, "error: %s\n", err)
		return 1
	}

	if config.Output == "json" {
		encoder := json.NewEncoder(stdout)
		encoder.SetIndent("", "  ")
		if err := encoder.Encode(result); err != nil {
			fmt.Fprintf(stderr, "error: could not encode JSON output: %s\n", err)
			return 1
		}
		return 0
	}

	fmt.Fprintf(stdout, "published %s %s\n", result.ComponentID, result.Version)
	return 0
}

func parsePublishConfig(args []string, getenv getenvFunc) (publishConfig, error) {
	config := publishConfig{
		APIURL:    envOrDefault(getenv, "ONERELEASE_API_BASE_URL", defaultAPIURL),
		Workspace: envOrDefault(getenv, "ONERELEASE_WORKSPACE_ID", defaultWorkspace),
		Token:     envOrDefault(getenv, "ONERELEASE_TOKEN", strings.TrimSpace(getenv("ONERELEASE_PUBLISHER_TOKEN"))),
		Timeout:   defaultTimeout,
		Output:    "text",
		Tags:      map[string]string{},
	}

	var tagFlags stringList
	flags := flag.NewFlagSet("publish", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.StringVar(&config.APIURL, "api-url", config.APIURL, "OneRelease API base URL")
	flags.StringVar(&config.Workspace, "workspace", config.Workspace, "OneRelease workspace ID")
	flags.StringVar(&config.Token, "token", config.Token, "bearer token")
	flags.StringVar(&config.Component, "component", "", "component ID")
	flags.StringVar(&config.Version, "version", "", "version")
	flags.StringVar(&config.ArtifactKey, "artifact-key", "", "artifact object key or URI")
	flags.StringVar(&config.ArtifactDigest, "artifact-digest", "", "artifact digest")
	flags.StringVar(&config.SourceKey, "source-key", "", "source object key or URI")
	flags.StringVar(&config.SourceDigest, "source-digest", "", "source digest")
	flags.StringVar(&config.Description, "description", "", "version description")
	flags.StringVar(&config.Notes, "notes", "", "version notes")
	flags.Var(&tagFlags, "tag", "version tag as key=value; may be repeated")
	flags.DurationVar(&config.Timeout, "timeout", config.Timeout, "HTTP timeout")
	flags.StringVar(&config.Output, "output", config.Output, "output format: text or json")

	if err := flags.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return publishConfig{}, err
		}
		return publishConfig{}, fmt.Errorf("invalid publish flags: %w", err)
	}
	if flags.NArg() > 0 {
		return publishConfig{}, fmt.Errorf("unexpected positional argument %q", flags.Arg(0))
	}

	config.APIURL = strings.TrimSpace(config.APIURL)
	config.Workspace = strings.TrimSpace(config.Workspace)
	config.Token = strings.TrimSpace(config.Token)
	config.Component = strings.TrimSpace(config.Component)
	config.Version = strings.TrimSpace(config.Version)
	config.ArtifactKey = strings.TrimSpace(config.ArtifactKey)
	config.ArtifactDigest = strings.TrimSpace(config.ArtifactDigest)
	config.SourceKey = strings.TrimSpace(config.SourceKey)
	config.SourceDigest = strings.TrimSpace(config.SourceDigest)
	config.Output = strings.TrimSpace(config.Output)

	tags, err := parseTags(tagFlags)
	if err != nil {
		return publishConfig{}, err
	}
	config.Tags = tags

	return config, validatePublishConfig(config)
}

func validatePublishConfig(config publishConfig) error {
	required := []struct {
		name  string
		value string
	}{
		{"--api-url", config.APIURL},
		{"--workspace", config.Workspace},
		{"--token or ONERELEASE_TOKEN", config.Token},
		{"--component", config.Component},
		{"--version", config.Version},
		{"--artifact-key", config.ArtifactKey},
		{"--artifact-digest", config.ArtifactDigest},
	}
	for _, item := range required {
		if item.value == "" {
			return fmt.Errorf("%s is required", item.name)
		}
	}
	if _, err := url.ParseRequestURI(config.APIURL); err != nil {
		return fmt.Errorf("--api-url must be a valid absolute URL: %w", err)
	}
	if (config.SourceKey == "") != (config.SourceDigest == "") {
		return errors.New("--source-key and --source-digest must be provided together")
	}
	if config.Timeout <= 0 {
		return errors.New("--timeout must be greater than zero")
	}
	switch config.Output {
	case "text", "json":
		return nil
	default:
		return fmt.Errorf("--output must be text or json, got %q", config.Output)
	}
}

func parseTags(rawTags []string) (map[string]string, error) {
	tags := map[string]string{}
	for _, raw := range rawTags {
		raw = strings.TrimSpace(raw)
		key, value, ok := strings.Cut(raw, "=")
		key = strings.TrimSpace(key)
		if !ok || key == "" {
			return nil, fmt.Errorf("--tag must be key=value, got %q", raw)
		}
		tags[key] = strings.TrimSpace(value)
	}
	return tags, nil
}

func envOrDefault(getenv getenvFunc, name string, fallback string) string {
	value := strings.TrimSpace(getenv(name))
	if value == "" {
		return fallback
	}
	return value
}

func printUsage(out io.Writer) {
	fmt.Fprint(out, `Usage:
  onerelease publish [flags]

Commands:
  publish    Create a component version

Run "onerelease publish --help" for publish flags.
`)
}

type apiClient struct {
	BaseURL    string
	Token      string
	HTTPClient *http.Client
}

var newAPIClient = func(baseURL string, token string, timeout time.Duration) apiClient {
	return apiClient{
		BaseURL:    baseURL,
		Token:      token,
		HTTPClient: &http.Client{Timeout: timeout},
	}
}

type artifact struct {
	Key    string `json:"key"`
	Digest string `json:"digest"`
}

type source struct {
	Key    string `json:"key"`
	Digest string `json:"digest"`
}

type componentVersionPayload struct {
	ComponentID string            `json:"componentId"`
	Version     string            `json:"version"`
	Description string            `json:"description,omitempty"`
	Notes       string            `json:"notes,omitempty"`
	Artifact    artifact          `json:"artifact"`
	Source      *source           `json:"source,omitempty"`
	Tags        map[string]string `json:"tags"`
}

type componentVersionResponse struct {
	WorkspaceID string            `json:"workspaceId"`
	ComponentID string            `json:"componentId"`
	Version     string            `json:"version"`
	Description string            `json:"description,omitempty"`
	Notes       string            `json:"notes,omitempty"`
	Artifact    artifact          `json:"artifact"`
	Source      *source           `json:"source,omitempty"`
	CreatedAt   string            `json:"createdAt,omitempty"`
	CreatedBy   string            `json:"createdBy,omitempty"`
	Tags        map[string]string `json:"tags"`
}

func (client apiClient) PublishVersion(ctx context.Context, config publishConfig) (componentVersionResponse, error) {
	payload := componentVersionPayload{
		ComponentID: config.Component,
		Version:     config.Version,
		Description: config.Description,
		Notes:       config.Notes,
		Artifact: artifact{
			Key:    config.ArtifactKey,
			Digest: config.ArtifactDigest,
		},
		Tags: config.Tags,
	}
	if config.SourceKey != "" {
		payload.Source = &source{Key: config.SourceKey, Digest: config.SourceDigest}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return componentVersionResponse{}, fmt.Errorf("could not encode publish request: %w", err)
	}

	endpoint, err := client.publishURL(config.Workspace)
	if err != nil {
		return componentVersionResponse{}, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return componentVersionResponse{}, fmt.Errorf("could not build publish request: %w", err)
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Authorization", "Bearer "+client.Token)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", "onerelease-cli/0.1.0")

	httpClient := client.HTTPClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	response, err := httpClient.Do(request)
	if err != nil {
		return componentVersionResponse{}, fmt.Errorf("publish request failed: %w", err)
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return componentVersionResponse{}, fmt.Errorf("could not read publish response: %w", err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return componentVersionResponse{}, apiErrorFromResponse(response.StatusCode, responseBody)
	}

	var result componentVersionResponse
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return componentVersionResponse{}, fmt.Errorf("could not decode publish response JSON: %w", err)
	}
	return result, nil
}

func (client apiClient) publishURL(workspace string) (string, error) {
	base, err := url.Parse(strings.TrimRight(client.BaseURL, "/"))
	if err != nil {
		return "", fmt.Errorf("could not parse API URL: %w", err)
	}
	if base.Scheme == "" || base.Host == "" {
		return "", errors.New("--api-url must include scheme and host")
	}
	workspacePath := url.PathEscape(workspace)
	base.Path = strings.TrimRight(base.Path, "/") + "/workspaces/" + workspacePath + "/versions"
	base.RawQuery = ""
	base.Fragment = ""
	return base.String(), nil
}

func apiErrorFromResponse(statusCode int, body []byte) error {
	message := strings.TrimSpace(string(body))
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err == nil {
		if value, ok := payload["message"].(string); ok && strings.TrimSpace(value) != "" {
			message = strings.TrimSpace(value)
		} else if value, ok := payload["detail"].(string); ok && strings.TrimSpace(value) != "" {
			message = strings.TrimSpace(value)
		}
	}
	if message == "" {
		message = http.StatusText(statusCode)
	}
	return fmt.Errorf("API returned HTTP %d: %s", statusCode, message)
}
