-- Copyright (c) 2025, Oracle and/or its affiliates.
-- -----------------------------------------------------
-- Create roles for the MySQL REST Service

-- The mysql_rest_service_admin ROLE allows to fully manage the REST services
-- The mysql_rest_service_schema_admin ROLE allows to manage the database schemas assigned to REST services
-- The mysql_rest_service_dev ROLE allows to develop new REST objects for given REST services and upload static files
-- The mysql_rest_service_user ROLE can be assigned to MySQL users that are granted access via MySQL Internal authentication.
-- The mysql_rest_service_meta_provider ROLE is used by the MySQL Router to read the mrs metadata and make inserts into the auth_user table
-- The mysql_rest_service_data_provider ROLE is used by the MySQL Router to read the actual schema data that is exposed via REST

CREATE ROLE IF NOT EXISTS 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_user',
    'mysql_rest_service_meta_provider', 'mysql_rest_service_data_provider';

-- Allow the 'mysql_rest_service_user' role to access the same data as 'mysql_rest_service_data_provider'
GRANT 'mysql_rest_service_data_provider' TO 'mysql_rest_service_user';

-- Allow the creation of temporary tables
GRANT CREATE TEMPORARY TABLES ON *.*
    TO 'mysql_rest_service_data_provider';

-- `mysql_rest_service_metadata`.`msm_schema_version`
GRANT SELECT ON `mysql_rest_service_metadata`.`msm_schema_version`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`audit_log`
GRANT SELECT ON `mysql_rest_service_metadata`.`audit_log`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- Config

-- `mysql_rest_service_metadata`.`config`
GRANT SELECT, UPDATE
    ON `mysql_rest_service_metadata`.`config`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`config`
    TO 'mysql_rest_service_meta_provider', 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`redirect`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`redirect`
    TO 'mysql_rest_service_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`redirect`
    TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- Service

-- `mysql_rest_service_metadata`.`url_host`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`url_host`
    TO 'mysql_rest_service_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`url_host`
    TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`url_host_alias`
GRANT SELECT, INSERT, DELETE
    ON `mysql_rest_service_metadata`.`url_host_alias`
    TO 'mysql_rest_service_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`url_host_alias`
    TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`service`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`service`
    TO 'mysql_rest_service_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`service`
    TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- Schema Objects

-- `mysql_rest_service_metadata`.`db_schema`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`db_schema`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`db_schema`
    TO 'mysql_rest_service_meta_provider', 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`db_object`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`db_object`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
GRANT SELECT ON `mysql_rest_service_metadata`.`db_object`
    TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`mrs_db_object_row_group_security`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_db_object_row_group_security`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
GRANT SELECT ON `mysql_rest_service_metadata`.`mrs_db_object_row_group_security`
    TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`object`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`object`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
GRANT SELECT ON `mysql_rest_service_metadata`.`object`
    TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`object_field`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`object_field`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
GRANT SELECT ON `mysql_rest_service_metadata`.`object_field`
    TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`object_reference`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`object_reference`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
GRANT SELECT ON `mysql_rest_service_metadata`.`object_reference`
    TO 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- Static Content

-- `mysql_rest_service_metadata`.`content_set`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`content_set`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
GRANT SELECT ON `mysql_rest_service_metadata`.`content_set`
    TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`content_file`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`content_file`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
GRANT SELECT ON `mysql_rest_service_metadata`.`content_file`
    TO 'mysql_rest_service_meta_provider';


-- `mysql_rest_service_metadata`.`content_set_has_obj_def`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`content_set_has_obj_def`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';
GRANT SELECT ON `mysql_rest_service_metadata`.`content_set_has_obj_def`
    TO 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- User Authentication

-- `mysql_rest_service_metadata`.`auth_app`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`auth_app`
    TO 'mysql_rest_service_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`auth_app`
    TO 'mysql_rest_service_meta_provider', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`service_has_auth_app`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`service_has_auth_app`
    TO 'mysql_rest_service_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`service_has_auth_app`
    TO 'mysql_rest_service_meta_provider', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`auth_vendor`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`auth_vendor`
    TO 'mysql_rest_service_admin';
GRANT SELECT ON `mysql_rest_service_metadata`.`auth_vendor`
    TO 'mysql_rest_service_meta_provider', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`mrs_user`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_user`
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT, UPDATE ON `mysql_rest_service_metadata`.`mrs_user`
    TO 'mysql_rest_service_meta_provider';
