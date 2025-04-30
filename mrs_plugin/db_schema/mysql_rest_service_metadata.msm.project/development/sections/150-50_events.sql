-- Copyright (c) 2025, Oracle and/or its affiliates.
-- -----------------------------------------------------
-- EVENTs

DELIMITER %%

-- Create an event to delete old audit_log entries that are older than 14 days

DROP EVENT IF EXISTS `delete_old_audit_log_entries`%%
CREATE EVENT `delete_old_audit_log_entries`
ON SCHEDULE EVERY 1 DAY ENABLE
DO BEGIN
    DELETE FROM `mysql_rest_service_metadata`.`audit_log`
        WHERE changed_at < NOW() - INTERVAL 14 DAY;
END%%

-- Create an event to dump the audit log every 15 minutes

DROP EVENT IF EXISTS `audit_log_dump_event`%%
CREATE EVENT `audit_log_dump_event`
ON SCHEDULE EVERY 15 MINUTE
  STARTS '2025-01-01 00:00:00'
ON COMPLETION PRESERVE DISABLE
DO BEGIN
    CALL `mysql_rest_service_metadata`.`dump_audit_log`();
END%%

-- Periodically down-sample router_status rows to keep its size under control.

DROP EVENT IF EXISTS `router_status_cleanup`%%
CREATE EVENT `router_status_cleanup` ON SCHEDULE EVERY 1 HOUR
ON COMPLETION NOT PRESERVE ENABLE COMMENT 'Aggregate and clean up router_status entries' DO
    CALL mysql_rest_service_metadata.router_status_do_cleanup(NOW())%%


-- Periodically delete the router_general_log

DROP EVENT IF EXISTS `router_log_cleanup`%%
CREATE EVENT `router_log_cleanup`
ON SCHEDULE EVERY 1 HOUR
ON COMPLETION NOT PRESERVE ENABLE COMMENT 'Clean up router_general_log entries'
DO
    DELETE FROM `mysql_rest_service_metadata`.`router_general_log`
        WHERE `log_time` <= NOW() - INTERVAL 1 DAY%%

DELIMITER ;
