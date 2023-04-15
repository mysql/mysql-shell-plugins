-- Copyright (c) 2023, Oracle and/or its affiliates.

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

USE `mysql_rest_service_metadata`;

-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`object_field`
-- -----------------------------------------------------
ALTER TABLE `mysql_rest_service_metadata`.`object_field` 
    ADD COLUMN `no_check` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Specifies whether the field should be ignored in the scope of concurency control';

-- -----------------------------------------------------
-- View `mysql_rest_service_metadata`.`object_fields_with_references`
-- -----------------------------------------------------

USE `mysql_rest_service_metadata`;
CREATE  OR REPLACE VIEW `object_fields_with_references` AS
WITH RECURSIVE obj_fields (
    caption, lev, id, represents_reference_id, parent_reference_id, object_id, name, db_name, db_datatype, enabled, 
    allow_filtering, no_check, sdk_options, comments,
    reduce_to_value_of_field_id, reference_mapping, unnest, crud_operations, ref_sdk_options, ref_comments) AS
(
    SELECT CONCAT("- ", f.name) as caption, 1 AS lev, f.id, f.represents_reference_id, f.parent_reference_id, f.object_id, f.name, f.db_name, 
        f.db_datatype, f.enabled, f.allow_filtering, f.no_check, f.sdk_options, f.comments,
        r.reduce_to_value_of_field_id, r.reference_mapping, r.unnest, r.crud_operations, 
        r.sdk_options as ref_sdk_options, r.comments AS ref_comments
    FROM `mysql_rest_service_metadata`.`object_field` f 
        LEFT OUTER JOIN `mysql_rest_service_metadata`.`object_reference` AS r
            ON r.id = f.represents_reference_id
    WHERE ISNULL(parent_reference_id)
    UNION ALL
    SELECT CONCAT(REPEAT("  ", p.lev), "- ", f.name) as caption, p.lev+1 AS lev, 
        f.id, f.represents_reference_id, f.parent_reference_id, f.object_id, f.name, f.db_name, 
        f.db_datatype, f.enabled, f.allow_filtering, f.no_check, f.sdk_options, f.comments,
        rc.reduce_to_value_of_field_id, rc.reference_mapping, rc.unnest, rc.crud_operations, 
        rc.sdk_options as ref_sdk_options, rc.comments AS ref_comments
    FROM obj_fields AS p JOIN `mysql_rest_service_metadata`.`object_reference` AS r
            ON r.id = p.represents_reference_id
        LEFT OUTER JOIN `mysql_rest_service_metadata`.`object_field` AS f
            ON r.id = f.parent_reference_id
        LEFT OUTER JOIN `mysql_rest_service_metadata`.`object_reference` AS rc
            ON rc.id = f.represents_reference_id
)
SELECT * FROM obj_fields;

-- -----------------------------------------------------
-- Procedure `mysql_rest_service_metadata`.`get_table_fields_and_references`
-- -----------------------------------------------------

DELIMITER $$
USE `mysql_rest_service_metadata`$$
CREATE PROCEDURE `get_table_fields_and_references`(
	IN table_schema VARCHAR(255), IN table_name VARCHAR(255))
