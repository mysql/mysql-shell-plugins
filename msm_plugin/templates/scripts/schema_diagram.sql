-- Copyright (c) 2025, Oracle and/or its affiliates.
-- -----------------------------------------------------
-- Table `msm_schema_diagram`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `msm_schema_diagram`;
CREATE TABLE IF NOT EXISTS `msm_schema_diagram` (
  `id` BINARY(16) NOT NULL,
  `name` VARCHAR(255) GENERATED ALWAYS AS (
        CAST(`diagram`->>"$.caption" as CHAR(255))
    COLLATE utf8mb4_bin
    ) VIRTUAL COMMENT 'The name of the diagram.',
  `diagram` JSON NOT NULL COMMENT 'Holds the diagram data in JSON format.',
  PRIMARY KEY (`id`),
  INDEX `name_idx`(`name`) )
ENGINE = InnoDB;
