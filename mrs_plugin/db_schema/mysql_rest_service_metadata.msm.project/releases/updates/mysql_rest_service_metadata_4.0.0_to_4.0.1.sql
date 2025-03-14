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
-- This script updates the database schema `mysql_rest_service_metadata`
-- from version 4.0.0 to 4.0.1
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
-- statements when creating the helper objects. The names of all helper
-- routines need to start with `msm_`.
-- -----------------------------------------------------------------------------

DELIMITER %%

-- Insert optional helper PROCEDUREs and FUNCTIONs here

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

-- -----------------------------------------------------------------------------
-- ALTER TABLE `mysql_rest_service_metadata`.`my_table`
-- -----------------------------------------------------------------------------

ALTER TABLE `mysql_rest_service_metadata`.`router`
    CHANGE COLUMN `router_name` `router_name` VARCHAR(255) NOT NULL
    COMMENT 'A user specified name for an instance of the router. Should default to address:port, where port is the http server port of the router. Set via --name during router bootstrap.';


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

DROP PROCEDURE IF EXISTS `mysql_rest_service_metadata`.`table_columns_with_references`%%
CREATE PROCEDURE `mysql_rest_service_metadata`.`table_columns_with_references`(
    p_schema_name VARCHAR(64), p_table_name VARCHAR(64))
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
        WHERE c.TABLE_SCHEMA COLLATE utf8mb3_general_ci = p_schema_name AND c.TABLE_NAME COLLATE utf8mb3_general_ci = p_table_name
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
                    AND c.TABLE_SCHEMA COLLATE utf8mb3_general_ci = p_schema_name AND c.TABLE_NAME COLLATE utf8mb3_general_ci = p_table_name
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
        WHERE k.REFERENCED_TABLE_SCHEMA COLLATE utf8mb3_general_ci = p_schema_name AND k.REFERENCED_TABLE_NAME COLLATE utf8mb3_general_ci = p_table_name
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
            WHERE co.COLUMN_NAME IS NOT NULL AND co.ENFORCED = 'YES' AND JSON_VALID(co.JSON_SCHEMA_DEF) AND co.TABLE_SCHEMA COLLATE utf8mb3_general_ci = p_schema_name AND co.TABLE_NAME COLLATE utf8mb3_general_ci = p_table_name
            GROUP BY co.TABLE_SCHEMA, co.TABLE_NAME, co.COLUMN_NAME) AS js
        ON f.TABLE_SCHEMA = js.TABLE_SCHEMA AND f.TABLE_NAME = js.TABLE_NAME AND f.name = js.COLUMN_NAME
    ORDER BY f.position;
END%%

-- Periodically down-sample router_status rows to keep its size under control.

-- sub-minute data is kept for 4h, then down-sampled to 1 minute samples
-- sub-hourly data is kept for 24h, then down-sampled to 1 hour samples
-- sub-daily data is kept for 7 days, then down-sampled to 1 day samples
-- daily data is kept indefinitely

DROP PROCEDURE IF EXISTS mysql_rest_service_metadata.router_status_down_sample%%
CREATE PROCEDURE mysql_rest_service_metadata.router_status_down_sample(
    time TIMESTAMP,
    router_version VARCHAR(12),
    status_variables JSON,
    target_interval CHAR)
    SQL SECURITY INVOKER
