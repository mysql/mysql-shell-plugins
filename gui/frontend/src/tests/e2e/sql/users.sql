CREATE USER IF NOT EXISTS 'shell'@'localhost' IDENTIFIED BY 'root';
CREATE USER IF NOT EXISTS 'shell'@'%' IDENTIFIED BY 'root';
GRANT ALL ON *.* TO 'shell'@'localhost';
GRANT ALL ON *.* TO 'shell'@'%';
FLUSH PRIVILEGES;

CREATE USER IF NOT EXISTS 'clientqa'@'localhost' IDENTIFIED BY 'clientqa';
CREATE USER IF NOT EXISTS 'clientqa'@'%' IDENTIFIED BY 'clientqa';
GRANT ALL ON *.* TO 'clientqa'@'localhost';
GRANT ALL ON *.* TO 'clientqa'@'%';
FLUSH PRIVILEGES;

CREATE USER IF NOT EXISTS 'dbuser1'@'localhost' IDENTIFIED BY 'dbuser1';
CREATE USER IF NOT EXISTS 'dbuser1'@'%' IDENTIFIED BY 'dbuser1';
GRANT ALL ON *.* TO 'dbuser1'@'localhost';
GRANT ALL ON *.* TO 'dbuser1'@'%';
FLUSH PRIVILEGES;

CREATE USER IF NOT EXISTS 'dbuser2'@'localhost' IDENTIFIED BY 'dbuser2';
CREATE USER IF NOT EXISTS 'dbuser2'@'%' IDENTIFIED BY 'dbuser2';
GRANT ALL ON *.* TO 'dbuser2'@'localhost';
GRANT ALL ON *.* TO 'dbuser2'@'%';
FLUSH PRIVILEGES;

CREATE USER IF NOT EXISTS 'dbuser3'@'localhost' IDENTIFIED BY 'dbuser3';
CREATE USER IF NOT EXISTS 'dbuser3'@'%' IDENTIFIED BY 'dbuser3';
GRANT ALL ON *.* TO 'dbuser3'@'localhost';
GRANT ALL ON *.* TO 'dbuser3'@'%';
FLUSH PRIVILEGES;
