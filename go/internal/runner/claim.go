package runner

import (
	"fmt"
	"slices"

	"github.com/ish10k/onerelease/internal/tag"
)

type ClaimEligibility struct {
	Eligible                bool
	Reasons                 []ClaimIneligibilityReason
	CurrentConcurrentClaims int
	MaxConcurrentClaims     int
}

type ClaimIneligibilityReason string

const (
	ClaimReasonRunnerInactive          ClaimIneligibilityReason = "runner_inactive"
	ClaimReasonEnvironmentMismatch     ClaimIneligibilityReason = "environment_mismatch"
	ClaimReasonComponentMismatch       ClaimIneligibilityReason = "component_mismatch"
	ClaimReasonComponentTypeMismatch   ClaimIneligibilityReason = "component_type_mismatch"
	ClaimReasonComponentTagMismatch    ClaimIneligibilityReason = "component_tag_mismatch"
	ClaimReasonEnvironmentTagMismatch  ClaimIneligibilityReason = "environment_tag_mismatch"
	ClaimReasonConcurrencyLimitReached ClaimIneligibilityReason = "concurrency_limit_reached"
)

type ClaimTarget struct {
	EnvironmentID   string
	ComponentID     string
	ComponentType   string
	EnvironmentTags tag.Tags
	ComponentTags   tag.Tags
}

func (r Runner) EvaluateClaimEligibility(target ClaimTarget, store Store) (ClaimEligibility, error) {
	if store == nil {
		return ClaimEligibility{}, fmt.Errorf("runner store is required")
	}

	currentConcurrentClaims, err := store.CountActiveClaimsByRunner(r.ID, r.WorkspaceID)
	if err != nil {
		return ClaimEligibility{}, err
	}

	reasons := make([]ClaimIneligibilityReason, 0, 4)

	if !r.Active {
		reasons = append(reasons, ClaimReasonRunnerInactive)
	}
	if len(r.Scope.EnvironmentIDs) > 0 && !slices.Contains(r.Scope.EnvironmentIDs, target.EnvironmentID) {
		reasons = append(reasons, ClaimReasonEnvironmentMismatch)
	}
	if len(r.Scope.ComponentIDs) > 0 && !slices.Contains(r.Scope.ComponentIDs, target.ComponentID) {
		reasons = append(reasons, ClaimReasonComponentMismatch)
	}
	if len(r.Scope.ComponentTypes) > 0 && !slices.Contains(r.Scope.ComponentTypes, target.ComponentType) {
		reasons = append(reasons, ClaimReasonComponentTypeMismatch)
	}
	if len(r.Scope.ComponentTags) > 0 && !hasAnyTag(target.ComponentTags, r.Scope.ComponentTags) {
		reasons = append(reasons, ClaimReasonComponentTagMismatch)
	}
	if len(r.Scope.EnvironmentTags) > 0 && !hasAnyTag(target.EnvironmentTags, r.Scope.EnvironmentTags) {
		reasons = append(reasons, ClaimReasonEnvironmentTagMismatch)
	}
	if r.Scope.MaxConcurrentClaims > 0 && currentConcurrentClaims >= r.Scope.MaxConcurrentClaims {
		reasons = append(reasons, ClaimReasonConcurrencyLimitReached)
	}

	return ClaimEligibility{
		Eligible:                len(reasons) == 0,
		Reasons:                 reasons,
		CurrentConcurrentClaims: currentConcurrentClaims,
		MaxConcurrentClaims:     r.Scope.MaxConcurrentClaims,
	}, nil
}

func hasAnyTag(tags tag.Tags, required []string) bool {
	if len(tags) == 0 {
		return false
	}

	for i := range required {
		if _, ok := tags[required[i]]; ok {
			return true
		}
	}

	return false
}
