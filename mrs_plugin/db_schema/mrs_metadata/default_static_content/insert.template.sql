-- Copyright (c) 2025, Oracle and/or its affiliates.
-- -----------------------------------------------------
-- Config

DELETE FROM `mysql_rest_service_metadata`.`config`;
INSERT INTO `mysql_rest_service_metadata`.`config` (`id`, `service_enabled`, `data`) VALUES (1, 1, '{ "defaultStaticContent": { "index.html": "${indexHtmlB64}", "favicon.ico": "${faviconIcoB64}", "favicon.svg": "${faviconSvgB64}", "sakila.svg": "${sakilaSvgB64}", "standalone-preact.js": "${standalonePreactJsB64}" }, "directoryIndexDirective": [ "index.html" ] }');

