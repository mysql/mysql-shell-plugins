-- Copyright (c) 2024, 2025, Oracle and/or its affiliates.

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

USE `mysql_rest_service_metadata`;

-- Set schema_version to 0.0.0 to indicate an ongoing upgrade
ALTER SQL SECURITY INVOKER VIEW `schema_version` (major, minor, patch) AS SELECT 0, 0, 0;

ALTER TABLE `mysql_rest_service_metadata`.`redirect`
  CHANGE COLUMN `target` `target` VARCHAR(1024) NOT NULL,
  ADD COLUMN `kind` ENUM('REDIRECT', 'REWRITE') NOT NULL DEFAULT 'REDIRECT',
  ADD COLUMN `in_development` JSON NULL;

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

-- Add a unique index on the name column of the auth_app table
-- First, ensure that there are no duplicate names present by renaming duplicates
-- Then add the unique index

DELIMITER $$
DROP PROCEDURE IF EXISTS `mysql_rest_service_metadata`.`ensure_auth_app_name_uniqueness` $$
CREATE PROCEDURE `mysql_rest_service_metadata`.`ensure_auth_app_name_uniqueness`()
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
END$$

DELIMITER ;

CALL `mysql_rest_service_metadata`.`ensure_auth_app_name_uniqueness`();
DROP PROCEDURE `mysql_rest_service_metadata`.`ensure_auth_app_name_uniqueness`;

ALTER TABLE `mysql_rest_service_metadata`.`auth_app`
    ADD CONSTRAINT auth_app_name_unique UNIQUE KEY (`name`);


DROP VIEW IF EXISTS `mysql_rest_service_metadata`.`table_columns_with_references`;

DELIMITER $$

-- Procedure to fetch all table columns as well as references to related tables

DROP PROCEDURE IF EXISTS `mysql_rest_service_metadata`.`table_columns_with_references`$$
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
END$$

DELIMITER ;

-- `mysql_rest_service_metadata`.`table_columns_with_references`
GRANT EXECUTE
    ON PROCEDURE `mysql_rest_service_metadata`.`table_columns_with_references`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

DELIMITER $$

-- The dump_audit_log procedure allows the audit_log table to be exported to a file
-- Please note that the secure_file_priv global variable must be set for this to work in the my.ini / my.cnf file
-- [mysqld]
-- secure-file-priv="/usr/local/mysql/outfiles"

DROP PROCEDURE IF EXISTS `mysql_rest_service_metadata`.`dump_audit_log`$$
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
END$$

-- Create an event to dump the audit log every 15 minutes

DROP EVENT IF EXISTS `mysql_rest_service_metadata`.`audit_log_dump_event`$$
CREATE EVENT `mysql_rest_service_metadata`.`audit_log_dump_event`
ON SCHEDULE EVERY 15 MINUTE
  STARTS '2025-01-01 00:00:00'
ON COMPLETION PRESERVE DISABLE
DO BEGIN
    CALL `mysql_rest_service_metadata`.`dump_audit_log`();
END$$

DELIMITER ;


-- -----------------------------------------------------
-- Create audit_log triggers
--

DELIMITER $$
DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_schema_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_schema_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_schema_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_object_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_object_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_object_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_vendor_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_vendor_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_vendor_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_app_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_app_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_app_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`config_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`config_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`config_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`redirect_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`redirect_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`redirect_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`url_host_alias_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`url_host_alias_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`url_host_alias_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`url_host_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`url_host_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`url_host_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_file_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_file_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_file_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_role_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_role_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_role_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_has_role_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_has_role_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_has_role_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_hierarchy_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_hierarchy_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_hierarchy_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_privilege_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_privilege_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_privilege_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_has_role_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_has_role_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_has_role_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_has_group_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_has_group_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_has_group_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_hierarchy_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_hierarchy_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_hierarchy_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_db_object_row_group_security_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_db_object_row_group_security_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_db_object_row_group_security_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_field_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_field_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_field_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_reference_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_reference_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_reference_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_has_auth_app_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_has_auth_app_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_has_auth_app_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_has_obj_def_AFTER_INSERT_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_has_obj_def_AFTER_UPDATE_AUDIT_LOG`$$
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
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_has_obj_def_AFTER_DELETE_AUDIT_LOG`$$
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
END$$

DELIMITER ;

/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

-- -----------------------------------------------------
-- MySQL Tasks Schema - CREATE Script

DROP SCHEMA IF EXISTS `mysql_tasks`;
CREATE SCHEMA `mysql_tasks` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Set schema_version to 0.0.0 to indicate an ongoing creation/upgrade of the schema
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `mysql_tasks`.`schema_version` (`major`,`minor`,`patch`) AS
SELECT 0, 0, 0;

