-- Copyright (c) 2024, Oracle and/or its affiliates.

DELIMITER $$
CREATE FUNCTION IF NOT EXISTS sakila.actor(s CHAR(20)) RETURNS char(50) DETERMINISTIC
BEGIN
    RETURN CONCAT('Hello, ',s,'!');
END$$
DELIMITER ;