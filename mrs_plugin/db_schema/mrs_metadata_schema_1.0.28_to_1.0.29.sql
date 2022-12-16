-- Copyright (c) 2022, Oracle and/or its affiliates.

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

DELIMITER $$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_BEFORE_INSERT`$$

USE `mysql_rest_service_metadata`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`service_BEFORE_INSERT` BEFORE INSERT ON `service` FOR EACH ROW
BEGIN
	SET @host_name := (SELECT h.name FROM `mysql_rest_service_metadata`.url_host h WHERE h.id = NEW.url_host_id);
	SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(CONCAT(@host_name, NEW.url_context_root)));
    
    IF @validPath = 0 THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
    END IF;
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_BEFORE_UPDATE`$$

USE `mysql_rest_service_metadata`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`service_BEFORE_UPDATE` BEFORE UPDATE ON `service` FOR EACH ROW
BEGIN
	IF (NEW.url_context_root <> OLD.url_context_root) THEN
		SET @host_name := (SELECT h.name FROM `mysql_rest_service_metadata`.url_host h WHERE h.id = NEW.url_host_id);
		SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(CONCAT(@host_name, NEW.url_context_root)));
		
		IF @validPath = 0 THEN
			SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
		END IF;
	END IF;
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_schema_BEFORE_INSERT`$$

USE `mysql_rest_service_metadata`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`db_schema_BEFORE_INSERT` BEFORE INSERT ON `db_schema` FOR EACH ROW
BEGIN
	SET @service_path := (SELECT CONCAT(h.name, se.url_context_root) AS path
		FROM `mysql_rest_service_metadata`.service se
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
		WHERE se.id = NEW.service_id);
	SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(CONCAT(@service_path, NEW.request_path)));
    
    IF @validPath = 0 THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
    END IF;
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_schema_BEFORE_UPDATE`$$

USE `mysql_rest_service_metadata`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`db_schema_BEFORE_UPDATE` BEFORE UPDATE ON `db_schema` FOR EACH ROW
BEGIN
	IF (NEW.request_path <> OLD.request_path OR NEW.service_id <> OLD.service_id) THEN
		SET @service_path := (SELECT CONCAT(h.name, se.url_context_root) AS path
			FROM `mysql_rest_service_metadata`.service se
				LEFT JOIN `mysql_rest_service_metadata`.url_host h
					ON se.url_host_id = h.id
			WHERE se.id = NEW.service_id);
		SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(CONCAT(@service_path, NEW.request_path)));
		
		IF @validPath = 0 THEN
			SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
		END IF;
    END IF;
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_object_BEFORE_INSERT`$$

USE `mysql_rest_service_metadata`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`db_object_BEFORE_INSERT` BEFORE INSERT ON `db_object` FOR EACH ROW
BEGIN
    SET @schema_path := (SELECT CONCAT(h.name, se.url_context_root, sc.request_path) AS path
        FROM `mysql_rest_service_metadata`.db_schema sc
            LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                ON se.id = sc.service_id
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
        WHERE sc.id = NEW.db_schema_id);
    SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(CONCAT(@schema_path, NEW.request_path)));
    
    IF @validPath = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
    END IF;
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_object_BEFORE_UPDATE`$$

USE `mysql_rest_service_metadata`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`db_object_BEFORE_UPDATE` BEFORE UPDATE ON `db_object` FOR EACH ROW
BEGIN
    IF (NEW.request_path <> OLD.request_path OR NEW.db_schema_id <> OLD.db_schema_id) THEN
        SET @schema_path := (SELECT CONCAT(h.name, se.url_context_root, sc.request_path) AS path
            FROM `mysql_rest_service_metadata`.db_schema sc
                LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                    ON se.id = sc.service_id
                LEFT JOIN `mysql_rest_service_metadata`.url_host h
                    ON se.url_host_id = h.id
            WHERE sc.id = NEW.db_schema_id);
        SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(CONCAT(@schema_path, NEW.request_path)));
        
        IF @validPath = 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
        END IF;
    END IF;
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_BEFORE_INSERT`$$

USE `mysql_rest_service_metadata`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`content_set_BEFORE_INSERT` BEFORE INSERT ON `content_set` FOR EACH ROW
BEGIN
	SET @service_path := (SELECT CONCAT(h.name, se.url_context_root) AS path
		FROM `mysql_rest_service_metadata`.service se
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
		WHERE se.id = NEW.service_id);
	SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(CONCAT(@service_path, NEW.request_path)));
    
    IF @validPath = 0 THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
    END IF;
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_BEFORE_UPDATE`$$

