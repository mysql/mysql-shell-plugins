/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

-- #############################################################################
-- MSM Section 002: Database Schema Update Script
-- -----------------------------------------------------------------------------
-- This script updates the `mysql_rest_service_metadata` database schema from version
-- 3.0.5 to 3.1.0
-- -----------------------------------------------------------------------------


-- #############################################################################
-- MSM Section 010: Server Variable Settings
-- -----------------------------------------------------------------------------
-- Set server variables, remember their state to be able to restore accordingly.
-- -----------------------------------------------------------------------------

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,'
    'NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,'
    'NO_ENGINE_SUBSTITUTION';


-- #############################################################################
-- MSM Section 220: Database Schema Version Update Indication
-- -----------------------------------------------------------------------------
-- Replace the `mysql_rest_service_metadata`.`msm_schema_version` VIEW
-- and initialize it with the version 0, 0, 0 which indicates the ongoing
-- update processes of the database schema.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `mysql_rest_service_metadata`.`msm_schema_version` (
    `major`,`minor`,`patch`) AS
SELECT 0, 0, 0;


-- #############################################################################
-- MSM Section 230: Creation of Update Helpers
-- -----------------------------------------------------------------------------
-- Definitions of optional helper PROCEDUREs and FUNCTIONs that are called
-- during the update of the database schema. It is important to note that these
-- need to be defined in a way as if a schema object of the same name and type
-- already exists. Use explicit DROP IF EXISTS statements or CREATE OR REPLACE
-- statements when creating the helper objects.
-- -----------------------------------------------------------------------------

DELIMITER %%

-- Create the `msm_schema_version` VIEW with the matching version so upgrades work
DROP PROCEDURE IF EXISTS `mysql_rest_service_metadata`.`msm_upgrade_from_schema_version_view`%%
CREATE PROCEDURE `mysql_rest_service_metadata`.`msm_upgrade_from_schema_version_view`()
BEGIN
    DECLARE version_str VARCHAR(255);
    DECLARE signal_msg VARCHAR(128);
    DECLARE item_count INT;

    -- Check if the schema_version VIEW exists
    SELECT COUNT(*) INTO item_count FROM information_schema.`TABLES`
        WHERE `TABLE_SCHEMA` = 'mysql_rest_service_metadata'
            AND `TABLE_NAME` = 'schema_version'
            AND `TABLE_TYPE` = 'VIEW';
    IF item_count = 1 THEN
        -- Get the current version of the schema
        SELECT CONCAT(v.major, '.', v.minor, '.', v.patch) INTO `version_str`
        FROM `mysql_rest_service_metadata`.`schema_version` AS v;

        IF version_str = '3.0.5' THEN
            CREATE OR REPLACE SQL SECURITY INVOKER
                VIEW `mysql_rest_service_metadata`.`msm_schema_version` (
                    `major`,`minor`,`patch`) AS
                SELECT 3, 0, 5;
        END IF;

        IF version_str = '3.1.0' THEN
            CREATE OR REPLACE SQL SECURITY INVOKER
                VIEW `mysql_rest_service_metadata`.`msm_schema_version` (
                    `major`,`minor`,`patch`) AS
                SELECT 3, 1, 0;
        END IF;

        IF version_str <> '3.0.5' AND version_str <> '3.1.0' THEN
            SET signal_msg = LEFT(CONCAT(
                'The schema `mysql_rest_service_metadata` is on an ',
                'unsupported version for upgrade. Manually upgrade to ',
                '3.0.5 first.'), 128);
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = signal_msg,
                MYSQL_ERRNO = 32100;
        END IF;
    END IF;
END%%

CALL `mysql_rest_service_metadata`.`msm_upgrade_from_schema_version_view`()%%
DROP PROCEDURE `mysql_rest_service_metadata`.`msm_upgrade_from_schema_version_view`%%


DROP PROCEDURE IF EXISTS `mysql_rest_service_metadata`.`msm_ensure_varchar_column_uniqueness`%%
CREATE PROCEDURE `mysql_rest_service_metadata`.`msm_ensure_varchar_column_uniqueness`()
BEGIN
    DECLARE val TEXT DEFAULT NULL;
    DECLARE auth_app_id BINARY(16) DEFAULT NULL;
    DECLARE done TINYINT DEFAULT FALSE;

    -- Get all names that have duplicates
    DECLARE my_cursor CURSOR FOR
        SELECT name
        FROM mysql_rest_service_metadata.auth_app
        GROUP BY name
        HAVING COUNT(*) > 1;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    OPEN my_cursor;

    -- Loop over all names that have duplicates
    duplicated_values_loop: LOOP
        FETCH NEXT FROM my_cursor INTO val;

        IF done THEN
            LEAVE duplicated_values_loop;
        ELSE
            BLOCK2: BEGIN
                DECLARE i INT;
                DECLARE done2 TINYINT DEFAULT FALSE;

                -- Get all ids for the current name
                DECLARE my_cursor_2 CURSOR FOR
                    SELECT id
                    FROM mysql_rest_service_metadata.auth_app
                    WHERE name = val;

                DECLARE CONTINUE HANDLER FOR NOT FOUND SET done2 = TRUE;
                OPEN my_cursor_2;

                -- Skip the first id
                FETCH NEXT FROM my_cursor_2 INTO auth_app_id;

                -- Loop over all id other ids for the current name and update the name, appending -2, -3, -4, etc.
                SET i = 1;
                update_values_loop: LOOP
                    FETCH NEXT FROM my_cursor_2 INTO auth_app_id;

                    IF done2 THEN
                        LEAVE update_values_loop;
                    ELSE
                        SET i = i + 1;
                        UPDATE `mysql_rest_service_metadata`.`auth_app` aa SET name = CONCAT(name, '-', i)
                        WHERE id = auth_app_id;
                    END IF;
                END LOOP update_values_loop;

                CLOSE my_cursor_2;
            END BLOCK2;
        END IF;
    END LOOP duplicated_values_loop;

    CLOSE my_cursor;
