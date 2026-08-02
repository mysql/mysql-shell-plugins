/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 */

PRAGMA foreign_keys = OFF;

ALTER TABLE `profile` ADD COLUMN `state` TEXT NULL;

BEGIN TRANSACTION;
DELETE FROM `user_has_role` WHERE `role_id` = 4;
DELETE FROM `role_has_privilege` WHERE `role_id` = 4 OR `privilege_id` IN (5, 6);
DELETE FROM `privilege` WHERE `id` IN (5, 6);
DELETE FROM `role` WHERE `id` = 4;
COMMIT;

DROP VIEW IF EXISTS `schema_version`;
CREATE VIEW schema_version (major, minor, patch) AS SELECT 0, 0, 25;

PRAGMA foreign_keys = ON;
