-- Copyright (c) 2024, 2025, Oracle and/or its affiliates.

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

USE `mysql_rest_service_metadata`;

-- Set schema_version to 0.0.0 to indicate an ongoing upgrade
ALTER SQL SECURITY INVOKER VIEW `schema_version` (major, minor, patch) AS SELECT 0, 0, 0;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_role`
  DROP INDEX `auth_role_unique_caption`;
ALTER TABLE `mysql_rest_service_metadata`.`mrs_role`
  ADD UNIQUE INDEX `unique_caption_per_service` (`specific_to_service_id` ASC, `caption` ASC) VISIBLE;

-- -----------------------------------------------------
-- Set the version VIEWs to the correct version

ALTER SQL SECURITY INVOKER VIEW `mysql_rest_service_metadata`.`mrs_user_schema_version` (major, minor, patch) AS SELECT 3, 0, 3;

ALTER SQL SECURITY INVOKER VIEW `mysql_rest_service_metadata`.`schema_version` (major, minor, patch) AS SELECT 3, 0, 3;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;