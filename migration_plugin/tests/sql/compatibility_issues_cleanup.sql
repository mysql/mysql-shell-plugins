-- Copyright (c) 2025, Oracle and/or its affiliates.
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

DROP USER IF EXISTS 'unsupported_auth_plugin'@'localhost';
DROP USER IF EXISTS 'deprecated_auth_plugin'@'localhost';
DROP USER IF EXISTS 'no_password'@'localhost';
DROP USER IF EXISTS 'restricted_grants'@'localhost';
DROP USER IF EXISTS 'invalid_grants'@'localhost';
DROP USER IF EXISTS 'wildcard_grant'@'localhost';
DROP USER IF EXISTS 'escaped_wildcard_grant'@'localhost';
DROP USER IF EXISTS 'grant_on_missing_object'@'localhost';
DROP USER IF EXISTS 'grant_on_missing_role'@'localhost';

DROP ROLE IF EXISTS 'skipped_role';

DROP USER IF EXISTS 'ociadmin'@'localhost';
DROP USER IF EXISTS 'skipped_user'@'localhost';
DROP USER IF EXISTS 'valid_definer'@'localhost';

DROP SCHEMA IF EXISTS `compatibility_issues`;
DROP SCHEMA IF EXISTS `compatibility_issues_skipped`;

CREATE SCHEMA `compatibility_issues`;

DELIMITER //

CREATE PROCEDURE `compatibility_issues`.`drop_tablespace`()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.FILES WHERE TABLESPACE_NAME = 't_space'
    ) THEN
        DROP TABLESPACE `t_space`;
    END IF;
END //

DELIMITER ;

CALL `compatibility_issues`.`drop_tablespace`();
DROP SCHEMA `compatibility_issues`;
