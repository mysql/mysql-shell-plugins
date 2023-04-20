-- Copyright (c) 2023, Oracle and/or its affiliates.

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

USE `mysql_rest_service_metadata`;

ALTER TABLE `mysql_rest_service_metadata`.`object_reference`
    CHANGE COLUMN `reduce_to_value_of_field_id` `reduce_to_value_of_field_id` BINARY(16) NULL COMMENT 'If set to an object_field, this reference will be reduced to the value of the given field. Example: \"films\": [ { \"categories\": [ \"Thriller\", \"Action\"] } ] instead of \"films\": [ { \"categories\": [ { \"name\": \"Thriller\" }, { \"name\": \"Action\" } ] } ],',
	CHANGE COLUMN `unnest` `unnest` BIT(1) NOT NULL DEFAULT 0 COMMENT 'If set to TRUE, the properties will be directly added to the parent';

ALTER TABLE `mysql_rest_service_metadata`.`object_field`
    CHANGE COLUMN `enabled` `enabled` BIT(1) NOT NULL DEFAULT 1 COMMENT 'When set to FALSE, the property is hidden from the result',
    CHANGE COLUMN `allow_filtering` `allow_filtering` BIT(1) NOT NULL DEFAULT 1 COMMENT 'When set to FALSE the property is not available for filtering',
    CHANGE COLUMN `no_check` `no_check` BIT(1) NOT NULL DEFAULT 0 COMMENT 'Specifies whether the field should be ignored in the scope of concurrency control',
    ADD COLUMN `no_update` BIT(1) NOT NULL DEFAULT 0 COMMENT 'If set to 1 then no updates of this field are allowed.';

-- -----------------------------------------------------
-- View `mysql_rest_service_metadata`.`object_fields_with_references`
-- -----------------------------------------------------
USE `mysql_rest_service_metadata`;
CREATE OR REPLACE VIEW `object_fields_with_references` AS
WITH RECURSIVE obj_fields (
    caption, lev, position, id, represents_reference_id, parent_reference_id, object_id, 
    name, db_column, enabled, 
    allow_filtering, no_check, no_update, sdk_options, comments,
    object_reference) AS
(
    SELECT CONCAT("- ", f.name) as caption, 1 AS lev, f.position, f.id, 
		f.represents_reference_id, f.parent_reference_id, f.object_id, f.name,
        f.db_column, f.enabled, f.allow_filtering, f.no_check, f.no_update, f.sdk_options, f.comments,
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
        f.db_column, f.enabled, f.allow_filtering, f.no_check, f.no_update, f.sdk_options, f.comments,
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
            "not_null", c.IS_NULLABLE = "NO",
            "is_primary", c.COLUMN_KEY = "PRI",
            "is_unique", c.COLUMN_KEY = "UNI",
            "is_generated", c.GENERATION_EXPRESSION <> "",
            "auto_inc", c.EXTRA = "auto_increment",
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
USE `mysql_rest_service_metadata`;

ALTER EVENT `mysql_rest_service_metadata`.`delete_old_audit_log_entries` DISABLE;

ALTER SQL SECURITY INVOKER VIEW `schema_version` (major, minor, patch) AS SELECT 1, 1, 3;

ALTER SQL SECURITY INVOKER VIEW `mrs_user_schema_version` (major, minor, patch) AS SELECT 1, 1, 3;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;