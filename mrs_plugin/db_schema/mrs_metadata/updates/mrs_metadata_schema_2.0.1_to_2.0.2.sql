-- Copyright (c) 2023, 2025, Oracle and/or its affiliates.

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

USE `mysql_rest_service_metadata`;

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`field_AFTER_INSERT_AUDIT_LOG`;
DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`field_AFTER_UPDATE_AUDIT_LOG`;
DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`field_AFTER_DELETE_AUDIT_LOG`;

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_object_BEFORE_DELETE`;

DELIMITER $$

CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`db_object_BEFORE_DELETE` BEFORE DELETE ON `db_object` FOR EACH ROW
BEGIN
    DELETE FROM `mysql_rest_service_metadata`.`mrs_privilege` WHERE `db_object_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_db_object_row_group_security` WHERE `db_object_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`object` WHERE `db_object_id` = OLD.`id`;
END$$

DELIMITER ;

DROP TABLE IF EXISTS `mysql_rest_service_metadata`.`field`;

ALTER TABLE `mysql_rest_service_metadata`.`object_field`
  ADD COLUMN `allow_sorting` BIT(1) NOT NULL DEFAULT 0 COMMENT 'When set to TRUE the field can be used for ordering.';

CREATE  OR REPLACE SQL SECURITY INVOKER VIEW `object_fields_with_references` AS
WITH RECURSIVE obj_fields (
    caption, lev, position, id, represents_reference_id, parent_reference_id, object_id, 
    name, db_column, enabled, 
    allow_filtering, allow_sorting, no_check, no_update, sdk_options, comments,
    object_reference) AS
(
    SELECT CONCAT("- ", f.name) as caption, 1 AS lev, f.position, f.id, 
		f.represents_reference_id, f.parent_reference_id, f.object_id, f.name,
        f.db_column, f.enabled, f.allow_filtering, f.allow_sorting, f.no_check, f.no_update, f.sdk_options, f.comments,
        IF(ISNULL(f.represents_reference_id), NULL, JSON_OBJECT(
			"reduce_to_value_of_field_id", TO_BASE64(r.reduce_to_value_of_field_id),
            "reference_mapping", r.reference_mapping,
            "unnest", (r.unnest = 1),
            "crud_operations", r.crud_operations, 
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
        f.db_column, f.enabled, f.allow_filtering, f.allow_sorting, f.no_check, f.no_update, f.sdk_options, f.comments,
        IF(ISNULL(f.represents_reference_id), NULL, JSON_OBJECT(
			"reduce_to_value_of_field_id", TO_BASE64(rc.reduce_to_value_of_field_id),
            "reference_mapping", rc.reference_mapping,
            "unnest", (rc.unnest = 1),
            "crud_operations", rc.crud_operations, 
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

ALTER SQL SECURITY INVOKER VIEW `schema_version` (major, minor, patch) AS SELECT 2, 0, 2;

ALTER SQL SECURITY INVOKER VIEW `mrs_user_schema_version` (major, minor, patch) AS SELECT 2, 0, 2;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;