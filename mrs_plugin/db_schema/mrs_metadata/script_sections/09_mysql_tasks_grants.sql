-- Copyright (c) 2025, Oracle and/or its affiliates.

-- -----------------------------------------------------
-- Grant the necessary mysql_tasks privileges to the MySQL REST Service roles
GRANT 'mysql_task_user' TO 'mysql_rest_service_admin', 'mysql_rest_service_schema_admin', 'mysql_rest_service_dev', 'mysql_rest_service_user',
	'mysql_rest_service_meta_provider', 'mysql_rest_service_data_provider';

