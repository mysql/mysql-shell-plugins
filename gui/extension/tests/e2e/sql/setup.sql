-- E2E Extension tests Database configurations
-- Copyright (c) 2023, 2024 Oracle and/or its affiliates.

-- Redistribution and use in source and binary forms, with or without
-- modification, are permitted provided that the following conditions are
-- met:

-- * Redistributions of source code must retain the above copyright notice,
--   this list of conditions and the following disclaimer.
-- * Redistributions in binary form must reproduce the above copyright
--   notice, this list of conditions and the following disclaimer in the
--   documentation and/or other materials provided with the distribution.
-- * Neither the name of Oracle nor the names of its contributors may be used
--   to endorse or promote products derived from this software without
--   specific prior written permission.

-- THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
-- IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
-- THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
-- PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
-- CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
-- EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
-- PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
-- PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
-- LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
-- NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
-- SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

SET GLOBAL local_infile = 'ON';
-- REST suite
USE sakila;
DROP SCHEMA IF EXISTS `mysql_rest_service_metadata`;
DROP TABLE IF EXISTS `abc`; 
CREATE TABLE `abc` (id int,name VARCHAR(50));
DROP SCHEMA IF EXISTS `dummyschema`; 
CREATE SCHEMA `dummyschema`;

-- DB suite
-- Dump Schema to Disk test
DROP SCHEMA IF EXISTS `dump_schema_to_disk`;
CREATE SCHEMA `dump_schema_to_disk`;

-- Load Dump from Disk test
DROP SCHEMA IF EXISTS `load_dump_from_disk`;

-- Dump Schema to Disk for MySQL Database Service test
DROP SCHEMA IF EXISTS `schema_for_mysql_db_service`;
CREATE SCHEMA `schema_for_mysql_db_service`;

-- Drop schema test
DROP SCHEMA IF EXISTS `schema_to_drop`;
CREATE SCHEMA `schema_to_drop`;

-- Drop Table test
DROP TABLE IF EXISTS `table_to_drop`; 
CREATE TABLE `table_to_drop` (id int,name VARCHAR(50));

-- Views
DROP VIEW IF EXISTS `test_view`; 
CREATE VIEW `test_view` as select * from actor;

DROP VIEW IF EXISTS `view_to_drop`; 
CREATE VIEW `view_to_drop` as select * from actor;

-- Event 
DROP EVENT IF EXISTS `test_event`;
CREATE EVENT test_event
    ON SCHEDULE AT CURRENT_TIMESTAMP + INTERVAL 1 HOUR
    DO
      select 1;

-- Routine
DROP PROCEDURE IF EXISTS `test_routine`;
DELIMITER $$ 
CREATE DEFINER=`root`@`localhost` 
PROCEDURE `test_routine`() 
BEGIN 
	select * from sakila.actor; 
END$$ 
DELIMITER ;

-- Data sets
DROP TABLE IF EXISTS `result_sets`; 
CREATE TABLE result_sets (
    id INT PRIMARY key AUTO_INCREMENT,
    text_field TEXT,
    long_text_field LONGTEXT,
    bool_field BOOLEAN,
    date_field DATETIME,
    blob_field BLOB
);

