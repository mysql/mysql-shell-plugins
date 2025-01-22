-- Copyright (c) 2024, 2025, Oracle and/or its affiliates.

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

ALTER SCHEMA `mysql_rest_service_metadata` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;

USE `mysql_rest_service_metadata`;

-- Set schema_version to 0.0.0 to indicate an ongoing upgrade
ALTER SQL SECURITY INVOKER VIEW `schema_version` (major, minor, patch) AS SELECT 0, 0, 0;

-- Remove old triggers
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`auth_vendor_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`auth_vendor_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`auth_vendor_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`content_file_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`content_file_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`content_file_AFTER_DELETE_AUDIT_LOG`;



DROP TRIGGER `mysql_rest_service_metadata`.`db_schema_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`db_schema_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`db_schema_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`service_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`service_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`service_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`db_object_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`db_object_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`db_object_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`object_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`object_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`object_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`object_reference_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`object_reference_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`object_reference_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`auth_app_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`auth_app_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`auth_app_AFTER_DELETE_AUDIT_LOG`;


DROP TRIGGER `mysql_rest_service_metadata`.`mrs_role_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_role_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_role_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_role_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_role_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_role_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`mrs_privilege_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_privilege_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_privilege_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_has_role_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_has_role_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_has_role_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_group_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_group_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_group_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_hierarchy_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_hierarchy_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_hierarchy_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`mrs_db_object_row_group_security_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_db_object_row_group_security_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`mrs_db_object_row_group_security_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER `mysql_rest_service_metadata`.`content_set_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`content_set_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER `mysql_rest_service_metadata`.`content_set_AFTER_DELETE_AUDIT_LOG`;

-- -----------------------------------------------------
-- Add `service_has_auth_app` n:m table, move the data and alter `auth_app` accordingly

ALTER TABLE `mysql_rest_service_metadata`.`auth_app`
  DROP FOREIGN KEY `fk_auth_app_service1`;

DROP INDEX `fk_auth_app_service1_idx` ON `mysql_rest_service_metadata`.`auth_app`;
DROP INDEX `unique_name_per_service` ON `mysql_rest_service_metadata`.`auth_app`;

-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`service_has_auth_app`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`service_has_auth_app` (
  `service_id` BINARY(16) NOT NULL,
  `auth_app_id` BINARY(16) NOT NULL,
  `options` JSON NULL,
  PRIMARY KEY (`service_id`, `auth_app_id`),
  INDEX `fk_service_has_auth_app_auth_app1_idx` (`auth_app_id` ASC) VISIBLE,
  INDEX `fk_service_has_auth_app_service1_idx` (`service_id` ASC) VISIBLE,
  CONSTRAINT `fk_service_has_auth_app_service1`
    FOREIGN KEY (`service_id`)
    REFERENCES `mysql_rest_service_metadata`.`service` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_service_has_auth_app_auth_app1`
    FOREIGN KEY (`auth_app_id`)
    REFERENCES `mysql_rest_service_metadata`.`auth_app` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;

INSERT INTO `mysql_rest_service_metadata`.`service_has_auth_app`(`service_id`, `auth_app_id`)
  SELECT `service_id`, `id` as `auth_app_id`
  FROM `mysql_rest_service_metadata`.`auth_app`;

ALTER TABLE `mysql_rest_service_metadata`.`auth_app`
  DROP COLUMN `service_id`;

-- -----------------------------------------------------
-- Add `parent_service_id` column and FK to `service` table and `metadata` to `service`, `db_schema` and `db_object`

ALTER TABLE `mysql_rest_service_metadata`.`service`
  ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT (REGEXP_REPLACE(url_context_root, '[^0-9a-zA-Z ]', '')),
  ADD COLUMN `parent_id` BINARY(16) NULL,
  ADD COLUMN `metadata` JSON NULL,
  ADD COLUMN `in_development` JSON NULL,
  ADD COLUMN `published` TINYINT NOT NULL DEFAULT 0,
  ADD INDEX `fk_service_service1_idx` (`parent_id` ASC) VISIBLE,
  ADD CONSTRAINT `fk_service_service1`
    FOREIGN KEY (`parent_id`)
    REFERENCES `mysql_rest_service_metadata`.`service` (`id`)
    ON DELETE RESTRICT
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`service`
  ADD CONSTRAINT in_development_developers_check CHECK(
    JSON_SCHEMA_VALID('{
    "id": "https://dev.mysql.com/mrs/service/in_development",
    "type": "object",
    "properties": {
        "developers": {
            "type": "array",
            "items": {
                "type": "string"
            },
            "minItems": 1,
            "uniqueItems": true
        }
    },
    "required": [ "developers" ]
    }', s.in_development)
);

ALTER TABLE `mysql_rest_service_metadata`.`db_schema`
  MODIFY COLUMN `items_per_page` INT UNSIGNED NULL DEFAULT 25,
  ADD COLUMN `internal` TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN `metadata` JSON NULL,
  ADD COLUMN `schema_type` ENUM('DATABASE_SCHEMA', 'SCRIPT_MODULE') NOT NULL DEFAULT 'DATABASE_SCHEMA',
  ADD CONSTRAINT db_schema_max_page_size CHECK (items_per_page IS NULL OR items_per_page < 16384);

ALTER TABLE `mysql_rest_service_metadata`.`object`
  ADD COLUMN `options` JSON NULL,
  ADD COLUMN `row_ownership_field_id` BINARY(16) NULL,
  ADD INDEX `row_ownership_object_idx` (`row_ownership_field_id` ASC) VISIBLE;

ALTER TABLE `mysql_rest_service_metadata`.`object_reference`
  ADD COLUMN `options` JSON NULL,
  ADD COLUMN `row_ownership_field_id` BINARY(16) NULL,
  ADD INDEX `row_ownership_object_reference_idx` (`row_ownership_field_id` ASC) VISIBLE;

ALTER TABLE `mysql_rest_service_metadata`.`object_field`
    ADD COLUMN `options` JSON NULL;

UPDATE `mysql_rest_service_metadata`.`object` AS o
    JOIN `mysql_rest_service_metadata`.`db_object` AS db_o ON db_o.id = o.db_object_id
    JOIN `mysql_rest_service_metadata`.`object_field` AS o_f ON o_f.object_id = o.id
        AND db_o.row_user_ownership_column = JSON_VALUE(o_f.db_column, "$.name")
SET o.row_ownership_field_id = o_f.id
WHERE db_o.row_user_ownership_enforced = TRUE;

UPDATE object, db_object
SET object.options=json_object(
    'duality_view_update', find_in_set('UPDATE', db_object.crud_operations)>0,
    'duality_view_insert', find_in_set('CREATE', db_object.crud_operations)>0,
    'duality_view_delete', find_in_set('DELETE', db_object.crud_operations)>0)
WHERE db_object.id=object.db_object_id;

ALTER TABLE `mysql_rest_service_metadata`.`db_object`
  ADD COLUMN `internal` TINYINT NOT NULL DEFAULT 0,
  MODIFY COLUMN `object_type` ENUM('TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION', 'SCRIPT') NOT NULL,
  MODIFY COLUMN `items_per_page` INT UNSIGNED NULL DEFAULT 25,
  ADD COLUMN `metadata` JSON NULL,
  ADD CONSTRAINT db_object_max_page_size CHECK (items_per_page IS NULL OR items_per_page < 16384),
  DROP COLUMN `row_user_ownership_enforced`,
  DROP COLUMN `row_user_ownership_column`;


ALTER TABLE `mysql_rest_service_metadata`.`content_set`
  ADD COLUMN `internal` TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN `content_type` ENUM('STATIC', 'SCRIPTS') NOT NULL DEFAULT 'STATIC';


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`content_set_has_obj_def`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`content_set_has_obj_def` (
  `content_set_id` BINARY(16) NOT NULL,
  `db_object_id` BINARY(16) NOT NULL,
  `method_type` ENUM("Script", "BeforeCreate", "BeforeRead", "BeforeUpdate", "BeforeDelete", "AfterCreate", "AfterRead", "AfterUpdate", "AfterDelete") NOT NULL,
  `priority` INT NOT NULL DEFAULT 0,
  `language` VARCHAR(45) NOT NULL,
  `class_name` VARCHAR(255) NOT NULL,
  `method_name` VARCHAR(255) NOT NULL,
  `comments` VARCHAR(512) NULL,
  `options` JSON NULL,
  INDEX `fk_content_set_has_obj_dev_db_object1_idx` (`db_object_id` ASC) VISIBLE,
  INDEX `fk_content_set_has_obj_dev_content_set1_idx` (`content_set_id` ASC) VISIBLE,
  INDEX `content_set_has_obj_dev_priority` (`priority` ASC) VISIBLE,
  PRIMARY KEY (`content_set_id`, `db_object_id`, `method_type`, `priority`),
  INDEX `content_set_has_obj_dev_method_type` (`method_type` ASC) VISIBLE,
  CONSTRAINT `fk_content_set_has_db_object_content_set1`
    FOREIGN KEY (`content_set_id`)
    REFERENCES `mysql_rest_service_metadata`.`content_set` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_content_set_has_db_object_db_object1`
    FOREIGN KEY (`db_object_id`)
    REFERENCES `mysql_rest_service_metadata`.`db_object` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;



DELIMITER $$

CREATE TRIGGER `mysql_rest_service_metadata`.`router_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `router` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "router",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "options", NEW.options),
        NULL,
        UNHEX(LPAD(CONV(NEW.id, 10, 16), 32, '0')),
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`router_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `router` FOR EACH ROW
BEGIN
    IF (COALESCE(OLD.options, '') <> COALESCE(NEW.options, '')) THEN
        INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
            table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
        VALUES (
            "router",
            "UPDATE",
            JSON_OBJECT(
                "id", OLD.id,
                "options", OLD.options),
            JSON_OBJECT(
                "id", NEW.id,
                "options", NEW.options),
            UNHEX(LPAD(CONV(OLD.id, 10, 16), 32, '0')),
            UNHEX(LPAD(CONV(NEW.id, 10, 16), 32, '0')),
            CURRENT_USER(),
            CURRENT_TIMESTAMP
        );
    END IF;
END$$

DROP TRIGGER `mysql_rest_service_metadata`.`content_set_BEFORE_DELETE`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`content_set_BEFORE_DELETE` BEFORE DELETE ON `content_set` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`content_file`
	WHERE `content_set_id` = OLD.`id`;
	DELETE FROM `mysql_rest_service_metadata`.`content_set_has_obj_def`
	WHERE `content_set_id` = OLD.`id`;
END$$



CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`content_set_has_obj_def_BEFORE_DELETE` BEFORE DELETE ON `content_set_has_obj_def` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`db_object` dbo
    WHERE OLD.method_type = "Script" AND dbo.id = OLD.db_object_id;
END$$



DROP TRIGGER `mysql_rest_service_metadata`.`service_BEFORE_INSERT`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`service_BEFORE_INSERT` BEFORE INSERT ON `service` FOR EACH ROW
BEGIN
    # Check if the full service request_path (including the optional developer setting) already exists
    IF NEW.enabled = TRUE THEN
        SET @host_name := (SELECT h.name FROM `mysql_rest_service_metadata`.url_host h WHERE h.id = NEW.url_host_id);
        SET @request_path := CONCAT(COALESCE(NEW.in_development->>'$.developers', ''), @host_name, NEW.url_context_root);
        SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(@request_path));

        IF @validPath = 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
        END IF;

        # Check if the same developer is already registered in the in_development->>'$.developers' of a service with the very same host_ctx
        SET @validDeveloperList := (SELECT MAX(COALESCE(
                JSON_OVERLAPS(s.in_development->>'$.developers', NEW.in_development->>'$.developers'), FALSE)) AS overlap
            FROM `mysql_rest_service_metadata`.`service` AS s JOIN
                `mysql_rest_service_metadata`.`url_host` AS h ON s.url_host_id = h.id JOIN
                `mysql_rest_service_metadata`.`url_host` AS h2 ON h2.id = NEW.url_host_id
            WHERE CONCAT(h.name, s.url_context_root) = CONCAT(h2.name, NEW.url_context_root) AND s.enabled = TRUE
            GROUP BY CONCAT(h.name, s.url_context_root));

        IF COALESCE(@validDeveloperList, FALSE) = TRUE THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "This developer is already registered for a REST service with the same host/url_context_root path.";
        END IF;
    END IF;

    IF NEW.in_development IS NOT NULL THEN
        SET NEW.published = 0;
    END IF;
