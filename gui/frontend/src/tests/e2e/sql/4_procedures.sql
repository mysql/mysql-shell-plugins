use sakila;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE IF NOT EXISTS `clearSchemas`()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE dbname VARCHAR(255);
    DECLARE cur CURSOR FOR SELECT schema_name
      FROM information_schema.schemata
     WHERE schema_name LIKE 'testschema%' ESCAPE '\\'
     ORDER BY schema_name;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO dbname;

        IF done THEN
          LEAVE read_loop;
        END IF;

        SET @query = CONCAT('DROP DATABASE ',dbname);
        PREPARE stmt FROM @query;
        EXECUTE stmt;
    END LOOP;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE IF NOT EXISTS `clearTables`()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE tablename VARCHAR(255);
    DECLARE cur CURSOR FOR SELECT table_name FROM information_schema.tables 
	where table_schema = database()
	AND table_name like "testtable%" ESCAPE '\\';
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO tablename;

        IF done THEN
          LEAVE read_loop;
        END IF;

        SET @query = CONCAT('DROP TABLE ', tablename);
        PREPARE stmt FROM @query;
        EXECUTE stmt;
    END LOOP;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE IF NOT EXISTS `clearViews`()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE viewname VARCHAR(255);
    DECLARE cur CURSOR FOR SELECT table_name FROM information_schema.views 
	WHERE table_schema = database()
	AND table_name LIKE "%testview%" ESCAPE '\\';
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO viewname;

        IF done THEN
          LEAVE read_loop;
        END IF;

        SET @query = CONCAT('DROP VIEW ', viewname);
        PREPARE stmt FROM @query;
        EXECUTE stmt;
    END LOOP;
END$$
DELIMITER ;