INSERT INTO result_sets VALUES(
  1, 
  'small text', 
  'This is a longer text example, to test the result sets functionality', 
  true, 
  NOW(),
  NULL
  );

  DROP TABLE IF EXISTS `all_data_types_ints`;
  CREATE TABLE `all_data_types_ints` (
    `id` int NOT NULL AUTO_INCREMENT,
    `test_boolean` tinyint(1) DEFAULT NULL,
    `test_smallint` smallint DEFAULT NULL,
    `test_mediumint` mediumint DEFAULT NULL,
    `test_integer` int DEFAULT NULL,
    `test_bigint` bigint DEFAULT '8888',
    `test_decimal` decimal(10,2) DEFAULT NULL,
    `test_float` float DEFAULT NULL,
    `test_double` double(10,2) DEFAULT NULL,
    PRIMARY KEY (`id`)
  ) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

  DROP TABLE IF EXISTS `all_data_types_dates`;
  CREATE TABLE `all_data_types_dates` (
    `id` int NOT NULL AUTO_INCREMENT,
    `test_date` date DEFAULT NULL,
    `test_datetime` datetime DEFAULT NULL,
    `test_timestamp` timestamp NULL DEFAULT NULL,
    `test_time` time DEFAULT NULL,
    `test_year` year DEFAULT '2024',
    PRIMARY KEY (`id`)
  ) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

  DROP TABLE IF EXISTS `all_data_types_chars`;
  CREATE TABLE `all_data_types_chars` (
    `id` int NOT NULL AUTO_INCREMENT,
    `test_char` char(50) DEFAULT NULL,
    `test_varchar` varchar(50) DEFAULT NULL,
    `test_tinytext` tinytext,
    `test_text` text,
    `test_mediumtext` mediumtext,
    `test_longtext` longtext,
    `test_enum` enum('value1','value2','value3','value4') DEFAULT NULL,
    `test_set` set('value1','value2','value3','value4') DEFAULT NULL,
    `test_json` json DEFAULT NULL,
    PRIMARY KEY (`id`)
  ) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

  DROP TABLE IF EXISTS `all_data_types_blobs`;
  CREATE TABLE `all_data_types_blobs` (
    `id` int NOT NULL AUTO_INCREMENT,
    `test_tinyblob` tinyblob,
    `test_blob` blob,
    `test_mediumblob` mediumblob,
    `test_longblob` longblob,
    `test_binary` binary(50) DEFAULT NULL,
    `test_varbinary` varbinary(50) DEFAULT NULL,
    PRIMARY KEY (`id`)
  ) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

  DROP TABLE IF EXISTS `all_data_types_geometries`;
  CREATE TABLE `all_data_types_geometries` (
    `id` int NOT NULL AUTO_INCREMENT,
    `test_point` geometry DEFAULT NULL,
    `test_linestring` linestring DEFAULT NULL,
    `test_polygon` polygon DEFAULT NULL,
    `test_multipoint` multipoint DEFAULT NULL,
    `test_multilinestring` multilinestring DEFAULT NULL,
    `test_multipolygon` multipolygon DEFAULT NULL,
    `test_geometrycollection` geomcollection DEFAULT NULL,
    `test_bit` bit(1) DEFAULT NULL,
    PRIMARY KEY (`id`)
  ) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO all_data_types_ints VALUES(
1, -- id
true, -- test_boolean
32767, -- test_smallint
8388607, -- mediumint
2, -- int 
4294967295, -- big int 
1.5, -- decimal
2.543, -- float
7.56 -- double
);

INSERT INTO all_data_types_dates VALUES(
1, -- id
"2023-01-01", -- date 
"2023-01-01 00:02:00", -- date time
"2023-01-01 00:02:00", -- timestamp
"00:02:00", -- time
"2023" -- year
);

INSERT INTO all_data_types_chars VALUES(
1, -- id
"test_char", -- char
"test_varchar", -- varchar 
"tiny", -- tinytext
"test_text", -- text
"test_medium", -- medium text
"test_long", -- long text
"value1", -- enum
"value1", -- set 
'{"test": "1"}' -- json
);

INSERT INTO all_data_types_blobs VALUES(
1, -- id
0xa1b8de72d02badac81b9f7deac, -- tiny blob
0xa1b8de72d02badac81b9f7deac, -- blob
0xa1b8de72d02badac81b9f7deac, -- mediumblob
0xa1b8de72d02badac81b9f7deac, -- long blob
0x6173646667, -- binary 
0x6173646667 -- var binary 
);

INSERT INTO all_data_types_geometries VALUES(
1, -- id
ST_GeomFromText('POINT(1 1)'), -- geometry
ST_LineStringFromText('LINESTRING(0 0,1 1,2 2)'), -- linestring
ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(5 5,7 5,7 7,5 7, 5 5))'), -- polygon
ST_GeomFromText('MULTIPOINT(0 0, 20 20, 60 60)'), -- multipoint
ST_GeomFromText('MultiLineString((1 1,2 2,3 3),(4 4,5 5))'), -- multilinestring
ST_GeomFromText('MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0)),((5 5,7 5,7 7,5 7, 5 5)))'), -- multipolygon
ST_GeomFromText('GEOMETRYCOLLECTION(POINT(1 1),LINESTRING(0 0,1 1,2 2,3 3,4 4))'), -- geomcollection
b'0' -- bit
);