END$$

DROP TRIGGER `mysql_rest_service_metadata`.`service_BEFORE_UPDATE`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`service_BEFORE_UPDATE` BEFORE UPDATE ON `service` FOR EACH ROW
BEGIN
    # Check if the full service request_path (including the optional developer setting) already exists,
    # but only when the service is enabled and either of those values was actually changed
    IF NEW.enabled = TRUE AND (COALESCE(NEW.in_development, '') <> COALESCE(OLD.in_development, '')
        OR NEW.url_host_id <> OLD.url_host_id OR NEW.url_context_root <> OLD.url_context_root) THEN

        SET @host_name := (SELECT h.name FROM `mysql_rest_service_metadata`.url_host h WHERE h.id = NEW.url_host_id);
        SET @request_path := CONCAT(COALESCE(NEW.in_development->>'$.developers', ''), @host_name, NEW.url_context_root);
        SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(@request_path));

        IF @validPath = 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
        END IF;

        # Check if the same developer is already registered in the in_development->>'$.developers' of a service with the very same host_ctx
        SET @validDeveloperList := (SELECT MAX(COALESCE(
                JSON_OVERLAPS(s.in_development->>'$.developers', NEW.in_development->>'$.developers'), FALSE)) AS overlap
            FROM `mysql_rest_service_metadata`.`service` AS s JOIN
                `mysql_rest_service_metadata`.`url_host` AS h ON s.url_host_id = h.id JOIN
                `mysql_rest_service_metadata`.`url_host` AS h2 ON h2.id = NEW.url_host_id
            WHERE CONCAT(h.name, s.url_context_root) = CONCAT(h2.name, NEW.url_context_root) AND s.enabled = TRUE
                AND s.id <> NEW.id
            GROUP BY CONCAT(h.name, s.url_context_root));

        IF COALESCE(@validDeveloperList, FALSE) = TRUE THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "This developer is already registered for a REST service with the same host/url_context_root path.";
        END IF;
    END IF;


    IF OLD.in_development IS NULL AND NEW.in_development IS NOT NULL AND NEW.published = 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "A REST service that is in development cannot be published. Please reset the development state first.";
    END IF;
END$$

DROP TRIGGER `mysql_rest_service_metadata`.`service_BEFORE_DELETE`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`service_BEFORE_DELETE` BEFORE DELETE ON `service` FOR EACH ROW
BEGIN
	# Since FKs do not fire the triggers on the related tables, manually trigger the DELETEs
	DELETE FROM `mysql_rest_service_metadata`.`db_schema` WHERE `service_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`content_set` WHERE `service_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`service_has_auth_app` WHERE `service_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_role` WHERE `specific_to_service_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_hierarchy_type` WHERE `specific_to_service_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_group` WHERE `specific_to_service_id` = OLD.`id`;
END$$

CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`service_has_auth_app_AFTER_DELETE` AFTER DELETE ON `service_has_auth_app` FOR EACH ROW
BEGIN
	# Since FKs do not fire the triggers on the related tables, manually trigger the DELETEs
    # If the corresponding auth_app is not used by another service, delete it
	IF ((SELECT COUNT(*) FROM `mysql_rest_service_metadata`.`service_has_auth_app` WHERE auth_app_id = OLD.auth_app_id) = 0) THEN
		DELETE FROM `mysql_rest_service_metadata`.`auth_app` WHERE `id` = OLD.`auth_app_id`;
	END IF;
END$$

