# Core Planning Invariant

Release Controller creates execution items from a complete immutable Release. It does not inspect provider infrastructure or derive artifact locations.

The brain requests `skip` only when:

- the latest deployment execution contains an item for the component
- that item has status `succeeded`
- that item has the requested version
- the deployment request is not forced

The brain requests `deploy` when no latest item exists, the latest item did not succeed, the requested version changed, or `force=true`.

Adapters inspect real target state. They may report `deploy`, `noop`, or `skip`; a forced same-version deployment that succeeds is recorded as possible drift.


