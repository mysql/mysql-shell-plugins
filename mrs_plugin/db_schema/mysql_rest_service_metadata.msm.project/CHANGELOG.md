# Database Schema Change Log for `mysql_rest_service_metadata`

## 4.0.3

- Changed the export format of the audit_log dump to valid JSON
- Enabled the `delete_old_audit_log_entries` EVENT by default
- Added `msm_instance_demoted` and `msm_instance_promoted` procedures

## 4.0.2

- Changes to the router_general_log table
- Added event to clean the router_general_log table after one day
- Fix GRANTs for msm_schema_version

Copyright (c) 2025, Oracle and/or its affiliates.
