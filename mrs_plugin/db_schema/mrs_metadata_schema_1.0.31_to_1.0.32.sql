-- Copyright (c) 2022, 2023, Oracle and/or its affiliates.

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

USE `mysql_rest_service_metadata`;

DELIMITER $$
CREATE DEFINER=CURRENT_USER TRIGGER `url_host_BEFORE_DELETE` BEFORE DELETE ON `url_host` FOR EACH ROW BEGIN
        DELETE FROM `mysql_rest_service_metadata`.`url_host_alias` WHERE `url_host_id` = OLD.`id`;
END$$
DELIMITER ;

ALTER TABLE `service` DROP FOREIGN KEY fk_service_url_host1;
ALTER TABLE `service` ADD CONSTRAINT `fk_service_url_host1` FOREIGN KEY (`url_host_id`) REFERENCES `url_host` (`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE `auth_app` DROP COLUMN `use_built_in_authorization`;

ALTER TABLE `mysql_rest_service_metadata`.`router_status` 
    RENAME COLUMN `http_requests_push` TO `http_requests_post`;

DELIMITER $$
CREATE DEFINER=CURRENT_USER TRIGGER `service_BEFORE_DELETE` BEFORE DELETE ON `service` FOR EACH ROW BEGIN
        # Since FK CASCADE does not fire the triggers on the related tables, manually trigger the DELETEs
        DELETE FROM `mysql_rest_service_metadata`.`db_schema` WHERE `service_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`content_set` WHERE `service_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`auth_app` WHERE `service_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_role` WHERE `specific_to_service_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_privilege` WHERE `service_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_hierarchy` WHERE `specific_to_service_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_group` WHERE `specific_to_service_id` = OLD.`id`;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=CURRENT_USER TRIGGER `db_schema_BEFORE_DELETE` BEFORE DELETE ON `db_schema` FOR EACH ROW BEGIN
        DELETE FROM `mysql_rest_service_metadata`.`db_object` WHERE `db_schema_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_privilege` WHERE `db_schema_id` = OLD.`id`;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=CURRENT_USER TRIGGER `db_object_BEFORE_DELETE` BEFORE DELETE ON `db_object` FOR EACH ROW BEGIN
        DELETE FROM `mysql_rest_service_metadata`.`field` WHERE `db_object_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_privilege` WHERE `db_object_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_db_object_row_group_security` WHERE `db_object_id` = OLD.`id`;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=CURRENT_USER TRIGGER `auth_vendor_BEFORE_DELETE` BEFORE DELETE ON `auth_vendor` FOR EACH ROW BEGIN
        DELETE FROM `mysql_rest_service_metadata`.`auth_app` WHERE `auth_vendor_id` = OLD.`id`;
END$$
DELIMITER ;

ALTER TABLE `auth_app` DROP FOREIGN KEY fk_auth_app_auth_vendor1;
ALTER TABLE `auth_app` ADD CONSTRAINT `fk_auth_app_auth_vendor1` FOREIGN KEY (`auth_vendor_id`) REFERENCES `auth_vendor` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

DELIMITER $$
CREATE DEFINER=CURRENT_USER TRIGGER `auth_app_BEFORE_DELETE` BEFORE DELETE ON `auth_app` FOR EACH ROW BEGIN
        DELETE FROM `mysql_rest_service_metadata`.`mrs_user` WHERE `auth_app_id` = OLD.`id`;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=CURRENT_USER TRIGGER `mrs_user_BEFORE_DELETE` BEFORE DELETE ON `mrs_user` FOR EACH ROW BEGIN
        DELETE FROM `mysql_rest_service_metadata`.`mrs_user_hierarchy` WHERE `user_id` = OLD.`id` OR `reporting_to_user_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_has_role` WHERE `user_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_has_group` WHERE `user_id` = OLD.`id`;
END$$
DELIMITER ;

ALTER TABLE `url_host_alias` DROP FOREIGN KEY fk_url_host_alias_url_host1;
ALTER TABLE `url_host_alias` ADD CONSTRAINT `fk_url_host_alias_url_host1` FOREIGN KEY (`url_host_id`) REFERENCES `url_host` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE `mrs_role` DROP FOREIGN KEY fk_priv_role_priv_role1;
ALTER TABLE `mrs_role` ADD CONSTRAINT `fk_priv_role_priv_role1` FOREIGN KEY (`derived_from_role_id`) REFERENCES `mrs_role` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

DELIMITER $$
CREATE DEFINER=CURRENT_USER TRIGGER `mrs_role_BEFORE_DELETE` BEFORE DELETE ON `mrs_role` FOR EACH ROW BEGIN
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_has_role` WHERE `role_id` = OLD.`id`;
    -- Workaround to fix issue with recursive delete
	IF OLD.id <> NULL THEN
		DELETE FROM `mysql_rest_service_metadata`.`mrs_role` WHERE `derived_from_role_id` = OLD.`id`;
	END IF;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_privilege` WHERE `role_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_group_has_role` WHERE `role_id` = OLD.`id`;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=CURRENT_USER TRIGGER `mrs_user_hierarchy_type_BEFORE_DELETE` BEFORE DELETE ON `mrs_user_hierarchy_type` FOR EACH ROW BEGIN
        DELETE FROM `mysql_rest_service_metadata`.`mrs_user_hierarchy` WHERE `user_hierarchy_type_id` = OLD.`id`;
END$$
DELIMITER ;

ALTER TABLE `mrs_privilege` DROP FOREIGN KEY fk_priv_on_schema_auth_role1;
ALTER TABLE `mrs_privilege` ADD CONSTRAINT `fk_priv_on_schema_auth_role1` FOREIGN KEY (`role_id`) REFERENCES `mrs_role` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE `mrs_privilege` DROP FOREIGN KEY fk_priv_on_schema_db_schema1;
ALTER TABLE `mrs_privilege` ADD CONSTRAINT `fk_priv_on_schema_db_schema1` FOREIGN KEY (`db_schema_id`) REFERENCES `db_schema` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE `mrs_privilege` DROP FOREIGN KEY fk_priv_on_schema_db_object1;
ALTER TABLE `mrs_privilege` ADD CONSTRAINT `fk_priv_on_schema_db_object1` FOREIGN KEY (`db_object_id`) REFERENCES `db_object` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

DELIMITER $$
CREATE DEFINER=CURRENT_USER TRIGGER `mrs_user_group_BEFORE_DELETE` BEFORE DELETE ON `mrs_user_group` FOR EACH ROW BEGIN
        DELETE FROM `mysql_rest_service_metadata`.`mrs_user_has_group` WHERE `user_group_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_group_hierarchy` WHERE `user_group_id` = OLD.`id` OR `parent_group_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_group_has_role` WHERE `user_group_id` = OLD.`id`;
END$$
DELIMITER ;

ALTER TABLE `mrs_user_group_has_role` DROP FOREIGN KEY fk_user_group_has_auth_role_user_group1;
ALTER TABLE `mrs_user_group_has_role` ADD CONSTRAINT `fk_user_group_has_auth_role_user_group1` FOREIGN KEY (`user_group_id`) REFERENCES `mrs_user_group` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE `mrs_user_group_has_role` DROP FOREIGN KEY fk_user_group_has_auth_role_auth_role1;
ALTER TABLE `mrs_user_group_has_role` ADD CONSTRAINT `fk_user_group_has_auth_role_auth_role1` FOREIGN KEY (`role_id`) REFERENCES `mrs_role` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

DELIMITER $$
CREATE DEFINER=CURRENT_USER TRIGGER `mrs_group_hierarchy_type_BEFORE_DELETE` BEFORE DELETE ON `mrs_group_hierarchy_type` FOR EACH ROW BEGIN
        DELETE FROM `mysql_rest_service_metadata`.`mrs_user_group_hierarchy` WHERE `group_hierarchy_type_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_db_object_row_group_security` WHERE `group_hierarchy_type_id` = OLD.`id`;
END$$
DELIMITER ;

ALTER TABLE `mrs_user_group_hierarchy` DROP FOREIGN KEY fk_user_group_has_user_group_user_group1;
ALTER TABLE `mrs_user_group_hierarchy` ADD CONSTRAINT `fk_user_group_has_user_group_user_group1` FOREIGN KEY (`user_group_id`) REFERENCES `mrs_user_group` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE `mrs_user_group_hierarchy` DROP FOREIGN KEY fk_user_group_has_user_group_user_group2;
ALTER TABLE `mrs_user_group_hierarchy` ADD CONSTRAINT `fk_user_group_has_user_group_user_group2` FOREIGN KEY (`parent_group_id`) REFERENCES `mrs_user_group` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE `mrs_user_group_hierarchy` DROP FOREIGN KEY fk_user_group_hierarchy_group_hierarchy_type1;
ALTER TABLE `mrs_user_group_hierarchy` ADD CONSTRAINT `fk_user_group_hierarchy_group_hierarchy_type1` FOREIGN KEY (`group_hierarchy_type_id`) REFERENCES `mrs_group_hierarchy_type` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE `mrs_db_object_row_group_security` DROP FOREIGN KEY fk_table1_db_object1;
ALTER TABLE `mrs_db_object_row_group_security` ADD CONSTRAINT `fk_table1_db_object1` FOREIGN KEY (`db_object_id`) REFERENCES `db_object` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE `mrs_db_object_row_group_security` DROP FOREIGN KEY fk_db_object_row_security_group_hierarchy_type1;
ALTER TABLE `mrs_db_object_row_group_security` ADD CONSTRAINT `fk_db_object_row_security_group_hierarchy_type1` FOREIGN KEY (`group_hierarchy_type_id`) REFERENCES `mrs_group_hierarchy_type` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE `router_status` MODIFY COLUMN `id` INT UNSIGNED AUTO_INCREMENT;

ALTER TABLE `router_status` DROP FOREIGN KEY fk_router_status_router1;
ALTER TABLE `router_status` ADD CONSTRAINT `fk_router_status_router1` FOREIGN KEY (`router_id`) REFERENCES `router` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE `router_session` MODIFY COLUMN `id` INT UNSIGNED AUTO_INCREMENT;

ALTER TABLE `router_general_log` MODIFY COLUMN `id` INT UNSIGNED AUTO_INCREMENT;

ALTER TABLE `router_general_log` DROP FOREIGN KEY fk_router_general_log_router1;
ALTER TABLE `router_general_log` ADD CONSTRAINT `fk_router_general_log_router1` FOREIGN KEY (`router_id`) REFERENCES `router` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE `router_general_log` DROP FOREIGN KEY fk_router_general_log_router_session1;
ALTER TABLE `router_general_log` ADD CONSTRAINT `fk_router_general_log_router_session1` FOREIGN KEY (`router_session_id`) REFERENCES `router_session` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`router_status`
    ADD COLUMN `details` JSON NULL COMMENT 'More detailed status information.';

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_app_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_app_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_app_AFTER_DELETE_AUDIT_LOG`;

DELIMITER $$

CREATE TRIGGER `mysql_rest_service_metadata`.`auth_app_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `auth_app` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "auth_app", 
        "INSERT", 
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "auth_vendor_id", NEW.auth_vendor_id,
            "service_id", NEW.service_id,
            "name", NEW.name,
            "description", NEW.description,
            "url", NEW.url,
            "url_direct_auth", NEW.url_direct_auth,
            "access_token", NEW.access_token,
            "app_id", NEW.app_id,
            "enabled", NEW.enabled,
            "limit_to_registered_users", NEW.limit_to_registered_users,
            "default_role_id", NEW.default_role_id),
        NULL,
        NEW.id,
        CURRENT_USER(), 
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`auth_app_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `auth_app` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "auth_app", 
        "UPDATE", 
        JSON_OBJECT(
            "id", OLD.id,
            "auth_vendor_id", OLD.auth_vendor_id,
            "service_id", OLD.service_id,
            "name", OLD.name,
            "description", OLD.description,
            "url", OLD.url,
            "url_direct_auth", OLD.url_direct_auth,
            "access_token", OLD.access_token,
            "app_id", OLD.app_id,
            "enabled", OLD.enabled,
            "limit_to_registered_users", OLD.limit_to_registered_users,
            "default_role_id", OLD.default_role_id),
        JSON_OBJECT(
            "id", NEW.id,
            "auth_vendor_id", NEW.auth_vendor_id,
            "service_id", NEW.service_id,
            "name", NEW.name,
            "description", NEW.description,
            "url", NEW.url,
            "url_direct_auth", NEW.url_direct_auth,
            "access_token", NEW.access_token,
            "app_id", NEW.app_id,
            "enabled", NEW.enabled,
            "limit_to_registered_users", NEW.limit_to_registered_users,
            "default_role_id", NEW.default_role_id),
        OLD.id,
        NEW.id,
        CURRENT_USER(), 
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`auth_app_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `auth_app` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "auth_app", 
        "DELETE", 
        JSON_OBJECT(
            "id", OLD.id,
            "auth_vendor_id", OLD.auth_vendor_id,
            "service_id", OLD.service_id,
            "name", OLD.name,
            "description", OLD.description,
            "url", OLD.url,
            "url_direct_auth", OLD.url_direct_auth,
            "access_token", OLD.access_token,
            "app_id", OLD.app_id,
            "enabled", OLD.enabled,
            "limit_to_registered_users", OLD.limit_to_registered_users,
            "default_role_id", OLD.default_role_id),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(), 
        CURRENT_TIMESTAMP
    );
END$$

DELIMITER ;

DELETE FROM `mysql_rest_service_metadata`.`auth_vendor` WHERE id = 0x33000000000000000000000000000000;

DROP ROLE IF EXISTS 'mrs_service_admin', 'mrs_schema_admin', 'mrs_provider_metadata', 'mrs_provider_data_access';


-- -----------------------------------------------------
-- Create roles for the MySQL RDS Service
-- 
-- The mysql_rest_service_admin ROLE allows to fully manage the mrs services
-- The mysql_rest_service_schema_admin ROLE allows to manage the database schemas assigned to mrs services
-- The mysql_rest_service_meta_provider ROLE is used by the MySQL Router to read the mrs metadata and make inserts into the auth_user table
-- The mysql_rest_service_data_provider ROLE is used by the MySQL Router to read the actual schema data that is exposed via REST

CREATE ROLE IF NOT EXISTS 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_meta_provider', 'mysql_rest_service_data_provider';

-- `mysql_rest_service_metadata`.`schema_version`
GRANT SELECT ON `mysql_rest_service_metadata`.`schema_version` 
	TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`audit_log`
GRANT SELECT ON `mysql_rest_service_metadata`.`audit_log` 
	TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- Config

-- `mysql_rest_service_metadata`.`config`
GRANT SELECT, UPDATE 
	ON `mysql_rest_service_metadata`.`config` 
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`config` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`redirect`
GRANT SELECT, INSERT, UPDATE, DELETE 
	ON `mysql_rest_service_metadata`.`redirect` 
    TO 'mysql_rest_service_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`redirect` 
	TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- Service

-- `mysql_rest_service_metadata`.`url_host`
GRANT SELECT, INSERT, UPDATE, DELETE 
	ON `mysql_rest_service_metadata`.`url_host` 
    TO 'mysql_rest_service_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`url_host` 
	TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`url_host_alias`
GRANT SELECT, INSERT, DELETE 
	ON `mysql_rest_service_metadata`.`url_host_alias` 
    TO 'mysql_rest_service_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`url_host_alias` 
	TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`service`
GRANT SELECT, INSERT, UPDATE, DELETE 
	ON `mysql_rest_service_metadata`.`service` 
    TO 'mysql_rest_service_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`service` 
	TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- Schema Objects

-- `mysql_rest_service_metadata`.`db_schema`
GRANT SELECT, INSERT, UPDATE, DELETE 
	ON `mysql_rest_service_metadata`.`db_schema` 
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`db_schema` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`db_object`
GRANT SELECT, INSERT, UPDATE, DELETE
	ON `mysql_rest_service_metadata`.`db_object` 
	TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`db_object` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`mrs_db_object_row_group_security`
GRANT SELECT, INSERT, UPDATE, DELETE
	ON `mysql_rest_service_metadata`.`mrs_db_object_row_group_security` 
	TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`mrs_db_object_row_group_security` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`field`
GRANT SELECT, INSERT, UPDATE, DELETE 
	ON `mysql_rest_service_metadata`.`field` 
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`field` 
	TO 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- Static Content

-- `mysql_rest_service_metadata`.`content_set`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`content_set` 
	TO 'mysql_rest_service_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`content_set` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`content_file`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`content_file` 
    TO 'mysql_rest_service_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`content_file` 
	TO 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- User Authentication

-- `mysql_rest_service_metadata`.`auth_app`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`auth_app` 
    TO 'mysql_rest_service_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`auth_app` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`auth_vendor`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`auth_vendor` 
    TO 'mysql_rest_service_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`auth_vendor` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`mrs_user`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_user` 
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user` 
	TO 'mysql_rest_service_meta_provider';
GRANT SELECT ON `mysql_rest_service_metadata`.`mrs_user` 
	TO 'mysql_rest_service_data_provider';

-- -----------------------------------------------------
-- User Hierarchy

-- `mysql_rest_service_metadata`.`mrs_user_hierarchy`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_user_hierarchy` 
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_hierarchy` 
	TO 'mysql_rest_service_meta_provider';
GRANT SELECT ON `mysql_rest_service_metadata`.`mrs_user_hierarchy` 
	TO 'mysql_rest_service_data_provider';

-- `mysql_rest_service_metadata`.`mrs_user_hierarchy_type`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_user_hierarchy_type` 
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_hierarchy_type` 
	TO 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- User Roles

-- `mysql_rest_service_metadata`.`mrs_user_has_role`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_user_has_role` 
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_has_role` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`mrs_role`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_role` 
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_role` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`mrs_privilege`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_privilege` 
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_privilege` 
	TO 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- User Group Management

-- `mysql_rest_service_metadata`.`mrs_user_has_group`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_user_has_group` 
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_has_group` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`mrs_user_group`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_user_group` 
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_group` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`mrs_user_group_has_role`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_user_group_has_role` 
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_group_has_role` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`mrs_group_hierarchy_type`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_group_hierarchy_type` 
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_group_hierarchy_type` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`mrs_user_group_hierarchy`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_user_group_hierarchy` 
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_group_hierarchy` 
	TO 'mysql_rest_service_meta_provider';
GRANT SELECT ON `mysql_rest_service_metadata`.`mrs_user_group_hierarchy` 
	TO 'mysql_rest_service_data_provider';

-- -----------------------------------------------------
-- Router Management

-- `mysql_rest_service_metadata`.`router`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`router` 
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT, UPDATE ON `mysql_rest_service_metadata`.`router` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`router_status`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`router_status` 
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT, UPDATE ON `mysql_rest_service_metadata`.`router_status` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`router_general_log`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`router_general_log` 
    TO 'mysql_rest_service_admin';
GRANT INSERT ON `mysql_rest_service_metadata`.`router_general_log` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`router_session`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`router_session` 
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`router_session` 
	TO 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- Procedures

-- `mysql_rest_service_metadata`.`get_sequence_id`

GRANT EXECUTE ON FUNCTION `mysql_rest_service_metadata`.`get_sequence_id`
	TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_meta_provider', 'mysql_rest_service_data_provider';



ALTER SQL SECURITY INVOKER VIEW `schema_version` (major, minor, patch) AS SELECT 1, 0, 32;

ALTER SQL SECURITY INVOKER VIEW `mrs_user_schema_version` (major, minor, patch) AS SELECT 1, 0, 32;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;