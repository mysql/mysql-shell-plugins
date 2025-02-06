# MySQL REST Service Metadata Schema

## Changes in 3.1.0

### Additions

- New audit_log_status table that tracks holds the last timestamp the audit_log was dumped

### Changes

- Change dump_audit_log PROCEDURE to only dump events that happened after the last dump was written

### Fixes

- Update audit_log_dump_event EVENT to run every 15 minutes instead of once a day
