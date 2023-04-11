CREATE USER 'shell'@'localhost' IDENTIFIED BY 'root';
CREATE USER 'shell'@'%' IDENTIFIED BY 'root';
GRANT ALL ON *.* TO 'shell'@'localhost';
GRANT ALL ON *.* TO 'shell'@'%';
FLUSH PRIVILEGES;

CREATE USER 'clientqa'@'localhost' IDENTIFIED BY 'clientqa';
CREATE USER 'clientqa'@'%' IDENTIFIED BY 'clientqa';
GRANT ALL ON *.* TO 'clientqa'@'localhost';
GRANT ALL ON *.* TO 'clientqa'@'%';
FLUSH PRIVILEGES;

CREATE USER 'dbuser1'@'localhost' IDENTIFIED BY 'dbuser1';
CREATE USER 'dbuser1'@'%' IDENTIFIED BY 'dbuser1';
GRANT ALL ON *.* TO 'dbuser1'@'localhost';
GRANT ALL ON *.* TO 'dbuser1'@'%';
FLUSH PRIVILEGES;

CREATE USER 'dbuser2'@'localhost' IDENTIFIED BY 'dbuser2';
CREATE USER 'dbuser2'@'%' IDENTIFIED BY 'dbuser2';
GRANT ALL ON *.* TO 'dbuser2'@'localhost';
GRANT ALL ON *.* TO 'dbuser2'@'%';
FLUSH PRIVILEGES;

CREATE USER 'dbuser3'@'localhost' IDENTIFIED BY 'dbuser3';
CREATE USER 'dbuser3'@'%' IDENTIFIED BY 'dbuser3';
GRANT ALL ON *.* TO 'dbuser3'@'localhost';
GRANT ALL ON *.* TO 'dbuser3'@'%';
FLUSH PRIVILEGES;