DROP FUNCTION `mysql_rest_service_metadata`.`valid_request_path`$$
CREATE FUNCTION `mysql_rest_service_metadata`.`valid_request_path`(path VARCHAR(255))
RETURNS TINYINT(1) NOT DETERMINISTIC READS SQL DATA
BEGIN
    SET @valid := (SELECT COUNT(*) = 0 AS valid FROM
        (SELECT CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name,
            se.url_context_root) as full_request_path
        FROM `mysql_rest_service_metadata`.service se
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
        WHERE CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name, se.url_context_root) = path
            AND se.enabled = TRUE
        UNION
        SELECT CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name, se.url_context_root,
            sc.request_path) as full_request_path
        FROM `mysql_rest_service_metadata`.db_schema sc
            LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                ON se.id = sc.service_id
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
        WHERE CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name, se.url_context_root,
                sc.request_path) = path
            AND se.enabled = TRUE
        UNION
        SELECT CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name, se.url_context_root,
            sc.request_path, o.request_path) as full_request_path
        FROM `mysql_rest_service_metadata`.db_object o
            LEFT OUTER JOIN `mysql_rest_service_metadata`.db_schema sc
                ON sc.id = o.db_schema_id
            LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                ON se.id = sc.service_id
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
        WHERE CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name, se.url_context_root,
                sc.request_path, o.request_path) = path
            AND se.enabled = TRUE
        UNION
        SELECT CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name, se.url_context_root,
            co.request_path) as full_request_path
        FROM `mysql_rest_service_metadata`.content_set co
            LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                ON se.id = co.service_id
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
        WHERE CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name, se.url_context_root,
                co.request_path) = path
            AND se.enabled = TRUE) AS p);

    RETURN @valid;
END$$

DELIMITER ;

-- -----------------------------------------------------
-- View `mysql_rest_service_metadata`.`table_columns_with_references`
-- -----------------------------------------------------
USE `mysql_rest_service_metadata`;
CREATE  OR REPLACE SQL SECURITY INVOKER VIEW `table_columns_with_references` AS
SELECT f.* FROM (
	-- Get the table columns
	SELECT c.ORDINAL_POSITION AS position, c.COLUMN_NAME AS name,
        NULL AS ref_column_names,
        JSON_OBJECT(
            "name", c.COLUMN_NAME,
            "datatype", c.COLUMN_TYPE,
            "not_null", c.IS_NULLABLE = "NO",
            "is_primary", c.COLUMN_KEY = "PRI",
            "is_unique", c.COLUMN_KEY = "UNI",
            "is_generated", c.GENERATION_EXPRESSION <> "",
            "id_generation", IF(c.EXTRA = "auto_increment", "auto_inc",
                IF(c.COLUMN_KEY = "PRI" AND c.DATA_TYPE = "binary" AND c.CHARACTER_MAXIMUM_LENGTH = 16,
                    "rev_uuid", NULL)),
            "comment", c.COLUMN_COMMENT,
            "srid", c.SRS_ID,
            "column_default", c.COLUMN_DEFAULT
            ) AS db_column,
	    NULL AS reference_mapping,
        c.TABLE_SCHEMA as table_schema, c.TABLE_NAME as table_name
	FROM INFORMATION_SCHEMA.COLUMNS AS c
	    LEFT OUTER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS k
	        ON c.TABLE_SCHEMA = k.TABLE_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME
                AND c.COLUMN_NAME=k.COLUMN_NAME
	            AND NOT ISNULL(k.POSITION_IN_UNIQUE_CONSTRAINT)
	-- Union with the references that point from the table to other tables (n:1)
	UNION
	SELECT MAX(c.ORDINAL_POSITION) + 100 AS position, MAX(k.REFERENCED_TABLE_NAME) AS name,
        GROUP_CONCAT(c.COLUMN_NAME SEPARATOR ', ') AS ref_column_names,
	    NULL AS db_column,
	    JSON_MERGE_PRESERVE(
			JSON_OBJECT("kind", "n:1"),
	        JSON_OBJECT("constraint",
                CONCAT(MAX(k.CONSTRAINT_SCHEMA), ".", MAX(k.CONSTRAINT_NAME))),
	        JSON_OBJECT("to_many", FALSE),
	        JSON_OBJECT("referenced_schema", MAX(k.REFERENCED_TABLE_SCHEMA)),
	        JSON_OBJECT("referenced_table", MAX(k.REFERENCED_TABLE_NAME)),
	        JSON_OBJECT("column_mapping",
                JSON_ARRAYAGG(JSON_OBJECT(
                    "base", c.COLUMN_NAME,
                    "ref", k.REFERENCED_COLUMN_NAME)))
	    ) AS reference_mapping,
        MAX(c.TABLE_SCHEMA) AS table_schema, MAX(c.TABLE_NAME) AS table_name
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS k
	    JOIN INFORMATION_SCHEMA.COLUMNS AS c
	        ON c.TABLE_SCHEMA = k.TABLE_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME
                AND c.COLUMN_NAME=k.COLUMN_NAME
	WHERE NOT ISNULL(k.REFERENCED_TABLE_NAME)
    GROUP BY k.CONSTRAINT_NAME, k.table_schema, k.table_name
	UNION
	-- Union with the references that point from other tables to the table (1:1 and 1:n)
	SELECT MAX(c.ORDINAL_POSITION) + 1000 AS position,
        MAX(c.TABLE_NAME) AS name,
        GROUP_CONCAT(k.COLUMN_NAME SEPARATOR ', ') AS ref_column_names,
	    NULL AS db_column,
	    JSON_MERGE_PRESERVE(
	        -- If the PKs of the table and the referred table are exactly the same,
            -- this is a 1:1 relationship, otherwise an 1:n
			JSON_OBJECT("kind", IF(JSON_CONTAINS(MAX(PK_TABLE.PK), MAX(PK_REF.PK)) = 1,
				"1:1", "1:n")),
	        JSON_OBJECT("constraint",
                CONCAT(MAX(k.CONSTRAINT_SCHEMA), ".", MAX(k.CONSTRAINT_NAME))),
	        JSON_OBJECT("to_many", JSON_CONTAINS(MAX(PK_TABLE.PK), MAX(PK_REF.PK)) = 0),
	        JSON_OBJECT("referenced_schema", MAX(c.TABLE_SCHEMA)),
	        JSON_OBJECT("referenced_table", MAX(c.TABLE_NAME)),
	        JSON_OBJECT("column_mapping",
                JSON_ARRAYAGG(JSON_OBJECT(
                    "base", k.REFERENCED_COLUMN_NAME,
                    "ref", c.COLUMN_NAME)))
	    ) AS reference_mapping,
        MAX(k.REFERENCED_TABLE_SCHEMA) AS table_schema,
        MAX(k.REFERENCED_TABLE_NAME) AS table_name
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS k
	    JOIN INFORMATION_SCHEMA.COLUMNS AS c
	        ON c.TABLE_SCHEMA = k.TABLE_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME
                AND c.COLUMN_NAME=k.COLUMN_NAME
	    -- The PK columns of the table, e.g. ["test_fk.product.id"]
	    JOIN (SELECT JSON_ARRAYAGG(CONCAT(c2.TABLE_SCHEMA, ".",
                    c2.TABLE_NAME, ".", c2.COLUMN_NAME)) AS PK,
	            c2.TABLE_SCHEMA, c2.TABLE_NAME
	            FROM INFORMATION_SCHEMA.COLUMNS AS c2
	            WHERE c2.COLUMN_KEY = "PRI"
	            GROUP BY c2.COLUMN_KEY, c2.TABLE_SCHEMA, c2.TABLE_NAME) AS PK_TABLE
	        ON PK_TABLE.TABLE_SCHEMA = k.REFERENCED_TABLE_SCHEMA
                AND PK_TABLE.TABLE_NAME = k.REFERENCED_TABLE_NAME
	    -- The PK columns of the referenced table,
        -- e.g. ["test_fk.product_part.id", "test_fk.product.id"]
	    JOIN (SELECT JSON_ARRAYAGG(PK2.PK_COL) AS PK, PK2.TABLE_SCHEMA, PK2.TABLE_NAME
	        FROM (SELECT IFNULL(
	            CONCAT(MAX(k1.REFERENCED_TABLE_SCHEMA), ".",
	                MAX(k1.REFERENCED_TABLE_NAME), ".", MAX(k1.REFERENCED_COLUMN_NAME)),
	            CONCAT(c1.TABLE_SCHEMA, ".", c1.TABLE_NAME, ".", c1.COLUMN_NAME)) AS PK_COL,
	            c1.TABLE_SCHEMA AS TABLE_SCHEMA, c1.TABLE_NAME AS TABLE_NAME
	            FROM INFORMATION_SCHEMA.COLUMNS AS c1
	                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS k1
	                    ON k1.TABLE_SCHEMA = c1.TABLE_SCHEMA
                            AND k1.TABLE_NAME = c1.TABLE_NAME
	                        AND k1.COLUMN_NAME = c1.COLUMN_NAME
	            WHERE c1.COLUMN_KEY = "PRI"
	            GROUP BY c1.COLUMN_NAME, c1.TABLE_SCHEMA, c1.TABLE_NAME) AS PK2
	            GROUP BY PK2.TABLE_SCHEMA, PK2.TABLE_NAME) AS PK_REF
	        ON PK_REF.TABLE_SCHEMA = k.TABLE_SCHEMA AND PK_REF.TABLE_NAME = k.TABLE_NAME
	GROUP BY k.CONSTRAINT_NAME, c.TABLE_SCHEMA, c.TABLE_NAME
    ) AS f