-- -----------------------------------------------------
-- Table `mysql_tasks`.`config`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_tasks`.`config` (
  `id` TINYINT NOT NULL DEFAULT 1,
  `data` JSON NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT Config_OnlyOneRow CHECK (id = 1))
ENGINE = InnoDB;

-- cSpell:ignore Lakehouse
INSERT IGNORE INTO `mysql_tasks`.`config` (`id`, `data`)
VALUES (1, '{ "limits": { "maximumPreparedStmtAsyncTasks": 100, "maximumLakehouseLoadingTasks": 5 } }');

-- -----------------------------------------------------
-- Table `mysql_tasks`.`task_impl`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_tasks`.`task_impl` (
  `id` BINARY(16) NOT NULL COMMENT 'A UUID uniquely identifying the task across replication instances in binary format. The id should be created by the function call UUID_TO_BIN(UUID(), 1) which generates the BINARY representation of the UUID in reverse order to improve indexing. The field is usually hidden from end users.',
  `mysql_user` VARCHAR(288) DEFAULT (CURRENT_USER()) COMMENT 'The MySQL user that created the task.',
  `app_user_id` BINARY(16) COMMENT 'An optional UUID representing a specific application user. If set, the app_user_id will be used to filter tasks per application users, preventing an app user to see tasks from other app users.',
  `alias` VARCHAR(16) COMMENT 'A human readable alias that allows easier referencing of a specific task. It uses the format {Abbreviated weekday name}-{task count per mysql_user or user_id if specified}, e.g. Mon-1, Mon-2, Tue-1, etc. Please note that there is no guarantee that the alias will be unique, while still being useful in the majority of cases as old task are deleted after 7 days.',
  `name` VARCHAR(255) NOT NULL COMMENT 'The name of the task.',
  `server_uuid`  BINARY(16) NOT NULL COMMENT 'The UUID of the server on which the task has been created. It should be populated using UUID_TO_BIN(@@server_uuid, 1).',
  `connection_id` BIGINT UNSIGNED NOT NULL COMMENT 'The MySQL server connection_id that was used to created the task.',
  `task_type` VARCHAR(80) NOT NULL COMMENT 'An application defined task type, used for filtering of tasks per type.',
  `data` JSON COMMENT 'Can hold application specific data.',
  `data_json_schema` JSON COMMENT 'A JSON schema defining the structure of the data field for the given task.',
  `log_data_json_schema` JSON COMMENT 'A JSON schema defining the structure of the task_log_impl.data field for the given task.',
  PRIMARY KEY(`id`),
  INDEX(`mysql_user`(192)),
  INDEX(`mysql_user`(176), `alias`),
  INDEX(`task_type`)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Table `mysql_tasks`.`task_log_impl`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_tasks`.`task_log_impl` (
  `id` BINARY(16) NOT NULL COMMENT 'A UUID uniquely identifying a task log entry. It should be created by the function call UUID_TO_BIN(UUID(), 1) which generates the BINARY representation of the UUID in the reverse order to improve indexing.',
  `task_id` BINARY(16) NOT NULL COMMENT 'The task ID (foreign key).',
  `mysql_user` VARCHAR(288) DEFAULT (CURRENT_USER()) COMMENT 'The MySQL user that created the task / inserted the task log.',
  `log_time` TIMESTAMP(6) NOT NULL COMMENT 'A timestamp when the task log entry was inserted.',
  `message` VARCHAR(2000) COMMENT 'A task log message.',
  `data` JSON COMMENT 'Can hold application specific log data. It must conform to log_data_json_schema defined in the`task_impl` table.',
  `progress` SMALLINT NOT NULL DEFAULT 0 COMMENT 'A task completion progress between 0 and 100%.',
  `status` ENUM('SCHEDULED', 'RUNNING', 'COMPLETED', 'ERROR', 'CANCELLED') DEFAULT 'SCHEDULED' COMMENT 'The task state. When created, a task goes in the SCHEDULED state, then is moved to RUNNING and finally COMPLETED state. In case of ERROR, the task status becomes ERROR. When task is killed by the user or by the garbage collector, it gets the CANCELLED status.',
  PRIMARY KEY(`id`),
  INDEX(`mysql_user`(192)),
  INDEX(`log_time`),
  INDEX(`status`),
  CONSTRAINT `fk_task_log_task_id`
    FOREIGN KEY (`task_id`)
    REFERENCES `mysql_tasks`.`task_impl` (`id`)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Trigger `mysql_tasks`.`task_impl_BEFORE_INSERT`
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS `mysql_tasks`.`task_impl_BEFORE_INSERT`;
DELIMITER $$
CREATE TRIGGER `mysql_tasks`.`task_impl_BEFORE_INSERT`
BEFORE INSERT ON `mysql_tasks`.`task_impl` FOR EACH ROW
BEGIN
  DECLARE day_abbr VARCHAR(3);
  DECLARE max_index INT UNSIGNED;

  -- Get the abbreviated day of the week
  SET day_abbr = DATE_FORMAT(CURDATE(), '%a');

  -- Find the next free index for the given user
  SELECT
    IFNULL(
      MAX(
        CAST(SUBSTRING_INDEX(alias, '-', -1) AS UNSIGNED)
      ), 0
    ) + 1
  INTO
    max_index
  FROM
    `mysql_tasks`.`task_impl`
  WHERE
    `mysql_user` = NEW.mysql_user
    AND alias LIKE CONCAT(day_abbr, '-%');

  -- Set the alias (if not set)
  SET NEW.`alias` = COALESCE(NEW.`alias`, CONCAT(day_abbr, '-', max_index));

  -- Set the server uuid (if not set)
  SET NEW.`server_uuid` = COALESCE(NEW.`server_uuid`, UUID_TO_BIN(@@server_uuid, 1));

END$$
DELIMITER ;

-- -----------------------------------------------------
-- Trigger `mysql_tasks`.`task_impl_BEFORE_DELETE`
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS `mysql_tasks`.`task_impl_BEFORE_DELETE`;
DELIMITER $$
CREATE TRIGGER `mysql_tasks`.`task_impl_BEFORE_DELETE`
BEFORE DELETE ON `mysql_tasks`.`task_impl` FOR EACH ROW
BEGIN
  DELETE FROM `mysql_tasks`.`task_log_impl`
  WHERE
    `task_id` = OLD.`id`;
END$$
DELIMITER ;

-- -----------------------------------------------------
-- View `mysql_tasks`.`task_i`
-- note: grant only INSERT on this view to users
--       (not SELECT)
-- -----------------------------------------------------
DROP VIEW IF EXISTS `mysql_tasks`.`task_i`;
CREATE SQL SECURITY DEFINER VIEW `mysql_tasks`.`task_i` AS
  SELECT
    `task_impl`.`id` AS `id`,
    `task_impl`.`app_user_id` AS `app_user_id`,
    `task_impl`.`alias` AS `alias`,
    `task_impl`.`name` AS `name`,
    `task_impl`.`server_uuid` AS `server_uuid`,
    `task_impl`.`connection_id` AS `connection_id`,
    `task_impl`.`task_type` AS `task_type`,
    `task_impl`.`data` AS `data`,
    `task_impl`.`data_json_schema` AS `data_json_schema`,
    `task_impl`.`log_data_json_schema` AS `log_data_json_schema`
  FROM `mysql_tasks`.`task_impl`
  WHERE
    (LEFT(`mysql_user`, (LENGTH(`mysql_user`) - locate('@', reverse(`mysql_user`)))) =
      LEFT(user(),(length(user()) - locate('@', reverse(user())))));

-- -----------------------------------------------------
-- View `mysql_tasks`.`task_log_i`
-- note: grant only INSERT on this view to users
--       (not SELECT)
-- -----------------------------------------------------
DROP VIEW IF EXISTS `mysql_tasks`.`task_log_i`;
CREATE SQL SECURITY DEFINER VIEW `mysql_tasks`.`task_log_i` AS
SELECT
  `task_log_impl`.`id` AS `id`,
  `task_log_impl`.`task_id` AS `task_id`,
  `task_log_impl`.`log_time` AS `log_time`,
  `task_log_impl`.`message` AS `message`,
  `task_log_impl`.`data` AS `data`,
  `task_log_impl`.`progress` AS `progress`,
  `task_log_impl`.`status` AS `status`
FROM `mysql_tasks`.`task_log_impl`
WHERE
  (LEFT(`mysql_user`, (LENGTH(`mysql_user`) - LOCATE('@', REVERSE(`mysql_user`)))) =
    LEFT(user(),(length(user()) - LOCATE('@', REVERSE(user())))));

-- -----------------------------------------------------
-- View `mysql_tasks`.`task_status_impl`
--   for internal use
-- -----------------------------------------------------
DROP VIEW IF EXISTS `mysql_tasks`.`task_status_impl`;
CREATE SQL SECURITY INVOKER VIEW `mysql_tasks`.`task_status_impl` AS
SELECT
  t.id AS id,
  t.app_user_id AS app_user_id,
  t.alias AS alias,
  t.server_uuid AS server_uuid,
  t.name AS name,
  t.mysql_user AS mysql_user,
  t.connection_id AS connection_id,
  t.task_type AS task_type,
  t.data AS data,
  last_tl.data AS log_data,
  IF (
    t.server_uuid = server_info.server_uuid,
    last_tl.message,
    'Not started on this server.'
  ) AS message,
  IF (
    t.server_uuid = server_info.server_uuid,
    last_tl.progress,
    0
  ) AS progress,
  IF (
    t.server_uuid = server_info.server_uuid,
    last_tl.status,
    'EXTERNAL'
  ) AS status,
  CAST(tl.first_log_time AS DATETIME) AS 'scheduled_time',
  IF (
    t.server_uuid = server_info.server_uuid,
    CAST(tl_running.first_log_time AS DATETIME),
    NULL
  ) AS 'starting_time',
  IF (
    t.server_uuid = server_info.server_uuid,
    IF(
      last_tl.progress = 0,
      NULL,
      CAST(
        TIMESTAMPADD(
          SECOND,
          ROUND(
            TIMESTAMPDIFF(
              SECOND,
              tl_running.first_log_time,
              tl.last_log_time
            ) / last_tl.progress * 100
          ),
          tl_running.first_log_time
        ) AS DATETIME
      )
    ),
    NULL
  ) AS 'estimated_completion_time',
  IF (
    t.server_uuid = server_info.server_uuid,
    IF(
      last_tl.progress = 0,
      NULL,
      TIMESTAMPDIFF(
        SECOND,
        tl_running.first_log_time,
        tl.last_log_time
      ) / last_tl.progress * 100.0 - TIMESTAMPDIFF(
        SECOND,
        tl_running.first_log_time,
        tl.last_log_time
      )
    ),
    NULL
  ) AS 'estimated_remaining_time',
  IF (
    t.server_uuid = server_info.server_uuid,
    CONCAT(
      REPEAT('#', FLOOR(last_tl.progress / 10)),
      REPEAT('_', 10 - FLOOR(last_tl.progress / 10))
    ),
    REPEAT('_', 10)
  ) AS 'progress_bar'
FROM
  `mysql_tasks`.`task_impl` t
INNER JOIN (
  SELECT
    tl1.task_id,
    MIN(tl1.log_time) AS first_log_time,
    MAX(tl1.log_time) AS last_log_time,
    COUNT(*) AS log_count
  FROM
    `mysql_tasks`.`task_log_impl` tl1
  GROUP BY
    tl1.task_id
) tl ON t.id = tl.task_id
LEFT OUTER JOIN `mysql_tasks`.`task_log_impl` last_tl
  ON tl.task_id = last_tl.task_id
  AND tl.last_log_time = last_tl.log_time
LEFT OUTER JOIN (
  SELECT
    tl2.task_id,
    MIN(tl2.log_time) AS first_log_time
  FROM
    `mysql_tasks`.`task_log_impl` tl2
  WHERE
    status = 'RUNNING'
  GROUP BY
    tl2.task_id
) tl_running ON t.id = tl_running.task_id
JOIN (
  SELECT UUID_TO_BIN(VARIABLE_VALUE, 1) AS server_uuid
  FROM performance_schema.global_variables
  WHERE VARIABLE_NAME = 'server_uuid'
) server_info ON 1 = 1;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task_list`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task_list`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task_list`(
  `app_user_id` VARCHAR(36),
  `task_type` VARCHAR(80),
  `offset` INT UNSIGNED,
  `limit` INT UNSIGNED
)
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  DECLARE tasks JSON DEFAULT NULL;

  IF `task_type` IS NULL THEN
    SET `task_type` = '%';
  END IF;

  IF `offset` IS NULL THEN
    SET `offset` = 0;
  END IF;

  IF `limit` IS NULL THEN
    SET `limit` = 20;
  END IF;

  SELECT /*+ SET_VAR(use_secondary_engine=off) */ JSON_ARRAYAGG(
    JSON_OBJECT(
      'id', BIN_TO_UUID(t.id, 1),
      'name', t.name,
      'connection_id', t.connection_id,
      'task_type', t.task_type,
      'data', t.data
  )) INTO tasks
  FROM (
    SELECT t1.id, t1.name, t1.connection_id,
           t1.task_type, t1.data
    FROM
      `mysql_tasks`.`task_impl` t1
    WHERE
      (LEFT(t1.`mysql_user`, (LENGTH(t1.`mysql_user`) - locate('@', reverse(t1.`mysql_user`)))) =
        LEFT(user(),(length(user()) - locate('@', reverse(user())))))
      AND (`app_user_id` IS NULL OR t1.app_user_id = UUID_TO_BIN(`app_user_id`, 1))
      AND t1.task_type LIKE `task_type`
    ORDER BY t1.id DESC
    LIMIT `limit` OFFSET `offset`
  ) t;

  RETURN tasks;
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`task_list`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`task_list`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`task_list`(
  `task_type` VARCHAR(80),
  `offset` INT UNSIGNED,
  `limit` INT UNSIGNED
)
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY INVOKER
BEGIN
  RETURN (
    SELECT `mysql_tasks`.`app_task_list`(NULL, `task_type`, `offset`, `limit`)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task`(
    app_user_id VARCHAR(36),
    id_or_alias VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  DECLARE tasks JSON DEFAULT NULL;
  DECLARE task_id VARCHAR(36);

  SELECT `mysql_tasks`.`get_task_id`(id_or_alias) INTO task_id;

  SELECT /*+ SET_VAR(use_secondary_engine=off) */
    JSON_OBJECT(
      'id', BIN_TO_UUID(t.id, 1),
      'alias', t.alias,
      'name', t.name,
      'connection_id', t.connection_id,
      'task_type', t.task_type,
      'data', t.data,
      'data_json_schema', t.data_json_schema,
      'log_data_json_schema', t.log_data_json_schema
  ) INTO tasks
  FROM
    `mysql_tasks`.`task_impl` t
  WHERE
    (LEFT(t.`mysql_user`, (LENGTH(t.`mysql_user`) - locate('@', reverse(t.`mysql_user`)))) =
      LEFT(user(),(length(user()) - locate('@', reverse(user())))))
    AND (`app_user_id` IS NULL OR t.app_user_id = UUID_TO_BIN(`app_user_id`, 1))
    AND t.id = UUID_TO_BIN(`task_id`, 1);

  RETURN tasks;
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`task`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`task`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`task`(
    id_or_alias VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT `mysql_tasks`.`app_task`(NULL, id_or_alias)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task_logs`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task_logs`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task_logs`(
    app_user_id VARCHAR(36),
    id_or_alias VARCHAR(36),
    newer_than_log_time TIMESTAMP(6)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  DECLARE task_logs JSON DEFAULT NULL;
  DECLARE task_id VARCHAR(36);

  SELECT `mysql_tasks`.`get_task_id`(id_or_alias) INTO task_id;

  SELECT /*+ SET_VAR(use_secondary_engine=off) */ JSON_ARRAYAGG(
    JSON_OBJECT(
      'id', BIN_TO_UUID(tl.id, 1),
      'task_id', BIN_TO_UUID(tl.task_id, 1),
      'log_time', tl.log_time,
      'message', tl.message,
      'data', tl.data,
      'progress', tl.progress,
      'status', tl.status
  )) INTO task_logs
  FROM
    `mysql_tasks`.`task_log_impl` tl
  JOIN
    `mysql_tasks`.`task_impl` t
  ON
    tl.task_id = t.id
  WHERE
    (LEFT(tl.`mysql_user`, (LENGTH(tl.`mysql_user`) - locate('@', reverse(tl.`mysql_user`)))) =
      LEFT(user(),(length(user()) - locate('@', reverse(user())))))
    AND (`app_user_id` IS NULL OR t.app_user_id = UUID_TO_BIN(`app_user_id`, 1))
    AND tl.task_id = UUID_TO_BIN(`task_id`, 1)
    AND tl.log_time > COALESCE(unix_timestamp(newer_than_log_time), '1970-01-01')
  ORDER BY tl.log_time DESC;

  RETURN task_logs;
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`task_logs`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`task_logs`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`task_logs`(
    id_or_alias VARCHAR(36),
    newer_than_log_time TIMESTAMP(6)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT `mysql_tasks`.`app_task_logs`(NULL, id_or_alias, newer_than_log_time)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task_status_list`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task_status_list`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task_status_list`(
    `app_user_id` VARCHAR(36),
    `task_type` VARCHAR(80),
    `offset` INT UNSIGNED,
    `limit` INT UNSIGNED
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN

  IF `task_type` IS NULL THEN
    SET `task_type` = '%';
  END IF;

  IF `offset` IS NULL THEN
    SET `offset` = 0;
  END IF;

  IF `limit` IS NULL THEN
    SET `limit` = 20;
  END IF;

  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */ JSON_ARRAYAGG(
      JSON_OBJECT(
        'id', sq.id,
        'alias', sq.alias,
        'server_uuid', BIN_TO_UUID(sq.server_uuid, 1),
        'name', sq.name,
        'task_type', sq.task_type,
        'task_data', sq.data,
        'data', sq.log_data,
        'message', sq.message,
        'progress', sq.progress,
        'status', sq.status,
        'scheduled_time', sq.scheduled_time,
        'starting_time', sq.starting_time,
        'estimated_completion_time', sq.estimated_completion_time,
        'estimated_remaining_time', sq.estimated_remaining_time,
        'progress_bar', sq.progress_bar,
        'row_hash', MD5(CONCAT_WS(',',
            sq.status, sq.message, sq.progress, sq.data, sq.log_data, sq.scheduled_time,
            sq.starting_time, sq.estimated_completion_time, sq.estimated_remaining_time
          )
        )
      )
    )
    FROM (
      SELECT * FROM
        `mysql_tasks`.`task_status_impl` tsi
      WHERE
        LEFT(tsi.mysql_user, LENGTH(tsi.mysql_user) - LOCATE('@', REVERSE(tsi.mysql_user))) =
        LEFT(SESSION_USER(), LENGTH(SESSION_USER()) - LOCATE('@', REVERSE(SESSION_USER())))
        AND (`app_user_id` IS NULL OR tsi.app_user_id = UUID_TO_BIN(`app_user_id`, 1))
        AND tsi.task_type LIKE `task_type`
      ORDER BY tsi.id DESC
      LIMIT `limit` OFFSET `offset`
    ) sq
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`task_status_list`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`task_status_list`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`task_status_list`(
    `task_type` VARCHAR(80),
    `offset` INT UNSIGNED,
    `limit` INT UNSIGNED
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT `mysql_tasks`.`app_task_status_list`(NULL, `task_type`, `offset`, `limit`)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task_status`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task_status`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task_status`(
    app_user_id VARCHAR(36),
    id_or_alias VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  DECLARE task_id VARCHAR(36);

  SELECT `mysql_tasks`.`get_task_id`(id_or_alias) INTO task_id;

  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
      JSON_OBJECT(
        'id', BIN_TO_UUID(sq.id, 1),
        'alias', sq.alias,
        'server_uuid', BIN_TO_UUID(sq.server_uuid, 1),
        'name', sq.name,
        'connection_id', sq.connection_id,
        'task_type', sq.task_type,
        'task_data', sq.data,
        'data', sq.log_data,
        'message', sq.message,
        'progress', sq.progress,
        'status', sq.status,
        'scheduled_time', sq.scheduled_time,
        'starting_time', sq.starting_time,
        'estimated_completion_time', sq.estimated_completion_time,
        'estimated_remaining_time', sq.estimated_remaining_time,
        'progress_bar', sq.progress_bar,
        'row_hash', MD5(CONCAT_WS(',',
            sq.status, sq.message, sq.progress, sq.data, sq.log_data, sq.scheduled_time,
            sq.starting_time, sq.estimated_completion_time, sq.estimated_remaining_time
          )
        )
      )
    FROM (
      SELECT * FROM
        `mysql_tasks`.`task_status_impl` tsi
      WHERE
        LEFT(tsi.mysql_user, LENGTH(tsi.mysql_user) - LOCATE('@', REVERSE(tsi.mysql_user))) =
        LEFT(SESSION_USER(), LENGTH(SESSION_USER()) - LOCATE('@', REVERSE(SESSION_USER())))
        AND (`app_user_id` IS NULL OR tsi.app_user_id = UUID_TO_BIN(`app_user_id`, 1))
        AND tsi.id = UUID_TO_BIN(`task_id`, 1)
    ) sq
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`task_status`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`task_status`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`task_status`(
    id_or_alias VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT `mysql_tasks`.`app_task_status`(NULL, id_or_alias)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`app_task_status_brief`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`app_task_status_brief`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`app_task_status_brief`(
    app_user_id VARCHAR(36),
    id_or_alias VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN

  DECLARE task_id VARCHAR(36);

  SELECT `mysql_tasks`.`get_task_id`(id_or_alias) INTO task_id;

  RETURN (
    SELECT /*+ SET_VAR(use_secondary_engine=off) */
      JSON_OBJECT(
        'data', sq.log_data,
        'message', sq.message,
        'progress', sq.progress,
        'status', sq.status
      )
    FROM (
      SELECT * FROM
        `mysql_tasks`.`task_status_impl` tsi
      WHERE
        LEFT(tsi.mysql_user, LENGTH(tsi.mysql_user) - LOCATE('@', REVERSE(tsi.mysql_user))) =
        LEFT(SESSION_USER(), LENGTH(SESSION_USER()) - LOCATE('@', REVERSE(SESSION_USER())))
        AND (`app_user_id` IS NULL OR tsi.app_user_id = UUID_TO_BIN(`app_user_id`, 1))
        AND tsi.id = UUID_TO_BIN(`task_id`, 1)
      LIMIT 1
    ) sq
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`task_status_brief`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`task_status_brief`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`task_status_brief`(
    id_or_alias VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT `mysql_tasks`.`app_task_status_brief`(NULL, id_or_alias)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`find_task_log_msg`
--   for internal use
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`find_task_log_msg`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`find_task_log_msg`(
    task_id VARCHAR(36),
    log_msg TEXT
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  DECLARE task_log JSON DEFAULT NULL;

  SELECT /*+ SET_VAR(use_secondary_engine=off) */ JSON_OBJECT(
    'id', BIN_TO_UUID(tl.id, 1),
    'log_time', tl.log_time,
    'data', tl.data,
    'progress', tl.progress,
    'status', tl.status
  ) INTO task_log
  FROM `mysql_tasks`.`task_log_impl` tl
  WHERE
    tl.task_id = UUID_TO_BIN(`task_id`, 1)
    AND tl.message = log_msg;

  RETURN task_log;
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_task_log_data_json_schema`
--   for internal use
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_task_log_data_json_schema`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_task_log_data_json_schema`(
    task_id VARCHAR(36)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT
      t.log_data_json_schema
    FROM `mysql_tasks`.`task_impl` t
    WHERE
      t.id = UUID_TO_BIN(`task_id`, 1)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_task_connection_id`
--   for internal use
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_task_connection_id`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_task_connection_id`(
    task_id VARCHAR(36)
  )
  RETURNS BIGINT UNSIGNED
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT
      t.connection_id
    FROM `mysql_tasks`.`task_impl` t
    WHERE
      t.id = UUID_TO_BIN(`task_id`, 1)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`active_task_count`
--   for internal use
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`active_task_count`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`active_task_count`()
  RETURNS INT UNSIGNED
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT COUNT(active_task.task_id) FROM (
      SELECT
        DISTINCT(tl.task_id) AS task_id
      FROM
        `mysql_tasks`.`task_log_impl` tl
      JOIN
        `mysql_tasks`.`task_impl` t
      ON
        tl.task_id = t.id
      WHERE
        tl.status IN ('RUNNING', 'SCHEDULED')
      AND tl.task_id NOT IN (
        SELECT DISTINCT(tli.task_id)
        FROM
          `mysql_tasks`.`task_log_impl` tli
        WHERE
          tli.status IN ('COMPLETED', 'ERROR', 'CANCELLED')
      )
    ) active_task
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_app_task_ids_from_alias`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_app_task_ids_from_alias`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_app_task_ids_from_alias`(
    app_user_id VARCHAR(36),
    alias VARCHAR(16)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT JSON_ARRAYAGG(
      BIN_TO_UUID(t.id, 1)
    )
    FROM
      `mysql_tasks`.`task_impl` t
    WHERE
      LEFT(t.mysql_user, LENGTH(t.mysql_user) - LOCATE('@', REVERSE(t.mysql_user))) =
      LEFT(SESSION_USER(), LENGTH(SESSION_USER()) - LOCATE('@', REVERSE(SESSION_USER())))
      AND (`app_user_id` IS NULL OR t.app_user_id = UUID_TO_BIN(`app_user_id`, 1))
      AND t.alias = alias
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_task_ids_from_alias`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_task_ids_from_alias`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_task_ids_from_alias`(
    alias VARCHAR(16)
  )
  RETURNS JSON
  READS SQL DATA
  SQL SECURITY DEFINER
BEGIN
  RETURN (
    SELECT `mysql_tasks`.`get_app_task_ids_from_alias`(NULL, alias)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_app_task_id`
--   for internal use
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_app_task_id`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_app_task_id`(
    app_user_id VARCHAR(36),
    id_or_alias VARCHAR(36)
  )
  RETURNS VARCHAR(36)
  READS SQL DATA
  SQL SECURITY INVOKER
BEGIN
  DECLARE task_ids JSON;
  DECLARE task_id VARCHAR(36);

  IF (CHAR_LENGTH(id_or_alias) = 36) THEN
    -- If argument has the exact length of UUID, assume task_id is provided
    SELECT id_or_alias INTO task_id;
  ELSE
    -- Otherwise, assume alias is provided

    -- Replace task_alias with task_id
    SELECT `mysql_tasks`.`get_app_task_ids_from_alias`(app_user_id, id_or_alias) INTO task_ids;

    IF JSON_LENGTH(task_ids) > 1 THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Multiple tasks for this alias, re-run using a task_id. For a list IDs: SELECT mysql_tasks.get_task_ids_from_alias(alias);';
    END IF;

    SELECT task_ids->>'$[0]' INTO task_id;
  END IF;

  RETURN task_id;
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_task_id`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_task_id`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_task_id`(
    id_or_alias VARCHAR(36)
  )
  RETURNS VARCHAR(36)
  READS SQL DATA
  SQL SECURITY INVOKER
BEGIN
  RETURN (
    SELECT `mysql_tasks`.`get_app_task_id`(NULL, id_or_alias)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_app_task_alias`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_app_task_alias`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_app_task_alias`(
    app_user_id VARCHAR(36),
    id VARCHAR(36)
  )
  RETURNS VARCHAR(16)
  READS SQL DATA
  SQL SECURITY INVOKER
BEGIN
  DECLARE task_info JSON;
  SELECT `mysql_tasks`.`app_task`(app_user_id, id) INTO task_info;
  RETURN task_info->>'$.alias';
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Function `mysql_tasks`.`get_task_alias`
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`get_task_alias`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`get_task_alias`(
    id VARCHAR(36)
  )
  RETURNS VARCHAR(16)
  READS SQL DATA
  SQL SECURITY INVOKER
BEGIN
  RETURN (
    SELECT `mysql_tasks`.`get_app_task_alias`(NULL, id)
  );
END $$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`create_app_task`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`create_app_task`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`create_app_task`(
  IN `app_user_id` VARCHAR(36),
	IN `name` VARCHAR(255), IN `task_type` VARCHAR(45), IN `data` JSON,
  IN `data_json_schema` JSON, IN `log_data_json_schema` JSON,
  OUT `task_id` VARCHAR(36))
SQL SECURITY INVOKER
BEGIN
  SET task_id = UUID();
  CALL `mysql_tasks`.`create_app_task_with_id`(`app_user_id`, task_id, `name`, task_type, `data`, `data_json_schema`, `log_data_json_schema`);
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`create_app_task_with_id`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`create_app_task_with_id`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`create_app_task_with_id`(
  IN `app_user_id` VARCHAR(36),
  IN `id` VARCHAR(36), IN `name` VARCHAR(255), IN `task_type` VARCHAR(45), IN `data` JSON,
  IN `data_json_schema` JSON, IN `log_data_json_schema` JSON)
SQL SECURITY INVOKER
BEGIN
  -- insert entry into task table
  INSERT INTO `mysql_tasks`.`task_i`(`id`, `app_user_id`, `server_uuid`, `name`, `connection_id`, `task_type`, `data`, `data_json_schema`, `log_data_json_schema`)
    VALUES (UUID_TO_BIN(id, 1), UUID_TO_BIN(app_user_id, 1), UUID_TO_BIN(@@server_uuid, 1), `name`, CONNECTION_ID(), task_type, `data`, `data_json_schema`, `log_data_json_schema`);

  IF `data_json_schema` IS NOT NULL AND NOT JSON_SCHEMA_VALID(`data_json_schema`, `data`) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'The provided task data does not conform to the given data_json_schema.',
      MYSQL_ERRNO = 5400;
  END IF;

  CALL `mysql_tasks`.`add_task_log`(id, 'Task created by user.', NULL, 0, 'SCHEDULED');
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`create_task`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`create_task`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`create_task`(
	IN `name` VARCHAR(255), IN `task_type` VARCHAR(45), IN `data` JSON, OUT `task_id` VARCHAR(36))
SQL SECURITY INVOKER
BEGIN
  CALL `mysql_tasks`.`create_app_task`(NULL, `name`, task_type, `data`, NULL, NULL, `task_id`);
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`create_task_with_id`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`create_task_with_id`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`create_task_with_id`(
  IN `id` VARCHAR(36), IN `name` VARCHAR(255), IN `task_type` VARCHAR(45), IN `data` JSON)
SQL SECURITY INVOKER
BEGIN
  CALL `mysql_tasks`.`create_app_task_with_id`(NULL, `id`, `name`, `task_type`, `data`, NULL, NULL);
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`add_task_log`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`add_task_log`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`add_task_log`(
  IN `task_id` VARCHAR(36), IN `message` VARCHAR(2000), IN `data` JSON,
  IN `progress` SMALLINT, IN `status` ENUM('SCHEDULED', 'RUNNING', 'COMPLETED', 'ERROR', 'CANCELLED'))
SQL SECURITY INVOKER
BEGIN
  DECLARE log_id BINARY(16) DEFAULT UUID_TO_BIN(UUID(), 1);
  DECLARE log_data_json_schema JSON DEFAULT NULL;

  SELECT `mysql_tasks`.`get_task_log_data_json_schema`(task_id) INTO log_data_json_schema;

  IF `log_data_json_schema` IS NOT NULL AND NOT JSON_SCHEMA_VALID(`log_data_json_schema`, `data`) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'The provided log data does not conform to the given log_data_json_schema.',
      MYSQL_ERRNO = 5400;
  END IF;

  INSERT INTO `mysql_tasks`.`task_log_i` (`id`, `task_id`, `log_time`, `message`, `data`, `progress`, `status`)
    VALUES (log_id, UUID_TO_BIN(task_id, 1), NOW(6), message, `data`, progress, `status`);
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`kill_app_task`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`kill_app_task`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`kill_app_task`(IN `app_user_id` VARCHAR(36), IN `id_or_alias` VARCHAR(36))
    SQL SECURITY INVOKER
BEGIN
  DECLARE task_id VARCHAR(36);
  DECLARE task_status JSON DEFAULT NULL;

  DECLARE status TEXT DEFAULT NULL;
  DECLARE suuid VARCHAR(36) DEFAULT NULL;
  DECLARE cid BIGINT UNSIGNED DEFAULT NULL;
  DECLARE i INT DEFAULT 0;
  DECLARE event_name TEXT DEFAULT NULL;

  SELECT `mysql_tasks`.`get_app_task_id`(app_user_id, id_or_alias) INTO task_id;

  SELECT `mysql_tasks`.`app_task_status`(app_user_id, task_id) INTO task_status;

  IF task_status IS NULL THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Task does not exist or not allowed to access it.';
  END IF;

  SET status = JSON_UNQUOTE(JSON_EXTRACT(task_status, '$.status'));
  SET suuid = JSON_UNQUOTE(JSON_EXTRACT(task_status, '$.server_uuid'));
  SET cid = JSON_UNQUOTE(JSON_EXTRACT(task_status, '$.connection_id'));

  IF suuid <> @@server_uuid THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Tasks started on other servers cannot be killed.';
  END IF;

  IF (status <> 'RUNNING' AND status <> 'SCHEDULED') THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Task inactive.';
  END IF;

  -- kill process
  SET @stmt = CONCAT('KILL ', cid);
  PREPARE stmt FROM @stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

  -- drop associated events
  IF JSON_CONTAINS_PATH(task_status, 'one', '$.data.events') THEN
    WHILE i < JSON_LENGTH(task_status->'$.data.events') DO
      SET event_name = JSON_UNQUOTE(JSON_EXTRACT(task_status->'$.data.events', CONCAT('$[',i,']')));
      CALL `mysql_tasks`.`drop_event`(event_name);
      SELECT i+1 INTO i;
    END WHILE;
  END IF;

  CALL `mysql_tasks`.`add_task_log`(task_id, 'Cancelled by user.', NULL, 100, 'CANCELLED');

END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`kill_task`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`kill_task`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`kill_task`(IN `id_or_alias` VARCHAR(36))
    SQL SECURITY INVOKER
BEGIN
  CALL `mysql_tasks`.`kill_app_task`(NULL, id_or_alias);
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`drop_event`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`drop_event`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`drop_event`(IN `event_name` TEXT)
  SQL SECURITY INVOKER
BEGIN
  DECLARE event_cmnt TEXT DEFAULT NULL;
  DECLARE version_string VARCHAR(255);
  DECLARE major INT UNSIGNED;
  DECLARE minor INT UNSIGNED;
  DECLARE patch INT UNSIGNED;
  DECLARE task_mgmt_major INT UNSIGNED;
  DECLARE task_mgmt_minor INT UNSIGNED;
  DECLARE task_mgmt_patch INT UNSIGNED;

  -- get schema version
  SELECT
    /*+ SET_VAR(use_secondary_engine=off) */
    v.major, v.minor, v.patch INTO task_mgmt_major, task_mgmt_minor, task_mgmt_patch
  FROM
    `mysql_tasks`.`schema_version` v;

  -- get comment from the runner event
  SELECT
    /*+ SET_VAR(use_secondary_engine=off) */
    EVENT_COMMENT INTO event_cmnt
  FROM
    information_schema.events e
  WHERE
    CONCAT(mysql_tasks.quote_identifier(e.EVENT_SCHEMA), '.', mysql_tasks.quote_identifier(e.EVENT_NAME)) = `event_name`
    AND e.EVENT_COMMENT LIKE 'mysql_tasks_schema_version=%';

  SET version_string = SUBSTRING_INDEX(event_cmnt, 'mysql_tasks_schema_version=', -1); -- Get the part after "="
  SET major = CAST(SUBSTRING_INDEX(version_string, '.', 1) AS UNSIGNED);
  SET minor = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(version_string, '.', 2), '.', -1) AS UNSIGNED);
  SET patch = CAST(SUBSTRING_INDEX(version_string, '.', -1) AS UNSIGNED);

  -- drop event if it has the comment with the supported version
  IF (event_cmnt IS NOT NULL)
    AND (major < task_mgmt_major OR (major = task_mgmt_major
    AND (minor < task_mgmt_minor OR (minor = task_mgmt_minor
    AND patch <= task_mgmt_patch))))
  THEN
    SET @stmt = CONCAT('DROP EVENT IF EXISTS ', event_name);
    PREPARE stmt FROM @stmt;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;

END $$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`execute_prepared_stmt_async_for_app`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`execute_prepared_stmt_async_for_app`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`execute_prepared_stmt_async_for_app`(
  IN `sql_statements` TEXT,
  IN `app_user_id` VARCHAR(36),
  IN `schema_name` VARCHAR(255),
  IN `task_name` VARCHAR(45),
  IN `task_data` JSON,
  IN `data_json_schema` JSON,
  IN `log_data_json_schema` JSON,
  IN `progress_monitor_sql_statements` TEXT,
  OUT task_id VARCHAR(36))
  SQL SECURITY INVOKER
BEGIN
  DECLARE event_name, progress_event_name TEXT DEFAULT NULL;
  DECLARE task_mgmt_version TEXT DEFAULT NULL;
  DECLARE max_parallel_tasks INT UNSIGNED DEFAULT NULL;
  DECLARE active_task_cnt INT UNSIGNED DEFAULT NULL;
  DECLARE internal_data JSON DEFAULT NULL;
  DECLARE internal_data_json_schema JSON DEFAULT NULL;
  DECLARE data_json_schema_required JSON DEFAULT NULL;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
      GET DIAGNOSTICS CONDITION 1 @p1 = RETURNED_SQLSTATE, @p2 = MYSQL_ERRNO, @p3 = MESSAGE_TEXT;
      SELECT RELEASE_LOCK('execute_prepared_stmt_async') INTO @__lock;
      SET @__lock = NULL;
      IF @p3 = 'No schema set.' THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'No schema set. Please pass in the schema name or set the current schema with USE.',
          MYSQL_ERRNO = 5400;
      ELSE
        RESIGNAL;
      END IF;
  END;

  SELECT
    /*+ SET_VAR(use_secondary_engine=off) */
    JSON_EXTRACT(data, '$.limits.maximumPreparedStmtAsyncTasks') INTO max_parallel_tasks
  FROM
    `mysql_tasks`.`config`
  WHERE id = 1
  LIMIT 1;

  IF task_name IS NULL THEN
    SET task_name = 'execute_prepared_stmt_async';
  END IF;

  IF schema_name IS NULL THEN
    SELECT
      /*+ SET_VAR(use_secondary_engine=off) */
      current_schema INTO schema_name
    FROM
      `performance_schema`.`events_statements_current`
    WHERE
      thread_id=PS_CURRENT_THREAD_ID()
      AND nesting_event_level=0;
  END IF;
  IF schema_name IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No schema set.', MYSQL_ERRNO = 5400;
  END IF;

  -- ensure the SQL statements end with a semicolon
  IF NOT REGEXP_LIKE(sql_statements, ';[:space:]*$') THEN
    SET sql_statements = CONCAT(sql_statements, '; ');
  END IF;

  -- ensure the progress monitor SQL statements end with a semicolon
  IF NOT REGEXP_LIKE(progress_monitor_sql_statements, ';[:space:]*$') THEN
    SET progress_monitor_sql_statements = CONCAT(progress_monitor_sql_statements, '; ');
  END IF;

  -- make sure the reserved property is not used
  IF JSON_CONTAINS_PATH(data_json_schema, 'one', '$.properties.mysqlMetadata') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'data_json_schema must not contain a reserved property "mysqlMetadata".', MYSQL_ERRNO = 5400;
  END IF;

  SET internal_data_json_schema = JSON_OBJECT(
    "type", "object",
    "properties", JSON_OBJECT(
      "mysqlMetadata", JSON_OBJECT(
        "type", "object",
        "properties", JSON_OBJECT(
          "events", JSON_OBJECT(
            "type", "array",
            "items", JSON_OBJECT(
              "type", "string"
            ),
            "minItems", 1,
            "uniqueItems", true
          ),
          "autoGc", JSON_OBJECT(
            "type", "boolean"
          )
        ),
        "required", JSON_ARRAY("events", "autoGc")
      )
    ),
    "required", JSON_ARRAY("mysqlMetadata")
  );

  -- merge the provided schema and the internal schema
  SET data_json_schema = COALESCE(data_json_schema, JSON_OBJECT("required", JSON_ARRAY()));
  SELECT JSON_UNQUOTE(JSON_MERGE_PRESERVE(JSON_EXTRACT(internal_data_json_schema, '$.required'), JSON_EXTRACT(data_json_schema, '$.required'))) INTO data_json_schema_required;
  SET data_json_schema = JSON_MERGE_PATCH(internal_data_json_schema, data_json_schema);
  SET data_json_schema = JSON_SET(data_json_schema, '$.required', data_json_schema_required);

  SELECT /*+ SET_VAR(use_secondary_engine=off) */ CONCAT(mysql_tasks.quote_identifier(schema_name), '.', mysql_tasks.quote_identifier(UUID())) INTO event_name;
  SELECT /*+ SET_VAR(use_secondary_engine=off) */ CONCAT(mysql_tasks.quote_identifier(schema_name), '.', mysql_tasks.quote_identifier(UUID())) INTO progress_event_name;
  SELECT /*+ SET_VAR(use_secondary_engine=off) */ CONCAT(major, '.', minor, '.', patch) FROM `mysql_tasks`.`schema_version` INTO task_mgmt_version;

  SET internal_data = JSON_OBJECT(
    "mysqlMetadata", JSON_OBJECT(
      "events", IF (progress_monitor_sql_statements IS NULL, JSON_ARRAY(event_name), JSON_ARRAY(event_name, progress_event_name)),
      "autoGc", true
    )
  );

  -- make sure reserved property is not used
  IF JSON_CONTAINS_PATH(task_data, 'one', '$.mysqlMetadata') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'task_data must not contain a reserved property "mysqlMetadata".', MYSQL_ERRNO = 5400;
  END IF;

  -- merge the provided task data and the internal metadata
  SET task_data = COALESCE(task_data, JSON_OBJECT());
  SET task_data = JSON_MERGE_PATCH(internal_data, task_data);

  SELECT GET_LOCK('execute_prepared_stmt_async', 2) INTO @__lock;
  IF @__lock = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot acquire lock. Try again later', MYSQL_ERRNO = 5400;
  END IF;

  -- READ COMMITTED does not acquire lock on the task_log table,
  -- avoiding a potential deadlock between this SELECT and INSERTS in concurrent events
  SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
  SELECT `mysql_tasks`.`active_task_count`() INTO active_task_cnt;
  COMMIT ;

  IF active_task_cnt >= max_parallel_tasks THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Maximum number of parallel tasks reached, try again later.', MYSQL_ERRNO = 5400;
  END IF;

  SET task_id = UUID();

  SET @eventSql = CONCAT(
    'CREATE EVENT ', event_name, ' ',
    'ON SCHEDULE AT NOW() ON COMPLETION NOT PRESERVE ENABLE ',
    'COMMENT "mysql_tasks_schema_version=', task_mgmt_version, '" ',
    'DO BEGIN ',
    'DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ',
    '  GET DIAGNOSTICS CONDITION 1 @p1 = RETURNED_SQLSTATE, @p2 = MYSQL_ERRNO, @p3 = MESSAGE_TEXT; ',
    '  CALL `mysql_tasks`.`add_task_log`("', task_id, '", CONCAT("Error: ", @p3), NULL, 100, "ERROR"); ',
    '  DROP EVENT IF EXISTS', progress_event_name, '; ',
    'END; ',
    'SET @task_id ="', task_id, '"; SET @task_result = NULL; ',
    'SET @connection_id = CONNECTION_ID(); ',
    'CALL `mysql_tasks`.`create_app_task_with_id`(', IF(app_user_id IS NULL, 'NULL', QUOTE(app_user_id)), ', @task_id, "', task_name, '", "Async_SQL", ',
      QUOTE(task_data), ', ',
      QUOTE(data_json_schema), ', ',
      QUOTE(log_data_json_schema),
    '); ',

    IF (progress_monitor_sql_statements IS NULL, '', CONCAT(
    'SET @sql = ''CREATE EVENT ', progress_event_name, ' ON SCHEDULE EVERY 5 SECOND ',
    'DO BEGIN ',
    'SET @task_id ="', task_id, '"; ',
    progress_monitor_sql_statements,
    'END;''; ',
    'PREPARE ds FROM @sql; ',
    'EXECUTE ds; ',
    'DEALLOCATE PREPARE ds; ')
    ),

    'CALL `mysql_tasks`.`add_task_log`(@task_id, "Event execution started...", NULL, 0, "RUNNING"); ',
    sql_statements,
    'CALL `mysql_tasks`.`add_task_log`(@task_id, "Execution finished.", CAST(@task_result AS JSON), 100, "COMPLETED"); ',
    'DROP EVENT IF EXISTS', progress_event_name, '; ',
    'END;');

  PREPARE dynamic_statement FROM @eventSql;
  EXECUTE dynamic_statement;
  DEALLOCATE PREPARE dynamic_statement;

  SELECT RELEASE_LOCK('execute_prepared_stmt_async') INTO @__lock;
  SET @__lock = NULL;
END$$
DELIMITER ;

-- -----------------------------------------------------
-- Procedure `mysql_tasks`.`execute_prepared_stmt_async`
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS `mysql_tasks`.`execute_prepared_stmt_async`;
DELIMITER $$
CREATE PROCEDURE `mysql_tasks`.`execute_prepared_stmt_async`(
  IN `sql_statements` TEXT,
  IN `schema_name` VARCHAR(255),
  IN `task_name` VARCHAR(45),
  IN `task_data` JSON,
  OUT task_id VARCHAR(36))
  SQL SECURITY INVOKER
BEGIN
  CALL `mysql_tasks`.`execute_prepared_stmt_async_for_app`(
    `sql_statements`, NULL, `schema_name`, `task_name`, `task_data`, NULL, NULL, NULL, task_id);
END$$
DELIMITER ;

-- -----------------------------------------------------
-- EVENT `mysql_tasks`.`task_cleanup`
-- -----------------------------------------------------
DROP EVENT IF EXISTS `mysql_tasks`.`task_cleanup`;
DELIMITER $$
CREATE EVENT `mysql_tasks`.`task_cleanup` ON SCHEDULE EVERY 1 DAY
ON COMPLETION NOT PRESERVE ENABLE COMMENT 'Clean up old tasks' DO
BEGIN
  DECLARE task_ids_to_del JSON DEFAULT NULL;

  -- find all tasks with last tog time
  -- more than 6 days old from the current date
  SELECT /*+ SET_VAR(use_secondary_engine=off) */ JSON_ARRAYAGG(
    BIN_TO_UUID(last_tl.task_id, 1)
  ) INTO @task_ids_to_del
  FROM (
    SELECT
      task_id,
      MAX(log_time) AS last_log_time
    FROM
      `mysql_tasks`.`task_log_impl`
    GROUP BY
      task_id
  ) tl
  LEFT OUTER JOIN
    `mysql_tasks`.`task_log_impl`  last_tl
    ON tl.task_id = last_tl.task_id AND tl.last_log_time = last_tl.log_time
  WHERE (last_tl.status <> 'SCHEDULED' AND last_tl.status <> 'RUNNING')
    AND last_tl.log_time < DATE_SUB(CURDATE(), INTERVAL 6 DAY);

  -- delete all old tasks
  DELETE FROM
    `mysql_tasks`.`task_impl`
  WHERE BIN_TO_UUID(id, 1) MEMBER OF(@task_ids_to_del);

END$$
DELIMITER ;

-- -----------------------------------------------------
-- EVENT `mysql_tasks`.`task_gc`
-- -----------------------------------------------------
DROP EVENT IF EXISTS `mysql_tasks`.`task_gc`;
DELIMITER $$
CREATE EVENT `mysql_tasks`.`task_gc` ON SCHEDULE EVERY 1 MINUTE
ON COMPLETION NOT PRESERVE ENABLE COMMENT 'Garbage collector' DO
BEGIN
  DECLARE i, j INT DEFAULT 0;
  DECLARE json_id JSON DEFAULT NULL;
  DECLARE json_user JSON DEFAULT NULL;
  DECLARE json_data JSON DEFAULT NULL;
  DECLARE curr_id VARCHAR(36) DEFAULT NULL;
  DECLARE curr_user TEXT DEFAULT NULL;
  DECLARE curr_data JSON DEFAULT NULL;
  DECLARE event_name TEXT DEFAULT NULL;

  -- Find active tasks without alive process
  SELECT /*+ SET_VAR(use_secondary_engine=off) */
  JSON_ARRAYAGG(BIN_TO_UUID(t.id, 1)), JSON_ARRAYAGG(t.mysql_user), JSON_ARRAYAGG(t.data) INTO json_id, json_user, json_data
  FROM `mysql_tasks`.`task_log_impl` tl
  JOIN (
    SELECT task_id, MAX(log_time) AS max_log_time, MAX(id) AS max_id
    FROM `mysql_tasks`.`task_log_impl`
    GROUP BY task_id
  ) tl2
  ON tl.log_time = tl2.max_log_time
  JOIN `mysql_tasks`.`task_impl` t
  ON tl.task_id = t.id
  LEFT JOIN `performance_schema`.`processlist` p ON t.connection_id = p.id
  WHERE
    (tl.status = 'RUNNING' OR tl.status = 'SCHEDULED')
    AND p.id IS NULL
    AND t.server_uuid = UUID_TO_BIN(@@server_uuid, 1)
    AND t.data->'$.autoGc' = true;

  WHILE i < JSON_LENGTH(json_id) DO
    SET curr_id = JSON_UNQUOTE(JSON_EXTRACT(json_id, CONCAT('$[', i, ']')));
    SET curr_user = JSON_UNQUOTE(JSON_EXTRACT(json_user, CONCAT('$[', i, ']')));
    SET curr_data = JSON_EXTRACT(json_data, CONCAT('$[', i, ']'));

    IF curr_data IS NOT NULL AND JSON_CONTAINS_PATH(curr_data, 'one', '$.events')  THEN
      SET j = 0;
      WHILE j < JSON_LENGTH(JSON_EXTRACT(curr_data, '$.events')) DO
        SET event_name = JSON_UNQUOTE(JSON_EXTRACT(curr_data, CONCAT('$.events[', j, ']')));
        CALL `mysql_tasks`.`drop_event`(event_name);
        SET j = j + 1;
      END WHILE;
    END IF;

    IF curr_id IS NOT NULL THEN
      INSERT INTO `mysql_tasks`.`task_log_impl` (`id`, `mysql_user`, `task_id`, `log_time`, `message`, `data`, `progress`, `status`)
        VALUES (UUID_TO_BIN(UUID(), 1), curr_user, UUID_TO_BIN(curr_id, 1), NOW(6), 'Cleaned up by system.', NULL, 100, 'CANCELLED');
    END IF;

    SELECT i + 1 INTO i;
  END WHILE;

  -- Find dangling events from tasks which are no longer running
  SELECT /*+ SET_VAR(use_secondary_engine=off) */
  JSON_ARRAYAGG(BIN_TO_UUID(t.id, 1)), JSON_ARRAYAGG(t.data) INTO json_id, json_data
  FROM `mysql_tasks`.`task_log_impl` tl
  JOIN (
    SELECT task_id, MAX(log_time) AS max_log_time, MAX(id) AS max_id
    FROM `mysql_tasks`.`task_log_impl`
    GROUP BY task_id
  ) tl2
  ON tl.log_time = tl2.max_log_time
  JOIN `mysql_tasks`.`task_impl` t
  ON tl.task_id = t.id
  JOIN information_schema.events ise
    ON JSON_UNQUOTE(t.data->'$.events[0]') =  CONCAT(mysql_tasks.quote_identifier(ise.EVENT_SCHEMA), '.', mysql_tasks.quote_identifier(ise.EVENT_NAME))
  LEFT JOIN `performance_schema`.`processlist` p ON t.connection_id = p.id
  WHERE
    (tl.status <> 'RUNNING' AND tl.status <> 'SCHEDULED')
    AND p.id IS NULL
    AND t.server_uuid = UUID_TO_BIN(@@server_uuid, 1)
    AND t.data->'$.autoGc' = true;

  WHILE i < JSON_LENGTH(json_id) DO
    SET curr_data = JSON_EXTRACT(json_data, CONCAT('$[', i, ']'));

    IF curr_data IS NOT NULL AND JSON_CONTAINS_PATH(curr_data, 'one', '$.events')  THEN
      SET j = 0;
      WHILE j < JSON_LENGTH(JSON_EXTRACT(curr_data, '$.events')) DO
        SET event_name = JSON_UNQUOTE(JSON_EXTRACT(curr_data, CONCAT('$.events[', j, ']')));
        CALL `mysql_tasks`.`drop_event`(event_name);
        SET j = j + 1;
      END WHILE;
    END IF;

    SELECT i + 1 INTO i;
  END WHILE;
END$$
DELIMITER ;


-- -----------------------------------------------------
-- FUNCTION `mysql_tasks`.`quote_identifier`
-- (copy of sys.quote_identifier to avoid permission issues)
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS `mysql_tasks`.`quote_identifier`;
DELIMITER $$
CREATE FUNCTION `mysql_tasks`.`quote_identifier`(in_identifier TEXT)
    RETURNS TEXT CHARSET UTF8MB4
    SQL SECURITY INVOKER
    DETERMINISTIC
    NO SQL
BEGIN
    RETURN CONCAT('`', REPLACE(in_identifier, '`', '``'), '`');
END$$
DELIMITER ;


-- -----------------------------------------------------
-- Create roles for the MySQL Tasks

-- The mysql_task_admin ROLE allows to fully manage the MySQL tasks schema
-- The mysql_task_user ROLE allows to create and work with MySQL tasks

CREATE ROLE IF NOT EXISTS 'mysql_task_admin', 'mysql_task_user';

-- GRANTS for mysql_task_admin
GRANT ALL ON `mysql_tasks`.* TO 'mysql_task_admin';

-- GRANTS for mysql_task_user
GRANT SELECT ON `mysql_tasks`.`config` TO 'mysql_task_user';
GRANT SELECT ON `mysql_tasks`.`schema_version` TO 'mysql_task_user';
GRANT INSERT ON `mysql_tasks`.`task_i` TO 'mysql_task_user';
GRANT INSERT ON `mysql_tasks`.`task_log_i` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`task_list` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`task` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`task_logs` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`task_status_list` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`task_status` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`task_status_brief` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`active_task_count` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`find_task_log_msg` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`get_task_ids_from_alias` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`get_task_id` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`get_task_alias` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`get_task_log_data_json_schema` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`get_task_connection_id` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`create_task` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`create_task_with_id` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`add_task_log` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`kill_task` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`drop_event` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`app_task_list` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`app_task` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`app_task_logs` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`app_task_status_list` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`app_task_status` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`app_task_status_brief` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`get_app_task_ids_from_alias` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`get_app_task_id` TO 'mysql_task_user';
GRANT EXECUTE ON FUNCTION `mysql_tasks`.`get_app_task_alias` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`create_app_task` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`create_app_task_with_id` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`kill_app_task` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`execute_prepared_stmt_async_for_app` TO 'mysql_task_user';
GRANT EXECUTE ON PROCEDURE `mysql_tasks`.`execute_prepared_stmt_async` TO 'mysql_task_user';

GRANT EXECUTE ON FUNCTION `mysql_tasks`.`quote_identifier` TO 'mysql_task_user';
GRANT SELECT ON `performance_schema`.`events_statements_current` TO 'mysql_task_user';

-- -----------------------------------------------------
-- Set the schema_version VIEW to the correct version at the very end
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `mysql_tasks`.`schema_version` (`major`,`minor`,`patch`) AS
SELECT 2, 0, 0;


-- -----------------------------------------------------
-- Grant the necessary mysql_tasks privileges to the MySQL REST Service roles
GRANT 'mysql_task_user' TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider', 'mysql_rest_service_data_provider';


-- -----------------------------------------------------
-- Set the version VIEWs to the correct version

ALTER SQL SECURITY INVOKER VIEW `mysql_rest_service_metadata`.`mrs_user_schema_version` (major, minor, patch) AS SELECT 3, 1, 0;

ALTER SQL SECURITY INVOKER VIEW `mysql_rest_service_metadata`.`schema_version` (major, minor, patch) AS SELECT 3, 1, 0;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