END%%

DELIMITER ;


-- #############################################################################
-- MSM Section 240: Non-idempotent Schema Object Changes and All DROPs
-- -----------------------------------------------------------------------------
-- This section contains changes performed on schema TABLEs. It is important to
-- note that these changes need to be carefully processed during a schema
-- upgrade operation. These changes must be executed in the right order as
-- each operation will result in a state change that often cannot be easily
-- revered. This might include DROP statements on other schema objects (VIEWs,
-- PROCEDUREs, FUNCTIONs, TRIGGERs EVENTs, ...) as they could otherwise prevent
-- change of the TABLE structure. These schema objects may then be re-created
-- inside the MSM Section 250: Idempotent Schema Object Changes. If there are
-- no changes required, this section can be skipped.
-- -----------------------------------------------------------------------------
-- TABLE changes and all DROP statements
-- -----------------------------------------------------------------------------

ALTER TABLE `mysql_rest_service_metadata`.`redirect`
  CHANGE COLUMN `target` `target` VARCHAR(1024) NOT NULL,
  ADD COLUMN `kind` ENUM('REDIRECT', 'REWRITE') NOT NULL DEFAULT 'REDIRECT',
  ADD COLUMN `in_development` JSON NULL;


UPDATE object SET options=json_remove(
    json_set(options, '$.dataMappingViewInsert', options->>'$.duality_view_insert'),
    '$.duality_view_insert')
WHERE options->>'$.duality_view_insert' is not null;

UPDATE object SET options=json_remove(
    json_set(options, '$.dataMappingViewUpdate', options->>'$.duality_view_update'),
    '$.duality_view_update')
WHERE options->>'$.duality_view_update' is not null;

UPDATE object SET options=json_remove(
    json_set(options, '$.dataMappingViewDelete', options->>'$.duality_view_delete'),
    '$.duality_view_delete')
WHERE options->>'$.duality_view_delete' is not null;

UPDATE object SET options=json_remove(
    json_set(options, '$.dataMappingViewNoCheck', options->>'$.duality_view_no_check'),
    '$.duality_view_no_check')
WHERE options->>'$.duality_view_no_check' is not null;

UPDATE object_reference SET options=json_remove(
    json_set(options, '$.dataMappingViewInsert', options->>'$.duality_view_insert'),
    '$.duality_view_insert')
WHERE options->>'$.duality_view_insert' is not null;

UPDATE object_reference SET options=json_remove(
    json_set(options, '$.dataMappingViewUpdate', options->>'$.duality_view_update'),
    '$.duality_view_update')
WHERE options->>'$.duality_view_update' is not null;

UPDATE object_reference SET options=json_remove(
    json_set(options, '$.dataMappingViewDelete', options->>'$.duality_view_delete'),
    '$.duality_view_delete')
WHERE options->>'$.duality_view_delete' is not null;

UPDATE object_reference SET options=json_remove(
    json_set(options, '$.dataMappingViewNoCheck', options->>'$.duality_view_no_check'),
    '$.duality_view_no_check')
WHERE options->>'$.duality_view_no_check' is not null;

ALTER TABLE `mysql_rest_service_metadata`.`object_field`
  ADD COLUMN `json_schema` JSON NULL;

