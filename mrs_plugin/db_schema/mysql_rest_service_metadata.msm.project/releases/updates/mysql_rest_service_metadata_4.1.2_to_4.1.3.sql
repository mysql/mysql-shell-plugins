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
-- from version 4.1.2 to 4.1.3
-- #############################################################################


-- #############################################################################
-- MSM Section 010: Server Variable Settings
-- -----------------------------------------------------------------------------
-- Set server variables, remember their state to be able to restore accordingly.
-- #############################################################################

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
-- #############################################################################

USE `mysql_rest_service_metadata`;

CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `msm_schema_version` (`major`,`minor`,`patch`) AS
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
-- #############################################################################

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
-- #############################################################################

/*
-- ToDo: Add ALTER TABLE statements or new CREATE TABLE statements. Include
-- DROP TRIGGER/EVENT/... statements and re-create them in the next section.
-- Perform DML statements if needed.

-- -----------------------------------------------------------------------------
-- ALTER TABLE `mysql_rest_service_metadata`.`my_table`
-- -----------------------------------------------------------------------------

ALTER TABLE `mysql_rest_service_metadata`.`my_table`
    ADD COLUMN birthday DATE;
*/


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
-- #############################################################################

DELIMITER %%

DROP PROCEDURE IF EXISTS `router_status_downsample`%%
CREATE PROCEDURE `router_status_downsample`(
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
        DROP TABLE IF EXISTS `aggregated`;
        RESIGNAL;
    END;

    -- target_interval must be either M (60s or 1min) H (60*60s or 1 hour) or D (24*60*60s or 1 day)
    IF target_interval = 'M' THEN
        SET max_interval = 60000;
        SET time_point_format = '%Y-%m-%d %H:%i:00';
        SET compress_older_than = DATE_SUB(time, INTERVAL 4 HOUR);
    ELSEIF target_interval = 'H' THEN
        SET max_interval = 60*60000;
        SET time_point_format = '%Y-%m-%d %H:00:00';
        SET compress_older_than = DATE_SUB(time, INTERVAL 24 HOUR);
    ELSEIF target_interval = 'D' THEN
        SET max_interval = 24*60*60000;
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

DROP PROCEDURE IF EXISTS `router_status_do_cleanup`%%
CREATE PROCEDURE `router_status_do_cleanup`(time TIMESTAMP)
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
        CALL mysql_rest_service_metadata.router_status_downsample(time, version, status_variables, 'M');
        CALL mysql_rest_service_metadata.router_status_downsample(time, version, status_variables, 'H');
        CALL mysql_rest_service_metadata.router_status_downsample(time, version, status_variables, 'D');
    END LOOP;

    CLOSE cur1;
END%%

DELIMITER ;


-- #############################################################################
-- MSM Section 270: Authorization
-- -----------------------------------------------------------------------------
-- This section is used to define changes for ROLEs and GRANTs in respect to
-- the previous version. If there are no changes required, this section can
-- be skipped.
-- #############################################################################

-- Change ROLEs and perform the required GRANT/REVOKE statements.


-- #############################################################################
-- MSM Section 290: Removal of Update Helpers
-- -----------------------------------------------------------------------------
-- Removal of optional helper PROCEDUREs and FUNCTIONs that are called during
-- the update of the database schema. Note that DROP IF EXISTS needs to be
-- used.
-- #############################################################################

-- Drop optional helper PROCEDUREs and FUNCTIONs here.


-- #############################################################################
-- MSM Section 910: Database Schema Version Definition
-- -----------------------------------------------------------------------------
-- Setting the correct database schema version.
-- #############################################################################

USE `mysql_rest_service_metadata`;

CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `msm_schema_version` (`major`,`minor`,`patch`) AS
SELECT 4, 1, 3;


-- #############################################################################
-- MSM Section 920: Server Variable Restoration
-- -----------------------------------------------------------------------------
-- Restore the modified server variables to their original state.
-- #############################################################################

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