GRANT SELECT ON `mysql_rest_service_metadata`.`mrs_user`
    TO 'mysql_rest_service_data_provider';

-- -----------------------------------------------------
-- User Hierarchy

-- `mysql_rest_service_metadata`.`mrs_user_hierarchy`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_user_hierarchy`
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_hierarchy`
    TO 'mysql_rest_service_meta_provider';
GRANT SELECT ON `mysql_rest_service_metadata`.`mrs_user_hierarchy`
    TO 'mysql_rest_service_data_provider';

-- `mysql_rest_service_metadata`.`mrs_user_hierarchy_type`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_user_hierarchy_type`
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_hierarchy_type`
    TO 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- User Roles

-- `mysql_rest_service_metadata`.`mrs_user_has_role`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_user_has_role`
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_has_role`
    TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`mrs_role`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_role`
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_role`
    TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`mrs_privilege`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_privilege`
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_privilege`
    TO 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- User Group Management

-- `mysql_rest_service_metadata`.`mrs_user_has_group`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_user_has_group`
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_has_group`
    TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`mrs_user_group`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_user_group`
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_group`
    TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`mrs_user_group_has_role`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_user_group_has_role`
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_group_has_role`
    TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`mrs_group_hierarchy_type`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_group_hierarchy_type`
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_group_hierarchy_type`
    TO 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`mrs_user_group_hierarchy`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`mrs_user_group_hierarchy`
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`mrs_user_group_hierarchy`
    TO 'mysql_rest_service_meta_provider';
GRANT SELECT ON `mysql_rest_service_metadata`.`mrs_user_group_hierarchy`
    TO 'mysql_rest_service_data_provider';

-- -----------------------------------------------------
-- Router Management

-- `mysql_rest_service_metadata`.`router`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`router`
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT, UPDATE ON `mysql_rest_service_metadata`.`router`
    TO 'mysql_rest_service_meta_provider';
GRANT SELECT
    ON `mysql_rest_service_metadata`.`router`
    TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`router_status`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`router_status`
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT, UPDATE ON `mysql_rest_service_metadata`.`router_status`
    TO 'mysql_rest_service_meta_provider';
GRANT SELECT ON `mysql_rest_service_metadata`.`router_status`
    TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`router_general_log`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`router_general_log`
    TO 'mysql_rest_service_admin';
GRANT INSERT ON `mysql_rest_service_metadata`.`router_general_log`
    TO 'mysql_rest_service_meta_provider';
GRANT SELECT ON `mysql_rest_service_metadata`.`router_general_log`
    TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`router_session`
GRANT SELECT, INSERT, UPDATE, DELETE
    ON `mysql_rest_service_metadata`.`router_session`
    TO 'mysql_rest_service_admin';
GRANT SELECT, INSERT ON `mysql_rest_service_metadata`.`router_session`
    TO 'mysql_rest_service_meta_provider';
GRANT SELECT ON `mysql_rest_service_metadata`.`router_session`
    TO 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev';

-- `mysql_rest_service_metadata`.`router_services`
GRANT SELECT ON `mysql_rest_service_metadata`.`router_services`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- Procedures

-- `mysql_rest_service_metadata`.`get_sequence_id`

GRANT EXECUTE ON FUNCTION `mysql_rest_service_metadata`.`get_sequence_id`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider', 'mysql_rest_service_data_provider';

-- `mysql_rest_service_metadata`.`table_columns_with_references`
GRANT EXECUTE
    ON PROCEDURE `mysql_rest_service_metadata`.`table_columns_with_references`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';


-- -----------------------------------------------------
-- Views

-- `mysql_rest_service_metadata`.`mrs_user_schema_version`
GRANT SELECT
  ON `mysql_rest_service_metadata`.`mrs_user_schema_version`
  TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

-- `mysql_rest_service_metadata`.`object_fields_with_references`
GRANT SELECT
    ON `mysql_rest_service_metadata`.`object_fields_with_references`
    TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_meta_provider';

-- -----------------------------------------------------
-- Grant the necessary mysql_tasks privileges to the MySQL REST Service roles
GRANT 'mysql_task_user' TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_user',
	'mysql_rest_service_meta_provider', 'mysql_rest_service_data_provider';