here:BEGIN
    DECLARE max_interval INT DEFAULT 1;
    DECLARE time_point_format VARCHAR(40) DEFAULT '';
    DECLARE done INT DEFAULT FALSE;
    DECLARE direct_columns TEXT DEFAULT '';
    DECLARE direct_query TEXT DEFAULT '';
    DECLARE details_query TEXT DEFAULT '';
    DECLARE before_time TIMESTAMP;
    DECLARE compress_older_than TIMESTAMP;
    DECLARE attr_name VARCHAR(80);
    DECLARE attr_non_resettable BOOLEAN;
    DECLARE attr_column VARCHAR(32);
    DECLARE cur1 CURSOR FOR SELECT vars.`name`, vars.`resettable`, vars.`column` FROM
        JSON_TABLE(status_variables,
         '$[*]' COLUMNS (
            `name` VARCHAR(80) PATH '$.name',
            `resettable` BOOLEAN PATH '$.nonResettable' DEFAULT 'false' ON EMPTY,
            `column` VARCHAR(32) PATH '$.column'
            )) vars;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN
        DROP TABLE IF EXISTS `mysql_rest_service_metadata`.`aggregated`;
        RESIGNAL;
    END;

    -- target_interval must be either M (60s or 1min) H (60*60s or 1 hour) or D (24*60*60s or 1 day)
    IF target_interval = 'M' THEN
        SET max_interval = 60;
        SET time_point_format = '%Y-%m-%d %H:%i:00';
        SET compress_older_than = DATE_SUB(time, INTERVAL 4 HOUR);
    ELSEIF target_interval = 'H' THEN
        SET max_interval = 60*60;
        SET time_point_format = '%Y-%m-%d %H:00:00';
        SET compress_older_than = DATE_SUB(time, INTERVAL 24 HOUR);
    ELSEIF target_interval = 'D' THEN
        SET max_interval = 24*60*60;
        SET time_point_format = '%Y-%m-%d 00:00:00';
        SET compress_older_than = DATE_SUB(time, INTERVAL 1 DAY);
    ELSE
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid value for target_interval, must be M, H or D.', MYSQL_ERRNO = 5400;
    END IF;
    SET before_time = DATE_FORMAT(compress_older_than, time_point_format);

    START TRANSACTION;
    -- generate aggregation query
    OPEN cur1;

    SET details_query = '';
    variable_loop: LOOP
        FETCH cur1 INTO attr_name, attr_non_resettable, attr_column;
        IF done THEN
            LEAVE variable_loop;
        END IF;
        IF attr_non_resettable THEN
             IF attr_column IS NOT NULL THEN
                SET direct_query = CONCAT(direct_query, 'MAX(', attr_column, ') as ', attr_column, ', ');
                SET direct_columns = CONCAT(direct_columns, attr_column, ',');
            ELSE
                SET details_query = CONCAT(details_query, quote(attr_name), ',MAX(details->''$.', attr_name, '''), ');
            END IF;
        ELSE
            IF attr_column IS NOT NULL THEN
                SET direct_query = CONCAT(direct_query, 'SUM(', attr_column, ') as ', attr_column, ', ');
                SET direct_columns = CONCAT(direct_columns, attr_column, ',');
            ELSE
                SET details_query = CONCAT(details_query, quote(attr_name), ',SUM(details->''$.', attr_name, '''), ');
             END IF;
        END IF;
    END LOOP;
    SET details_query = CONCAT('JSON_OBJECT(', SUBSTR(details_query, 1, GREATEST(0, LENGTH(details_query)-2)), ') as details');

    CLOSE cur1;
    DROP TABLE IF EXISTS `aggregated`;
    CREATE TEMPORARY TABLE `aggregated` LIKE mysql_rest_service_metadata.router_status;

    -- aggregate rows with interval < target_interval at the same time
    SET @query = CONCAT('INSERT INTO `aggregated` ',
        '(id, router_id, `timespan`, status_time, ', direct_columns, '`details`)',
        ' SELECT min(rs.id) as id, rs.router_id, ', max_interval, ' as `timespan`, ',
        'DATE_FORMAT(rs.status_time, ', quote(time_point_format), ') as status_time_rounded, ',
        direct_query, details_query,
        ' FROM mysql_rest_service_metadata.router_status rs JOIN mysql_rest_service_metadata.router r ON rs.router_id=r.id WHERE r.version=', quote(router_version),
        ' AND rs.status_time < ', quote(before_time), ' AND rs.`timespan` < ', max_interval);
    SET @query = CONCAT(@query, ' GROUP BY rs.router_id, DATE_FORMAT(rs.status_time, ',quote(time_point_format),') ORDER BY status_time_rounded ASC');

    PREPARE stmt FROM @query;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;

    DELETE FROM mysql_rest_service_metadata.router_status r
        WHERE r.router_id=router_id AND r.status_time < before_time AND r.`timespan` < max_interval;

    INSERT INTO mysql_rest_service_metadata.router_status SELECT * FROM `aggregated`;

    COMMIT;
END%%

DROP PROCEDURE IF EXISTS mysql_rest_service_metadata.router_status_do_cleanup%%
CREATE PROCEDURE mysql_rest_service_metadata.router_status_do_cleanup(time TIMESTAMP)
    SQL SECURITY INVOKER
