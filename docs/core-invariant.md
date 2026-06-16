# Core Planning Invariant

DeploySet Controller plans `deploy` unless a component is proven already applied.

A component can noop only when:

- the latest deployment execution contains an item for the component
- that item has status `succeeded`
- that item has the requested version
- the actual deployed SHA equals the release artifact SHA

If actual SHA reading is not available yet, callers may set `requireActualShaCheck=false` for MVP testing.

