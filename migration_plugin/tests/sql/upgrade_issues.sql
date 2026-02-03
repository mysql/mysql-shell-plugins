-- Copyright (c) 2025, 2026, Oracle and/or its affiliates.
--
-- This program is free software; you can redistribute it and/or modify
-- it under the terms of the GNU General Public License, version 2.0,
-- as published by the Free Software Foundation.
--
-- This program is designed to work with certain software (including
-- but not limited to OpenSSL) that is licensed under separate terms, as
-- designated in a particular file or component or in included license
-- documentation.  The authors of MySQL hereby grant you an additional
-- permission to link the program and your derivative works with the
-- separately licensed software that they have either included with
-- the program or referenced in the documentation.
--
-- This program is distributed in the hope that it will be useful,  but
-- WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
-- the GNU General Public License, version 2.0, for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program; if not, write to the Free Software Foundation, Inc.,
-- 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

-- save the sql_mode removing NO_AUTO_CREATE_USER, we don't want to use it, as
-- it will generate UC issues
SET @old_sql_mode = REPLACE(@@sql_mode, 'NO_AUTO_CREATE_USER', '');
SET @@sql_mode = @old_sql_mode;

CREATE SCHEMA `upgrade_issues`;
USE `upgrade_issues`;

-- reservedKeywords

CREATE TABLE `system` (`json_table` integer, `cube` int);
CREATE TRIGGER `first_value` AFTER DELETE ON `system` FOR EACH ROW BEGIN END;
CREATE VIEW `lateral` AS SELECT NOW();
CREATE FUNCTION `array`() RETURNS INT DETERMINISTIC RETURN 1;
CREATE PROCEDURE `rows`() DETERMINISTIC BEGIN END;
CREATE EVENT `lead` ON SCHEDULE EVERY 1 YEAR DO BEGIN END;

-- utf8mb3

CREATE TABLE `test_utf8mb3` (a varchar(64) charset 'utf8mb3');

-- nonNativePartitioning

CREATE TABLE non_native_partitioning(a INT) ENGINE=MyISAM
PARTITION BY RANGE(a) (
  PARTITION p0 VALUES LESS THAN (1000),
  PARTITION p1 VALUES LESS THAN MAXVALUE
);

-- foreignKeyLength

CREATE TABLE `_123456789112345678921234567893123456789412345678951234567896123`(
    ref_id INT UNSIGNED
);

CREATE TABLE `foreign_key_length`(
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY
);

ALTER TABLE `_123456789112345678921234567893123456789412345678951234567896123`
ADD FOREIGN KEY (
    ref_id
) REFERENCES `foreign_key_length` (
    id
);

-- maxdbSqlModeFlags
-- obsoleteSqlModeFlags

SET @@sql_mode = 'MAXDB';

CREATE TRIGGER `maxdb_sql_mode_flags` AFTER DELETE ON `system` FOR EACH ROW BEGIN END;

SET @@sql_mode = @old_sql_mode;

-- enumSetElementLength

