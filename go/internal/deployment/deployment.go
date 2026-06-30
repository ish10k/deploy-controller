package deployment

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/ish10k/onerelease/internal/registry"
	"github.com/ish10k/onerelease/internal/tag"
)

type Deployment struct {
	WorkspaceID   string
	ID            string
	EnvironmentID string
	ReleaseID     string
	RequestedBy   string
	Notes         string
	Force         bool
	StartedAt     time.Time
	CompletedAt   time.Time
	Items         []Item
	Tags          tag.Tags
}

type Item struct {
	PlanItem
	DeploymentID   string
	Artifact       registry.Artifact
	Status         Status
	ReportedAction *ReportedAction
	ClaimedBy      *string
	ClaimedAt      *time.Time
	ClaimExpiresAt *time.Time
	RunnerReason   *string
	FailureReason  *string
	DriftDetected  bool
	DriftReason    *DriftReason
	ReportedBy     *string
	Message        *string
	Error          *string
}

type DeploymentStatus string

const (
	PendingDeploymentStatus    DeploymentStatus = "pending"
	ClaimedDeploymentStatus    DeploymentStatus = "claimed"
	InProgressDeploymentStatus DeploymentStatus = "in-progress"
	SucceededDeploymentStatus  DeploymentStatus = "succeeded"
	FailedDeploymentStatus     DeploymentStatus = "failed"
	CancelledDeploymentStatus  DeploymentStatus = "cancelled"
)

type Status string

const (
	PendingStatus    Status = "pending"
	ClaimedStatus    Status = "claimed"
	InProgressStatus Status = "in-progress"
	SucceededStatus  Status = "succeeded"
	FailedStatus     Status = "failed"
	SkippedStatus    Status = "skipped"
)

type RequestedAction string

const (
	DeployRequestedAction RequestedAction = "deploy"
	SkipRequestedAction   RequestedAction = "skip"
)

type ReportedAction string

const (
	DeployReportedAction ReportedAction = "deploy"
	NoopReportedAction   ReportedAction = "noop"
	SkipReportedAction   ReportedAction = "skip"
)

type RequestedReason string

const (
	MissingLatestExecutionItemRequestedReason      RequestedReason = "missing_latest_execution_item"
	LatestStatusNotSucceededRequestedReason        RequestedReason = "latest_status_not_succeeded"
	VersionChangedRequestedReason                  RequestedReason = "version_changed"
	ForceRequestedReason                           RequestedReason = "force"
	LatestExecutionAlreadySucceededRequestedReason RequestedReason = "latest_execution_already_succeeded"
)

type DriftReason string

const (
	SameVersionRedeployedDriftReason       DriftReason = "same_version_redeployed"
	SameVersionTargetMissingDriftReason    DriftReason = "same_version_target_missing"
	SameVersionArtifactMismatchDriftReason DriftReason = "same_version_artifact_mismatch"
)

func CreateDeployment(plan Plan, registryStore registry.Store, deploymentStore Store, requestedBy string, notes string, force bool) (*Deployment, error) {
	if registryStore == nil {
		return nil, fmt.Errorf("registry store is required")
	}
	if deploymentStore == nil {
		return nil, fmt.Errorf("deployment store is required")
	}

	deploymentID, err := newDeploymentID()
	if err != nil {
		return nil, err
	}

	deployment := Deployment{
		WorkspaceID:   plan.WorkspaceID,
		ID:            deploymentID,
		EnvironmentID: plan.EnvironmentID,
		ReleaseID:     plan.ReleaseID,
		RequestedBy:   requestedBy,
		Notes:         notes,
		Force:         force,
		Items:         make([]Item, len(plan.Items)),
	}

	for i, planItem := range plan.Items {
		version, err := registryStore.GetVersion(planItem.ComponentID, planItem.Version, plan.WorkspaceID)
		if err != nil {
			return nil, fmt.Errorf("failed to load version %q for component %q: %w", planItem.Version, planItem.ComponentID, err)
		}
		if version == nil {
			return nil, fmt.Errorf("version %q for component %q not found", planItem.Version, planItem.ComponentID)
		}

		deployment.Items[i] = Item{
			PlanItem:       planItem,
			DeploymentID:   deploymentID,
			Artifact:       version.Artifact,
			Status:         PendingStatus,
			ReportedAction: nil,
		}
	}

	if err := deploymentStore.Create(deployment); err != nil {
		return nil, err
	}

	return &deployment, nil
}

func newDeploymentID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}

	return hex.EncodeToString(b[:]), nil
}

func (d Deployment) Status() DeploymentStatus {
	if len(d.Items) == 0 {
		return PendingDeploymentStatus
	}

	hasSkipped := false
	hasSucceeded := false
	hasPending := false

	for i := range d.Items {
		switch d.Items[i].Status {
		case FailedStatus:
			return FailedDeploymentStatus
		case InProgressStatus:
			return InProgressDeploymentStatus
		case ClaimedStatus:
			return ClaimedDeploymentStatus
		case PendingStatus:
			hasPending = true
		case SucceededStatus:
			hasSucceeded = true
		case SkippedStatus:
			hasSkipped = true
		}
	}

	if hasPending {
		return PendingDeploymentStatus
	}
	if hasSucceeded || hasSkipped {
		return SucceededDeploymentStatus
	}

	return PendingDeploymentStatus
}
