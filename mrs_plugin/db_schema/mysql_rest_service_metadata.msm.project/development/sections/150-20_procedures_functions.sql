-- Copyright (c) 2025, Oracle and/or its affiliates.
-- -----------------------------------------------------
-- PROCEDURES and FUNCTIONs

DELIMITER %%

-- -----------------------------------------------------------------------------
-- CREATE PROCEDURE `msm_instance_demoted`
-- -----------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS `msm_instance_demoted`%%
CREATE PROCEDURE `msm_instance_demoted`()
SQL SECURITY DEFINER
COMMENT 'This procedure needs to be called on a primary instance in an InnoDB Cluster setup before it is demoted to
    become a secondary.'
BEGIN
    ALTER EVENT `mysql_rest_service_metadata`.`delete_old_audit_log_entries` DISABLE;
    ALTER EVENT `mysql_rest_service_metadata`.`router_status_cleanup` DISABLE;
    ALTER EVENT `mysql_rest_service_metadata`.`router_log_cleanup` DISABLE;
END%%

-- -----------------------------------------------------------------------------
-- CREATE PROCEDURE `msm_instance_promoted`
-- -----------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS `msm_instance_promoted`%%
CREATE PROCEDURE `msm_instance_promoted`()
SQL SECURITY DEFINER
COMMENT 'This procedure needs to be called on an instance in an InnoDB Cluster setup when it is promoted to
    become the primary.'
BEGIN
    ALTER EVENT `mysql_rest_service_metadata`.`delete_old_audit_log_entries` ENABLE;
    ALTER EVENT `mysql_rest_service_metadata`.`router_status_cleanup` ENABLE;
    ALTER EVENT `mysql_rest_service_metadata`.`router_log_cleanup` ENABLE;
END%%


-- -----------------------------------------------------------------------------
-- CREATE FUNCTIONs
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS `get_sequence_id`%%
CREATE FUNCTION `get_sequence_id`() RETURNS BINARY(16) SQL SECURITY INVOKER NOT DETERMINISTIC NO SQL
RETURN UUID_TO_BIN(UUID(), 1)%%

DROP FUNCTION IF EXISTS `valid_request_path`%%
CREATE FUNCTION `valid_request_path`(path VARCHAR(255))
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
END%%


-- -----------------------------------------------------------------------------
-- CREATE PROCEDUREs
-- -----------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS `dump_audit_log`%%
CREATE PROCEDURE `dump_audit_log`()
SQL SECURITY DEFINER
COMMENT 'The dump_audit_log procedure allows the audit_log table to be exported to a file
    Please note that the secure_file_priv global variable must be set for this to work in the my.ini / my.cnf file
    [mysqld]
    secure-file-priv="/usr/local/mysql/outfiles"'
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
                'SELECT JSON_OBJECT("changed_at", changed_at, "id", id, "server_uuid", @@server_uuid, ',
                '    "schema_name", schema_name, "table_name", table_name, "dm_type", dml_type, "changed_by", changed_by, '
                '    "old_row_data", JSON_REPLACE(old_row_data, "$.data.defaultStaticContent", "BINARY_DATA"), ',
                '    "new_row_data", JSON_REPLACE(new_row_data, "$.data.defaultStaticContent", "BINARY_DATA")) ',
                'INTO OUTFILE "', TRIM(TRAILING '/' FROM @@secure_file_priv), '/mrs/mrs_audit_log_',
                DATE_FORMAT(dump_until, '%Y-%m-%d_%H-%i-%s'),
                '.log" LINES TERMINATED BY "\\\n" ',
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

-- Procedure to fetch all table columns as well as references to related tables

