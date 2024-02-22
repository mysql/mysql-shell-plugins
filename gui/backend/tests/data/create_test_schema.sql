-- Copyright (c) 2021, 2024, Oracle and/or its affiliates.

CREATE DATABASE IF NOT EXISTS `test_user_story`;
USE `test_user_story`;

CREATE TABLE `categories` (
  `categoryID` int NOT NULL AUTO_INCREMENT,
  `categoryName` varchar(100) NOT NULL,
  PRIMARY KEY (`categoryID`)
) ENGINE=InnoDB;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` TRIGGER `categories_AFTER_INSERT` AFTER INSERT ON `categories` FOR EACH ROW BEGIN
SET @test=1;
END$$
DELIMITER ;

CREATE TABLE `products` (
  `productID` int NOT NULL AUTO_INCREMENT,
  `productName` varchar(100) NOT NULL,
  `categoryID` int DEFAULT NULL,
  PRIMARY KEY (`productID`),
  KEY `fk_category` (`categoryID`),
  CONSTRAINT `fk_category` FOREIGN KEY (`categoryID`) REFERENCES `categories` (`categoryID`)
) ENGINE=InnoDB;

CREATE TABLE `test_pk_table` (
    `column1` INT NOT NULL,
    `column2` INT NOT NULL,
    PRIMARY KEY (`column1`, `column2`)
);

CREATE TABLE `test_no_pk_name` (
    `column1` INT,
    `column2` INT
);


CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `view_products`
AS select `productName` from `products`;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `procedure_get_names`()
BEGIN
SELECT productName from products;
END$$
DELIMITER ;

DELIMITER $$
CREATE DEFINER=`root`@`localhost` FUNCTION `function_count`() RETURNS int
    NO SQL
BEGIN
RETURN 1;
END$$
DELIMITER ;

CREATE USER IF NOT EXISTS `user1`@`localhost` IDENTIFIED BY 'user1password';
CREATE USER IF NOT EXISTS `user2`@`localhost` IDENTIFIED BY 'user2password';
