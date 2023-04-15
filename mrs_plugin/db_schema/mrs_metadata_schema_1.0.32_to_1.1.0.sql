-- Copyright (c) 2022, 2023, Oracle and/or its affiliates.

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

USE `mysql_rest_service_metadata`;

-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`object`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`object` (
  `id` BINARY(16) NOT NULL,
  `db_object_id` BINARY(16) NOT NULL,
  `position` INT NOT NULL DEFAULT 0,
  `sdk_options` JSON NULL,
  `comments` VARCHAR(512) NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_result_db_object1_idx` (`db_object_id` ASC) VISIBLE,
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
  `reduce_to_value_of_field_id` BINARY(16) NOT NULL COMMENT 'If set to an object_field, this reference will be reduced to the value of the given field. Example: \"films\": [ { \"categories\": [ \"Thriller\", \"Action\"] } ] instead of \"films\": [ { \"categories\": [ { \"name\": \"Thriller\" }, { \"name\": \"Action\" } ] } ],',
  `reference_mapping` JSON NOT NULL COMMENT 'Holds all column mappings of the FK, {fkContraintName: \"constraint_name\", referencedSchema: \"schema_name\", referencedSchemaObject: \"table_name\", columnMapping: [{“column_name”: “referenced_column_name”}, ...}',
  `unnest` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'If set to TRUE, the properties will be directly added to the parent',
  `crud_operations` SET('CREATE', 'READ', 'UPDATE', 'DELETE') NOT NULL DEFAULT 'READ',
  `sdk_options` JSON NULL,
  `comments` VARCHAR(512) NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_result_reference_result_property1_idx` (`reduce_to_value_of_field_id` ASC) VISIBLE,
  CONSTRAINT `fk_result_reference_result_property1`
    FOREIGN KEY (`reduce_to_value_of_field_id`)
    REFERENCES `mysql_rest_service_metadata`.`object_field` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `mysql_rest_service_metadata`.`object_field`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mysql_rest_service_metadata`.`object_field` (
  `id` BINARY(16) NOT NULL,
  `object_id` BINARY(16) NOT NULL,
  `parent_reference_id` BINARY(16) NULL,
  `represents_reference_id` BINARY(16) NULL,
  `name` VARCHAR(255) NOT NULL COMMENT 'The name of the property',
  `db_name` VARCHAR(255) NULL,
  `db_datatype` VARCHAR(45) NULL COMMENT 'The actual MySQL datatype or NULL if the property represents a result_reference',
  `enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'When set to FALSE, the property is hidden from the result',
  `allow_filtering` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'When set to FALSE the property is not available for filtering',
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

DELIMITER $$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `object` FOR EACH ROW
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
            "position", NEW.position,
            "sdk_options", NEW.sdk_options,
            "comments", NEW.comments),
        NULL,
        NEW.id,
        CURRENT_USER(), 
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `object` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "object", 
        "UPDATE", 
        JSON_OBJECT(
            "id", OLD.id,
            "db_object_id", OLD.db_object_id,
            "position", OLD.position,
            "sdk_options", OLD.sdk_options,
            "comments", OLD.comments),
        JSON_OBJECT(
            "id", NEW.id,
            "db_object_id", NEW.db_object_id,
            "position", NEW.position,
            "sdk_options", NEW.sdk_options,
            "comments", NEW.comments),
        OLD.id,
        NEW.id,
        CURRENT_USER(), 
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `object` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "object", 
        "DELETE", 
        JSON_OBJECT(
            "id", OLD.id,
            "db_object_id", OLD.db_object_id,
            "position", OLD.position,
            "sdk_options", OLD.sdk_options,
            "comments", OLD.comments),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(), 
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_field_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `object_field` FOR EACH ROW
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
            "db_name", NEW.db_name,
            "db_datatype", NEW.db_datatype,
            "enabled", NEW.enabled,
            "allow_filtering", NEW.allow_filtering,
            "sdk_options", NEW.sdk_options,
            "comments", NEW.comments),
        NULL,
        NEW.id,
        CURRENT_USER(), 
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_field_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `object_field` FOR EACH ROW
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
            "db_name", OLD.db_name,
            "db_datatype", OLD.db_datatype,
            "enabled", OLD.enabled,
            "allow_filtering", OLD.allow_filtering,
            "sdk_options", OLD.sdk_options,
            "comments", OLD.comments),
        JSON_OBJECT(
            "id", NEW.id,
            "object_id", NEW.object_id,
            "parent_reference_id", NEW.parent_reference_id,
            "represents_reference_id", NEW.represents_reference_id,
            "name", NEW.name,
            "db_name", NEW.db_name,
            "db_datatype", NEW.db_datatype,
            "enabled", NEW.enabled,
            "allow_filtering", NEW.allow_filtering,
            "sdk_options", NEW.sdk_options,
            "comments", NEW.comments),
        OLD.id,
        NEW.id,
        CURRENT_USER(), 
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_field_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `object_field` FOR EACH ROW
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
            "db_name", OLD.db_name,
            "db_datatype", OLD.db_datatype,
            "enabled", OLD.enabled,
            "allow_filtering", OLD.allow_filtering,
            "sdk_options", OLD.sdk_options,
            "comments", OLD.comments),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(), 
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_reference_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `object_reference` FOR EACH ROW
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
            "reference_mapping", NEW.reference_mapping,
            "unnest", NEW.unnest,
            "crud_operations", NEW.crud_operations,
            "sdk_options", NEW.sdk_options,
            "comments", NEW.comments),
        NULL,
        NEW.id,
        CURRENT_USER(), 
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_reference_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `object_reference` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "object_reference", 
        "UPDATE", 
        JSON_OBJECT(
            "id", OLD.id,
            "reduce_to_value_of_field_id", OLD.reduce_to_value_of_field_id,
            "reference_mapping", OLD.reference_mapping,
            "unnest", OLD.unnest,
            "crud_operations", OLD.crud_operations,
            "sdk_options", OLD.sdk_options,
            "comments", OLD.comments),
        JSON_OBJECT(
            "id", NEW.id,
            "reduce_to_value_of_field_id", NEW.reduce_to_value_of_field_id,
            "reference_mapping", NEW.reference_mapping,
            "unnest", NEW.unnest,
            "crud_operations", NEW.crud_operations,
            "sdk_options", NEW.sdk_options,
            "comments", NEW.comments),
        OLD.id,
        NEW.id,
        CURRENT_USER(), 
        CURRENT_TIMESTAMP
    );
END$$

CREATE TRIGGER `mysql_rest_service_metadata`.`object_reference_AFTER_DELETE_AUDIT_LOG` AFTER DELETE ON `object_reference` FOR EACH ROW
BEGIN
	INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
		table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
	VALUES (
        "object_reference", 
        "DELETE", 
        JSON_OBJECT(
            "id", OLD.id,
            "reduce_to_value_of_field_id", OLD.reduce_to_value_of_field_id,
            "reference_mapping", OLD.reference_mapping,
            "unnest", OLD.unnest,
            "crud_operations", OLD.crud_operations,
            "sdk_options", OLD.sdk_options,
            "comments", OLD.comments),
        NULL,
        OLD.id,
        NULL,
        CURRENT_USER(), 
        CURRENT_TIMESTAMP
    );
END$$

DELIMITER ;

ALTER SQL SECURITY INVOKER VIEW `schema_version` (major, minor, patch) AS SELECT 1, 1, 0;

ALTER SQL SECURITY INVOKER VIEW `mrs_user_schema_version` (major, minor, patch) AS SELECT 1, 1, 0;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;