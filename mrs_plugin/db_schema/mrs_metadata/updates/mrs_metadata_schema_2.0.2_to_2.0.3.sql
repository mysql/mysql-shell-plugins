-- Copyright (c) 2023, 2025, Oracle and/or its affiliates.

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

USE `mysql_rest_service_metadata`;

DELIMITER $$

USE `mysql_rest_service_metadata`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`router_BEFORE_DELETE` BEFORE DELETE ON `router` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`router_status` WHERE `router_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`router_general_log` WHERE `router_id` = OLD.`id`;
END$$

USE `mysql_rest_service_metadata`$$
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`router_session_BEFORE_DELETE` BEFORE DELETE ON `router_session` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`router_general_log` WHERE `router_session_id` = OLD.`id`;
END$$

DELIMITER ;

ALTER TABLE `mysql_rest_service_metadata`.`db_schema`
  DROP FOREIGN KEY `fk_db_schema_service1`;
ALTER TABLE `mysql_rest_service_metadata`.`db_schema`
  ADD CONSTRAINT `fk_db_schema_service1`
    FOREIGN KEY (`service_id`)
    REFERENCES `mysql_rest_service_metadata`.`service` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`auth_app`
  DROP FOREIGN KEY `fk_auth_app_auth_vendor1`,
  DROP FOREIGN KEY `fk_auth_app_service1`;
ALTER TABLE `mysql_rest_service_metadata`.`auth_app`
  ADD CONSTRAINT `fk_auth_app_auth_vendor1`
    FOREIGN KEY (`auth_vendor_id`)
    REFERENCES `mysql_rest_service_metadata`.`auth_vendor` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_auth_app_service1`
    FOREIGN KEY (`service_id`)
    REFERENCES `mysql_rest_service_metadata`.`service` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user`
  DROP FOREIGN KEY `fk_auth_user_auth_app1`;
ALTER TABLE `mysql_rest_service_metadata`.`mrs_user`
  ADD CONSTRAINT `fk_auth_user_auth_app1`
    FOREIGN KEY (`auth_app_id`)
    REFERENCES `mysql_rest_service_metadata`.`auth_app` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`url_host_alias`
  DROP FOREIGN KEY `fk_url_host_alias_url_host1`;
ALTER TABLE `mysql_rest_service_metadata`.`url_host_alias`
  ADD CONSTRAINT `fk_url_host_alias_url_host1`
    FOREIGN KEY (`url_host_id`)
    REFERENCES `mysql_rest_service_metadata`.`url_host` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`content_set`
  DROP FOREIGN KEY `fk_static_content_version_service1`;
ALTER TABLE `mysql_rest_service_metadata`.`content_set`
  ADD CONSTRAINT `fk_static_content_version_service1`
    FOREIGN KEY (`service_id`)
    REFERENCES `mysql_rest_service_metadata`.`service` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`content_file`
  DROP FOREIGN KEY `fk_content_content_set1`;
ALTER TABLE `mysql_rest_service_metadata`.`content_file`
  ADD CONSTRAINT `fk_content_content_set1`
    FOREIGN KEY (`content_set_id`)
    REFERENCES `mysql_rest_service_metadata`.`content_set` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_role`
  DROP FOREIGN KEY `fk_priv_role_priv_role1`,
  DROP FOREIGN KEY `fk_auth_role_service1`;
