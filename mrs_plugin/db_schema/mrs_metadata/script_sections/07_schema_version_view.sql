-- Copyright (c) 2025, Oracle and/or its affiliates.
-- -----------------------------------------------------
-- Set the schema_version VIEW to the correct version at the very end

USE `mysql_rest_service_metadata`;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW msm_schema_version (major, minor, patch) AS SELECT 4, 0, 0;