-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`audit_log_status`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`audit_log_status` (
  `id` TINYINT NOT NULL,
  `last_dump_at` TIMESTAMP NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB
COMMENT = 'no_audit_log';

-- Ensure only one row in `mysql_rest_service_metadata`.`audit_log_status`
ALTER TABLE `mysql_rest_service_metadata`.`audit_log_status`
  ADD CONSTRAINT AuditLogStatus_OnlyOneRow CHECK (id = 1);

INSERT INTO `mysql_rest_service_metadata`.`audit_log_status` (`id`, `last_dump_at`, `data`) VALUES (1, NULL, NULL);


DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_has_auth_app_AFTER_DELETE`;

INSERT INTO `mysql_rest_service_metadata`.`auth_app` (`id`, `auth_vendor_id`, `name`, `description`,
    `enabled`, `limit_to_registered_users`, `default_role_id`, `options`)
VALUES (0x31, 0x31, 'MySQL', 'Provide login capabilities for MySQL Server user accounts.',
    TRUE, FALSE, 0x31, NULL);

CALL `mysql_rest_service_metadata`.`msm_ensure_varchar_column_uniqueness`();

ALTER TABLE `mysql_rest_service_metadata`.`auth_app`
    ADD CONSTRAINT auth_app_name_unique UNIQUE KEY (`name`);


DROP VIEW IF EXISTS `mysql_rest_service_metadata`.`table_columns_with_references`;



-- #############################################################################
-- MSM Section 250: Idempotent Schema Object Additions And Changes
-- -----------------------------------------------------------------------------
-- This section contains the new and update creation of all schema objects,
-- except TABLEs, ROLEs and GRANTs. Ensure that all existing objects are
-- overwritten in a clean manner using explicit DROP IF EXISTS statements or
-- CREATE OR REPLACE when re-creating the objects. All object removals must
-- be defined in the MSM Section 240. If there are no changes required, this
-- section can be skipped.
-- -----------------------------------------------------------------------------
-- All other schema object definitions (VIEWs, PROCEDUREs, FUNCTIONs, TRIGGERs,
-- EVENTs, ...) that are new or have changed
-- -----------------------------------------------------------------------------

DELIMITER %%

-- Procedure to fetch all table columns as well as references to related tables

DROP PROCEDURE IF EXISTS `mysql_rest_service_metadata`.`table_columns_with_references`%%
CREATE PROCEDURE `mysql_rest_service_metadata`.`table_columns_with_references`(
    schema_name VARCHAR(64), table_name VARCHAR(64))
BEGIN
    SELECT f.*, js.json_schema_def FROM (
        -- Get the table columns
        SELECT c.ORDINAL_POSITION AS position, c.COLUMN_NAME AS name,
            NULL AS ref_column_names,
            JSON_OBJECT(
                'name', c.COLUMN_NAME,
                'datatype', c.COLUMN_TYPE,
                'not_null', c.IS_NULLABLE = 'NO',
                'is_primary', c.COLUMN_KEY = 'PRI',
                'is_unique', c.COLUMN_KEY = 'UNI',
                'is_generated', c.GENERATION_EXPRESSION <> '',
                'id_generation', IF(c.EXTRA = 'auto_increment', 'auto_inc',
                    IF(c.COLUMN_KEY = 'PRI' AND c.DATA_TYPE = 'binary' AND c.CHARACTER_MAXIMUM_LENGTH = 16,
                        'rev_uuid', NULL)),
                'comment', c.COLUMN_COMMENT,
                'srid', c.SRS_ID,
                'column_default', c.COLUMN_DEFAULT,
                'charset', c.CHARACTER_SET_NAME,
                'collation', c.COLLATION_NAME
                ) AS db_column,
            NULL AS reference_mapping,
            c.TABLE_SCHEMA as table_schema, c.TABLE_NAME as table_name
        FROM INFORMATION_SCHEMA.COLUMNS AS c
            LEFT OUTER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS k
                ON c.TABLE_SCHEMA = k.TABLE_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME
                    AND c.COLUMN_NAME=k.COLUMN_NAME
                    AND NOT ISNULL(k.POSITION_IN_UNIQUE_CONSTRAINT)
        WHERE c.TABLE_SCHEMA = schema_name AND c.TABLE_NAME = table_name
        -- Union with the references that point from the table to other tables (n:1)
        UNION
        SELECT MAX(c.ORDINAL_POSITION) + 100 AS position, MAX(k.REFERENCED_TABLE_NAME) AS name,
            GROUP_CONCAT(c.COLUMN_NAME SEPARATOR ', ') AS ref_column_names,
            NULL AS db_column,
            JSON_MERGE_PRESERVE(
                JSON_OBJECT('kind', 'n:1'),
                JSON_OBJECT('constraint',
                    CONCAT(MAX(k.CONSTRAINT_SCHEMA), '.', MAX(k.CONSTRAINT_NAME))),
                JSON_OBJECT('to_many', FALSE),
                JSON_OBJECT('referenced_schema', MAX(k.REFERENCED_TABLE_SCHEMA)),
                JSON_OBJECT('referenced_table', MAX(k.REFERENCED_TABLE_NAME)),
                JSON_OBJECT('column_mapping',
                    JSON_ARRAYAGG(JSON_OBJECT(
                        'base', c.COLUMN_NAME,
                        'ref', k.REFERENCED_COLUMN_NAME)))
            ) AS reference_mapping,
            MAX(c.TABLE_SCHEMA) AS table_schema, MAX(c.TABLE_NAME) AS table_name
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS k
            JOIN INFORMATION_SCHEMA.COLUMNS AS c
                ON c.TABLE_SCHEMA = k.TABLE_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME
                    AND c.COLUMN_NAME=k.COLUMN_NAME
                    AND c.TABLE_SCHEMA = schema_name AND c.TABLE_NAME = table_name
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
                JSON_OBJECT('kind', IF(JSON_CONTAINS(MAX(PK_TABLE.PK), MAX(PK_REF.PK)) = 1,
                    '1:1', '1:n')),
                JSON_OBJECT('constraint',
                    CONCAT(MAX(k.CONSTRAINT_SCHEMA), '.', MAX(k.CONSTRAINT_NAME))),
                JSON_OBJECT('to_many', JSON_CONTAINS(MAX(PK_TABLE.PK), MAX(PK_REF.PK)) = 0),
                JSON_OBJECT('referenced_schema', MAX(c.TABLE_SCHEMA)),
                JSON_OBJECT('referenced_table', MAX(c.TABLE_NAME)),
                JSON_OBJECT('column_mapping',
                    JSON_ARRAYAGG(JSON_OBJECT(
                        'base', k.REFERENCED_COLUMN_NAME,
                        'ref', c.COLUMN_NAME)))
            ) AS reference_mapping,
            MAX(k.REFERENCED_TABLE_SCHEMA) AS table_schema,
            MAX(k.REFERENCED_TABLE_NAME) AS table_name
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS k
            JOIN INFORMATION_SCHEMA.COLUMNS AS c
                ON c.TABLE_SCHEMA = k.TABLE_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME
                    AND c.COLUMN_NAME=k.COLUMN_NAME
            -- The PK columns of the table, e.g. ['test_fk.product.id']
            JOIN (SELECT JSON_ARRAYAGG(CONCAT(c2.TABLE_SCHEMA, '.',
                        c2.TABLE_NAME, '.', c2.COLUMN_NAME)) AS PK,
                    c2.TABLE_SCHEMA, c2.TABLE_NAME
                    FROM INFORMATION_SCHEMA.COLUMNS AS c2
                    WHERE c2.COLUMN_KEY = 'PRI'
                    GROUP BY c2.COLUMN_KEY, c2.TABLE_SCHEMA, c2.TABLE_NAME) AS PK_TABLE
                ON PK_TABLE.TABLE_SCHEMA = k.REFERENCED_TABLE_SCHEMA
                    AND PK_TABLE.TABLE_NAME = k.REFERENCED_TABLE_NAME
            -- The PK columns of the referenced table,
            -- e.g. ['test_fk.product_part.id', 'test_fk.product.id']
            JOIN (SELECT JSON_ARRAYAGG(PK2.PK_COL) AS PK, PK2.TABLE_SCHEMA, PK2.TABLE_NAME
                FROM (SELECT IFNULL(
                    CONCAT(MAX(k1.REFERENCED_TABLE_SCHEMA), '.',
                        MAX(k1.REFERENCED_TABLE_NAME), '.', MAX(k1.REFERENCED_COLUMN_NAME)),
                    CONCAT(c1.TABLE_SCHEMA, '.', c1.TABLE_NAME, '.', c1.COLUMN_NAME)) AS PK_COL,
                    c1.TABLE_SCHEMA AS TABLE_SCHEMA, c1.TABLE_NAME AS TABLE_NAME
                    FROM INFORMATION_SCHEMA.COLUMNS AS c1
                        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS k1
                            ON k1.TABLE_SCHEMA = c1.TABLE_SCHEMA
                                AND k1.TABLE_NAME = c1.TABLE_NAME
                                AND k1.COLUMN_NAME = c1.COLUMN_NAME
                    WHERE c1.COLUMN_KEY = 'PRI'
                    GROUP BY c1.COLUMN_NAME, c1.TABLE_SCHEMA, c1.TABLE_NAME) AS PK2
                    GROUP BY PK2.TABLE_SCHEMA, PK2.TABLE_NAME) AS PK_REF
                ON PK_REF.TABLE_SCHEMA = k.TABLE_SCHEMA AND PK_REF.TABLE_NAME = k.TABLE_NAME
        WHERE k.REFERENCED_TABLE_SCHEMA = schema_name AND k.REFERENCED_TABLE_NAME = table_name
        GROUP BY k.CONSTRAINT_NAME, c.TABLE_SCHEMA, c.TABLE_NAME
        ) AS f
        -- LEFT JOIN with possible JSON_SCHEMA CHECK constraint for the given column
        LEFT OUTER JOIN (
            SELECT co.TABLE_SCHEMA, co.TABLE_NAME, co.COLUMN_NAME, MAX(co.JSON_SCHEMA_DEF) AS json_schema_def
            FROM (SELECT tc.TABLE_SCHEMA, tc.TABLE_NAME, TRIM('`' FROM TRIM(TRAILING ')' FROM
                    REGEXP_SUBSTR(REGEXP_SUBSTR(cc.CHECK_CLAUSE, 'json_schema_valid\s*\\(.*,\s*`[^`]*`\s*\\)'), '`[^`]*`\\)')
                    )) AS COLUMN_NAME,
                    tc.ENFORCED, cc.CONSTRAINT_NAME,
                    REPLACE(TRIM('\\''' FROM REGEXP_REPLACE(SUBSTRING(cc.CHECK_CLAUSE FROM LOCATE('{', cc.CHECK_CLAUSE)), '\s*,\s*`[^`]*`\\).*', '')), '\\\\n', '\n') AS JSON_SCHEMA_DEF
                FROM `information_schema`.`TABLE_CONSTRAINTS` AS tc
                    LEFT OUTER JOIN information_schema.CHECK_CONSTRAINTS AS cc
                        ON cc.CONSTRAINT_SCHEMA = tc.TABLE_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
                ) AS co
            WHERE co.COLUMN_NAME IS NOT NULL AND co.ENFORCED = 'YES' AND JSON_VALID(co.JSON_SCHEMA_DEF) AND co.TABLE_SCHEMA = schema_name AND co.TABLE_NAME = table_name
            GROUP BY co.TABLE_SCHEMA, co.TABLE_NAME, co.COLUMN_NAME) AS js
        ON f.TABLE_SCHEMA = js.TABLE_SCHEMA AND f.TABLE_NAME = js.TABLE_NAME AND f.name = js.COLUMN_NAME
    ORDER BY f.position;
