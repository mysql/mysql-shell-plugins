-- Copyright (c) 2023, Oracle and/or its affiliates.

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

USE `mysql_rest_service_metadata`;

ALTER TABLE `mysql_rest_service_metadata`.`object` 
    ADD COLUMN `name` VARCHAR(255) NOT NULL,
    DROP CONSTRAINT `fk_result_db_object1`;

ALTER TABLE `mysql_rest_service_metadata`.`object` 
    ADD CONSTRAINT `fk_result_db_object1`
    FOREIGN KEY (`db_object_id`)
    REFERENCES `mysql_rest_service_metadata`.`db_object` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`object_field`
-- -----------------------------------------------------
ALTER TABLE `mysql_rest_service_metadata`.`object_field` 
    ADD COLUMN `position` INT NOT NULL,
    ADD COLUMN `db_column` JSON NULL COMMENT 'Holds information about the original database column, e.g. {\"name\": \"first_name\", \"datatype\":\"VARCHAR(45)\", \"notNull\": true, \"isPrimary\": false, \"isUnique\": false, \"isGenerated\": false, \"autoInc\": false}',
	DROP COLUMN `db_name`,
	DROP COLUMN `db_datatype`,
    DROP CONSTRAINT `fk_properties_result1`,
    DROP CONSTRAINT `fk_result_property_result_reference1`,
    DROP CONSTRAINT `fk_result_property_result_reference2`;