BEGIN
	-- Get the table columns
	SELECT c.ORDINAL_POSITION AS POS, c.COLUMN_NAME AS NAME, "COL" AS KIND, 
	    c.IS_NULLABLE, c.COLUMN_TYPE, c.COLUMN_KEY,
	    c.EXTRA, c.PRIVILEGES, c.COLUMN_COMMENT,
	    c.GENERATION_EXPRESSION,
	    NULL AS REFERENCE_MAPPING
	FROM INFORMATION_SCHEMA.COLUMNS AS c
	    LEFT OUTER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS k
	        ON c.TABLE_SCHEMA = k.TABLE_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME AND c.COLUMN_NAME=k.COLUMN_NAME 
	            AND NOT ISNULL(k.POSITION_IN_UNIQUE_CONSTRAINT)
	WHERE c.TABLE_SCHEMA = table_schema AND
	    c.TABLE_NAME = table_name
	-- Union with the references that point from the table to other tables (n:1)
	UNION
	SELECT MAX(c.ORDINAL_POSITION) + 100 AS POS, MAX(k.REFERENCED_TABLE_NAME) AS NAME, "REF Single (n:1)" AS KIND,
	    NULL AS IS_NULLABLE, NULL AS COLUMN_TYPE, NULL AS COLUMN_KEY,
	    NULL AS EXTRA, NULL AS PRIVILEGES, NULL AS COLUMN_COMMENT,
	    NULL AS GENERATION_EXPRESSION,
	    JSON_MERGE_PRESERVE(
	        JSON_OBJECT("constraint", CONCAT(MAX(k.CONSTRAINT_SCHEMA), ".", MAX(k.CONSTRAINT_NAME))),
	        JSON_OBJECT("toMany", FALSE),
	        JSON_OBJECT("referencedSchema", MAX(k.REFERENCED_TABLE_SCHEMA)),
	        JSON_OBJECT("referencedTable", MAX(k.REFERENCED_TABLE_NAME)),
	        JSON_OBJECT("columnMapping", JSON_OBJECTAGG(c.COLUMN_NAME, k.REFERENCED_COLUMN_NAME))
	    ) AS REFERENCE_MAPPING
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS k
	    JOIN INFORMATION_SCHEMA.COLUMNS AS c
	        ON c.TABLE_SCHEMA = k.TABLE_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME AND c.COLUMN_NAME=k.COLUMN_NAME
	WHERE c.TABLE_SCHEMA = table_schema AND
	    c.TABLE_NAME = table_name AND
	    NOT ISNULL(k.REFERENCED_TABLE_NAME)
	GROUP BY k.CONSTRAINT_NAME
	UNION
	-- Union with the references that point from other tables to the table (1:1 and 1:n)
	SELECT MAX(c.ORDINAL_POSITION) + 1000 AS POS, MAX(c.TABLE_NAME) AS NAME,
	    -- If the PKs of the table and the referred table are exactly the same, this is a 1:1 relationship
	    IF(JSON_CONTAINS(MAX(PK_TABLE.PK), MAX(PK_REF.PK)) = 1, "REF Single (1:1)", "REF Many (1:n)") AS KIND,
	    NULL AS IS_NULLABLE, NULL AS COLUMN_TYPE, NULL AS COLUMN_KEY,
	    NULL AS EXTRA, NULL AS PRIVILEGES, NULL AS COLUMN_COMMENT,
	    NULL AS GENERATION_EXPRESSION,
	    JSON_MERGE_PRESERVE(
	        JSON_OBJECT("constraint", CONCAT(MAX(k.CONSTRAINT_SCHEMA), ".", MAX(k.CONSTRAINT_NAME))),
	        JSON_OBJECT("toMany", JSON_CONTAINS(MAX(PK_TABLE.PK), MAX(PK_REF.PK)) = 0),
	        JSON_OBJECT("referencedSchema", MAX(c.TABLE_SCHEMA)),
	        JSON_OBJECT("referencedTable", MAX(c.TABLE_NAME)),
	        JSON_OBJECT("columnMapping", JSON_OBJECTAGG(c.COLUMN_NAME, k.REFERENCED_COLUMN_NAME))
	    ) AS REFERENCE_MAPPING
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS k
	    JOIN INFORMATION_SCHEMA.COLUMNS AS c
	        ON c.TABLE_SCHEMA = k.TABLE_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME AND c.COLUMN_NAME=k.COLUMN_NAME
	    -- The PK columns of the table, e.g. ["test_fk.product.id"]
	    JOIN (SELECT JSON_ARRAYAGG(CONCAT(c2.TABLE_SCHEMA, ".", c2.TABLE_NAME, ".", c2.COLUMN_NAME)) AS PK,
	            c2.TABLE_SCHEMA, c2.TABLE_NAME
	            FROM INFORMATION_SCHEMA.COLUMNS AS c2
	            WHERE c2.COLUMN_KEY = "PRI"
	            GROUP BY c2.COLUMN_KEY, c2.TABLE_SCHEMA, c2.TABLE_NAME) AS PK_TABLE
	        ON PK_TABLE.TABLE_SCHEMA = k.REFERENCED_TABLE_SCHEMA AND PK_TABLE.TABLE_NAME = k.REFERENCED_TABLE_NAME
	    -- The PK columns of the referenced table, e.g. ["test_fk.product_part.id", "test_fk.product.id"]
	    JOIN (SELECT JSON_ARRAYAGG(PK2.PK_COL) AS PK, PK2.TABLE_SCHEMA, PK2.TABLE_NAME
	        FROM (SELECT IFNULL(
	            CONCAT(MAX(k1.REFERENCED_TABLE_SCHEMA), ".", MAX(k1.REFERENCED_TABLE_NAME), ".", 
	                MAX(k1.REFERENCED_COLUMN_NAME)), 
	            CONCAT(c1.TABLE_SCHEMA, ".", c1.TABLE_NAME, ".", c1.COLUMN_NAME)) AS PK_COL, 
	            c1.TABLE_SCHEMA AS TABLE_SCHEMA, c1.TABLE_NAME AS TABLE_NAME
	            FROM INFORMATION_SCHEMA.COLUMNS AS c1
	                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS k1
	                    ON k1.TABLE_SCHEMA = c1.TABLE_SCHEMA AND k1.TABLE_NAME = c1.TABLE_NAME
	                        AND k1.COLUMN_NAME = c1.COLUMN_NAME
	            WHERE c1.COLUMN_KEY = "PRI"
	            GROUP BY c1.COLUMN_NAME, c1.TABLE_SCHEMA, c1.TABLE_NAME) AS PK2
	            GROUP BY PK2.TABLE_SCHEMA, PK2.TABLE_NAME) AS PK_REF
	        ON PK_REF.TABLE_SCHEMA = k.TABLE_SCHEMA AND PK_REF.TABLE_NAME = k.TABLE_NAME
	WHERE k.REFERENCED_TABLE_SCHEMA = table_schema AND
	    k.REFERENCED_TABLE_NAME = table_name
	GROUP BY k.CONSTRAINT_NAME, c.TABLE_SCHEMA, c.TABLE_NAME
	ORDER BY POS;
END$$

DELIMITER ;

ALTER SQL SECURITY INVOKER VIEW `schema_version` (major, minor, patch) AS SELECT 1, 1, 1;

ALTER SQL SECURITY INVOKER VIEW `mrs_user_schema_version` (major, minor, patch) AS SELECT 1, 1, 1;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;