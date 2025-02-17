-- Copyright (c) 2025, Oracle and/or its affiliates.
-- -----------------------------------------------------
-- Additional SQL

-- Ensure only one row in `mysql_rest_service_metadata`.`config`
ALTER TABLE `mysql_rest_service_metadata`.`config`
	ADD CONSTRAINT Config_OnlyOneRow CHECK (id = 1);

-- Ensure only one row in `mysql_rest_service_metadata`.`audit_log_status`
ALTER TABLE `mysql_rest_service_metadata`.`audit_log_status`
	ADD CONSTRAINT AuditLogStatus_OnlyOneRow CHECK (id = 1);

-- Ensure there is a default for service.name taken from url_context_root
ALTER TABLE `mysql_rest_service_metadata`.`service`
    CHANGE COLUMN name name VARCHAR(255) NOT NULL DEFAULT (REGEXP_REPLACE(url_context_root, '[^0-9a-zA-Z ]', ''));

-- Ensure page size is within 16K limit
ALTER TABLE `mysql_rest_service_metadata`.`db_schema`
	ADD CONSTRAINT db_schema_max_page_size CHECK (items_per_page IS NULL OR items_per_page < 16384);
ALTER TABLE `mysql_rest_service_metadata`.`db_object`
	ADD CONSTRAINT db_object_max_page_size CHECK (items_per_page IS NULL OR items_per_page < 16384);

-- Insert a default auth_app for MySQL Internal Authentication
INSERT INTO `mysql_rest_service_metadata`.`auth_app` (`id`, `auth_vendor_id`, `name`, `description`,
    `enabled`, `limit_to_registered_users`, `default_role_id`, `options`)
VALUES (0x31, 0x31, 'MySQL', 'Provide login capabilities for MySQL Server user accounts.',
    TRUE, FALSE, 0x31, NULL);

-- Ensure an email cannot be used as user name and a user name cannot be used as email
ALTER TABLE `mysql_rest_service_metadata`.`mrs_user`
    ADD CONSTRAINT `mrs_user_no_at_symbol_in_user_name` CHECK (INSTR(name, '@') = 0),
    ADD CONSTRAINT `mrs_user_at_symbol_in_email` CHECK (INSTR(email, '@') > 0 OR email IS NULL OR email = '');

DELIMITER $$

CREATE FUNCTION `mysql_rest_service_metadata`.`get_sequence_id`() RETURNS BINARY(16) SQL SECURITY INVOKER NOT DETERMINISTIC NO SQL
RETURN UUID_TO_BIN(UUID(), 1)$$

CREATE EVENT `mysql_rest_service_metadata`.`delete_old_audit_log_entries` ON SCHEDULE EVERY 1 DAY DISABLE DO
DELETE FROM `mysql_rest_service_metadata`.`audit_log` WHERE changed_at < TIMESTAMP(DATE_SUB(NOW(), INTERVAL 14 DAY))$$


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

DELIMITER ;

-- Ensure that for STORED PROCEDURE parameters at least one of the 'in' and 'out' flag is set to true
ALTER TABLE `mysql_rest_service_metadata`.`object_field`
  ADD CONSTRAINT param_mode_not_false CHECK (
    (db_column->"$.in" IS NULL AND db_column->"$.out" IS NULL) OR
    (db_column->"$.in" + db_column->"$.out" >= 1));

-- Ensure the service.in_development->>$.developers is a list that only holds unique strings
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

-- The dump_audit_log procedure allows the audit_log table to be exported to a file
-- Please note that the secure_file_priv global variable must be set for this to work in the my.ini / my.cnf file
-- [mysqld]
-- secure-file-priv="/usr/local/mysql/outfiles"

DELIMITER $$
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

-- Function to fetch all fields of an object in a recursive manner

CREATE OR REPLACE SQL SECURITY INVOKER VIEW `mysql_rest_service_metadata`.`object_fields_with_references` AS
WITH RECURSIVE obj_fields (
    caption, lev, position, id, represents_reference_id, parent_reference_id, object_id,
    name, db_column, enabled,
    allow_filtering, allow_sorting, no_check, no_update, options, sdk_options, comments,
    object_reference) AS
(
    SELECT CONCAT('- ', f.name) as caption, 1 AS lev, f.position, f.id,
		f.represents_reference_id, f.parent_reference_id, f.object_id, f.name,
        f.db_column, f.enabled, f.allow_filtering, f.allow_sorting, f.no_check, f.no_update,
        f.options, f.sdk_options, f.comments,
        IF(ISNULL(f.represents_reference_id), NULL, JSON_OBJECT(
            'reduce_to_value_of_field_id', TO_BASE64(r.reduce_to_value_of_field_id),
            'row_ownership_field_id', TO_BASE64(r.row_ownership_field_id),
            'reference_mapping', r.reference_mapping,
            'unnest', (r.unnest = 1),
            'options', r.options,
            'sdk_options', r.sdk_options,
            'comments', r.comments
        )) AS object_reference
    FROM `mysql_rest_service_metadata`.`object_field` f
        LEFT OUTER JOIN `mysql_rest_service_metadata`.`object_reference` AS r
            ON r.id = f.represents_reference_id
    WHERE ISNULL(parent_reference_id)
    UNION ALL
    SELECT CONCAT(REPEAT('  ', p.lev), '- ', f.name) as caption, p.lev+1 AS lev, f.position,
        f.id, f.represents_reference_id, f.parent_reference_id, f.object_id, f.name,
        f.db_column, f.enabled, f.allow_filtering, f.allow_sorting, f.no_check, f.no_update,
        f.options, f.sdk_options, f.comments,
        IF(ISNULL(f.represents_reference_id), NULL, JSON_OBJECT(
            'reduce_to_value_of_field_id', TO_BASE64(rc.reduce_to_value_of_field_id),
            'row_ownership_field_id', TO_BASE64(rc.row_ownership_field_id),
            'reference_mapping', rc.reference_mapping,
            'unnest', (rc.unnest = 1),
            'options', rc.options,
            'sdk_options', rc.sdk_options,
            'comments', rc.comments
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

