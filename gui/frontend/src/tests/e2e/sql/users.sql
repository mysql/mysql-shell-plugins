CREATE USER IF NOT EXISTS 'shell'@'localhost' IDENTIFIED BY 'dummy';
CREATE USER IF NOT EXISTS 'shell'@'%' IDENTIFIED BY 'dummy';
GRANT ALL ON *.* TO 'shell'@'localhost' WITH GRANT OPTION;
GRANT ALL ON *.* TO 'shell'@'%' WITH GRANT OPTION;

CREATE USER IF NOT EXISTS 'clientqa'@'localhost' IDENTIFIED BY 'dummy';
CREATE USER IF NOT EXISTS 'clientqa'@'%' IDENTIFIED BY 'dummy';
GRANT ALL ON *.* TO 'clientqa'@'localhost' WITH GRANT OPTION;
GRANT ALL ON *.* TO 'clientqa'@'%' WITH GRANT OPTION;

CREATE USER IF NOT EXISTS 'dbuser1'@'localhost' IDENTIFIED BY 'dummy';
CREATE USER IF NOT EXISTS 'dbuser1'@'%' IDENTIFIED BY 'dummy';
GRANT ALL ON *.* TO 'dbuser1'@'localhost' WITH GRANT OPTION;
GRANT ALL ON *.* TO 'dbuser1'@'%' WITH GRANT OPTION;

CREATE USER IF NOT EXISTS 'dbuser2'@'localhost' IDENTIFIED BY 'dummy';
CREATE USER IF NOT EXISTS 'dbuser2'@'%' IDENTIFIED BY 'dummy';
GRANT ALL ON *.* TO 'dbuser2'@'localhost' WITH GRANT OPTION;
GRANT ALL ON *.* TO 'dbuser2'@'%' WITH GRANT OPTION;

CREATE USER IF NOT EXISTS 'dbuser3'@'localhost' IDENTIFIED BY 'dummy';
CREATE USER IF NOT EXISTS 'dbuser3'@'%' IDENTIFIED BY 'dummy';
GRANT ALL ON *.* TO 'dbuser3'@'localhost' WITH GRANT OPTION;
GRANT ALL ON *.* TO 'dbuser3'@'%' WITH GRANT OPTION;