END%%

-- The dump_audit_log procedure allows the audit_log table to be exported to a file
-- Please note that the secure_file_priv global variable must be set for this to work in the my.ini / my.cnf file
-- [mysqld]
-- secure-file-priv="/usr/local/mysql/outfiles"

DROP PROCEDURE IF EXISTS `mysql_rest_service_metadata`.`dump_audit_log`%%
CREATE PROCEDURE `mysql_rest_service_metadata`.`dump_audit_log`()
SQL SECURITY DEFINER
BEGIN
    DECLARE dump_from TIMESTAMP;
    DECLARE dump_until TIMESTAMP;
    DECLARE event_count INT;

    -- Only perform the dump if the secure_file_priv global is set, otherwise the file cannot be written
    IF @@secure_file_priv IS NOT NULL THEN
        SELECT IFNULL(last_dump_at, '2025-01-01 00:00:00') INTO dump_from
        FROM `mysql_rest_service_metadata`.`audit_log_status`
        WHERE `id` = 1;

        SET dump_until = NOW();

        SELECT COUNT(*) INTO event_count
        FROM `mysql_rest_service_metadata`.`audit_log`
        WHERE `changed_at` BETWEEN dump_from AND dump_until;

        IF event_count > 0 THEN
            -- Export all audit_log entries that occurred since the last dump
            SET @sql = CONCAT(
                'SELECT changed_at, id, @@server_uuid AS server_uuid, ',
                '    schema_name, table_name, dml_type, changed_by, '
                '    JSON_REPLACE(old_row_data, "$.data.defaultStaticContent", "BINARY_DATA") AS old_row_data, ',
                '    JSON_REPLACE(new_row_data, "$.data.defaultStaticContent", "BINARY_DATA") AS new_row_data ',
                'INTO OUTFILE "', TRIM(TRAILING '/' FROM @@secure_file_priv), '/mrs/mrs_audit_log_',
                DATE_FORMAT(dump_until, '%Y-%m-%d_%H-%i-%s'),
                '.log" FIELDS TERMINATED BY "," OPTIONALLY ENCLOSED BY "\\\"" LINES TERMINATED BY "\\\n" ',
                'FROM `mysql_rest_service_metadata`.`audit_log` ',
                'WHERE `changed_at` BETWEEN CAST("', DATE_FORMAT(dump_from, '%Y-%m-%d %H:%i:%s'), '" AS DATETIME) ',
                '    AND CAST("', DATE_FORMAT(dump_until, '%Y-%m-%d %H:%i:%s'), '" AS DATETIME) ',
                'ORDER BY `id`');

            CALL sys.execute_prepared_stmt(@sql);
        END IF;

        UPDATE `mysql_rest_service_metadata`.`audit_log_status`
        SET `last_dump_at` = dump_until
        WHERE `id` = 1;
    ELSE
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Please configure the secure-file-priv variable in the [mysqld] section of my.cnf.',
            MYSQL_ERRNO = 5400;
    END IF;
