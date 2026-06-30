package deployment

import (
	"time"

	"github.com/ish10k/onerelease/internal/registry"
	"github.com/ish10k/onerelease/internal/tag"
)

type Deployment struct {
	WorkspaceId   string
	DeploymentId  string
	EnvironmentId string
	ReleaseId     string
	Status        DeploymentStatus
	RequestedBy   string
	Notes         string
	Force         bool
	StartedAt     time.Time
	CompletedAt   time.Time
	Items         []DeploymentItem
	Tags          tag.Tags
}

type DeploymentItem struct {
	WorkspaceId     string
	DeploymentId    string
	EnvironmentId   string
	ComponentId     string
	Version         string
	Artifact        registry.Artifact
	RequestedAction RequestedAction
	ReportedAction  ReportedAction
	Status          DeploymentItemStatus
	ClaimedBy       string
	ClaimedAt       string
	ClaimExpiresAt  string
	// fill in the rest....
}

type DeploymentStatus string

const (
	PendingDeploymentStatus   DeploymentStatus = "Pending"
	ClaimedDeploymentStatus   DeploymentStatus = "Claimed"
	RunningDeploymentStatus   DeploymentStatus = "Running"
	SucceededDeploymentStatus DeploymentStatus = "Succeeded"
	FailedDeploymentStatus    DeploymentStatus = "Failed"
	CancelledDeploymentStatus DeploymentStatus = "Cancelled"
)

type DeploymentItemStatus string

type RequestedAction string

type ReportedAction string