DROP PROCEDURE IF EXISTS `table_columns_with_references`%%
CREATE PROCEDURE `table_columns_with_references`(
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


-- sub-minute data is kept for 4h, then down-sampled to 1 minute samples
-- sub-hourly data is kept for 24h, then down-sampled to 1 hour samples
-- sub-daily data is kept for 7 days, then down-sampled to 1 day samples
-- daily data is kept indefinitely

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


DROP PROCEDURE IF EXISTS `sdk_service_data`%%
CREATE PROCEDURE `sdk_service_data`(IN service_id BINARY(16))
BEGIN
    DECLARE service_res JSON;
    DECLARE schema_id BINARY(16);
    DECLARE schema_res JSON;

    -- Get all db_schemas of the given service, fetch the id to do the nested SELECTs and
    -- the data as JSON
    DECLARE schema_loop_done TINYINT DEFAULT FALSE;
    DECLARE schema_cursor CURSOR FOR
        SELECT s.id,
            JSON_OBJECT(
                'id', s.id,
                'name', s.name,
                'schema_type', s.schema_type,
                'request_path', s.request_path,
                'requires_auth', s.requires_auth,
                'internal', s.internal,
                'options', s.options
            )
        FROM mysql_rest_service_metadata.db_schema AS s
        WHERE s.service_id = service_id AND s.enabled = 1;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET schema_loop_done = 1;

    -- Get the service data as JSON
    SELECT
        JSON_OBJECT(
            'id', s.id,
            'url_context_root', s.url_context_root,
            'name', s.name,
            'enabled', s.enabled,
            'published', s.published,
            'options', s.options,
            'auth_path', s.auth_path,
            'auth_completed_url_validation', s.auth_completed_url_validation
        )
        INTO service_res
    FROM mysql_rest_service_metadata.service AS s
    WHERE s.id = service_id;

    -- Initiate the list of db_schemas with an empty JSON array
    SET service_res = JSON_SET(service_res, '$.db_schemas', json_array());

    -- Loop over all db_schema of the given service
    OPEN schema_cursor;
    schema_loop: LOOP
        -- Get the next db_schema of the service
        FETCH NEXT FROM schema_cursor INTO schema_id, schema_res;

        IF schema_loop_done THEN
            LEAVE schema_loop;
        ELSE schema_block: BEGIN
            -- Get all db_objects of the given db_schema, fetch the id to do the nested SELECTs and
            -- the data as JSON
            DECLARE db_object_id BINARY(16);
            DECLARE db_object_res JSON;
            DECLARE db_object_loop_done TINYINT DEFAULT FALSE;
            DECLARE db_object_cursor CURSOR FOR
                SELECT o.id,
                    JSON_OBJECT(
                        'id', o.id,
                        'name', o.name,
                        'request_path', o.request_path,
                        'internal', o.internal,
                        'object_type', o.object_type,
                        'crud_operations', o.crud_operations,
                        'format', o.format,
                        'requires_auth', o.requires_auth,
                        'options', o.options
                    )
                FROM mysql_rest_service_metadata.db_object AS o
                WHERE o.db_schema_id = schema_id AND o.enabled = 1;
            DECLARE CONTINUE HANDLER FOR NOT FOUND SET db_object_loop_done = 1;

            -- Initiate the list of db_objects with an empty JSON array
            SET schema_res = JSON_SET(schema_res, '$.db_objects', json_array());

            -- Loop over all db_objects of the given db_schema
            OPEN db_object_cursor;
            db_object_loop: LOOP
                FETCH NEXT FROM db_object_cursor INTO db_object_id, db_object_res;

                IF db_object_loop_done THEN
                    LEAVE db_object_loop;
                ELSE db_object_block: BEGIN
                    DECLARE object_id BINARY(16);
                    DECLARE object_res JSON;
                    DECLARE object_loop_done TINYINT DEFAULT FALSE;
                    DECLARE object_cursor CURSOR FOR
                        SELECT o.id,
                          JSON_OBJECT(
                            'id', o.id,
                            'db_object_id', o.db_object_id,
                            'name', name,
                            'kind', kind,
                            'position', position,
                            'row_ownership_field_id', row_ownership_field_id,
                            'options', options,
                            'sdk_options', sdk_options
                          )
                      FROM mysql_rest_service_metadata.object AS o
                      WHERE o.db_object_id = db_object_id;
                    DECLARE CONTINUE HANDLER FOR NOT FOUND SET object_loop_done = 1;

                    -- Initiate the list of objects with an empty JSON array
                    SET db_object_res = JSON_SET(db_object_res, '$.objects', json_array());

                    -- Loop over all SDK object instances of the given db_object
                    OPEN object_cursor;
                    object_loop: LOOP
                        FETCH NEXT FROM object_cursor INTO object_id, object_res;

                        IF object_loop_done THEN
                            LEAVE object_loop;
                        ELSE object_block: BEGIN
                            DECLARE field_id BINARY(16);
                            DECLARE field_res JSON;
                            DECLARE field_loop_done TINYINT DEFAULT FALSE;
                            DECLARE field_cursor CURSOR FOR
                                SELECT f.id,
                                    JSON_OBJECT(
                                        'caption', f.caption,
                                        'lev', f.lev,
                                        'position', f.position,
                                        'id', f.id,
                                        'represents_reference_id', f.represents_reference_id,
                                        'parent_reference_id', f.parent_reference_id,
                                        'object_id', f.object_id,
                                        'name', f.name,
                                        'db_column', f.db_column,
                                        'enabled', f.enabled,
                                        'allow_filtering', f.allow_filtering,
                                        'allow_sorting', f.allow_sorting,
                                        'no_check', f.no_check,
                                        'no_update', f.no_update,
                                        'options', f.options,
                                        'sdk_options', f.sdk_options,
                                        'object_reference', f.object_reference
                                    )
                                FROM mysql_rest_service_metadata.object_fields_with_references AS f
                                WHERE f.object_id = object_id;
                            DECLARE CONTINUE HANDLER FOR NOT FOUND SET field_loop_done = 1;

                            -- Initiate the list of fields with an empty JSON array
                            SET object_res = JSON_SET(object_res, '$.fields', json_array());

                            -- Loop over all fields of the given SDK object
                            OPEN field_cursor;
                            field_loop: LOOP
                                FETCH NEXT FROM field_cursor INTO field_id, field_res;

                                IF field_loop_done THEN
                                    LEAVE field_loop;
                                ELSE field_block: BEGIN
                                    -- Append the field JSON data to the object's fields array
                                    SET object_res = JSON_ARRAY_APPEND(object_res, '$.fields', field_res);
                                END field_block; END IF;
                            END LOOP field_loop;

                            -- Append the SDK object JSON data to the db_objects's objects array
                            SET db_object_res = JSON_ARRAY_APPEND(db_object_res, '$.objects', object_res);
                        END object_block; END IF;
                    END LOOP object_loop;

                    -- Append the db_object JSON data to the db_schema's db_objects array
                    SET schema_res = JSON_ARRAY_APPEND(schema_res, '$.db_objects', db_object_res);

                END db_object_block; END IF;
            END LOOP db_object_loop;

            -- Append the db_schema JSON data to the service's db_schemas array
            SET service_res = JSON_ARRAY_APPEND(service_res, '$.db_schemas', schema_res);

            CLOSE db_object_cursor;
        END schema_block; END IF;
    END LOOP schema_loop;

    CLOSE schema_cursor;

    -- Return the JSON data as a result set
    SELECT service_res;
END%%

DELIMITER ;