ORDER BY f.position;

-- -----------------------------------------------------
-- View `mysql_rest_service_metadata`.`object_fields_with_references`
-- -----------------------------------------------------
USE `mysql_rest_service_metadata`;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `object_fields_with_references` AS
WITH RECURSIVE obj_fields (
    caption, lev, position, id, represents_reference_id, parent_reference_id, object_id,
    name, db_column, enabled,
    allow_filtering, allow_sorting, no_check, no_update, options, sdk_options, comments,
    object_reference) AS
(
    SELECT CONCAT("- ", f.name) as caption, 1 AS lev, f.position, f.id,
		f.represents_reference_id, f.parent_reference_id, f.object_id, f.name,
        f.db_column, f.enabled, f.allow_filtering, f.allow_sorting, f.no_check, f.no_update,
        f.options, f.sdk_options, f.comments,
        IF(ISNULL(f.represents_reference_id), NULL, JSON_OBJECT(
            "reduce_to_value_of_field_id", TO_BASE64(r.reduce_to_value_of_field_id),
            "row_ownership_field_id", TO_BASE64(r.row_ownership_field_id),
            "reference_mapping", r.reference_mapping,
            "unnest", (r.unnest = 1),
            "options", r.options,
            "sdk_options", r.sdk_options,
            "comments", r.comments
        )) AS object_reference
    FROM `mysql_rest_service_metadata`.`object_field` f
        LEFT OUTER JOIN `mysql_rest_service_metadata`.`object_reference` AS r
            ON r.id = f.represents_reference_id
    WHERE ISNULL(parent_reference_id)
    UNION ALL
    SELECT CONCAT(REPEAT("  ", p.lev), "- ", f.name) as caption, p.lev+1 AS lev, f.position,
        f.id, f.represents_reference_id, f.parent_reference_id, f.object_id, f.name,
        f.db_column, f.enabled, f.allow_filtering, f.allow_sorting, f.no_check, f.no_update,
        f.options, f.sdk_options, f.comments,
        IF(ISNULL(f.represents_reference_id), NULL, JSON_OBJECT(
            "reduce_to_value_of_field_id", TO_BASE64(rc.reduce_to_value_of_field_id),
            "row_ownership_field_id", TO_BASE64(rc.row_ownership_field_id),
            "reference_mapping", rc.reference_mapping,
            "unnest", (rc.unnest = 1),
            "options", rc.options,
            "sdk_options", rc.sdk_options,
            "comments", rc.comments
        )) AS object_reference
    FROM obj_fields AS p JOIN `mysql_rest_service_metadata`.`object_reference` AS r
            ON r.id = p.represents_reference_id
        LEFT OUTER JOIN `mysql_rest_service_metadata`.`object_field` AS f
            ON r.id = f.parent_reference_id
        LEFT OUTER JOIN `mysql_rest_service_metadata`.`object_reference` AS rc
            ON rc.id = f.represents_reference_id
	WHERE f.id IS NOT NULL
)
SELECT * FROM obj_fields;


CREATE OR REPLACE SQL SECURITY INVOKER VIEW `router_services` AS
SELECT r.id AS router_id, r.router_name, r.address, r.options->>'$.developer' AS router_developer,
    s.id as service_id, h.name AS service_url_host_name,
    s.url_context_root AS service_url_context_root,
    CONCAT(h.name, s.url_context_root) AS service_host_ctx,
    s.published, s.in_development,
    (SELECT GROUP_CONCAT(IF(item REGEXP '^[A-Za-z0-9_]+$', item, QUOTE(item)) ORDER BY item)
        FROM JSON_TABLE(
        s.in_development->>'$.developers', '$[*]' COLUMNS (item text path '$')
    ) AS jt) AS sorted_developers
FROM `mysql_rest_service_metadata`.`service` s
    LEFT JOIN `mysql_rest_service_metadata`.`url_host` h
        ON s.url_host_id = h.id
    JOIN `mysql_rest_service_metadata`.`router` r
WHERE
    (enabled = 1)
    AND (
    ((published = 1) AND (NOT EXISTS (select s2.id from `mysql_rest_service_metadata`.`service` s2 where s.url_host_id=s2.url_host_id AND s.url_context_root=s2.url_context_root
        AND JSON_OVERLAPS(r.options->'$.developer', s2.in_development->>'$.developers'))))
    OR
    ((published = 0) AND (s.id IN (select s2.id from `mysql_rest_service_metadata`.`service` s2 where s.url_host_id=s2.url_host_id AND s.url_context_root=s2.url_context_root
        AND JSON_OVERLAPS(r.options->'$.developer', s2.in_development->>'$.developers'))))
    OR
    ((published = 0) AND r.options->'$.developer' IS NOT NULL AND s.in_development IS NULL)
    );


-- Additional ALTERs

ALTER TABLE `mysql_rest_service_metadata`.`auth_vendor`
    ADD COLUMN `options` JSON NULL;

ALTER TABLE `mysql_rest_service_metadata`.`auth_app`
    ADD COLUMN `options` JSON NULL;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user`
    ADD COLUMN `options` JSON NULL;

ALTER TABLE `mysql_rest_service_metadata`.`content_file`
    ADD COLUMN `options` JSON NULL;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_role`
    ADD COLUMN `options` JSON NULL;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_has_role`
    ADD COLUMN `options` JSON NULL;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_hierarchy_type`
    ADD COLUMN `options` JSON NULL;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_hierarchy`
    ADD COLUMN `options` JSON NULL;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_privilege`
    ADD COLUMN `options` JSON NULL;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_group`
    ADD COLUMN `options` JSON NULL;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_group_has_role`
    ADD COLUMN `options` JSON NULL;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_has_group`
    ADD COLUMN `options` JSON NULL;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_group_hierarchy_type`
    ADD COLUMN `options` JSON NULL;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_group_hierarchy`
    ADD COLUMN `options` JSON NULL;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_db_object_row_group_security`
    ADD COLUMN `options` JSON NULL;



-- -----------------------------------------------------
-- Create audit_log triggers
--