BEGIN
    DECLARE version VARCHAR(12);
    DECLARE old_status_variables JSON DEFAULT '[{"name":"httpRequestGet","column":"http_requests_get"},
{"name":"httpRequestPost","column":"http_requests_post"},
{"name":"httpRequestPut","column":"http_requests_put"},
{"name":"httpRequestDelete","column":"http_requests_delete"},
{"name":"kEntityCounterHttpRequestOptions"},
{"name":"httpConnectionsReused"},
{"name":"httpConnectionsCreated"},
{"name":"httpConnectionsClosed"},
{"name":"mysqlConnectionsReused"},
{"name":"mysqlConnectionsCreated","column":"mysql_connections"},
{"name":"mysqlConnectionsClosed"},
{"name":"mysqlConnectionsActive","column":"active_mysql_connections","nonResettable":true},
{"name":"mysqlQueries","column":"mysql_queries"},
{"name":"mysqlChangeUser"},
{"name":"mysqlPrepareStmt"},
{"name":"mysqlExecuteStmt"},
{"name":"mysqlRemoveStmt"},
{"name":"restReturnedItems"},
{"name":"restAffectedItems"},
{"name":"restCacheItemLoads"},
{"name":"restCacheItemEjects"},
{"name":"restCacheItemHits"},
{"name":"restCacheItemMisses"},
{"name":"restCachedItems","nonResettable":true},
{"name":"restCacheFileLoads"},
{"name":"restCacheFileEjects"},
{"name":"restCacheFileHits"},
{"name":"restCacheFileMisses"},
{"name":"restCachedFiles","nonResettable":true},
{"name":"restCachedEndpoints","nonResettable":true},
{"name":"changesHosts","nonResettable":true},
{"name":"changesServices","nonResettable":true},
{"name":"changesSchemas","nonResettable":true},
{"name":"changesContentSets","nonResettable":true},
{"name":"changesObjects","nonResettable":true},
{"name":"changesFiles","nonResettable":true},
{"name":"changesAuthentications","nonResettable":true},
{"name":"restAsofUsesRo"},
{"name":"restAsofUsesRw"},
{"name":"restAsofSwitchesFromRo2Rw"},
{"name":"restAsofNumberOfTimeouts"},
{"name":"restMetadataGtids"},
{"name":"sqlQueryTimeouts"}]';
    DECLARE status_variables JSON;
    DECLARE done INT DEFAULT FALSE;
    DECLARE cur1 CURSOR FOR SELECT router.version, JSON_EXTRACT(ANY_VALUE(router.attributes), '$.statusVariables')
        FROM mysql_rest_service_metadata.router
        GROUP BY router.version;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN cur1;

    variable_loop: LOOP
        FETCH cur1 INTO version, status_variables;
        IF done THEN
            LEAVE variable_loop;
        END IF;
        IF status_variables IS NULL THEN
            SET status_variables = old_status_variables;
        END IF;
        CALL mysql_rest_service_metadata.router_status_down_sample(time, version, status_variables, 'M');
        CALL mysql_rest_service_metadata.router_status_down_sample(time, version, status_variables, 'H');
        CALL mysql_rest_service_metadata.router_status_down_sample(time, version, status_variables, 'D');
    END LOOP;

    CLOSE cur1;
END%%


DROP EVENT IF EXISTS `mysql_rest_service_metadata`.`router_status_cleanup`%%
CREATE EVENT `mysql_rest_service_metadata`.`router_status_cleanup` ON SCHEDULE EVERY 1 HOUR
ON COMPLETION NOT PRESERVE ENABLE COMMENT 'Aggregate and clean up router_status entries' DO
    CALL mysql_rest_service_metadata.router_status_do_cleanup(NOW())%%

DELIMITER ;


-- #############################################################################
-- MSM Section 270: Authorization
-- -----------------------------------------------------------------------------
-- This section is used to define changes for ROLEs and GRANTs in respect to
-- the previous version. If there are no changes required, this section can
-- be skipped.
-- -----------------------------------------------------------------------------

-- Change ROLEs and perform the required GRANT/REVOKE statements.


-- #############################################################################
-- MSM Section 290: Removal of Update Helpers
-- -----------------------------------------------------------------------------
-- Removal of optional helper PROCEDUREs and FUNCTIONs that are called during
-- the update of the database schema. Note that DROP IF EXISTS needs to be
-- used.
-- -----------------------------------------------------------------------------

-- Drop optional helper PROCEDUREs and FUNCTIONs here.


-- #############################################################################
-- MSM Section 910: Database Schema Version Definition
-- -----------------------------------------------------------------------------
-- Setting the correct database schema version.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `mysql_rest_service_metadata`.`msm_schema_version` (
    `major`,`minor`,`patch`) AS
SELECT 4, 0, 1;


-- #############################################################################
-- MSM Section 920: Server Variable Restoration
-- -----------------------------------------------------------------------------
-- Restore the modified server variables to their original state.
-- -----------------------------------------------------------------------------

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
