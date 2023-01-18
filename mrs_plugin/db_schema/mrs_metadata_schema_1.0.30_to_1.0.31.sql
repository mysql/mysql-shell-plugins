-- Copyright (c) 2022, 2023, Oracle and/or its affiliates.

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

USE `mysql_rest_service_metadata`;

DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_BEFORE_INSERT`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_BEFORE_UPDATE`;

DELIMITER $$

CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`mrs_user_BEFORE_INSERT` BEFORE INSERT ON `mrs_user` FOR EACH ROW
BEGIN
	IF NEW.name IS NOT NULL AND (SELECT COUNT(*) FROM `mysql_rest_service_metadata`.`mrs_user` AS u 
		WHERE UPPER(u.name) = UPPER(NEW.name) AND u.auth_app_id = NEW.auth_app_id) > 0
	THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "This name has already been used.";
	END IF;
	IF NEW.email IS NOT NULL AND (SELECT COUNT(*) FROM `mysql_rest_service_metadata`.`mrs_user` AS u 
		WHERE UPPER(u.email) = UPPER(NEW.email) AND u.auth_app_id = NEW.auth_app_id) > 0
	THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "This email has already been used.";
    END IF;
    IF JSON_STORAGE_SIZE(NEW.app_options) > 16384 THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The JSON value stored in app_options must not be bigger than 16KB.";
    END IF;
END$$

CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`mrs_user_BEFORE_UPDATE` BEFORE UPDATE ON `mrs_user` FOR EACH ROW
BEGIN
	IF NEW.name IS NOT NULL AND (SELECT COUNT(*) FROM `mysql_rest_service_metadata`.`mrs_user` AS u 
		WHERE UPPER(u.name) = UPPER(NEW.name) AND u.auth_app_id = NEW.auth_app_id) > 0
	THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "This name has already been used.";
	END IF;
	IF NEW.email IS NOT NULL AND (SELECT COUNT(*) FROM `mysql_rest_service_metadata`.`mrs_user` AS u 
		WHERE UPPER(u.email) = UPPER(NEW.email) AND u.auth_app_id = NEW.auth_app_id) > 0
	THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "This email has already been used.";
    END IF;
    IF JSON_STORAGE_SIZE(NEW.app_options) > 16384 THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The JSON value stored in app_options must not be bigger than 16KB.";
    END IF;
END$$

DELIMITER ;

USE `mysql_rest_service_metadata`;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW schema_version (major, minor, patch) AS SELECT 1, 0, 31;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW mrs_user_schema_version (major, minor, patch) AS SELECT 1, 0, 31;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;