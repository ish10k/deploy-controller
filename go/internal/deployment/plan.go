package deployment

import (
	"fmt"

	"github.com/ish10k/onerelease/internal/environment"
	"github.com/ish10k/onerelease/internal/registry"
)

type Plan struct {
	WorkspaceID   string
	EnvironmentID string
	ReleaseID     string
	Items         []PlanItem
}

type PlanItem struct {
	WorkspaceID      string
	EnvironmentID    string
	ReleaseID        string
	ComponentID      string
	Version          string
	RequestedAction  RequestedAction
	RequestedReason  RequestedReason
}

func CreatePlan(rls registry.Release, env environment.Environment, store Store, force bool) (*Plan, error) {
	if rls.WorkspaceID != env.WorkspaceID {
		return nil, fmt.Errorf("release and environment must belong to the same workspace")
	}
	if !env.Active {
		return nil, fmt.Errorf("environment is inactive")
	}

	lastDeployment, err := loadLastDeployment(env, store)
	if err != nil {
		return nil, err
	}

	planItems := make([]PlanItem, len(rls.Items))
	for i, item := range rls.Items {
		requestedAction := DeployRequestedAction
		requestedReason := MissingLatestExecutionItemRequestedReason

		if force {
			requestedReason = ForceRequestedReason
		} else if lastDeployment != nil {
			lastItem := findDeploymentItem(lastDeployment, item.ComponentID)

			switch {
			case lastItem == nil:
				requestedReason = MissingLatestExecutionItemRequestedReason
			case lastItem.Status != SucceededStatus:
				requestedReason = LatestStatusNotSucceededRequestedReason
			case lastItem.Version != item.Version:
				requestedReason = VersionChangedRequestedReason
			default:
				requestedAction = SkipRequestedAction
				requestedReason = LatestExecutionAlreadySucceededRequestedReason
			}
		}

		planItems[i] = PlanItem{
			WorkspaceID:     env.WorkspaceID,
			EnvironmentID:   env.ID,
			ReleaseID:       rls.ID,
			ComponentID:     item.ComponentID,
			Version:         item.Version,
			RequestedAction: requestedAction,
			RequestedReason: requestedReason,
		}
	}

	return &Plan{
		WorkspaceID:   rls.WorkspaceID,
		EnvironmentID: env.ID,
		ReleaseID:     rls.ID,
		Items:         planItems,
	}, nil
}

func loadLastDeployment(env environment.Environment, store Store) (*Deployment, error) {
	if env.LastDeploymentID == "" {
		return nil, nil
	}
	if store == nil {
		return nil, fmt.Errorf("deployment store is required")
	}

	lastDeployment, err := store.Get(env.LastDeploymentID, env.WorkspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to load last deployment %q for environment %q: %w", env.LastDeploymentID, env.ID, err)
	}
	if lastDeployment == nil {
		return nil, fmt.Errorf("environment %q references missing last deployment %q", env.ID, env.LastDeploymentID)
	}

	return lastDeployment, nil
}

func findDeploymentItem(deployment *Deployment, componentID string) *Item {
	if deployment == nil {
		return nil
	}

	for i := range deployment.Items {
		item := &deployment.Items[i]
		if item.ComponentID == componentID {
			return item
		}
	}

	return nil
}
