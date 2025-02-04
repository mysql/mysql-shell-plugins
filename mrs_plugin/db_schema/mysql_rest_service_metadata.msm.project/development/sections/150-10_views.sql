-- Copyright (c) 2025, Oracle and/or its affiliates.
-- -----------------------------------------------------
-- VIEWs

-- -----------------------------------------------------------------------------
-- View `mysql_rest_service_metadata`.`mrs_user_schema_version`
-- -----------------------------------------------------------------------------
CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `mysql_rest_service_metadata`.`mrs_user_schema_version` (
    major, minor, patch) AS
SELECT 4, 0, 0;

-- -----------------------------------------------------------------------------
-- View `mysql_rest_service_metadata`.`object_fields_with_references`
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- View `mysql_rest_service_metadata`.`router_services`
-- -----------------------------------------------------------------------------
CREATE OR REPLACE SQL SECURITY INVOKER
VIEW `mysql_rest_service_metadata`.`router_services` AS
SELECT r.id AS router_id, r.router_name, r.address, r.attributes->>'$.developer' AS router_developer,
    s.id as service_id, h.name AS service_url_host_name,
    s.url_context_root AS service_url_context_root,
    CONCAT(h.name, s.url_context_root) AS service_host_ctx,
    s.published, s.in_development,
    (SELECT GROUP_CONCAT(IF(item REGEXP '^[A-Za-z0-9_]+$', item, QUOTE(item)) ORDER BY item)
        FROM JSON_TABLE(
        s.in_development->>'$.developers', '$[*]' COLUMNS (item text path '$')
    ) AS jt) AS sorted_developers
FROM `mysql_rest_service_metadata`.`service` s
    LEFT JOIN `mysql_rest_service_metadata`.`url_host` h
        ON s.url_host_id = h.id
    JOIN `mysql_rest_service_metadata`.`router` r
WHERE
    (enabled = 1)
    AND (
    ((published = 1) AND (NOT EXISTS (select s2.id from `mysql_rest_service_metadata`.`service` s2 where s.url_host_id=s2.url_host_id AND s.url_context_root=s2.url_context_root
        AND JSON_OVERLAPS(r.attributes->'$.developer', s2.in_development->>'$.developers'))))
    OR
    ((published = 0) AND (s.id IN (select s2.id from `mysql_rest_service_metadata`.`service` s2 where s.url_host_id=s2.url_host_id AND s.url_context_root=s2.url_context_root
        AND JSON_OVERLAPS(r.attributes->'$.developer', s2.in_development->>'$.developers'))))
    OR
    ((published = 0) AND (r.options->'$.developer' IS NOT NULL
        OR r.attributes->'$.developer' IS NOT NULL) AND s.in_development IS NULL)
    );
