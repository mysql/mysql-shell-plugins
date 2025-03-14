-- Copyright (c) 2025, Oracle and/or its affiliates.
-- -----------------------------------------------------
-- TRIGGERs

DELIMITER %%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`router_AFTER_INSERT_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`router_AFTER_INSERT_AUDIT_LOG` AFTER INSERT ON `router` FOR EACH ROW
BEGIN
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
    VALUES (
        "router",
        "INSERT",
        NULL,
        JSON_OBJECT(
            "id", NEW.id,
            "options", NEW.options),
        NULL,
        UNHEX(LPAD(CONV(NEW.id, 10, 16), 32, '0')),
        CURRENT_USER(),
        CURRENT_TIMESTAMP
    );
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`router_AFTER_UPDATE_AUDIT_LOG`%%
CREATE TRIGGER `mysql_rest_service_metadata`.`router_AFTER_UPDATE_AUDIT_LOG` AFTER UPDATE ON `router` FOR EACH ROW
BEGIN
    IF (COALESCE(OLD.options, '') <> COALESCE(NEW.options, '')) THEN
        INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
            table_name, dml_type, old_row_data, new_row_data, old_row_id, new_row_id, changed_by, changed_at)
        VALUES (
            "router",
            "UPDATE",
            JSON_OBJECT(
                "id", OLD.id,
                "options", OLD.options),
            JSON_OBJECT(
                "id", NEW.id,
                "options", NEW.options),
            UNHEX(LPAD(CONV(OLD.id, 10, 16), 32, '0')),
            UNHEX(LPAD(CONV(NEW.id, 10, 16), 32, '0')),
            CURRENT_USER(),
            CURRENT_TIMESTAMP
        );
    END IF;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`url_host_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`url_host_BEFORE_DELETE` BEFORE DELETE ON `url_host` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`url_host_alias` WHERE `url_host_id` = OLD.`id`;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_BEFORE_INSERT`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`service_BEFORE_INSERT` BEFORE INSERT ON `service` FOR EACH ROW
BEGIN
    # Check if the full service request_path (including the optional developer setting) already exists
    IF NEW.enabled = TRUE THEN
        SET @host_name := (SELECT h.name FROM `mysql_rest_service_metadata`.url_host h WHERE h.id = NEW.url_host_id);
        SET @request_path := CONCAT(COALESCE(NEW.in_development->>'$.developers', ''), @host_name, NEW.url_context_root);
        SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(@request_path));

        IF @validPath = 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
        END IF;

        # Check if the same developer is already registered in the in_development->>'$.developers' of a service with the very same host_ctx
        SET @validDeveloperList := (SELECT MAX(COALESCE(
                JSON_OVERLAPS(s.in_development->>'$.developers', NEW.in_development->>'$.developers'), FALSE)) AS overlap
            FROM `mysql_rest_service_metadata`.`service` AS s JOIN
                `mysql_rest_service_metadata`.`url_host` AS h ON s.url_host_id = h.id JOIN
                `mysql_rest_service_metadata`.`url_host` AS h2 ON h2.id = NEW.url_host_id
            WHERE CONCAT(h.name, s.url_context_root) = CONCAT(h2.name, NEW.url_context_root) AND s.enabled = TRUE
            GROUP BY CONCAT(h.name, s.url_context_root));

        IF COALESCE(@validDeveloperList, FALSE) = TRUE THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "This developer is already registered for a REST service with the same host/url_context_root path.";
        END IF;
    END IF;

    IF NEW.in_development IS NOT NULL THEN
        SET NEW.published = 0;
    END IF;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_BEFORE_UPDATE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`service_BEFORE_UPDATE` BEFORE UPDATE ON `service` FOR EACH ROW
BEGIN
    # Check if the full service request_path (including the optional developer setting) already exists,
    # but only when the service is enabled and either of those values was actually changed
    IF NEW.enabled = TRUE AND (COALESCE(NEW.in_development, '') <> COALESCE(OLD.in_development, '')
		OR NEW.url_host_id <> OLD.url_host_id OR NEW.url_context_root <> OLD.url_context_root) THEN

        SET @host_name := (SELECT h.name FROM `mysql_rest_service_metadata`.url_host h WHERE h.id = NEW.url_host_id);
        SET @request_path := CONCAT(COALESCE(NEW.in_development->>'$.developers', ''), @host_name, NEW.url_context_root);
        SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(@request_path));

        IF @validPath = 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
        END IF;

        # Check if the same developer is already registered in the in_development->>'$.developers' of a service with the very same host_ctx
        SET @validDeveloperList := (SELECT MAX(COALESCE(
                JSON_OVERLAPS(s.in_development->>'$.developers', NEW.in_development->>'$.developers'), FALSE)) AS overlap
            FROM `mysql_rest_service_metadata`.`service` AS s JOIN
                `mysql_rest_service_metadata`.`url_host` AS h ON s.url_host_id = h.id JOIN
                `mysql_rest_service_metadata`.`url_host` AS h2 ON h2.id = NEW.url_host_id
            WHERE CONCAT(h.name, s.url_context_root) = CONCAT(h2.name, NEW.url_context_root) AND s.enabled = TRUE
                AND s.id <> NEW.id
            GROUP BY CONCAT(h.name, s.url_context_root));

        IF COALESCE(@validDeveloperList, FALSE) = TRUE THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "This developer is already registered for a REST service with the same host/url_context_root path.";
        END IF;
    END IF;

    IF OLD.in_development IS NULL AND NEW.in_development IS NOT NULL AND NEW.published = 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "A REST service that is in development cannot be published. Please reset the development state first.";
    END IF;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`service_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`service_BEFORE_DELETE` BEFORE DELETE ON `service` FOR EACH ROW
