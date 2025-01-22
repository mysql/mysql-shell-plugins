-- Copyright (c) 2025, Oracle and/or its affiliates.
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