DELIMITER $$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `mrs_user` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "auth_app_id", NEW.auth_app_id,
            "name", NEW.name,
            "email", NEW.email,
            "vendor_user_id", NEW.vendor_user_id,
            "login_permitted", NEW.login_permitted,
            "mapped_user_id", NEW.mapped_user_id,
            "app_options", NEW.app_options,
            "options", NEW.options),
        NULL,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `mrs_user` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "auth_app_id", OLD.auth_app_id,
            "name", OLD.name,
            "email", OLD.email,
            "vendor_user_id", OLD.vendor_user_id,
            "login_permitted", OLD.login_permitted,
            "mapped_user_id", OLD.mapped_user_id,
            "app_options", OLD.app_options,
            "options", OLD.options),
        JSON_OBJECT(
            "id", NEW.id,
            "auth_app_id", NEW.auth_app_id,
            "name", NEW.name,
            "email", NEW.email,
            "vendor_user_id", NEW.vendor_user_id,
            "login_permitted", NEW.login_permitted,
            "mapped_user_id", NEW.mapped_user_id,
            "app_options", NEW.app_options,
            "options", NEW.options),
        OLD.id,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `mrs_user` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "auth_app_id", OLD.auth_app_id,
            "name", OLD.name,
            "email", OLD.email,
            "vendor_user_id", OLD.vendor_user_id,
            "login_permitted", OLD.login_permitted,
            "mapped_user_id", OLD.mapped_user_id,
            "app_options", OLD.app_options,
            "options", OLD.options),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`auth_vendor_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `auth_vendor` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "auth_vendor",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "name", NEW.name,
            "validation_url", NEW.validation_url,
            "enabled", NEW.enabled,
            "comments", NEW.comments,
            "options", NEW.options),
        NULL,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`auth_vendor_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `auth_vendor` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "auth_vendor",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "name", OLD.name,
            "validation_url", OLD.validation_url,
            "enabled", OLD.enabled,
            "comments", OLD.comments,
            "options", OLD.options),
        JSON_OBJECT(
            "id", NEW.id,
            "name", NEW.name,
            "validation_url", NEW.validation_url,
            "enabled", NEW.enabled,
            "comments", NEW.comments,
            "options", NEW.options),
        OLD.id,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`auth_vendor_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `auth_vendor` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "auth_vendor",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "name", OLD.name,
            "validation_url", OLD.validation_url,
            "enabled", OLD.enabled,
            "comments", OLD.comments,
            "options", OLD.options),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

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
            "name", NEW.name,
            "description", NEW.description,
            "url", NEW.url,
            "url_direct_auth", NEW.url_direct_auth,
            "access_token", NEW.access_token,
            "app_id", NEW.app_id,
            "enabled", NEW.enabled,
            "limit_to_registered_users", NEW.limit_to_registered_users,
            "default_role_id", NEW.default_role_id,
            "options", NEW.options),
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
            "name", OLD.name,
            "description", OLD.description,
            "url", OLD.url,
            "url_direct_auth", OLD.url_direct_auth,
            "access_token", OLD.access_token,
            "app_id", OLD.app_id,
            "enabled", OLD.enabled,
            "limit_to_registered_users", OLD.limit_to_registered_users,
            "default_role_id", OLD.default_role_id,
            "options", OLD.options),
        JSON_OBJECT(
            "id", NEW.id,
            "auth_vendor_id", NEW.auth_vendor_id,
            "name", NEW.name,
            "description", NEW.description,
            "url", NEW.url,
            "url_direct_auth", NEW.url_direct_auth,
            "access_token", NEW.access_token,
            "app_id", NEW.app_id,
            "enabled", NEW.enabled,
            "limit_to_registered_users", NEW.limit_to_registered_users,
            "default_role_id", NEW.default_role_id,
            "options", NEW.options),
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
            "name", OLD.name,
            "description", OLD.description,
            "url", OLD.url,
            "url_direct_auth", OLD.url_direct_auth,
            "access_token", OLD.access_token,
            "app_id", OLD.app_id,
            "enabled", OLD.enabled,
            "limit_to_registered_users", OLD.limit_to_registered_users,
            "default_role_id", OLD.default_role_id,
            "options", OLD.options),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$


CREATE TRIGGER `mysql_rest_service_metadata`.`content_file_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `content_file` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "content_file",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "content_set_id", NEW.content_set_id,
            "request_path", NEW.request_path,
            "requires_auth", NEW.requires_auth,
            "enabled", NEW.enabled,
            "size", NEW.size,
            "options", NEW.options),
        NULL,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`content_file_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `content_file` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "content_file",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "content_set_id", OLD.content_set_id,
            "request_path", OLD.request_path,
            "requires_auth", OLD.requires_auth,
            "enabled", OLD.enabled,
            "size", OLD.size,
            "options", OLD.options),
        JSON_OBJECT(
            "id", NEW.id,
            "content_set_id", NEW.content_set_id,
            "request_path", NEW.request_path,
            "requires_auth", NEW.requires_auth,
            "enabled", NEW.enabled,
            "size", NEW.size,
            "options", NEW.options),
        OLD.id,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`content_file_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `content_file` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "content_file",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "content_set_id", OLD.content_set_id,
            "request_path", OLD.request_path,
            "requires_auth", OLD.requires_auth,
            "enabled", OLD.enabled,
            "size", OLD.size,
            "options", OLD.options),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$