END%%

-- Create an event to dump the audit log every 15 minutes

DROP EVENT IF EXISTS `mysql_rest_service_metadata`.`audit_log_dump_event`%%
CREATE EVENT `mysql_rest_service_metadata`.`audit_log_dump_event`
ON SCHEDULE EVERY 15 MINUTE
  STARTS '2025-01-01 00:00:00'
ON COMPLETION PRESERVE DISABLE
DO BEGIN
    CALL `mysql_rest_service_metadata`.`dump_audit_log`();
END%%

-- -----------------------------------------------------
-- Create audit_log triggers
--

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_schema_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`db_schema_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `db_schema` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_schema_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`db_schema_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `db_schema` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_schema_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`db_schema_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `db_schema` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`service_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `service` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`service_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `service` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`service_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `service` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_object_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`db_object_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `db_object` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_object_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`db_object_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `db_object` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_object_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`db_object_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `db_object` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `mrs_user` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `mrs_user` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `mrs_user` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_vendor_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`auth_vendor_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `auth_vendor` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_vendor_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`auth_vendor_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `auth_vendor` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_vendor_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`auth_vendor_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `auth_vendor` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_app_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`auth_app_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `auth_app` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_app_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`auth_app_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `auth_app` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_app_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`auth_app_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `auth_app` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`config_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`config_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `config` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "config",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "service_enabled", NEW.service_enabled,
            "data", NEW.data),
        NULL,
        NEW.id,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`config_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`config_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `config` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "config",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "service_enabled", OLD.service_enabled,
            "data", OLD.data),
        JSON_OBJECT(
            "id", NEW.id,
            "service_enabled", NEW.service_enabled,
            "data", NEW.data),
        OLD.id,
        NEW.id,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`config_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`config_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `config` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "config",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "service_enabled", OLD.service_enabled,
            "data", OLD.data),
        NULL,
        OLD.id,
        NULL,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`redirect_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`redirect_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `redirect` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "redirect",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "pattern", NEW.pattern,
            "target", NEW.target,
            "kind", NEW.kind,
            "in_development", NEW.in_development),
        NULL,
        NEW.id,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`redirect_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`redirect_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `redirect` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "redirect",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "pattern", OLD.pattern,
            "target", OLD.target,
            "kind", OLD.kind,
            "in_development", OLD.in_development),
        JSON_OBJECT(
            "id", NEW.id,
            "pattern", NEW.pattern,
            "target", NEW.target,
            "kind", NEW.kind,
            "in_development", NEW.in_development),
        OLD.id,
        NEW.id,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`redirect_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`redirect_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `redirect` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "redirect",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "pattern", OLD.pattern,
            "target", OLD.target,
            "kind", OLD.kind,
            "in_development", OLD.in_development),
        NULL,
        OLD.id,
        NULL,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`url_host_alias_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`url_host_alias_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `url_host_alias` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "url_host_alias",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "url_host_id", NEW.url_host_id,
            "alias", NEW.alias),
        NULL,
        NEW.id,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`url_host_alias_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`url_host_alias_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `url_host_alias` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "url_host_alias",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "url_host_id", OLD.url_host_id,
            "alias", OLD.alias),
        JSON_OBJECT(
            "id", NEW.id,
            "url_host_id", NEW.url_host_id,
            "alias", NEW.alias),
        OLD.id,
        NEW.id,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`url_host_alias_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`url_host_alias_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `url_host_alias` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "url_host_alias",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "url_host_id", OLD.url_host_id,
            "alias", OLD.alias),
        NULL,
        OLD.id,
        NULL,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`url_host_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`url_host_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `url_host` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "url_host",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "name", NEW.name,
            "comments", NEW.comments),
        NULL,
        NEW.id,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`url_host_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`url_host_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `url_host` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "url_host",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "name", OLD.name,
            "comments", OLD.comments),
        JSON_OBJECT(
            "id", NEW.id,
            "name", NEW.name,
            "comments", NEW.comments),
        OLD.id,
        NEW.id,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`url_host_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`url_host_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `url_host` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "url_host",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "name", OLD.name,
            "comments", OLD.comments),
        NULL,
        OLD.id,
        NULL,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_file_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`content_file_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `content_file` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_file_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`content_file_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `content_file` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_file_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`content_file_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `content_file` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`content_set_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `content_set` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`content_set_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `content_set` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`content_set_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `content_set` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_role_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_role_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `mrs_role` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_role_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_role_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `mrs_role` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_role_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_role_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `mrs_role` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_has_role_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_role_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `mrs_user_has_role` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_has_role_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_role_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `mrs_user_has_role` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_has_role_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_role_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `mrs_user_has_role` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_hierarchy_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `mrs_user_hierarchy` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_hierarchy_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `mrs_user_hierarchy` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_hierarchy_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `mrs_user_hierarchy` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `mrs_user_hierarchy_type` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `mrs_user_hierarchy_type` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `mrs_user_hierarchy_type` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_privilege_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_privilege_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `mrs_privilege` FOR EACH ROW
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
            "service_path", NEW.service_path,
            "schema_path", NEW.schema_path,
            "object_path", NEW.object_path,
            "options", NEW.options),
        NULL,
        NEW.id,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_privilege_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_privilege_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `mrs_privilege` FOR EACH ROW
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
            "service_path", OLD.service_path,
            "schema_path", OLD.schema_path,
            "object_path", OLD.object_path,
            "options", OLD.options),
        JSON_OBJECT(
            "id", NEW.id,
            "role_id", NEW.role_id,
            "crud_operations", NEW.crud_operations,
            "service_id", NEW.service_id,
            "db_schema_id", NEW.db_schema_id,
            "db_object_id", NEW.db_object_id,
            "service_path", NEW.service_path,
            "schema_path", NEW.schema_path,
            "object_path", NEW.object_path,
            "options", NEW.options),
        OLD.id,
        NEW.id,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_privilege_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_privilege_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `mrs_privilege` FOR EACH ROW
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
            "service_path", OLD.service_path,
            "schema_path", OLD.schema_path,
            "object_path", OLD.object_path,
            "options", OLD.options),
        NULL,
        OLD.id,
        NULL,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `mrs_user_group` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `mrs_user_group` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `mrs_user_group` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_has_role_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_has_role_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `mrs_user_group_has_role` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_has_role_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_has_role_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `mrs_user_group_has_role` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_has_role_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_has_role_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `mrs_user_group_has_role` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_has_group_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_group_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `mrs_user_has_group` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_has_group_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_group_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `mrs_user_has_group` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_has_group_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_has_group_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `mrs_user_has_group` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `mrs_group_hierarchy_type` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `mrs_group_hierarchy_type` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `mrs_group_hierarchy_type` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_hierarchy_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_hierarchy_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `mrs_user_group_hierarchy` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_hierarchy_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_hierarchy_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `mrs_user_group_hierarchy` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_hierarchy_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_hierarchy_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `mrs_user_group_hierarchy` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_db_object_row_group_security_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_db_object_row_group_security_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `mrs_db_object_row_group_security` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_db_object_row_group_security_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_db_object_row_group_security_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `mrs_db_object_row_group_security` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_db_object_row_group_security_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`mrs_db_object_row_group_security_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `mrs_db_object_row_group_security` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`object_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `object` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`object_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `object` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`object_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `object` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_field_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`object_field_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `object_field` FOR EACH ROW
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
            "position", NEW.position,
            "db_column", NEW.db_column,
            "enabled", NEW.enabled,
            "allow_filtering", NEW.allow_filtering,
            "allow_sorting", NEW.allow_sorting,
            "no_check", NEW.no_check,
            "no_update", NEW.no_update,
            "json_schema", NEW.json_schema,
            "options", NEW.options,
            "sdk_options", NEW.sdk_options,
            "comments", NEW.comments),
        NULL,
        NEW.id,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_field_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`object_field_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `object_field` FOR EACH ROW
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
            "position", OLD.position,
            "db_column", OLD.db_column,
            "enabled", OLD.enabled,
            "allow_filtering", OLD.allow_filtering,
            "allow_sorting", OLD.allow_sorting,
            "no_check", OLD.no_check,
            "no_update", OLD.no_update,
            "json_schema", OLD.json_schema,
            "options", OLD.options,
            "sdk_options", OLD.sdk_options,
            "comments", OLD.comments),
        JSON_OBJECT(
            "id", NEW.id,
            "object_id", NEW.object_id,
            "parent_reference_id", NEW.parent_reference_id,
            "represents_reference_id", NEW.represents_reference_id,
            "name", NEW.name,
            "position", NEW.position,
            "db_column", NEW.db_column,
            "enabled", NEW.enabled,
            "allow_filtering", NEW.allow_filtering,
            "allow_sorting", NEW.allow_sorting,
            "no_check", NEW.no_check,
            "no_update", NEW.no_update,
            "json_schema", NEW.json_schema,
            "options", NEW.options,
            "sdk_options", NEW.sdk_options,
            "comments", NEW.comments),
        OLD.id,
        NEW.id,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_field_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`object_field_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `object_field` FOR EACH ROW
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
            "position", OLD.position,
            "db_column", OLD.db_column,
            "enabled", OLD.enabled,
            "allow_filtering", OLD.allow_filtering,
            "allow_sorting", OLD.allow_sorting,
            "no_check", OLD.no_check,
            "no_update", OLD.no_update,
            "json_schema", OLD.json_schema,
            "options", OLD.options,
            "sdk_options", OLD.sdk_options,
            "comments", OLD.comments),
        NULL,
        OLD.id,
        NULL,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_reference_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`object_reference_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `object_reference` FOR EACH ROW
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
            "row_ownership_field_id", NEW.row_ownership_field_id,
            "reference_mapping", NEW.reference_mapping,
            "unnest", NEW.unnest,
            "options", NEW.options,
            "sdk_options", NEW.sdk_options,
            "comments", NEW.comments),
        NULL,
        NEW.id,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_reference_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`object_reference_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `object_reference` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "object_reference",
        "UPDATE",
        JSON_OBJECT(
            "id", OLD.id,
            "reduce_to_value_of_field_id", OLD.reduce_to_value_of_field_id,
            "row_ownership_field_id", OLD.row_ownership_field_id,
            "reference_mapping", OLD.reference_mapping,
            "unnest", OLD.unnest,
            "options", OLD.options,
            "sdk_options", OLD.sdk_options,
            "comments", OLD.comments),
        JSON_OBJECT(
            "id", NEW.id,
            "reduce_to_value_of_field_id", NEW.reduce_to_value_of_field_id,
            "row_ownership_field_id", NEW.row_ownership_field_id,
            "reference_mapping", NEW.reference_mapping,
            "unnest", NEW.unnest,
            "options", NEW.options,
            "sdk_options", NEW.sdk_options,
            "comments", NEW.comments),
        OLD.id,
        NEW.id,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_reference_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`object_reference_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `object_reference` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "object_reference",
        "DELETE",
        JSON_OBJECT(
            "id", OLD.id,
            "reduce_to_value_of_field_id", OLD.reduce_to_value_of_field_id,
            "row_ownership_field_id", OLD.row_ownership_field_id,
            "reference_mapping", OLD.reference_mapping,
            "unnest", OLD.unnest,
            "options", OLD.options,
            "sdk_options", OLD.sdk_options,
            "comments", OLD.comments),
        NULL,
        OLD.id,
        NULL,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_has_auth_app_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`service_has_auth_app_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `service_has_auth_app` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_has_auth_app_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`service_has_auth_app_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `service_has_auth_app` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_has_auth_app_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`service_has_auth_app_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `service_has_auth_app` FOR EACH ROW
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
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_has_obj_def_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`content_set_has_obj_def_AFTER_INSERT_AUDIT_LOG`
    AFTER INSERT ON `content_set_has_obj_def` FOR EACH ROW
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
            "kind", NEW.kind,
            "priority", NEW.priority,
            "language", NEW.language,
            "name", NEW.name,
            "class_name", NEW.class_name,
            "comments", NEW.comments,
            "options", NEW.options),
        NULL,
        NEW.content_set_id,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_has_obj_def_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`content_set_has_obj_def_AFTER_UPDATE_AUDIT_LOG`
    AFTER UPDATE ON `content_set_has_obj_def` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "content_set_has_obj_def",
        "UPDATE",
        JSON_OBJECT(
            "content_set_id", OLD.content_set_id,
            "db_object_id", OLD.db_object_id,
            "kind", OLD.kind,
            "priority", OLD.priority,
            "language", OLD.language,
            "name", OLD.name,
            "class_name", OLD.class_name,
            "comments", OLD.comments,
            "options", OLD.options),
        JSON_OBJECT(
            "content_set_id", NEW.content_set_id,
            "db_object_id", NEW.db_object_id,
            "kind", NEW.kind,
            "priority", NEW.priority,
            "language", NEW.language,
            "name", NEW.name,
            "class_name", NEW.class_name,
            "comments", NEW.comments,
            "options", NEW.options),
        OLD.content_set_id,
        NEW.content_set_id,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_has_obj_def_AFTER_DELETE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`content_set_has_obj_def_AFTER_DELETE_AUDIT_LOG`
    AFTER DELETE ON `content_set_has_obj_def` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "content_set_has_obj_def",
        "DELETE",
        JSON_OBJECT(
            "content_set_id", OLD.content_set_id,
            "db_object_id", OLD.db_object_id,
            "kind", OLD.kind,
            "priority", OLD.priority,
            "language", OLD.language,
            "name", OLD.name,
            "class_name", OLD.class_name,
            "comments", OLD.comments,
            "options", OLD.options),
        NULL,
        OLD.content_set_id,
        NULL,
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END%%


