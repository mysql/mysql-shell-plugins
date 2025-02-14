-- Copyright (c) 2024, 2025, Oracle and/or its affiliates.

DELIMITER $$
CREATE FUNCTION IF NOT EXISTS sakila.actor(s CHAR(20)) RETURNS char(50) DETERMINISTIC
BEGIN
    RETURN CONCAT('Hello, ',s,'!');
END$$
DELIMITER ;

CREATE SCHEMA IF NOT EXISTS test;
DROP TABLE IF EXISTS test.t1;
CREATE TABLE test.t1
(
  CHECK (c1 <> c2),
  c1 INT CHECK (c1 > 10),
  c2 INT CONSTRAINT c2_positive CHECK (c2 > 0),
  c3 INT CHECK (c3 < 100),
  info JSON CONSTRAINT info_json_schema CHECK (
    JSON_SCHEMA_VALID('{
    "id": "https://dev.mysql.com/mrs/test/test.t1/info",
    "type": "object",
    "properties": {
        "friends": {
            "type": "array",
            "items": {
                "type": "string"
            },
            "minItems": 1,
            "uniqueItems": true
        },
        "nickName": {
          "type": "string"
        }
    },
    "required": [ "friends" ]
    }', info)),
  data JSON,
  CONSTRAINT c1_nonzero CHECK (c1 <> 0),
  CHECK (c1 > c3),
  CHECK (JSON_SCHEMA_VALID('{
    "id": "https://dev.mysql.com/mrs/test/test.t1/data",
    "type": "object",
    "properties": {
        "hobbies": {
            "type": "array",
            "items": {
                "type": "string"
            },
            "minItems": 0,
            "uniqueItems": true
        },
        "height": {
            "type": "number"
        }
    },
    "required": [ "height" ]
    }', data) AND (c1 <> c2)),
  CONSTRAINT info_json_schema2 CHECK (
    JSON_SCHEMA_VALID('{
    "id": "https://dev.mysql.com/mrs/test/test.t1/info",
    "type": "object",
    "properties": {
        "friends": {
            "type": "array",
            "items": {
                "type": "string"
            },
            "minItems": 1,
            "uniqueItems": true
        },
        "nickName": {
          "type": "string"
        }
    },
    "required": [ "friends" ]
    }', info))
);
