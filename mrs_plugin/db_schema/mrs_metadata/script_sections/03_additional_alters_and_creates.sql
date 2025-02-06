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

DELIMITER ;

