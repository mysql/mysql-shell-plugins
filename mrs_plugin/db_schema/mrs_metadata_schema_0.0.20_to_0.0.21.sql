-- Copyright (c) 2022, Oracle and/or its affiliates.
-- 

-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`auth_vendor`
-- -----------------------------------------------------

ALTER TABLE `mysql_rest_service_metadata`.`auth_vendor` 
CHANGE COLUMN `name` `name` VARCHAR(65) NOT NULL ,
CHANGE COLUMN `validation_url` `validation_url` VARCHAR(255) NULL DEFAULT NULL;

-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`auth_app`
-- -----------------------------------------------------

ALTER TABLE `mysql_rest_service_metadata`.`auth_app`
ADD COLUMN `url_direct_auth` VARCHAR(255) NULL;

-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`auth_user`
-- -----------------------------------------------------

ALTER TABLE `mysql_rest_service_metadata`.`auth_user`
ADD COLUMN `login_permitted` TINYINT NOT NULL DEFAULT 0;

-- -----------------------------------------------------
-- View `mysql_rest_service_metadata`.`schema_version`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `mysql_rest_service_metadata`.`schema_version`;
USE `mysql_rest_service_metadata`;
CREATE  OR REPLACE SQL SECURITY INVOKER VIEW schema_version (major, minor, patch) AS SELECT 0, 0, 21;