CREATE TABLE `enum_element_length` (e ENUM('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddeeeeee'));
CREATE TABLE `set_element_length` (s SET('a', 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwvvvvvvvvvv', 'b', 'c'));

-- removedFunctions

CREATE FUNCTION `removed_functions`() RETURNS TEXT DETERMINISTIC RETURN ENCRYPT('123');

-- groupbyAscSyntax

CREATE TABLE `group_by_asc_syntax_t` (title VARCHAR(100), genre VARCHAR(100), year_produced YEAR);
CREATE VIEW `group_by_asc_syntax_v` AS SELECT genre, COUNT(*), year_produced FROM `group_by_asc_syntax_t` GROUP BY genre DESC;

-- zeroDates

SET @@sql_mode = '';

CREATE TABLE `zero_dates` (i INTEGER, dt DATETIME DEFAULT '0000-00-00', ts TIMESTAMP DEFAULT '0000-00-00', d DATE DEFAULT '0000-00-00');

SET @@sql_mode = @old_sql_mode;

-- columnsWhichCannotHaveDefaults

SET @@sql_mode = '';

CREATE TABLE `columns_which_cannot_have_defaults` (p POINT NOT NULL DEFAULT '');

SET @@sql_mode = @old_sql_mode;

-- orphanedObjects

--#ifdef HAS_MYSQL_PROC
INSERT INTO mysql.proc VALUES (
    'upgrade_issues_ex',
    'orphaned_procedure',
    'PROCEDURE',
    'orphaned_procedure',
    'SQL',
    'CONTAINS_SQL',
    'NO',
    'DEFINER',
    '',
    '',
    _binary 'begin\nselect count(*) from somedb.sometable;\nend',
    'root@localhost',
    '2022-11-23 11:46:34',
    '2022-11-23 11:46:34',
    'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION',
    '',
    'utf8mb4',
    'utf8mb4_general_ci',
    'latin1_swedish_ci',
    _binary 'begin\nselect count(*) from somedb.sometable;\nend'
);
--#endif

-- dollarSignName

CREATE TABLE $dollar_sign_name ($c1 INT, $c2 INT);

-- emptyDotTableSyntax

CREATE TABLE `empty_dot_table_syntax_t` (`id` int);

DELIMITER $$

CREATE PROCEDURE `empty_dot_table_syntax_p`() BEGIN DELETE FROM .empty_dot_table_syntax_t; END$$

DELIMITER ;

-- syntax

DELIMITER $$

CREATE PROCEDURE `syntax`()
BEGIN
  DECLARE rows INT DEFAULT 0;
  DECLARE ROW  INT DEFAULT 4;
END$$

DELIMITER ;

-- invalidEngineForeignKey

SET SESSION foreign_key_checks = OFF;

CREATE TABLE `invalid_engine_foreign_key_1` (
    `column_idColumn` int NOT NULL,
    KEY (`column_idColumn`),
    FOREIGN KEY(`column_idColumn`) REFERENCES `invalid_engine_foreign_key_2` (`idColumn`) ON DELETE NO ACTION
) ENGINE = InnoDB;

CREATE TABLE `invalid_engine_foreign_key_2` (`idColumn` int NOT NULL, PRIMARY KEY(`idColumn`)) ENGINE = MyISAM;

SET SESSION foreign_key_checks = ON;

-- foreignKeyReferences

/*!80400 SET @@session.restrict_fk_on_non_standard_key=OFF */;

CREATE TABLE `non_standard_fks_parent` (
   a int,
   b int,
   PRIMARY KEY (a,b)
) ENGINE=InnoDB;

CREATE TABLE non_standard_fks (
   c int PRIMARY KEY,
   a int,
   FOREIGN KEY (a) REFERENCES `non_standard_fks_parent`(a)
) ENGINE=InnoDB;

/*!80400 SET @@session.restrict_fk_on_non_standard_key=ON */;

-- deprecatedTemporalDelimiter

CREATE TABLE `deprecated_temporal_delimiter` (
    `id` DATE DEFAULT '2022_12_12'
) ENGINE=InnoDB
DEFAULT CHARSET=latin1
PARTITION BY RANGE COLUMNS(id) (
    PARTITION px_2024_01 VALUES LESS THAN ('2022_02_01')
    ENGINE = InnoDB
);

-- columnDefinition

CREATE TABLE `column_definition`(c1 DOUBLE AUTO_INCREMENT PRIMARY KEY);

-- invalidPrivileges

CREATE USER 'invalid_privileges'@'localhost';
GRANT SUPER ON *.* TO 'invalid_privileges'@'localhost';

-- partitionsWithPrefixKeys

CREATE TABLE `partitions_with_prefix_keys` (f1 varchar(100) NOT NULL, f2 varchar(25) NOT NULL, f3 varchar(10) NOT NULL, PRIMARY KEY (f1(10),f2,f3(2))) PARTITION BY KEY ();
