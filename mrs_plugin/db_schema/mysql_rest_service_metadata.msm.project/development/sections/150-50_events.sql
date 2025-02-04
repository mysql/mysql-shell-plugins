-- Copyright (c) 2025, Oracle and/or its affiliates.
-- -----------------------------------------------------
-- EVENTs

DELIMITER %%

DROP EVENT IF EXISTS `mysql_rest_service_metadata`.`delete_old_audit_log_entries`%%
CREATE EVENT `mysql_rest_service_metadata`.`delete_old_audit_log_entries`
ON SCHEDULE EVERY 1 DAY DISABLE
DO BEGIN
    DELETE FROM `mysql_rest_service_metadata`.`audit_log` WHERE changed_at < TIMESTAMP(DATE_SUB(NOW(), INTERVAL 14 DAY));
END%%

-- Create an event to dump the audit log every 15 minutes

DROP EVENT IF EXISTS `mysql_rest_service_metadata`.`audit_log_dump_event`%%
CREATE EVENT `mysql_rest_service_metadata`.`audit_log_dump_event`
ON SCHEDULE EVERY 15 MINUTE
  STARTS '2025-01-01 00:00:00'
ON COMPLETION PRESERVE DISABLE
DO BEGIN
    CALL `mysql_rest_service_metadata`.`dump_audit_log`();
END%%

DELIMITER ;
