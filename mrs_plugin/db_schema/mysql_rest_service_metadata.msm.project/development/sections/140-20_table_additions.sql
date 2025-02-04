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

-- Ensure an email cannot be used as user name and a user name cannot be used as email
ALTER TABLE `mysql_rest_service_metadata`.`mrs_user`
    ADD CONSTRAINT `mrs_user_no_at_symbol_in_user_name` CHECK (INSTR(name, '@') = 0),
    ADD CONSTRAINT `mrs_user_at_symbol_in_email` CHECK (INSTR(email, '@') > 0 OR email IS NULL OR email = '');

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
