-- Copyright (c) 2023, 2025, Oracle and/or its affiliates.

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

USE `mysql_rest_service_metadata`;

-- Ensure that for STORED PROCEDURE parameters at least one of the 'in' and 'out' flag is set to true
ALTER TABLE `mysql_rest_service_metadata`.`object_field`
  ADD CONSTRAINT param_mode_not_false CHECK (
    (db_column->"$.in" IS NULL AND db_column->"$.out" IS NULL) OR 
    (db_column->"$.in" + db_column->"$.out" >= 1));

ALTER SQL SECURITY INVOKER VIEW `schema_version` (major, minor, patch) AS SELECT 2, 0, 1;

ALTER SQL SECURITY INVOKER VIEW `mrs_user_schema_version` (major, minor, patch) AS SELECT 2, 0, 1;

-- Allow the 'mysql_rest_service_data_provider' role to create temporary tables
GRANT CREATE TEMPORARY TABLES ON *.*
    TO 'mysql_rest_service_data_provider';

DELIMITER $$
DROP FUNCTION `mysql_rest_service_metadata`.`get_sequence_id`$$
CREATE FUNCTION `mysql_rest_service_metadata`.`get_sequence_id`() RETURNS BINARY(16) SQL SECURITY INVOKER NOT DETERMINISTIC NO SQL 
RETURN UUID_TO_BIN(UUID(), 1)$$

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;