DELIMITER ;


-- #############################################################################
-- MSM Section 270: Authorization
-- -----------------------------------------------------------------------------
-- This section is used to define changes for ROLEs and GRANTs in respect to
-- the previous version. If there are no changes required, this section can
-- be skipped.
-- -----------------------------------------------------------------------------

-- `mysql_rest_service_metadata`.`table_columns_with_references`
GRANT EXECUTE
    ON PROCEDURE `mysql_rest_service_metadata`.`table_columns_with_references`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';


-- #############################################################################
-- MSM Section 290: Removal of Update Helpers
-- -----------------------------------------------------------------------------
-- Removal of optional helper PROCEDUREs and FUNCTIONs that are called during
-- the update of the database schema. Note that DROP IF EXISTS needs to be
-- used.
-- -----------------------------------------------------------------------------

DROP PROCEDURE `mysql_rest_service_metadata`.`msm_ensure_varchar_column_uniqueness`;


-- #############################################################################
-- MSM Section 910: Database Schema Version Definition
-- -----------------------------------------------------------------------------
-- Setting the correct database schema version.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `mysql_rest_service_metadata`.`msm_schema_version` (
    `major`,`minor`,`patch`) AS
SELECT 3, 1, 0;


-- #############################################################################
-- MSM Section 920: Server Variable Restoration
-- -----------------------------------------------------------------------------
-- Restore the modified server variables to their original state.
-- -----------------------------------------------------------------------------

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
