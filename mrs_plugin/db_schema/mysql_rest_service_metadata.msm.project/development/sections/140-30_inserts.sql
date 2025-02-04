-- Copyright (c) 2025, Oracle and/or its affiliates.
-- -----------------------------------------------------
-- INSERTs

-- -----------------------------------------------------------------------------
-- Host filter that matches any string
INSERT INTO `mysql_rest_service_metadata`.`url_host` (`id`, `name`, `comments`)
VALUES (0x31, '', 'Match any host');

-- -----------------------------------------------------------------------------
-- MRS Authentication Vendors
INSERT INTO `mysql_rest_service_metadata`.`auth_vendor` (
    `id`, `name`, `validation_url`, `enabled`, `comments`, `options`)
VALUES (0x30, 'MRS', NULL, 1, 'Built-in user management of MRS', NULL);

INSERT INTO `mysql_rest_service_metadata`.`auth_vendor` (
    `id`, `name`, `validation_url`, `enabled`, `comments`, `options`)
VALUES (0x31, 'MySQL Internal', NULL, 1,
    'Provides basic authentication via MySQL Server accounts', NULL);

INSERT INTO `mysql_rest_service_metadata`.`auth_vendor` (
    `id`, `name`, `validation_url`, `enabled`, `comments`, `options`)
VALUES (0x32, 'Facebook', NULL, 1, 'Uses the Facebook Login OAuth2 service',
    NULL);

INSERT INTO `mysql_rest_service_metadata`.`auth_vendor` (
    `id`, `name`, `validation_url`, `enabled`, `comments`, `options`)
VALUES (0x34, 'Google', NULL, 1, 'Uses the Google OAuth2 service', NULL);

INSERT INTO `mysql_rest_service_metadata`.`auth_vendor` (
    `id`, `name`, `validation_url`, `enabled`, `comments`, `options`)
VALUES (0x35, 'OCI OAuth2', NULL, 1, 'Uses the OCI OAuth2 service', NULL);

-- Default MySQL auth_app for MySQL Internal Authentication
INSERT INTO `mysql_rest_service_metadata`.`auth_app` (
    `id`, `auth_vendor_id`, `name`, `description`, `enabled`,
    `limit_to_registered_users`, `default_role_id`, `options`)
VALUES (0x31, 0x31, 'MySQL',
    'Provide login capabilities for MySQL Server user accounts.',
    TRUE, FALSE, 0x31, NULL);

-- Default role for full access
INSERT INTO `mysql_rest_service_metadata`.`mrs_role` (
    `id`, `derived_from_role_id`, `specific_to_service_id`, `caption`,
    `description`, `options`)
VALUES (0x31, NULL, NULL, 'Full Access', 'Full access to all db_objects', NULL);

-- Default privilege that defines full access
INSERT INTO `mysql_rest_service_metadata`.`mrs_privilege` (
    `id`, `role_id`, `crud_operations`, `service_path`, `schema_path`,
    `object_path`, `options`)
VALUES (0x31, 0x31, 'CREATE,READ,UPDATE,DELETE', DEFAULT, DEFAULT, DEFAULT,
    NULL);

-- User hierarchy types
INSERT INTO `mysql_rest_service_metadata`.`mrs_user_hierarchy_type` (
    `id`, `caption`, `description`, `specific_to_service_id`, `options`)
VALUES (0x31, 'Direct Report', 'An employee directly reporting to the user',
    NULL, NULL);
INSERT INTO `mysql_rest_service_metadata`.`mrs_user_hierarchy_type` (
    `id`, `caption`, `description`, `specific_to_service_id`, `options`)
VALUES (0x32, 'Dotted Line Report',
    'An employee reporting to the user via a dotted line relationship',
    NULL, NULL);

-- -----------------------------------------------------------------------------
-- Base entry for audit_log_status, indicating that no dump has yet happened
INSERT INTO `mysql_rest_service_metadata`.`audit_log_status` (
    `id`, `last_dump_at`, `data`) VALUES (1, NULL, NULL);