BEGIN
	# Since FKs do not fire the triggers on the related tables, manually trigger the DELETEs
	DELETE FROM `mysql_rest_service_metadata`.`content_set` WHERE `service_id` = OLD.`id`;
	DELETE FROM `mysql_rest_service_metadata`.`db_schema` WHERE `service_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`service_has_auth_app` WHERE `service_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_role` WHERE `specific_to_service_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_hierarchy_type` WHERE `specific_to_service_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_group` WHERE `specific_to_service_id` = OLD.`id`;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_schema_BEFORE_INSERT`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`db_schema_BEFORE_INSERT` BEFORE INSERT ON `db_schema` FOR EACH ROW
BEGIN
	SET @service_path := (SELECT CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name, se.url_context_root) AS path
		FROM `mysql_rest_service_metadata`.service se
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
		WHERE se.id = NEW.service_id);
	SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(CONCAT(@service_path, NEW.request_path)));

    IF @validPath = 0 THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
    END IF;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_schema_BEFORE_UPDATE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`db_schema_BEFORE_UPDATE` BEFORE UPDATE ON `db_schema` FOR EACH ROW
BEGIN
	IF (NEW.request_path <> OLD.request_path OR NEW.service_id <> OLD.service_id) THEN
		SET @service_path := (SELECT CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name, se.url_context_root) AS path
			FROM `mysql_rest_service_metadata`.service se
				LEFT JOIN `mysql_rest_service_metadata`.url_host h
					ON se.url_host_id = h.id
			WHERE se.id = NEW.service_id);
		SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(CONCAT(@service_path, NEW.request_path)));

		IF @validPath = 0 THEN
			SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
		END IF;
    END IF;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_schema_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`db_schema_BEFORE_DELETE` BEFORE DELETE ON `db_schema` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`db_object` WHERE `db_schema_id` = OLD.`id`;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_object_BEFORE_INSERT`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`db_object_BEFORE_INSERT` BEFORE INSERT ON `db_object` FOR EACH ROW
BEGIN
    SET @schema_path := (SELECT CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name, se.url_context_root, sc.request_path) AS path
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
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_object_BEFORE_UPDATE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`db_object_BEFORE_UPDATE` BEFORE UPDATE ON `db_object` FOR EACH ROW
BEGIN
    IF (NEW.request_path <> OLD.request_path OR NEW.db_schema_id <> OLD.db_schema_id) THEN
        SET @schema_path := (SELECT CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name, se.url_context_root, sc.request_path) AS path
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
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`db_object_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`db_object_BEFORE_DELETE` BEFORE DELETE ON `db_object` FOR EACH ROW
BEGIN
    DELETE FROM `mysql_rest_service_metadata`.`mrs_db_object_row_group_security` WHERE `db_object_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`object` WHERE `db_object_id` = OLD.`id`;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_vendor_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`auth_vendor_BEFORE_DELETE` BEFORE DELETE ON `auth_vendor` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`auth_app` WHERE `auth_vendor_id` = OLD.`id`;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`auth_app_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`auth_app_BEFORE_DELETE` BEFORE DELETE ON `auth_app` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`mrs_user` WHERE `auth_app_id` = OLD.`id`;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_BEFORE_INSERT`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`mrs_user_BEFORE_INSERT` BEFORE INSERT ON `mrs_user` FOR EACH ROW
BEGIN
	IF NEW.name IS NOT NULL AND (SELECT COUNT(*) FROM `mysql_rest_service_metadata`.`mrs_user` AS u
		WHERE UPPER(u.name) = UPPER(NEW.name) AND u.auth_app_id = NEW.auth_app_id AND NEW.id <> u.id) > 0
	THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "This name has already been used.";
	END IF;
	IF NEW.email IS NOT NULL AND (SELECT COUNT(*) FROM `mysql_rest_service_metadata`.`mrs_user` AS u
		WHERE UPPER(u.email) = UPPER(NEW.email) AND u.auth_app_id = NEW.auth_app_id AND NEW.id <> u.id) > 0
	THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "This email has already been used.";
    END IF;
    IF (NEW.auth_string IS NULL AND
        (SELECT a.auth_vendor_id FROM `mysql_rest_service_metadata`.`auth_app` AS a WHERE a.id = NEW.auth_app_id) = 0x30000000000000000000000000000000)
    THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "A this account requires a password to be set.";
    END IF;
    IF JSON_STORAGE_SIZE(NEW.app_options) > 16384 THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The JSON value stored in app_options must not be bigger than 16KB.";
    END IF;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_BEFORE_UPDATE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`mrs_user_BEFORE_UPDATE` BEFORE UPDATE ON `mrs_user` FOR EACH ROW
BEGIN
	IF NEW.name IS NOT NULL AND (SELECT COUNT(*) FROM `mysql_rest_service_metadata`.`mrs_user` AS u
		WHERE UPPER(u.name) = UPPER(NEW.name) AND u.auth_app_id = NEW.auth_app_id AND NEW.id <> u.id) > 0
	THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "This name has already been used.";
	END IF;
	IF NEW.email IS NOT NULL AND (SELECT COUNT(*) FROM `mysql_rest_service_metadata`.`mrs_user` AS u
		WHERE UPPER(u.email) = UPPER(NEW.email) AND u.auth_app_id = NEW.auth_app_id AND NEW.id <> u.id) > 0
	THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "This email has already been used.";
    END IF;
    IF (NEW.auth_string IS NULL AND
        (SELECT a.auth_vendor_id FROM `mysql_rest_service_metadata`.`auth_app` AS a WHERE a.id = NEW.auth_app_id) = 0x30000000000000000000000000000000)
    THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "A this account requires a password to be set.";
    END IF;
    IF JSON_STORAGE_SIZE(NEW.app_options) > 16384 THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The JSON value stored in app_options must not be bigger than 16KB.";
    END IF;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`mrs_user_BEFORE_DELETE` BEFORE DELETE ON `mrs_user` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`mrs_user_hierarchy` WHERE `user_id` = OLD.`id` OR `reporting_to_user_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_has_role` WHERE `user_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_has_group` WHERE `user_id` = OLD.`id`;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_BEFORE_INSERT`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`content_set_BEFORE_INSERT` BEFORE INSERT ON `content_set` FOR EACH ROW
