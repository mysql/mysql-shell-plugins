-- Copyright (c) 2023, 2025, Oracle and/or its affiliates.

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

USE `mysql_rest_service_metadata`;

ALTER TABLE `mysql_rest_service_metadata`.`db_object`
    CHANGE COLUMN `object_type` `object_type` ENUM('TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION') NOT NULL;


CREATE ROLE IF NOT EXISTS 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`schema_version`
GRANT SELECT ON `mysql_rest_service_metadata`.`schema_version`
	TO 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`audit_log`
GRANT SELECT ON `mysql_rest_service_metadata`.`audit_log`
	TO 'mysql_rest_service_dev';

-- -----------------------------------------------------
-- Service

-- `mysql_rest_service_metadata`.`url_host`
GRANT SELECT ON `mysql_rest_service_metadata`.`url_host`
	TO 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`url_host_alias`
GRANT SELECT ON `mysql_rest_service_metadata`.`url_host_alias`
	TO 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`service`
GRANT SELECT ON `mysql_rest_service_metadata`.`service`
	TO 'mysql_rest_service_dev';

-- -----------------------------------------------------
-- Schema Objects

-- `mysql_rest_service_metadata`.`db_schema`
GRANT SELECT ON `mysql_rest_service_metadata`.`db_schema`
	TO 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`db_object`
GRANT SELECT, INSERT, UPDATE, DELETE
	ON `mysql_rest_service_metadata`.`db_object`
	TO 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`mrs_db_object_row_group_security`
GRANT SELECT, INSERT, UPDATE, DELETE
	ON `mysql_rest_service_metadata`.`mrs_db_object_row_group_security`
	TO 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`object`
GRANT SELECT, INSERT, UPDATE, DELETE
	ON `mysql_rest_service_metadata`.`object`
    TO 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`object_field`
GRANT SELECT, INSERT, UPDATE, DELETE
	ON `mysql_rest_service_metadata`.`object_field`
    TO 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`object_reference`
GRANT SELECT, INSERT, UPDATE, DELETE
	ON `mysql_rest_service_metadata`.`object_reference`
    TO 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`table_columns_with_references`
GRANT SELECT
	ON `mysql_rest_service_metadata`.`table_columns_with_references`
    TO 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`object_fields_with_references`
GRANT SELECT
	ON `mysql_rest_service_metadata`.`object_fields_with_references`
    TO 'mysql_rest_service_dev';

-- -----------------------------------------------------
-- Static Content

-- `mysql_rest_service_metadata`.`content_set`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`content_set`
	TO 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`content_file`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`content_file`
    TO 'mysql_rest_service_dev';

-- -----------------------------------------------------
-- Router Management

-- `mysql_rest_service_metadata`.`router`
GRANT SELECT
    ON `mysql_rest_service_metadata`.`router`
    TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`router_status`
GRANT SELECT ON `mysql_rest_service_metadata`.`router_status`
	TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`router_general_log`
GRANT SELECT ON `mysql_rest_service_metadata`.`router_general_log`
	TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`router_session`
GRANT SELECT ON `mysql_rest_service_metadata`.`router_session`
	TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';


-- -----------------------------------------------------
-- Procedures

-- `mysql_rest_service_metadata`.`get_sequence_id`

GRANT EXECUTE ON FUNCTION `mysql_rest_service_metadata`.`get_sequence_id`
	TO 'mysql_rest_service_dev';

-- -----------------------------------------------------
-- Views

-- `mysql_rest_service_metadata`.`mrs_user_schema_version`

GRANT SELECT
  ON `mysql_rest_service_metadata`.`mrs_user_schema_version`
  TO 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`table_columns_with_references`

GRANT SELECT
  ON `mysql_rest_service_metadata`.`table_columns_with_references`
  TO 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`object_fields_with_references`

GRANT SELECT
  ON `mysql_rest_service_metadata`.`object_fields_with_references`
  TO 'mysql_rest_service_dev';



ALTER SQL SECURITY INVOKER VIEW `schema_version` (major, minor, patch) AS SELECT 2, 2, 0;

ALTER SQL SECURITY INVOKER VIEW `mrs_user_schema_version` (major, minor, patch) AS SELECT 2, 2, 0;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;