-- Copyright (c) 2021, 2025, Oracle and/or its affiliates.
-- Fri Mar 14 10:38:50 2025
-- Model: New Model    Version: 1.0
-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema mysql_rest_service_metadata
-- -----------------------------------------------------
-- Holds metadata information for the MySQL REST Service.
DROP SCHEMA IF EXISTS `mysql_rest_service_metadata` ;

-- -----------------------------------------------------
-- Schema mysql_rest_service_metadata
--
-- Holds metadata information for the MySQL REST Service.
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `mysql_rest_service_metadata` DEFAULT CHARACTER SET utf8 COLLATE utf8_bin ;
USE `mysql_rest_service_metadata` ;

-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`url_host`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`url_host` (
  `id` BINARY(16) NOT NULL,
  `name` VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'Specifies the host name of the MRS as represented in the request URLs. Example: example.com',
  `comments` VARCHAR(512) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `name_UNIQUE` (`name` ASC) VISIBLE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`service`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`service` (
  `id` BINARY(16) NOT NULL,
  `parent_id` BINARY(16) NULL,
  `url_host_id` BINARY(16) NOT NULL,
  `url_context_root` VARCHAR(255) NOT NULL DEFAULT '/mrs' COMMENT 'Specifies context root of the MRS as represented in the request URLs, default being /mrs. URL Example: https://www.example.com/mrs',
  `url_protocol` SET('HTTP', 'HTTPS') NOT NULL DEFAULT 'HTTPS',
  `name` VARCHAR(255) NOT NULL,
  `enabled` TINYINT NOT NULL DEFAULT 1,
  `published` TINYINT NOT NULL DEFAULT 0,
  `in_development` JSON NULL COMMENT 'If not NULL, this column indicates that the REST service is currently \"in development\" and holds the name(s) of the developer(s) who is(/are) allowed to work with the service in the \"$.developers\" string array. REST services with this column not being NULL may use the same url_host+url_context_root context path as existing services. Routers only serve REST services with this column being NULL, unless they are bootstrapped with --mrs-development <user> which sets `router`.`option`->>\"$.developer\". When bootstrapped with the --mrs-development <user> option the Router also serves REST services marked \"in development\" with this column\'s \"$.developers\" including the same name as the <user> specified during bootstrap, while these REST services marked \"in development\" take priority over services with the same url_host+url_context_root context path and this column being NULL.',
  `comments` VARCHAR(512) NULL,
  `options` JSON NULL,
  `auth_path` VARCHAR(255) NOT NULL DEFAULT '/authentication' COMMENT 'The path used for authentication. The following sub-paths will be made available for <service_path>/<auth_path>:  /login /status /logout /completed',
  `auth_completed_url` VARCHAR(255) NULL COMMENT 'The authentication workflow will redirect to this URL after successful- or failed login. If this field is not set, the workflow will redirect to <service_path>/<auth_path>/completed if the <service_path>/<auth_path>/login?onCompletionRedirect parameter has not been set.',
  `auth_completed_url_validation` VARCHAR(512) NULL COMMENT 'A regular expression to validate the <service_path>/<auth_path>/login?onCompletionRedirect parameter. If set, this allows to limit the possible URLs an application can specify for this parameter.',
  `auth_completed_page_content` TEXT NULL COMMENT 'If this field is set its content will replace the page content of the /completed page.',
  `enable_sql_endpoint` TINYINT NOT NULL DEFAULT 0,
  `custom_metadata_schema` VARCHAR(255) NULL,
  `metadata` JSON NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_service_url_host1_idx` (`url_host_id` ASC) VISIBLE,
  INDEX `fk_service_service1_idx` (`parent_id` ASC) VISIBLE,
  CONSTRAINT `fk_service_url_host1`
    FOREIGN KEY (`url_host_id`)
    REFERENCES `mysql_rest_service_metadata`.`url_host` (`id`)
    ON DELETE RESTRICT
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_service_service1`
    FOREIGN KEY (`parent_id`)
    REFERENCES `mysql_rest_service_metadata`.`service` (`id`)
    ON DELETE RESTRICT
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`db_schema`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`db_schema` (
  `id` BINARY(16) NOT NULL,
  `service_id` BINARY(16) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `schema_type` ENUM('DATABASE_SCHEMA', 'SCRIPT_MODULE') NOT NULL DEFAULT 'DATABASE_SCHEMA',
  `request_path` VARCHAR(255) NOT NULL,
  `requires_auth` TINYINT NOT NULL DEFAULT 0,
  `enabled` TINYINT NOT NULL DEFAULT 1,
  `internal` TINYINT NOT NULL DEFAULT 0,
  `items_per_page` INT UNSIGNED NULL DEFAULT 25,
  `comments` VARCHAR(512) NULL,
  `options` JSON NULL,
  `metadata` JSON NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_db_schema_service1_idx` (`service_id` ASC) VISIBLE,
  CONSTRAINT `fk_db_schema_service1`
    FOREIGN KEY (`service_id`)
    REFERENCES `mysql_rest_service_metadata`.`service` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`db_object`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`db_object` (
  `id` BINARY(16) NOT NULL,
  `db_schema_id` BINARY(16) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `request_path` VARCHAR(255) NOT NULL,
  `enabled` TINYINT NOT NULL DEFAULT 1,
  `internal` TINYINT NOT NULL DEFAULT 0,
  `object_type` ENUM('TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION', 'SCRIPT') NOT NULL,
  `crud_operations` SET('CREATE', 'READ', 'UPDATE', 'DELETE') NOT NULL DEFAULT '' COMMENT 'Calculated by the duality view options of object and object_reference table, always UPDATE for procedures and functions.',
  `format` ENUM('FEED', 'ITEM', 'MEDIA') NOT NULL DEFAULT 'FEED' COMMENT 'The HTTP request method for this handler. \'feed\' executes the source query and returns the result set in JSON representation, \'item\' returns a single row instead, \'media\' turns the result set into a binary representation with accompanying HTTP Content-Type header.',
  `items_per_page` INT UNSIGNED NULL,
  `media_type` VARCHAR(45) NULL,
  `auto_detect_media_type` TINYINT NOT NULL DEFAULT 0,
  `requires_auth` TINYINT NOT NULL DEFAULT 0,
  `auth_stored_procedure` VARCHAR(255) NULL DEFAULT 0 COMMENT 'Specifies the STORE PROCEDURE that should be called to identify if the given user is allowed to perform the given CRUD operation. The SP has to be in the same schema as the schema object and it has to accept the following parameters: (user_id, schema, object, crud_operation).  It returns true or false.',
  `options` JSON NULL COMMENT 'Holds additional options for the db_object, e.g. {\"id_generation\": \"auto_increment\"}. \"id_generation\" can be undefined or \"auto_increment\" for tables using AUTO_INCREMENT or \"reverse_uuid\" for tables using DECIMAL(16) for the primary key.',
  `details` JSON NULL,
  `comments` VARCHAR(512) NULL,
  `metadata` JSON NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_db_objects_db_schema1_idx` (`db_schema_id` ASC) INVISIBLE,
  CONSTRAINT `fk_db_objects_db_schema1`
    FOREIGN KEY (`db_schema_id`)
    REFERENCES `mysql_rest_service_metadata`.`db_schema` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`auth_vendor`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`auth_vendor` (
  `id` BINARY(16) NOT NULL,
  `name` VARCHAR(65) NOT NULL,
  `validation_url` VARCHAR(255) NULL COMMENT 'URL used to validate the access_token provided by the client. Example: https://graph.facebook.com/debug_token?input_token=%access_token%&access_token=%app_access_token%',
  `enabled` TINYINT NOT NULL DEFAULT 1,
  `comments` VARCHAR(512) NULL,
  `options` JSON NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`auth_app`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`auth_app` (
  `id` BINARY(16) NOT NULL,
  `auth_vendor_id` BINARY(16) NOT NULL,
  `name` VARCHAR(45) NOT NULL,
  `description` VARCHAR(512) NULL,
  `url` VARCHAR(255) NULL,
  `url_direct_auth` VARCHAR(255) NULL,
  `access_token` VARCHAR(1024) NULL COMMENT 'The app access token to validate the user login.',
  `app_id` VARCHAR(1024) NULL,
  `enabled` TINYINT NULL,
  `limit_to_registered_users` TINYINT NOT NULL DEFAULT 1 COMMENT 'Limit the users that can log in to the list of users in the auth_user table. The auth_user table can be pre-filled with users by specifying the name and email only. The vendor_user_id will be added on the first login automatically.',
  `default_role_id` BINARY(16) NULL COMMENT 'If set, a new user that has not any auth_roles assigned will get this role assigned when he logs in the first time.',
  `options` JSON NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_auth_app_auth_vendor1_idx` (`auth_vendor_id` ASC) VISIBLE,
  UNIQUE INDEX `name_UNIQUE` (`name` ASC) VISIBLE,
  CONSTRAINT `fk_auth_app_auth_vendor1`
    FOREIGN KEY (`auth_vendor_id`)
    REFERENCES `mysql_rest_service_metadata`.`auth_vendor` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`mrs_user`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`mrs_user` (
  `id` BINARY(16) NOT NULL,
  `auth_app_id` BINARY(16) NOT NULL,
  `name` VARCHAR(225) NULL,
  `email` VARCHAR(255) NULL,
  `vendor_user_id` VARCHAR(255) NULL,
  `login_permitted` TINYINT NOT NULL DEFAULT 0,
  `mapped_user_id` VARCHAR(255) NULL,
  `app_options` JSON NULL,
  `auth_string` TEXT NULL,
  `options` JSON NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_auth_user_auth_app1_idx` (`auth_app_id` ASC) VISIBLE,
  INDEX `mrs_use_vendor_user_id` (`vendor_user_id` ASC) VISIBLE,
  INDEX `mrs_user_name` (`name` ASC) VISIBLE,
  INDEX `mrs_user_email` (`email` ASC) VISIBLE,
  CONSTRAINT `fk_auth_user_auth_app1`
    FOREIGN KEY (`auth_app_id`)
    REFERENCES `mysql_rest_service_metadata`.`auth_app` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`config`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`config` (
  `id` TINYINT NOT NULL DEFAULT 1,
  `service_enabled` TINYINT NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`redirect`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`redirect` (
  `id` BINARY(16) NOT NULL,
  `pattern` VARCHAR(1024) NOT NULL,
  `target` VARCHAR(1024) NOT NULL,
  `kind` ENUM('REDIRECT', 'REWRITE') NOT NULL DEFAULT 'REDIRECT',
  `in_development` JSON NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`url_host_alias`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`url_host_alias` (
  `id` BINARY(16) NOT NULL,
  `url_host_id` BINARY(16) NOT NULL,
  `alias` VARCHAR(255) NOT NULL COMMENT 'Specifies additional aliases for the given host, e.g. www.example.com',
  PRIMARY KEY (`id`),
  INDEX `fk_url_host_alias_url_host1_idx` (`url_host_id` ASC) VISIBLE,
  CONSTRAINT `fk_url_host_alias_url_host1`
    FOREIGN KEY (`url_host_id`)
    REFERENCES `mysql_rest_service_metadata`.`url_host` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`content_set`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`content_set` (
  `id` BINARY(16) NOT NULL,
  `service_id` BINARY(16) NOT NULL,
  `content_type` ENUM('STATIC', 'SCRIPTS') NOT NULL DEFAULT 'STATIC',
  `request_path` VARCHAR(255) NOT NULL,
  `requires_auth` TINYINT NOT NULL DEFAULT 0,
  `enabled` TINYINT NOT NULL DEFAULT 0,
  `internal` TINYINT NOT NULL DEFAULT 0,
  `comments` VARCHAR(512) NULL,
  `options` JSON NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_static_content_version_service1_idx` (`service_id` ASC) VISIBLE,
  CONSTRAINT `fk_static_content_version_service1`
    FOREIGN KEY (`service_id`)
    REFERENCES `mysql_rest_service_metadata`.`service` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`content_file`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`content_file` (
  `id` BINARY(16) NOT NULL,
  `content_set_id` BINARY(16) NOT NULL,
  `request_path` VARCHAR(255) NOT NULL DEFAULT '/',
  `requires_auth` TINYINT NOT NULL DEFAULT 0,
  `enabled` TINYINT NOT NULL DEFAULT 1,
  `content` LONGBLOB NOT NULL,
  `size` BIGINT GENERATED ALWAYS AS (LENGTH(content)) STORED,
  `options` JSON NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_content_content_set1_idx` (`content_set_id` ASC) VISIBLE,
  CONSTRAINT `fk_content_content_set1`
    FOREIGN KEY (`content_set_id`)
    REFERENCES `mysql_rest_service_metadata`.`content_set` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`audit_log`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`audit_log` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `schema_name` VARCHAR(255) NULL,
  `table_name` VARCHAR(255) NOT NULL,
  `dml_type` ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  `old_row_data` JSON NULL,
  `new_row_data` JSON NULL,
  `changed_by` VARCHAR(255) NOT NULL,
  `changed_at` TIMESTAMP NOT NULL,
  `old_row_id` BINARY(16) NULL,
  `new_row_id` BINARY(16) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_table_name` (`table_name` ASC) VISIBLE,
  INDEX `idx_changed_at` (`changed_at` ASC) VISIBLE,
  INDEX `idx_changed_by` (`changed_by` ASC) VISIBLE,
  INDEX `idx_new_row_id` (`new_row_id` ASC) VISIBLE,
  INDEX `idx_old_row_id` (`old_row_id` ASC) VISIBLE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`mrs_role`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`mrs_role` (
  `id` BINARY(16) NOT NULL,
  `derived_from_role_id` BINARY(16) NULL,
  `specific_to_service_id` BINARY(16) NULL,
  `caption` VARCHAR(150) NOT NULL,
  `description` VARCHAR(512) NULL,
  `options` JSON NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_priv_role_priv_role1_idx` (`derived_from_role_id` ASC) VISIBLE,
  INDEX `fk_auth_role_service1_idx` (`specific_to_service_id` ASC) VISIBLE,
  UNIQUE INDEX `unique_caption_per_service` (`specific_to_service_id` ASC, `caption` ASC) VISIBLE,
  CONSTRAINT `fk_priv_role_priv_role1`
    FOREIGN KEY (`derived_from_role_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_role` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_auth_role_service1`
    FOREIGN KEY (`specific_to_service_id`)
    REFERENCES `mysql_rest_service_metadata`.`service` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`mrs_user_has_role`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`mrs_user_has_role` (
  `user_id` BINARY(16) NOT NULL,
  `role_id` BINARY(16) NOT NULL,
  `comments` VARCHAR(512) NULL,
  `options` JSON NULL,
  PRIMARY KEY (`user_id`, `role_id`),
  INDEX `fk_auth_user_has_privilege_role_privilege_role1_idx` (`role_id` ASC) VISIBLE,
  INDEX `fk_auth_user_has_privilege_role_auth_user1_idx` (`user_id` ASC) VISIBLE,
  CONSTRAINT `fk_auth_user_has_privilege_role_auth_user1`
    FOREIGN KEY (`user_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_auth_user_has_privilege_role_privilege_role1`
    FOREIGN KEY (`role_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_role` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`mrs_user_hierarchy_type`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`mrs_user_hierarchy_type` (
  `id` BINARY(16) NOT NULL,
  `caption` VARCHAR(150) NULL,
  `description` VARCHAR(512) NULL,
  `specific_to_service_id` BINARY(16) NULL,
  `options` JSON NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_user_hierarchy_type_service1_idx` (`specific_to_service_id` ASC) VISIBLE,
  CONSTRAINT `fk_user_hierarchy_type_service1`
    FOREIGN KEY (`specific_to_service_id`)
    REFERENCES `mysql_rest_service_metadata`.`service` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`mrs_user_hierarchy`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`mrs_user_hierarchy` (
  `user_id` BINARY(16) NOT NULL,
  `reporting_to_user_id` BINARY(16) NOT NULL,
  `user_hierarchy_type_id` BINARY(16) NOT NULL,
  `options` JSON NULL,
  PRIMARY KEY (`user_id`, `reporting_to_user_id`, `user_hierarchy_type_id`),
  INDEX `fk_user_hierarchy_auth_user2_idx` (`reporting_to_user_id` ASC) VISIBLE,
  INDEX `fk_user_hierarchy_hierarchy_type1_idx` (`user_hierarchy_type_id` ASC) VISIBLE,
  CONSTRAINT `fk_user_hierarchy_auth_user1`
    FOREIGN KEY (`user_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_user_hierarchy_auth_user2`
    FOREIGN KEY (`reporting_to_user_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_user_hierarchy_hierarchy_type1`
    FOREIGN KEY (`user_hierarchy_type_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user_hierarchy_type` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`mrs_privilege`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`mrs_privilege` (
  `id` BINARY(16) NOT NULL,
  `role_id` BINARY(16) NOT NULL,
  `crud_operations` SET('CREATE', 'READ', 'UPDATE', 'DELETE') NOT NULL DEFAULT '',
  `service_path` VARCHAR(512) NOT NULL DEFAULT '*',
  `schema_path` VARCHAR(255) NOT NULL DEFAULT '*',
  `object_path` VARCHAR(255) NOT NULL DEFAULT '*',
  `options` JSON NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_priv_on_schema_auth_role1`
    FOREIGN KEY (`role_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_role` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`mrs_user_group`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`mrs_user_group` (
  `id` BINARY(16) NOT NULL,
  `specific_to_service_id` BINARY(16) NULL,
  `caption` VARCHAR(45) NULL,
  `description` VARCHAR(512) NULL,
  `options` JSON NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_user_group_service1_idx` (`specific_to_service_id` ASC) VISIBLE,
  CONSTRAINT `fk_user_group_service1`
    FOREIGN KEY (`specific_to_service_id`)
    REFERENCES `mysql_rest_service_metadata`.`service` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`mrs_user_group_has_role`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`mrs_user_group_has_role` (
  `user_group_id` BINARY(16) NOT NULL,
  `role_id` BINARY(16) NOT NULL,
  `options` JSON NULL,
  PRIMARY KEY (`user_group_id`, `role_id`),
  INDEX `fk_user_group_has_auth_role_auth_role1_idx` (`role_id` ASC) VISIBLE,
  INDEX `fk_user_group_has_auth_role_user_group1_idx` (`user_group_id` ASC) VISIBLE,
  CONSTRAINT `fk_user_group_has_auth_role_user_group1`
    FOREIGN KEY (`user_group_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user_group` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_user_group_has_auth_role_auth_role1`
    FOREIGN KEY (`role_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_role` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`mrs_user_has_group`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`mrs_user_has_group` (
  `user_id` BINARY(16) NOT NULL,
  `user_group_id` BINARY(16) NOT NULL,
  `comments` VARCHAR(512) NULL,
  `options` JSON NULL,
  PRIMARY KEY (`user_id`, `user_group_id`),
  INDEX `fk_auth_user_has_user_group_user_group1_idx` (`user_group_id` ASC) VISIBLE,
  INDEX `fk_auth_user_has_user_group_auth_user1_idx` (`user_id` ASC) VISIBLE,
  CONSTRAINT `fk_auth_user_has_user_group_auth_user1`
    FOREIGN KEY (`user_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_auth_user_has_user_group_user_group1`
    FOREIGN KEY (`user_group_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user_group` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`mrs_group_hierarchy_type`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`mrs_group_hierarchy_type` (
  `id` BINARY(16) NOT NULL,
  `caption` VARCHAR(150) NULL,
  `description` VARCHAR(512) NULL,
  `options` JSON NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`mrs_user_group_hierarchy`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`mrs_user_group_hierarchy` (
  `user_group_id` BINARY(16) NOT NULL,
  `parent_group_id` BINARY(16) NOT NULL,
  `group_hierarchy_type_id` BINARY(16) NOT NULL,
  `level` INT UNSIGNED NOT NULL DEFAULT 0,
  `options` JSON NULL,
  PRIMARY KEY (`user_group_id`, `parent_group_id`, `group_hierarchy_type_id`),
  INDEX `fk_user_group_has_user_group_user_group2_idx` (`parent_group_id` ASC) VISIBLE,
  INDEX `fk_user_group_has_user_group_user_group1_idx` (`user_group_id` ASC) VISIBLE,
  INDEX `fk_user_group_hierarchy_group_hierarchy_type1_idx` (`group_hierarchy_type_id` ASC) VISIBLE,
  CONSTRAINT `fk_user_group_has_user_group_user_group1`
    FOREIGN KEY (`user_group_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user_group` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_user_group_has_user_group_user_group2`
    FOREIGN KEY (`parent_group_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user_group` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_user_group_hierarchy_group_hierarchy_type1`
    FOREIGN KEY (`group_hierarchy_type_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_group_hierarchy_type` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`mrs_db_object_row_group_security`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`mrs_db_object_row_group_security` (
  `db_object_id` BINARY(16) NOT NULL,
  `group_hierarchy_type_id` BINARY(16) NOT NULL,
  `row_group_ownership_column` VARCHAR(255) NOT NULL,
  `level` INT UNSIGNED NOT NULL DEFAULT 0,
  `match_level` ENUM('HIGHER', 'EQUAL OR HIGHER', 'EQUAL', 'LOWER OR EQUAL', 'LOWER') NOT NULL DEFAULT 'HIGHER',
  `options` JSON NULL,
  INDEX `fk_table1_db_object1_idx` (`db_object_id` ASC) VISIBLE,
  INDEX `fk_db_object_row_security_group_hierarchy_type1_idx` (`group_hierarchy_type_id` ASC) VISIBLE,
  PRIMARY KEY (`db_object_id`, `group_hierarchy_type_id`),
  CONSTRAINT `fk_table1_db_object1`
    FOREIGN KEY (`db_object_id`)
    REFERENCES `mysql_rest_service_metadata`.`db_object` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_db_object_row_security_group_hierarchy_type1`
    FOREIGN KEY (`group_hierarchy_type_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_group_hierarchy_type` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`router`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`router` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'The ID of the router instance that uniquely identifies the router on this MySQL REST Service setup.',
  `router_name` VARCHAR(255) NOT NULL COMMENT 'A user specified name for an instance of the router. Should default to address:port, where port is the http server port of the router. Set via --name during router bootstrap.',
  `address` VARCHAR(255) CHARACTER SET 'ascii' COLLATE 'ascii_general_ci' NOT NULL COMMENT 'Network address of the host the Router is running on. Set via --report--host during bootstrap.',
  `product_name` VARCHAR(128) NOT NULL COMMENT 'The product name of the routing component, e.g. \'MySQL Router\'',
  `version` VARCHAR(12) NULL COMMENT 'The version of the router instance. Updated on bootstrap and each startup of the router instance. Format: x.y.z, 3 digits for each component. Managed by Router.',
  `last_check_in` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'A timestamp updated by the router every hour with the current time. This timestamp is used to detect routers that are no longer used or stalled. Managed by Router.',
  `attributes` JSON NULL COMMENT 'Router specific custom attributes. Managed by Router.',
  `options` JSON NULL COMMENT 'Router instance specific configuration options.',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `address_router_name` (`address` ASC, `router_name` ASC) VISIBLE)
ENGINE = InnoDB
COMMENT = 'no_audit_log';


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`router_status`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`router_status` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `router_id` INT UNSIGNED NOT NULL,
  `status_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'The time the status was reported',
  `timespan` INT UNSIGNED NOT NULL COMMENT 'The timespan of the measuring interval',
  `mysql_connections` INT UNSIGNED NOT NULL DEFAULT 0,
  `mysql_queries` INT UNSIGNED NOT NULL DEFAULT 0,
  `http_requests_get` INT UNSIGNED NOT NULL DEFAULT 0,
  `http_requests_post` INT UNSIGNED NOT NULL DEFAULT 0,
  `http_requests_put` INT UNSIGNED NOT NULL DEFAULT 0,
  `http_requests_delete` INT UNSIGNED NOT NULL DEFAULT 0,
  `active_mysql_connections` INT UNSIGNED NOT NULL DEFAULT 0,
  `details` JSON NULL COMMENT 'More detailed status information',
  PRIMARY KEY (`id`),
  INDEX `fk_router_status_router1_idx` (`router_id` ASC) VISIBLE,
  INDEX `status_time` (`status_time` ASC) VISIBLE,
  CONSTRAINT `fk_router_status_router1`
    FOREIGN KEY (`router_id`)
    REFERENCES `mysql_rest_service_metadata`.`router` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
COMMENT = 'no_audit_log';


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`router_session`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`router_session` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BINARY(16) NOT NULL,
  `service_id` BINARY(16) NOT NULL,
  `expires` DATETIME NOT NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB
COMMENT = 'no_audit_log';


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`router_general_log`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`router_general_log` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `router_id` INT UNSIGNED NOT NULL,
  `router_session_id` INT UNSIGNED NULL,
  `log_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `log_type` ENUM("INFO", "WARNING", "ERROR") NOT NULL,
  `code` SMALLINT UNSIGNED NULL,
  `message` VARCHAR(255) NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_router_general_log_router1_idx` (`router_id` ASC) VISIBLE,
  INDEX `log_time` (`log_time` ASC) VISIBLE,
  INDEX `fk_router_general_log_router_session1_idx` (`router_session_id` ASC) VISIBLE,
  CONSTRAINT `fk_router_general_log_router1`
    FOREIGN KEY (`router_id`)
    REFERENCES `mysql_rest_service_metadata`.`router` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_router_general_log_router_session1`
    FOREIGN KEY (`router_session_id`)
    REFERENCES `mysql_rest_service_metadata`.`router_session` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
COMMENT = 'no_audit_log';


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`object`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`object` (
  `id` BINARY(16) NOT NULL,
  `db_object_id` BINARY(16) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `kind` ENUM('RESULT', 'PARAMETERS', 'INTERFACE') NOT NULL DEFAULT 'RESULT',
  `position` INT NOT NULL DEFAULT 0,
  `row_ownership_field_id` BINARY(16) NULL,
  `options` JSON NULL COMMENT 'Holds data mapping view options for INSERT, UPDATE, DELETE and CHECK, e.g. { dataMappingViewInsert: true, dataMappingViewUpdate: true, dataMappingViewDelete: false, dataMappingViewNoCheck: false }',
  `sdk_options` JSON NULL,
  `comments` VARCHAR(512) NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_result_db_object1_idx` (`db_object_id` ASC) VISIBLE,
  INDEX `row_ownership_object_idx` (`row_ownership_field_id` ASC) VISIBLE,
  CONSTRAINT `fk_result_db_object1`
    FOREIGN KEY (`db_object_id`)
    REFERENCES `mysql_rest_service_metadata`.`db_object` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`object_reference`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`object_reference` (
  `id` BINARY(16) NOT NULL,
  `reduce_to_value_of_field_id` BINARY(16) NULL COMMENT 'If set to an object_field, this reference will be reduced to the value of the given field. Example: \"films\": [ { \"categories\": [ \"Thriller\", \"Action\"] } ] instead of \"films\": [ { \"categories\": [ { \"name\": \"Thriller\" }, { \"name\": \"Action\" } ] } ],',
  `row_ownership_field_id` BINARY(16) NULL,
  `reference_mapping` JSON NOT NULL COMMENT 'Holds all column mappings of the FK, {kind:\"n:1\", constraint: \"constraint_name\", referenced_schema: \"schema_name\", referenced_table: \"table_name\", column_mapping: [{\"column_name\": \"referenced_column_name\"}, \"to_many\": true, \"id_generation\": \"auto_increment\"}. \"id_generation\" can be undefined or \"auto_increment\" for tables using AUTO_INCREMENT or \"reverse_uuid\" for tables using BINARY(16) for the primary key.',
  `unnest` BIT(1) NOT NULL DEFAULT 0 COMMENT 'If set to TRUE, the properties will be directly added to the parent',
  `options` JSON NULL COMMENT 'Holds data mapping view options for INSERT, UPDATE, DELETE and CHECK, e.g. { dataMappingViewInsert: true, dataMappingViewUpdate: true, dataMappingViewDelete: false, dataMappingViewNoCheck: false }',
  `sdk_options` JSON NULL,
  `comments` VARCHAR(512) NULL,
  PRIMARY KEY (`id`),
  INDEX `reduce_to_idx` (`reduce_to_value_of_field_id` ASC) VISIBLE,
  INDEX `row_ownership_object_reference_idx` (`row_ownership_field_id` ASC) VISIBLE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`object_field`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`object_field` (
  `id` BINARY(16) NOT NULL,
  `object_id` BINARY(16) NOT NULL,
  `parent_reference_id` BINARY(16) NULL,
  `represents_reference_id` BINARY(16) NULL,
  `name` VARCHAR(255) NOT NULL COMMENT 'The name of the field as returned in the JSON',
  `position` INT NOT NULL,
  `db_column` JSON NULL COMMENT 'Holds information about the original database column, e.g. {\"name\": \"first_name\", \"datatype\":\"VARCHAR(45)\", \"not_null\": true, \"is_primary\": false, \"is_unique\": false, \"is_generated\": false, \"auto_inc\": false}. When representing a STORED PROCEDURE parameter, two optional fields can be set, {\"in\": true, \"out\": false}',
  `enabled` BIT(1) NOT NULL DEFAULT 1 COMMENT 'When set to FALSE, the property is hidden from the result',
  `allow_filtering` BIT(1) NOT NULL DEFAULT 1 COMMENT 'When set to FALSE the property is not available for filtering',
  `allow_sorting` BIT(1) NOT NULL DEFAULT 0 COMMENT 'When set to TRUE the field can be used for ordering',
  `no_check` BIT(1) NOT NULL DEFAULT 0 COMMENT 'Specifies whether the field should be ignored in the scope of concurrency control',
  `no_update` BIT(1) NOT NULL DEFAULT 0 COMMENT 'If set to 1 then no updates of this field are allowed.',
  `json_schema` JSON NULL,
  `options` JSON NULL,
  `sdk_options` JSON NULL,
  `comments` VARCHAR(512) NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_properties_result1_idx` (`object_id` ASC) VISIBLE,
  INDEX `fk_result_property_result_reference1_idx` (`parent_reference_id` ASC) VISIBLE,
  INDEX `fk_result_property_result_reference2_idx` (`represents_reference_id` ASC) VISIBLE,
  CONSTRAINT `fk_properties_result1`
    FOREIGN KEY (`object_id`)
    REFERENCES `mysql_rest_service_metadata`.`object` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_result_property_result_reference1`
    FOREIGN KEY (`parent_reference_id`)
    REFERENCES `mysql_rest_service_metadata`.`object_reference` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_result_property_result_reference2`
    FOREIGN KEY (`represents_reference_id`)
    REFERENCES `mysql_rest_service_metadata`.`object_reference` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`service_has_auth_app`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`service_has_auth_app` (
  `service_id` BINARY(16) NOT NULL,
  `auth_app_id` BINARY(16) NOT NULL,
  `options` JSON NULL,
  PRIMARY KEY (`service_id`, `auth_app_id`),
  INDEX `fk_service_has_auth_app_auth_app1_idx` (`auth_app_id` ASC) VISIBLE,
  INDEX `fk_service_has_auth_app_service1_idx` (`service_id` ASC) VISIBLE,
  CONSTRAINT `fk_service_has_auth_app_service1`
    FOREIGN KEY (`service_id`)
    REFERENCES `mysql_rest_service_metadata`.`service` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_service_has_auth_app_auth_app1`
    FOREIGN KEY (`auth_app_id`)
    REFERENCES `mysql_rest_service_metadata`.`auth_app` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`content_set_has_obj_def`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`content_set_has_obj_def` (
  `content_set_id` BINARY(16) NOT NULL,
  `db_object_id` BINARY(16) NOT NULL,
  `kind` ENUM('Script', 'BeforeCreate', 'BeforeRead', 'BeforeUpdate', 'BeforeDelete', 'AfterCreate', 'AfterRead', 'AfterUpdate', 'AfterDelete') NOT NULL,
  `priority` INT NOT NULL DEFAULT 0,
  `language` VARCHAR(45) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `class_name` VARCHAR(255) NULL,
  `comments` VARCHAR(512) NULL,
  `options` JSON NULL,
  INDEX `fk_content_set_has_obj_dev_db_object1_idx` (`db_object_id` ASC) VISIBLE,
  INDEX `fk_content_set_has_obj_dev_content_set1_idx` (`content_set_id` ASC) VISIBLE,
  INDEX `content_set_has_obj_dev_priority` (`priority` ASC) VISIBLE,
  PRIMARY KEY (`content_set_id`, `db_object_id`, `kind`, `priority`),
  INDEX `content_set_has_obj_dev_method_type` (`kind` ASC) VISIBLE,
  CONSTRAINT `fk_content_set_has_db_object_content_set1`
    FOREIGN KEY (`content_set_id`)
    REFERENCES `mysql_rest_service_metadata`.`content_set` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_content_set_has_db_object_db_object1`
    FOREIGN KEY (`db_object_id`)
    REFERENCES `mysql_rest_service_metadata`.`db_object` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`audit_log_status`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`audit_log_status` (
  `id` TINYINT NOT NULL,
  `last_dump_at` TIMESTAMP NULL,
  `data` JSON NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB
COMMENT = 'no_audit_log';


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