BEGIN
	SET @service_path := (SELECT CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name, se.url_context_root) AS path
		FROM `mysql_rest_service_metadata`.service se
            LEFT JOIN `mysql_rest_service_metadata`.url_host h
                ON se.url_host_id = h.id
		WHERE se.id = NEW.service_id);
	SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(CONCAT(@service_path, NEW.request_path)));

    IF @validPath = 0 THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
    END IF;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_BEFORE_UPDATE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`content_set_BEFORE_UPDATE` BEFORE UPDATE ON `content_set` FOR EACH ROW
BEGIN
	IF (NEW.request_path <> OLD.request_path OR NEW.service_id <> OLD.service_id) THEN
		SET @service_path := (SELECT CONCAT(COALESCE(se.in_development->>'$.developers', ''), h.name, se.url_context_root) AS path
			FROM `mysql_rest_service_metadata`.service se
				LEFT JOIN `mysql_rest_service_metadata`.url_host h
					ON se.url_host_id = h.id
			WHERE se.id = NEW.service_id);
		SET @validPath := (SELECT `mysql_rest_service_metadata`.`valid_request_path`(CONCAT(@service_path, NEW.request_path)));

		IF @validPath = 0 THEN
			SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = "The request_path is already used by another entity.";
		END IF;
    END IF;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`content_set_BEFORE_DELETE` BEFORE DELETE ON `content_set` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`content_file`
	WHERE `content_set_id` = OLD.`id`;
	DELETE FROM `mysql_rest_service_metadata`.`content_set_has_obj_def`
	WHERE `content_set_id` = OLD.`id`;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_file_BEFORE_INSERT`%%
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
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_file_BEFORE_UPDATE`%%
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
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_role_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`mrs_role_BEFORE_DELETE` BEFORE DELETE ON `mrs_role` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`mrs_user_has_role` WHERE `role_id` = OLD.`id`;
    -- Workaround to fix issue with recursive delete
	IF OLD.id <> NULL THEN
		DELETE FROM `mysql_rest_service_metadata`.`mrs_role` WHERE `derived_from_role_id` = OLD.`id`;
	END IF;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_privilege` WHERE `role_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_group_has_role` WHERE `role_id` = OLD.`id`;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`mrs_user_hierarchy_type_BEFORE_DELETE` BEFORE DELETE ON `mrs_user_hierarchy_type` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`mrs_user_hierarchy` WHERE `user_hierarchy_type_id` = OLD.`id`;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_user_group_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`mrs_user_group_BEFORE_DELETE` BEFORE DELETE ON `mrs_user_group` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`mrs_user_has_group` WHERE `user_group_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_group_hierarchy` WHERE `user_group_id` = OLD.`id` OR `parent_group_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_group_has_role` WHERE `user_group_id` = OLD.`id`;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`mrs_group_hierarchy_type_BEFORE_DELETE` BEFORE DELETE ON `mrs_group_hierarchy_type` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`mrs_user_group_hierarchy` WHERE `group_hierarchy_type_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`mrs_db_object_row_group_security` WHERE `group_hierarchy_type_id` = OLD.`id`;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`router_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`router_BEFORE_DELETE` BEFORE DELETE ON `router` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`router_status` WHERE `router_id` = OLD.`id`;
    DELETE FROM `mysql_rest_service_metadata`.`router_general_log` WHERE `router_id` = OLD.`id`;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`router_session_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`router_session_BEFORE_DELETE` BEFORE DELETE ON `router_session` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`router_general_log` WHERE `router_session_id` = OLD.`id`;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`object_BEFORE_DELETE` BEFORE DELETE ON `object` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`object_field` WHERE `object_id` = OLD.`id`;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`object_field_BEFORE_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`object_field_BEFORE_DELETE` BEFORE DELETE ON `object_field` FOR EACH ROW
BEGIN
	SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
	DELETE FROM `mysql_rest_service_metadata`.`object_reference` WHERE `id` = OLD.`represents_reference_id`;
    SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
END%%

DROP TRIGGER IF EXISTS `mysql_rest_service_metadata`.`content_set_has_obj_def_AFTER_DELETE`%%
CREATE DEFINER = CURRENT_USER TRIGGER `mysql_rest_service_metadata`.`content_set_has_obj_def_AFTER_DELETE` AFTER DELETE ON `content_set_has_obj_def` FOR EACH ROW
BEGIN
	DELETE FROM `mysql_rest_service_metadata`.`db_object` dbo
    WHERE OLD.kind = "Script" AND dbo.id = OLD.db_object_id;
END%%

DELIMITER ;