CREATE TRIGGER `mysql_rest_service_metadata`.`db_schema_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `db_schema` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "db_schema",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "service_id", NEW.service_id,
            "name", NEW.name,
            "schema_type", NEW.schema_type,
            "request_path", NEW.request_path,
            "requires_auth", NEW.requires_auth,
            "enabled", NEW.enabled,
            "internal", NEW.internal,
            "items_per_page", NEW.items_per_page,
            "comments", NEW.comments,
            "options", NEW.options,
            "metadata", NEW.metadata),
        NULL,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`db_schema_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `db_schema` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "db_schema",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "service_id", OLD.service_id,
            "name", OLD.name,
            "schema_type", OLD.schema_type,
            "request_path", OLD.request_path,
            "requires_auth", OLD.requires_auth,
            "enabled", OLD.enabled,
            "internal", OLD.internal,
            "items_per_page", OLD.items_per_page,
            "comments", OLD.comments,
            "options", OLD.options,
            "metadata", OLD.metadata),
        JSON_OBJECT(
            "id", NEW.id,
            "service_id", NEW.service_id,
            "name", NEW.name,
            "schema_type", NEW.schema_type,
            "request_path", NEW.request_path,
            "requires_auth", NEW.requires_auth,
            "enabled", NEW.enabled,
            "internal", NEW.internal,
            "items_per_page", NEW.items_per_page,
            "comments", NEW.comments,
            "options", NEW.options,
            "metadata", NEW.metadata),
        OLD.id,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`db_schema_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `db_schema` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "db_schema",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "service_id", OLD.service_id,
            "name", OLD.name,
            "schema_type", OLD.schema_type,
            "request_path", OLD.request_path,
            "requires_auth", OLD.requires_auth,
            "enabled", OLD.enabled,
            "internal", OLD.internal,
            "items_per_page", OLD.items_per_page,
            "comments", OLD.comments,
            "options", OLD.options,
            "metadata", OLD.metadata),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`service_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `service` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "service",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "parent_id", NEW.parent_id,
            "url_host_id", NEW.url_host_id,
            "url_context_root", NEW.url_context_root,
            "url_protocol", NEW.url_protocol,
            "name", NEW.name,
            "enabled", NEW.enabled,
            "published", NEW.published,
            "in_development", NEW.in_development,
            "comments", NEW.comments,
            "options", NEW.options,
            "auth_path", NEW.auth_path,
            "auth_completed_url", NEW.auth_completed_url,
            "auth_completed_url_validation", NEW.auth_completed_url_validation,
            "enable_sql_endpoint", NEW.enable_sql_endpoint,
            "custom_metadata_schema", NEW.custom_metadata_schema,
            "metadata", NEW.metadata),
        NULL,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`service_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `service` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "service",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "parent_id", OLD.parent_id,
            "url_host_id", OLD.url_host_id,
            "url_context_root", OLD.url_context_root,
            "url_protocol", OLD.url_protocol,
            "name", OLD.name,
            "enabled", OLD.enabled,
            "published", OLD.published,
            "in_development", OLD.in_development,
            "comments", OLD.comments,
            "options", OLD.options,
            "auth_path", OLD.auth_path,
            "auth_completed_url", OLD.auth_completed_url,
            "auth_completed_url_validation", OLD.auth_completed_url_validation,
            "enable_sql_endpoint", OLD.enable_sql_endpoint,
            "custom_metadata_schema", OLD.custom_metadata_schema,
            "metadata", OLD.metadata),
        JSON_OBJECT(
            "id", NEW.id,
            "parent_id", NEW.parent_id,
            "url_host_id", NEW.url_host_id,
            "url_context_root", NEW.url_context_root,
            "url_protocol", NEW.url_protocol,
            "name", NEW.name,
            "enabled", NEW.enabled,
            "published", NEW.published,
            "in_development", NEW.in_development,
            "comments", NEW.comments,
            "options", NEW.options,
            "auth_path", NEW.auth_path,
            "auth_completed_url", NEW.auth_completed_url,
            "auth_completed_url_validation", NEW.auth_completed_url_validation,
            "enable_sql_endpoint", NEW.enable_sql_endpoint,
            "custom_metadata_schema", NEW.custom_metadata_schema,
            "metadata", NEW.metadata),
        OLD.id,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`service_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `service` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "service",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "parent_id", OLD.parent_id,
            "url_host_id", OLD.url_host_id,
            "url_context_root", OLD.url_context_root,
            "url_protocol", OLD.url_protocol,
            "name", OLD.name,
            "enabled", OLD.enabled,
            "published", OLD.published,
            "in_development", OLD.in_development,
            "comments", OLD.comments,
            "options", OLD.options,
            "auth_path", OLD.auth_path,
            "auth_completed_url", OLD.auth_completed_url,
            "auth_completed_url_validation", OLD.auth_completed_url_validation,
            "enable_sql_endpoint", OLD.enable_sql_endpoint,
            "custom_metadata_schema", OLD.custom_metadata_schema,
            "metadata", OLD.metadata),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`db_object_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `db_object` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "db_object",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "db_schema_id", NEW.db_schema_id,
            "name", NEW.name,
            "request_path", NEW.request_path,
            "enabled", NEW.enabled,
            "internal", NEW.internal,
            "object_type", NEW.object_type,
            "crud_operations", NEW.crud_operations,
            "format", NEW.format,
            "items_per_page", NEW.items_per_page,
            "media_type", NEW.media_type,
            "auto_detect_media_type", NEW.auto_detect_media_type,
            "requires_auth", NEW.requires_auth,
            "auth_stored_procedure", NEW.auth_stored_procedure,
            "options", NEW.options,
            "details", NEW.details,
            "comments", NEW.comments,
            "metadata", NEW.metadata),
        NULL,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`db_object_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `db_object` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "db_object",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "db_schema_id", OLD.db_schema_id,
            "name", OLD.name,
            "request_path", OLD.request_path,
            "enabled", OLD.enabled,
            "internal", OLD.internal,
            "object_type", OLD.object_type,
            "crud_operations", OLD.crud_operations,
            "format", OLD.format,
            "items_per_page", OLD.items_per_page,
            "media_type", OLD.media_type,
            "auto_detect_media_type", OLD.auto_detect_media_type,
            "requires_auth", OLD.requires_auth,
            "auth_stored_procedure", OLD.auth_stored_procedure,
            "options", OLD.options,
            "details", OLD.details,
            "comments", OLD.comments,
            "metadata", OLD.metadata),
        JSON_OBJECT(
            "id", NEW.id,
            "db_schema_id", NEW.db_schema_id,
            "name", NEW.name,
            "request_path", NEW.request_path,
            "enabled", NEW.enabled,
            "internal", NEW.internal,
            "object_type", NEW.object_type,
            "crud_operations", NEW.crud_operations,
            "format", NEW.format,
            "items_per_page", NEW.items_per_page,
            "media_type", NEW.media_type,
            "auto_detect_media_type", NEW.auto_detect_media_type,
            "requires_auth", NEW.requires_auth,
            "auth_stored_procedure", NEW.auth_stored_procedure,
            "options", NEW.options,
            "details", NEW.details,
            "comments", NEW.comments,
            "metadata", NEW.metadata),
        OLD.id,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`db_object_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `db_object` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "db_object",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "db_schema_id", OLD.db_schema_id,
            "name", OLD.name,
            "request_path", OLD.request_path,
            "enabled", OLD.enabled,
            "internal", OLD.internal,
            "object_type", OLD.object_type,
            "crud_operations", OLD.crud_operations,
            "format", OLD.format,
            "items_per_page", OLD.items_per_page,
            "media_type", OLD.media_type,
            "auto_detect_media_type", OLD.auto_detect_media_type,
            "requires_auth", OLD.requires_auth,
            "auth_stored_procedure", OLD.auth_stored_procedure,
            "options", OLD.options,
            "details", OLD.details,
            "comments", OLD.comments,
            "metadata", OLD.metadata),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$


CREATE TRIGGER `mysql_rest_service_metadata`.`service_has_auth_app_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `service_has_auth_app` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "service_has_auth_app",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "service_id", NEW.service_id,
            "auth_app_id", NEW.auth_app_id,
            "options", NEW.options),
        NULL,
        NEW.service_id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`service_has_auth_app_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `service_has_auth_app` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "service_has_auth_app",
        "UPDATE",
        JSON_OBJECT(
            "service_id", OLD.service_id,
            "auth_app_id", OLD.auth_app_id,
            "options", OLD.options),
        JSON_OBJECT(
            "service_id", NEW.service_id,
            "auth_app_id", NEW.auth_app_id,
            "options", NEW.options),
        OLD.service_id,
        NEW.service_id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`service_has_auth_app_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `service_has_auth_app` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "service_has_auth_app",
        "DELETE",
        JSON_OBJECT(
            "service_id", OLD.service_id,
            "auth_app_id", OLD.auth_app_id,
            "options", OLD.options),
        NULL,
        OLD.service_id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `object` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "object",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "db_object_id", NEW.db_object_id,
            "name", NEW.name,
            "kind", NEW.kind,
            "position", NEW.position,
            "row_ownership_field_id", NEW.row_ownership_field_id,
            "options", NEW.options,
            "sdk_options", NEW.sdk_options,
            "comments", NEW.comments),
        NULL,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `object` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "object",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "db_object_id", OLD.db_object_id,
            "name", OLD.name,
            "kind", OLD.kind,
            "position", OLD.position,
            "row_ownership_field_id", OLD.row_ownership_field_id,
            "options", OLD.options,
            "sdk_options", OLD.sdk_options,
            "comments", OLD.comments),
        JSON_OBJECT(
            "id", NEW.id,
            "db_object_id", NEW.db_object_id,
            "name", NEW.name,
            "kind", NEW.kind,
            "position", NEW.position,
            "row_ownership_field_id", NEW.row_ownership_field_id,
            "options", NEW.options,
            "sdk_options", NEW.sdk_options,
            "comments", NEW.comments),
        OLD.id,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `object` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "object",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "db_object_id", OLD.db_object_id,
            "name", OLD.name,
            "kind", OLD.kind,
            "position", OLD.position,
            "row_ownership_field_id", OLD.row_ownership_field_id,
            "options", OLD.options,
            "sdk_options", OLD.sdk_options,
            "comments", OLD.comments),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_reference_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `object_reference` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "object_reference",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "reduce_to_value_of_field_id", NEW.reduce_to_value_of_field_id,
            "reference_mapping", NEW.reference_mapping,
            "unnest", NEW.unnest,
            "crud_operations", NEW.crud_operations,
            "options", NEW.options,
            "sdk_options", NEW.sdk_options,
            "comments", NEW.comments),
        NULL,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_reference_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `object_reference` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "object_reference",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "reduce_to_value_of_field_id", OLD.reduce_to_value_of_field_id,
            "reference_mapping", OLD.reference_mapping,
            "unnest", OLD.unnest,
            "crud_operations", OLD.crud_operations,
            "options", OLD.options,
            "sdk_options", OLD.sdk_options,
            "comments", OLD.comments),
        JSON_OBJECT(
            "id", NEW.id,
            "reduce_to_value_of_field_id", NEW.reduce_to_value_of_field_id,
            "reference_mapping", NEW.reference_mapping,
            "unnest", NEW.unnest,
            "crud_operations", NEW.crud_operations,
            "options", NEW.options,
            "sdk_options", NEW.sdk_options,
            "comments", NEW.comments),
        OLD.id,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_reference_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `object_reference` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "object_reference",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "reduce_to_value_of_field_id", OLD.reduce_to_value_of_field_id,
            "reference_mapping", OLD.reference_mapping,
            "unnest", OLD.unnest,
            "crud_operations", OLD.crud_operations,
            "options", OLD.options,
            "sdk_options", OLD.sdk_options,
            "comments", OLD.comments),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$



CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_role_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `mrs_role` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_role",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "derived_from_role_id", NEW.derived_from_role_id,
            "specific_to_service_id", NEW.specific_to_service_id,
            "caption", NEW.caption,
            "description", NEW.description,
            "options", NEW.options),
        NULL,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_role_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `mrs_role` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_role",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "derived_from_role_id", OLD.derived_from_role_id,
            "specific_to_service_id", OLD.specific_to_service_id,
            "caption", OLD.caption,
            "description", OLD.description,
            "options", OLD.options),
        JSON_OBJECT(
            "id", NEW.id,
            "derived_from_role_id", NEW.derived_from_role_id,
            "specific_to_service_id", NEW.specific_to_service_id,
            "caption", NEW.caption,
            "description", NEW.description,
            "options", NEW.options),
        OLD.id,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_role_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `mrs_role` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_role",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "derived_from_role_id", OLD.derived_from_role_id,
            "specific_to_service_id", OLD.specific_to_service_id,
            "caption", OLD.caption,
            "description", OLD.description,
            "options", OLD.options),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_role_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `mrs_user_has_role` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_has_role",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "user_id", NEW.user_id,
            "role_id", NEW.role_id,
            "comments", NEW.comments,
            "options", NEW.options),
        NULL,
        NEW.user_id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_role_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `mrs_user_has_role` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_has_role",
        "UPDATE",
        JSON_OBJECT(
            "user_id", OLD.user_id,
            "role_id", OLD.role_id,
            "comments", OLD.comments,
            "options", OLD.options),
        JSON_OBJECT(
            "user_id", NEW.user_id,
            "role_id", NEW.role_id,
            "comments", NEW.comments,
            "options", NEW.options),
        OLD.user_id,
        NEW.user_id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_role_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `mrs_user_has_role` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_has_role",
        "DELETE",
        JSON_OBJECT(
            "user_id", OLD.user_id,
            "role_id", OLD.role_id,
            "comments", OLD.comments,
            "options", OLD.options),
        NULL,
        OLD.user_id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `mrs_user_hierarchy` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_hierarchy",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "user_id", NEW.user_id,
            "reporting_to_user_id", NEW.reporting_to_user_id,
            "user_hierarchy_type_id", NEW.user_hierarchy_type_id,
            "options", NEW.options),
        NULL,
        NEW.user_id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `mrs_user_hierarchy` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_hierarchy",
        "UPDATE",
        JSON_OBJECT(
            "user_id", OLD.user_id,
            "reporting_to_user_id", OLD.reporting_to_user_id,
            "user_hierarchy_type_id", OLD.user_hierarchy_type_id,
            "options", OLD.options),
        JSON_OBJECT(
            "user_id", NEW.user_id,
            "reporting_to_user_id", NEW.reporting_to_user_id,
            "user_hierarchy_type_id", NEW.user_hierarchy_type_id,
            "options", NEW.options),
        OLD.user_id,
        NEW.user_id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `mrs_user_hierarchy` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_hierarchy",
        "DELETE",
        JSON_OBJECT(
            "user_id", OLD.user_id,
            "reporting_to_user_id", OLD.reporting_to_user_id,
            "user_hierarchy_type_id", OLD.user_hierarchy_type_id,
            "options", OLD.options),
        NULL,
        OLD.user_id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `mrs_user_hierarchy_type` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_hierarchy_type",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "caption", NEW.caption,
            "description", NEW.description,
            "specific_to_service_id", NEW.specific_to_service_id,
            "options", NEW.options),
        NULL,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `mrs_user_hierarchy_type` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_hierarchy_type",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "caption", OLD.caption,
            "description", OLD.description,
            "specific_to_service_id", OLD.specific_to_service_id,
            "options", OLD.options),
        JSON_OBJECT(
            "id", NEW.id,
            "caption", NEW.caption,
            "description", NEW.description,
            "specific_to_service_id", NEW.specific_to_service_id,
            "options", NEW.options),
        OLD.id,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `mrs_user_hierarchy_type` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_hierarchy_type",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "caption", OLD.caption,
            "description", OLD.description,
            "specific_to_service_id", OLD.specific_to_service_id,
            "options", OLD.options),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_privilege_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `mrs_privilege` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_privilege",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "role_id", NEW.role_id,
            "crud_operations", NEW.crud_operations,
            "service_id", NEW.service_id,
            "db_schema_id", NEW.db_schema_id,
            "db_object_id", NEW.db_object_id,
            "options", NEW.options),
        NULL,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_privilege_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `mrs_privilege` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_privilege",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "role_id", OLD.role_id,
            "crud_operations", OLD.crud_operations,
            "service_id", OLD.service_id,
            "db_schema_id", OLD.db_schema_id,
            "db_object_id", OLD.db_object_id,
            "options", OLD.options),
        JSON_OBJECT(
            "id", NEW.id,
            "role_id", NEW.role_id,
            "crud_operations", NEW.crud_operations,
            "service_id", NEW.service_id,
            "db_schema_id", NEW.db_schema_id,
            "db_object_id", NEW.db_object_id,
            "options", NEW.options),
        OLD.id,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_privilege_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `mrs_privilege` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_privilege",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "role_id", OLD.role_id,
            "crud_operations", OLD.crud_operations,
            "service_id", OLD.service_id,
            "db_schema_id", OLD.db_schema_id,
            "db_object_id", OLD.db_object_id,
            "options", OLD.options),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `mrs_user_group` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_group",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "specific_to_service_id", NEW.specific_to_service_id,
            "caption", NEW.caption,
            "description", NEW.description,
            "options", NEW.options),
        NULL,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `mrs_user_group` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_group",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "specific_to_service_id", OLD.specific_to_service_id,
            "caption", OLD.caption,
            "description", OLD.description,
            "options", OLD.options),
        JSON_OBJECT(
            "id", NEW.id,
            "specific_to_service_id", NEW.specific_to_service_id,
            "caption", NEW.caption,
            "description", NEW.description,
            "options", NEW.options),
        OLD.id,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `mrs_user_group` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_group",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "specific_to_service_id", OLD.specific_to_service_id,
            "caption", OLD.caption,
            "description", OLD.description,
            "options", OLD.options),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_has_role_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `mrs_user_group_has_role` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_group_has_role",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "user_group_id", NEW.user_group_id,
            "role_id", NEW.role_id,
            "options", NEW.options),
        NULL,
        NEW.user_group_id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_has_role_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `mrs_user_group_has_role` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_group_has_role",
        "UPDATE",
        JSON_OBJECT(
            "user_group_id", OLD.user_group_id,
            "role_id", OLD.role_id,
            "options", OLD.options),
        JSON_OBJECT(
            "user_group_id", NEW.user_group_id,
            "role_id", NEW.role_id,
            "options", NEW.options),
        OLD.user_group_id,
        NEW.user_group_id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_has_role_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `mrs_user_group_has_role` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_group_has_role",
        "DELETE",
        JSON_OBJECT(
            "user_group_id", OLD.user_group_id,
            "role_id", OLD.role_id,
            "options", OLD.options),
        NULL,
        OLD.user_group_id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_group_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `mrs_user_has_group` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_has_group",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "user_id", NEW.user_id,
            "user_group_id", NEW.user_group_id,
            "comments", NEW.comments,
            "options", NEW.options),
        NULL,
        NEW.user_id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_group_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `mrs_user_has_group` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_has_group",
        "UPDATE",
        JSON_OBJECT(
            "user_id", OLD.user_id,
            "user_group_id", OLD.user_group_id,
            "comments", OLD.comments,
            "options", OLD.options),
        JSON_OBJECT(
            "user_id", NEW.user_id,
            "user_group_id", NEW.user_group_id,
            "comments", NEW.comments,
            "options", NEW.options),
        OLD.user_id,
        NEW.user_id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_group_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `mrs_user_has_group` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_has_group",
        "DELETE",
        JSON_OBJECT(
            "user_id", OLD.user_id,
            "user_group_id", OLD.user_group_id,
            "comments", OLD.comments,
            "options", OLD.options),
        NULL,
        OLD.user_id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `mrs_group_hierarchy_type` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_group_hierarchy_type",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "caption", NEW.caption,
            "description", NEW.description,
            "options", NEW.options),
        NULL,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `mrs_group_hierarchy_type` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_group_hierarchy_type",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "caption", OLD.caption,
            "description", OLD.description,
            "options", OLD.options),
        JSON_OBJECT(
            "id", NEW.id,
            "caption", NEW.caption,
            "description", NEW.description,
            "options", NEW.options),
        OLD.id,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `mrs_group_hierarchy_type` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_group_hierarchy_type",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "caption", OLD.caption,
            "description", OLD.description,
            "options", OLD.options),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_hierarchy_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `mrs_user_group_hierarchy` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_group_hierarchy",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "user_group_id", NEW.user_group_id,
            "parent_group_id", NEW.parent_group_id,
            "group_hierarchy_type_id", NEW.group_hierarchy_type_id,
            "level", NEW.level,
            "options", NEW.options),
        NULL,
        NEW.user_group_id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_hierarchy_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `mrs_user_group_hierarchy` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_group_hierarchy",
        "UPDATE",
        JSON_OBJECT(
            "user_group_id", OLD.user_group_id,
            "parent_group_id", OLD.parent_group_id,
            "group_hierarchy_type_id", OLD.group_hierarchy_type_id,
            "level", OLD.level,
            "options", OLD.options),
        JSON_OBJECT(
            "user_group_id", NEW.user_group_id,
            "parent_group_id", NEW.parent_group_id,
            "group_hierarchy_type_id", NEW.group_hierarchy_type_id,
            "level", NEW.level,
            "options", NEW.options),
        OLD.user_group_id,
        NEW.user_group_id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_hierarchy_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `mrs_user_group_hierarchy` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_user_group_hierarchy",
        "DELETE",
        JSON_OBJECT(
            "user_group_id", OLD.user_group_id,
            "parent_group_id", OLD.parent_group_id,
            "group_hierarchy_type_id", OLD.group_hierarchy_type_id,
            "level", OLD.level,
            "options", OLD.options),
        NULL,
        OLD.user_group_id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_db_object_row_group_security_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `mrs_db_object_row_group_security` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_db_object_row_group_security",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "db_object_id", NEW.db_object_id,
            "group_hierarchy_type_id", NEW.group_hierarchy_type_id,
            "row_group_ownership_column", NEW.row_group_ownership_column,
            "level", NEW.level,
            "match_level", NEW.match_level,
            "options", NEW.options),
        NULL,
        NEW.db_object_id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_db_object_row_group_security_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `mrs_db_object_row_group_security` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_db_object_row_group_security",
        "UPDATE",
        JSON_OBJECT(
            "db_object_id", OLD.db_object_id,
            "group_hierarchy_type_id", OLD.group_hierarchy_type_id,
            "row_group_ownership_column", OLD.row_group_ownership_column,
            "level", OLD.level,
            "match_level", OLD.match_level,
            "options", OLD.options),
        JSON_OBJECT(
            "db_object_id", NEW.db_object_id,
            "group_hierarchy_type_id", NEW.group_hierarchy_type_id,
            "row_group_ownership_column", NEW.row_group_ownership_column,
            "level", NEW.level,
            "match_level", NEW.match_level,
            "options", NEW.options),
        OLD.db_object_id,
        NEW.db_object_id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_db_object_row_group_security_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `mrs_db_object_row_group_security` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "mrs_db_object_row_group_security",
        "DELETE",
        JSON_OBJECT(
            "db_object_id", OLD.db_object_id,
            "group_hierarchy_type_id", OLD.group_hierarchy_type_id,
            "row_group_ownership_column", OLD.row_group_ownership_column,
            "level", OLD.level,
            "match_level", OLD.match_level,
            "options", OLD.options),
        NULL,
        OLD.db_object_id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`content_set_has_obj_def_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `content_set_has_obj_def` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "content_set_has_obj_def",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "content_set_id", NEW.content_set_id,
            "db_object_id", NEW.db_object_id,
            "method_type", NEW.method_type,
            "priority", NEW.priority,
            "language", NEW.language,
            "class_name", NEW.class_name,
            "method_name", NEW.method_name,
            "comments", NEW.comments,
            "options", NEW.options),
        NULL,
        NEW.content_set_id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`content_set_has_obj_def_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `content_set_has_obj_def` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "content_set_has_obj_def",
        "UPDATE",
        JSON_OBJECT(
            "content_set_id", OLD.content_set_id,
            "db_object_id", OLD.db_object_id,
            "method_type", OLD.method_type,
            "priority", OLD.priority,
            "language", OLD.language,
            "class_name", OLD.class_name,
            "method_name", OLD.method_name,
            "comments", OLD.comments,
            "options", OLD.options),
        JSON_OBJECT(
            "content_set_id", NEW.content_set_id,
            "db_object_id", NEW.db_object_id,
            "method_type", NEW.method_type,
            "priority", NEW.priority,
            "language", NEW.language,
            "class_name", NEW.class_name,
            "method_name", NEW.method_name,
            "comments", NEW.comments,
            "options", NEW.options),
        OLD.content_set_id,
        NEW.content_set_id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`content_set_has_obj_def_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `content_set_has_obj_def` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "content_set_has_obj_def",
        "DELETE",
        JSON_OBJECT(
            "content_set_id", OLD.content_set_id,
            "db_object_id", OLD.db_object_id,
            "method_type", OLD.method_type,
            "priority", OLD.priority,
            "language", OLD.language,
            "class_name", OLD.class_name,
            "method_name", OLD.method_name,
            "comments", OLD.comments,
            "options", OLD.options),
        NULL,
        OLD.content_set_id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`content_set_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `content_set` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "content_set",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "service_id", NEW.service_id,
            "content_type", NEW.content_type,
            "request_path", NEW.request_path,
            "requires_auth", NEW.requires_auth,
            "enabled", NEW.enabled,
            "internal", NEW.internal,
            "comments", NEW.comments,
            "options", NEW.options),
        NULL,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`content_set_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `content_set` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "content_set",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "service_id", OLD.service_id,
            "content_type", OLD.content_type,
            "request_path", OLD.request_path,
            "requires_auth", OLD.requires_auth,
            "enabled", OLD.enabled,
            "internal", OLD.internal,
            "comments", OLD.comments,
            "options", OLD.options),
        JSON_OBJECT(
            "id", NEW.id,
            "service_id", NEW.service_id,
            "content_type", NEW.content_type,
            "request_path", NEW.request_path,
            "requires_auth", NEW.requires_auth,
            "enabled", NEW.enabled,
            "internal", NEW.internal,
            "comments", NEW.comments,
            "options", NEW.options),
        OLD.id,
        NEW.id,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`content_set_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `content_set` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "content_set",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "service_id", OLD.service_id,
            "content_type", OLD.content_type,
            "request_path", OLD.request_path,
            "requires_auth", OLD.requires_auth,
            "enabled", OLD.enabled,
            "internal", OLD.internal,
            "comments", OLD.comments,
            "options", OLD.options),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END$$


DELIMITER ;

-- -----------------------------------------------------
-- Update GRANTs

GRANT SELECT ON `mysql_rest_service_metadata`.`auth_app`
	TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`service_has_auth_app`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`service_has_auth_app`
    TO 'mysql_rest_service_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`service_has_auth_app`
	TO 'mysql_rest_service_meta_provider', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

GRANT SELECT ON `mysql_rest_service_metadata`.`auth_vendor`
	TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`content_set_has_obj_def`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`content_set_has_obj_def`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
GRANT SELECT ON `mysql_rest_service_metadata`.`content_set_has_obj_def`
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`router_services`
GRANT SELECT ON `mysql_rest_service_metadata`.`router_services`
	TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';


-- -----------------------------------------------------
-- Set the version VIEWs to the correct version

ALTER SQL SECURITY INVOKER VIEW `mysql_rest_service_metadata`.`mrs_user_schema_version` (major, minor, patch) AS SELECT 3, 0, 0;

ALTER SQL SECURITY INVOKER VIEW `mysql_rest_service_metadata`.`schema_version` (major, minor, patch) AS SELECT 3, 0, 0;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;