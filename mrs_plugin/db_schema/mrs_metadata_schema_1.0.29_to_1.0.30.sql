-- Copyright (c) 2022, 2023, Oracle and/or its affiliates.

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user`
    ADD COLUMN `auth_string` TEXT NULL;

INSERT INTO `mysql_rest_service_metadata`.`auth_vendor` (`id`, `name`, `validation_url`, `enabled`, `comments`) VALUES (0x30, 'MRS', 'NULL', 1, 'Built-in user management of MRS');
UPDATE `mysql_rest_service_metadata`.`auth_vendor` SET name="MySQL Internal" WHERE id = 0x31;

USE `mysql_rest_service_metadata`;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW schema_version (major, minor, patch) AS SELECT 1, 0, 30;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW mrs_user_schema_version (major, minor, patch) AS SELECT 1, 0, 30;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;