ALTER TABLE `mysql_rest_service_metadata`.`object_field` 
  ADD CONSTRAINT `fk_properties_result1`
    FOREIGN KEY (`object_id`)
    REFERENCES `mysql_rest_service_metadata`.`object` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_result_property_result_reference1`
    FOREIGN KEY (`parent_reference_id`)
    REFERENCES `mysql_rest_service_metadata`.`object_reference` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_result_property_result_reference2`
    FOREIGN KEY (`represents_reference_id`)
    REFERENCES `mysql_rest_service_metadata`.`object_reference` (`id`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`object_reference` 
    DROP CONSTRAINT `fk_result_reference_result_property1`;

-- -----------------------------------------------------
-- View `mysql_rest_service_metadata`.`object_fields_with_references`
-- -----------------------------------------------------

USE `mysql_rest_service_metadata`;
CREATE  OR REPLACE VIEW `object_fields_with_references` AS
WITH RECURSIVE obj_fields (
    caption, lev, position, id, represents_reference_id, parent_reference_id, object_id, 
    name, db_column, enabled, 
    allow_filtering, no_check, sdk_options, comments,
    object_reference) AS
(
    SELECT CONCAT("- ", f.name) as caption, 1 AS lev, f.position, f.id, 
		f.represents_reference_id, f.parent_reference_id, f.object_id, f.name,
        f.db_column, f.enabled, f.allow_filtering, f.no_check, f.sdk_options, f.comments,
        JSON_OBJECT(
			"reduceToValueOfFieldId", r.reduce_to_value_of_field_id,
            "referenceMapping", r.reference_mapping,
            "unnest", r.unnest,
            "crudOperations", r.crud_operations, 
			"sdkOptions", r.sdk_options,
            "comments", r.comments
        ) AS object_reference
    FROM `mysql_rest_service_metadata`.`object_field` f 
        LEFT OUTER JOIN `mysql_rest_service_metadata`.`object_reference` AS r
            ON r.id = f.represents_reference_id
    WHERE ISNULL(parent_reference_id)
    UNION ALL
    SELECT CONCAT(REPEAT("  ", p.lev), "- ", f.name) as caption, p.lev+1 AS lev, f.position,
        f.id, f.represents_reference_id, f.parent_reference_id, f.object_id, f.name, 
        f.db_column, f.enabled, f.allow_filtering, f.no_check, f.sdk_options, f.comments,
        JSON_OBJECT(
			"reduceToValueOfFieldId", rc.reduce_to_value_of_field_id,
            "referenceMapping", rc.reference_mapping,
            "unnest", rc.unnest,
            "crudOperations", rc.crud_operations, 
			"sdkOptions", rc.sdk_options,
            "comments", rc.comments
        ) AS object_reference
    FROM obj_fields AS p JOIN `mysql_rest_service_metadata`.`object_reference` AS r
            ON r.id = p.represents_reference_id
        LEFT OUTER JOIN `mysql_rest_service_metadata`.`object_field` AS f
            ON r.id = f.parent_reference_id
        LEFT OUTER JOIN `mysql_rest_service_metadata`.`object_reference` AS rc
            ON rc.id = f.represents_reference_id
)
SELECT * FROM obj_fields;

-- -----------------------------------------------------
-- View `mysql_rest_service_metadata`.`table_columns_with_references`
-- -----------------------------------------------------
USE `mysql_rest_service_metadata`;
CREATE  OR REPLACE VIEW `table_columns_with_references` AS
SELECT f.* FROM (
	-- Get the table columns
	SELECT c.ORDINAL_POSITION AS position, c.COLUMN_NAME AS name,
        NULL AS ref_column_names,
        JSON_OBJECT(
            "name", c.COLUMN_NAME,
            "datatype", c.COLUMN_TYPE,
            "notNull", c.IS_NULLABLE = "NO",
            "isPrimary", c.COLUMN_KEY = "PRI",
            "isUnique", c.COLUMN_KEY = "UNI",
            "isGenerated", c.GENERATION_EXPRESSION <> "",
            "autoInc", c.EXTRA = "auto_increment",
            "privileges", c.PRIVILEGES,
            "comment", c.COLUMN_COMMENT
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
	        JSON_OBJECT("toMany", FALSE),
	        JSON_OBJECT("referencedSchema", MAX(k.REFERENCED_TABLE_SCHEMA)),
	        JSON_OBJECT("referencedTable", MAX(k.REFERENCED_TABLE_NAME)),
	        JSON_OBJECT("columnMapping",
                JSON_OBJECTAGG(c.COLUMN_NAME, k.REFERENCED_COLUMN_NAME))
	    ) AS reference_mapping,
        MAX(c.TABLE_SCHEMA) AS table_schema, MAX(c.TABLE_NAME) AS table_name
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS k
	    JOIN INFORMATION_SCHEMA.COLUMNS AS c
	        ON c.TABLE_SCHEMA = k.TABLE_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME 
                AND c.COLUMN_NAME=k.COLUMN_NAME
	WHERE NOT ISNULL(k.REFERENCED_TABLE_NAME)
	GROUP BY k.CONSTRAINT_NAME
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
	        JSON_OBJECT("toMany", JSON_CONTAINS(MAX(PK_TABLE.PK), MAX(PK_REF.PK)) = 0),
	        JSON_OBJECT("referencedSchema", MAX(c.TABLE_SCHEMA)),
	        JSON_OBJECT("referencedTable", MAX(c.TABLE_NAME)),
	        JSON_OBJECT("columnMapping", 
                JSON_OBJECTAGG(c.COLUMN_NAME, k.REFERENCED_COLUMN_NAME))
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

DROP PROCEDURE `mysql_rest_service_metadata`.`get_table_fields_and_references`;

DELIMITER $$

DROP TRIGGER `mysql_rest_service_metadata`.`object_field_AFTER_INSERT_AUDIT_LOG`$$
DROP TRIGGER `mysql_rest_service_metadata`.`object_field_AFTER_UPDATE_AUDIT_LOG`$$
DROP TRIGGER `mysql_rest_service_metadata`.`object_field_AFTER_DELETE_AUDIT_LOG`$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_field_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `object_field` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "object_field", 
        "INSERT", 
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "object_id", NEW.object_id,
            "parent_reference_id", NEW.parent_reference_id,
            "represents_reference_id", NEW.represents_reference_id,
            "name", NEW.name,
            "db_column", NEW.db_column,
            "enabled", NEW.enabled,
            "allow_filtering", NEW.allow_filtering,
            "no_check", NEW.no_check,
            "sdk_options", NEW.sdk_options,
            "comments", NEW.comments),
        NULL,
        NEW.id,
        CURRENT_USER(), 
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_field_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `object_field` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "object_field", 
        "UPDATE", 
        JSON_OBJECT(
            "id", OLD.id,
            "object_id", OLD.object_id,
            "parent_reference_id", OLD.parent_reference_id,
            "represents_reference_id", OLD.represents_reference_id,
            "name", OLD.name,
            "db_column", OLD.db_column,
            "enabled", OLD.enabled,
            "allow_filtering", OLD.allow_filtering,
            "no_check", OLD.no_check,
            "sdk_options", OLD.sdk_options,
            "comments", OLD.comments),
        JSON_OBJECT(
            "id", NEW.id,
            "object_id", NEW.object_id,
            "parent_reference_id", NEW.parent_reference_id,
            "represents_reference_id", NEW.represents_reference_id,
            "name", NEW.name,
            "db_column", NEW.db_column,
            "enabled", NEW.enabled,
            "allow_filtering", NEW.allow_filtering,
            "no_check", NEW.no_check,
            "sdk_options", NEW.sdk_options,
            "comments", NEW.comments),
        OLD.id,
        NEW.id,
        CURRENT_USER(), 
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_field_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `object_field` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "object_field", 
        "DELETE", 
        JSON_OBJECT(
            "id", OLD.id,
            "object_id", OLD.object_id,
            "parent_reference_id", OLD.parent_reference_id,
            "represents_reference_id", OLD.represents_reference_id,
            "name", OLD.name,
            "db_column", OLD.db_column,
            "enabled", OLD.enabled,
            "allow_filtering", OLD.allow_filtering,
            "no_check", OLD.no_check,
            "sdk_options", OLD.sdk_options,
            "comments", OLD.comments),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(), 
        CURRENT_TIMESTAMP
    );
END$$

DELIMITER ;



-- `mysql_rest_service_metadata`.`object`
GRANT SELECT, INSERT, UPDATE, DELETE 
	ON `mysql_rest_service_metadata`.`object` 
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`object` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`object_field`
GRANT SELECT, INSERT, UPDATE, DELETE 
	ON `mysql_rest_service_metadata`.`object_field` 
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`object_field` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`object_reference`
GRANT SELECT, INSERT, UPDATE, DELETE 
	ON `mysql_rest_service_metadata`.`object_reference` 
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`object_reference` 
	TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`table_columns_with_references`
GRANT SELECT
	ON `mysql_rest_service_metadata`.`table_columns_with_references` 
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`object_fields_with_references`
GRANT SELECT
	ON `mysql_rest_service_metadata`.`object_fields_with_references` 
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_meta_provider';


ALTER SQL SECURITY INVOKER VIEW `schema_version` (major, minor, patch) AS SELECT 1, 1, 2;

ALTER SQL SECURITY INVOKER VIEW `mrs_user_schema_version` (major, minor, patch) AS SELECT 1, 1, 2;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;