USE `mysql_rest_service_metadata`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`content_set_BEFORE_UPDATE` BEFORE UPDATE ON `content_set` FOR EACH ROW
BEGIN
	IF (NEW.request_path <> OLD.request_path OR NEW.service_id <> OLD.service_id) THEN
		SET @service_path := (SELECT CONCAT(h.name, se.url_context_root) AS path
			FROM `mysql_rest_service_metadata`.service se
				LEFT JOIN `mysql_rest_service_metadata`.url_host h
					ON se.url_host_id = h.id
			WHERE se.id = NEW.service_id);
		SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(CONCAT(@service_path, NEW.request_path)));
		
		IF @validPath = 0 THEN
			SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
		END IF;
    END IF;
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_file_BEFORE_INSERT`$$

USE `mysql_rest_service_metadata`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`content_file_BEFORE_INSERT` BEFORE INSERT ON `content_file` FOR EACH ROW
BEGIN
    SET @content_set_path := (SELECT CONCAT(h.name, se.url_context_root, co.request_path) AS path
        FROM `mysql_rest_service_metadata`.content_set co
            LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                ON se.id = co.service_id
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
        WHERE co.id = NEW.content_set_id);
    SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(CONCAT(@content_set_path, NEW.request_path)));
    
    IF @validPath = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
    END IF;
END$$

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_file_BEFORE_UPDATE`$$

USE `mysql_rest_service_metadata`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`content_file_BEFORE_UPDATE` BEFORE UPDATE ON `content_file` FOR EACH ROW
BEGIN
    IF (NEW.request_path <> OLD.request_path OR NEW.content_set_id <> OLD.content_set_id) THEN
        SET @content_set_path := (SELECT CONCAT(h.name, se.url_context_root, co.request_path) AS path
            FROM `mysql_rest_service_metadata`.content_set co
                LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                    ON se.id = co.service_id
                LEFT JOIN `mysql_rest_service_metadata`.url_host h
                    ON se.url_host_id = h.id
            WHERE co.id = NEW.content_set_id);
        SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(CONCAT(@content_set_path, NEW.request_path)));
        
        IF @validPath = 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
        END IF;
    END IF;
END$$

DROP FUNCTION IF EXISTS `mysql_rest_service_metadata`.`valid_request_path`$$

CREATE FUNCTION `mysql_rest_service_metadata`.`valid_request_path`(path VARCHAR(255)) 
RETURNS TINYINT(1) NOT DETERMINISTIC READS SQL DATA
BEGIN
    SET @valid := (SELECT COUNT(*) = 0 AS valid FROM 
        (SELECT CONCAT(h.name,
            se.url_context_root) as full_request_path
        FROM `mysql_rest_service_metadata`.service se
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
        WHERE CONCAT(h.name, se.url_context_root) = path
        UNION
        SELECT CONCAT(h.name, se.url_context_root,
            sc.request_path) as full_request_path
        FROM `mysql_rest_service_metadata`.db_schema sc
            LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                ON se.id = sc.service_id
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
        WHERE CONCAT(h.name, se.url_context_root,
                sc.request_path) = path
        UNION
        SELECT CONCAT(h.name, se.url_context_root,
            sc.request_path, o.request_path) as full_request_path
        FROM `mysql_rest_service_metadata`.db_object o
            LEFT OUTER JOIN `mysql_rest_service_metadata`.db_schema sc
                ON sc.id = o.db_schema_id
            LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                ON se.id = sc.service_id
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
        WHERE CONCAT(h.name, se.url_context_root,
                sc.request_path, o.request_path) = path
        UNION
        SELECT CONCAT(h.name, se.url_context_root,
            co.request_path) as full_request_path
        FROM `mysql_rest_service_metadata`.content_set co
            LEFT OUTER JOIN `mysql_rest_service_metadata`.service se
                ON se.id = co.service_id
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
        WHERE CONCAT(h.name, se.url_context_root,
                co.request_path) = path) AS p);

     RETURN @valid;
END$$

DELIMITER ;

USE `mysql_rest_service_metadata`;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW schema_version (major, minor, patch) AS SELECT 1, 0, 29;
CREATE  OR REPLACE SQL SECURITY INVOKER VIEW mrs_user_schema_version (major, minor, patch) AS SELECT 1, 0, 29;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;