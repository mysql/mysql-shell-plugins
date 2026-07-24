# MRS component end-to-end tests

These tests verify workflows that begin with Shell-managed MRS metadata and end
at the HTTPS endpoint hosted by the MySQL Server component.

## Test fixtures

- `mrs_component` provides an initially uninstalled, function-scoped
  `MrsComponentTestHarness`. Use it when installation or lifecycle behavior is
  part of the test.
- `ready_mrs_component` publishes the test service, installs the component, and
  waits for `READY`. Use it for REST data-plane tests.
- The existing `phone_book -> init_mrs` fixtures own the session-scoped MySQL
  sandbox, MRS metadata, and sample data.

The harness always removes an installed component and restores the service's
original publication state. It polls component status for lifecycle
transitions; tests must not use fixed startup sleeps.

Tests that change persistent or component configuration must register its
restoration with `mrs_component.add_cleanup()`. Callbacks run in reverse order
before component uninstall, while component interfaces and system variables
are still available.

`MrsHttpClient` retains cookies, does not follow redirects by default, and
returns error responses instead of raising for HTTP status codes. Pass
`follow_redirects=True` only when following redirects is part of the scenario.
Use the GET-only `wait_for_status()` when a test must wait for a published
metadata change to become visible. It retries selected transient HTTP statuses
(404 by default), but transport failures and unexpected statuses fail
immediately.

Keep scenario-specific assertions in test modules. Add behavior to the harness
only when it represents a reusable component, metadata, or HTTP operation.

## Running

Pass `--mrs-component` to enable the suite. The suite uses the `mysqld`
executable from `PATH` to deploy and destroy a fresh sandbox; it does not
require or reuse a running MySQL Server.

From `mrs_plugin`:

```sh
python3 run_tests.py \
    --mrs-component \
    --shell /path/to/mysqlsh \
    --pytest=-s \
    -k component_serves_published_service
```

Copyright (c) 2026, Oracle and/or its affiliates.