ALTER TABLE `mysql_rest_service_metadata`.`mrs_role`
  ADD CONSTRAINT `fk_priv_role_priv_role1`
    FOREIGN KEY (`derived_from_role_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_role` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_auth_role_service1`
    FOREIGN KEY (`specific_to_service_id`)
    REFERENCES `mysql_rest_service_metadata`.`service` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_has_role`
  DROP FOREIGN KEY `fk_auth_user_has_privilege_role_auth_user1`,
  DROP FOREIGN KEY `fk_auth_user_has_privilege_role_privilege_role1`;
ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_has_role`
  ADD CONSTRAINT `fk_auth_user_has_privilege_role_auth_user1`
    FOREIGN KEY (`user_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_auth_user_has_privilege_role_privilege_role1`
    FOREIGN KEY (`role_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_role` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_hierarchy_type`
  DROP FOREIGN KEY `fk_user_hierarchy_type_service1`;
ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_hierarchy_type`
  ADD CONSTRAINT `fk_user_hierarchy_type_service1`
    FOREIGN KEY (`specific_to_service_id`)
    REFERENCES `mysql_rest_service_metadata`.`service` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_hierarchy`
  DROP FOREIGN KEY `fk_user_hierarchy_auth_user1`,
  DROP FOREIGN KEY `fk_user_hierarchy_auth_user2`,
  DROP FOREIGN KEY `fk_user_hierarchy_hierarchy_type1`;
ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_hierarchy`
  ADD CONSTRAINT `fk_user_hierarchy_auth_user1`
    FOREIGN KEY (`user_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_user_hierarchy_auth_user2`
    FOREIGN KEY (`reporting_to_user_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_user_hierarchy_hierarchy_type1`
    FOREIGN KEY (`user_hierarchy_type_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user_hierarchy_type` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_privilege`
  DROP FOREIGN KEY `fk_priv_on_schema_auth_role1`,
  DROP FOREIGN KEY `fk_priv_on_schema_db_schema1`,
  DROP FOREIGN KEY `fk_priv_on_schema_service1`,
  DROP FOREIGN KEY `fk_priv_on_schema_db_object1`;
ALTER TABLE `mysql_rest_service_metadata`.`mrs_privilege`
  ADD CONSTRAINT `fk_priv_on_schema_auth_role1`
    FOREIGN KEY (`role_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_role` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_priv_on_schema_db_schema1`
    FOREIGN KEY (`db_schema_id`)
    REFERENCES `mysql_rest_service_metadata`.`db_schema` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_priv_on_schema_service1`
    FOREIGN KEY (`service_id`)
    REFERENCES `mysql_rest_service_metadata`.`service` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_priv_on_schema_db_object1`
    FOREIGN KEY (`db_object_id`)
    REFERENCES `mysql_rest_service_metadata`.`db_object` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_group`
  DROP FOREIGN KEY `fk_user_group_service1`;
ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_group`
  ADD CONSTRAINT `fk_user_group_service1`
    FOREIGN KEY (`specific_to_service_id`)
    REFERENCES `mysql_rest_service_metadata`.`service` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_group_has_role`
  DROP FOREIGN KEY `fk_user_group_has_auth_role_user_group1`,
  DROP FOREIGN KEY `fk_user_group_has_auth_role_auth_role1`;
ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_group_has_role`
  ADD CONSTRAINT `fk_user_group_has_auth_role_user_group1`
    FOREIGN KEY (`user_group_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user_group` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_user_group_has_auth_role_auth_role1`
    FOREIGN KEY (`role_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_role` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_has_group`
  DROP FOREIGN KEY `fk_auth_user_has_user_group_auth_user1`,
  DROP FOREIGN KEY `fk_auth_user_has_user_group_user_group1`;
ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_has_group`
  ADD CONSTRAINT `fk_auth_user_has_user_group_auth_user1`
    FOREIGN KEY (`user_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_auth_user_has_user_group_user_group1`
    FOREIGN KEY (`user_group_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user_group` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_group_hierarchy`
  DROP FOREIGN KEY `fk_user_group_has_user_group_user_group1`,
  DROP FOREIGN KEY `fk_user_group_has_user_group_user_group2`,
  DROP FOREIGN KEY `fk_user_group_hierarchy_group_hierarchy_type1`;
ALTER TABLE `mysql_rest_service_metadata`.`mrs_user_group_hierarchy`
  ADD CONSTRAINT `fk_user_group_has_user_group_user_group1`
    FOREIGN KEY (`user_group_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user_group` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_user_group_has_user_group_user_group2`
    FOREIGN KEY (`parent_group_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_user_group` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_user_group_hierarchy_group_hierarchy_type1`
    FOREIGN KEY (`group_hierarchy_type_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_group_hierarchy_type` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`mrs_db_object_row_group_security`
  DROP FOREIGN KEY `fk_table1_db_object1`,
  DROP FOREIGN KEY `fk_db_object_row_security_group_hierarchy_type1`;
ALTER TABLE `mysql_rest_service_metadata`.`mrs_db_object_row_group_security`
  ADD CONSTRAINT `fk_table1_db_object1`
    FOREIGN KEY (`db_object_id`)
    REFERENCES `mysql_rest_service_metadata`.`db_object` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_db_object_row_security_group_hierarchy_type1`
    FOREIGN KEY (`group_hierarchy_type_id`)
    REFERENCES `mysql_rest_service_metadata`.`mrs_group_hierarchy_type` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`router_status`
  DROP FOREIGN KEY `fk_router_status_router1`;
ALTER TABLE `mysql_rest_service_metadata`.`router_status`
  ADD CONSTRAINT `fk_router_status_router1`
    FOREIGN KEY (`router_id`)
    REFERENCES `mysql_rest_service_metadata`.`router` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER TABLE `mysql_rest_service_metadata`.`router_general_log`
  DROP FOREIGN KEY `fk_router_general_log_router1`,
  DROP FOREIGN KEY `fk_router_general_log_router_session1`;
ALTER TABLE `mysql_rest_service_metadata`.`router_general_log`
  ADD CONSTRAINT `fk_router_general_log_router1`
    FOREIGN KEY (`router_id`)
    REFERENCES `mysql_rest_service_metadata`.`router` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_router_general_log_router_session1`
    FOREIGN KEY (`router_session_id`)
    REFERENCES `mysql_rest_service_metadata`.`router_session` (`id`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

ALTER SQL SECURITY INVOKER VIEW `schema_version` (major, minor, patch) AS SELECT 2, 0, 3;

ALTER SQL SECURITY INVOKER VIEW `mrs_user_schema_version` (major, minor, patch) AS SELECT 2, 0, 3;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;