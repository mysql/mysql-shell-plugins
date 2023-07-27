# MySQL Shell for VS Code Change Log

## Changes in 1.11.3+8.0.33

- Added MRS SDK documentation about querying table data with expanded fields
### Fixes

- Increased MRS metadata schema version to 2.1.0
- Fixed hardcoded download paths for MRS Router 8.0.33 Preview 3
- BUG#35594404 Remove extraneous "findFirst()” options

## Changes in 1.11.2+8.0.33

### Additions

- Add missing MRS SDK API reference documentation.

### Fixes

- BUG#35594274 "orderBy" yields unexpected error in MRS SDK "findMany()"
- BUG#35120862 - Database object role privileges not removed when deleting a REST object
- BUG#35124914 - Unexpected error whilst deleting an MRS service in the MySQL Shell

## Changes in 1.11.1+8.0.33

### Fixes

- Regression determining the shell configuration home path that caused the existing configuration (connections, certificates) to be ignored.
- BUG#35381777 Fix service metadata display format

## Changes in 1.11.0+8.0.33

### Additions

- Updated MySQL Shell to 8.0.33
- Support for MySQL REST Service Preview 3, an update of MySQL Router from labs.mysql.com to MRS Preview 3 is required to use MRS
- Optimized extension workflow
- Saving and loading of DB Notebooks

### Fixes

- Bug#35124878 Incorrect documentation for deleting an MRS object
- Bug#35377927 Delete REST schema after proper confirmation
- Bug#35381360 Display service listing for "mrs.get.service()"
- Bug#35337158 Provide feedback if service id does not exist
- Bug#35321265 Add/Fix support for Table Aliases usage in SQL Auto-Completion
- Bug#34504322 Shell Console: Results of JS X DevAPI are all NULL
- Bug#35266189 Create MySQL Notebook action opens a script editor
- Bug#34623702 SERVER STATUS SHOWS CONNECTION NAME NONE
- Bug#34200753 VS CODE EXTENSION IS INOPERABLE AFTER CONNECTING/KILLING TO EXTERNAL PROCESS
- Bug#35154565 DATA FIELDS HAVE PROBLEMS WITH SPECIAL DATA TYPES
- Bug#34032230 USING AN INVALID TOKEN ON THE URL OUTPUTS A NO-USER-FRIENDLY ERROR MESSAGE
- Bug#33752913 WINDOW/DIALOG FOOTER COLOR IS NOT WORKING
- Bug#35317260 Default value for url_protocol when adding REST service
- Bug#35337695 Fix service "auto_select_single" for raw Shell
- Bug#35317488 Display listing for current service
- Bug#35341478 Display error line and column in DB Notebook
- Bug#35312214 Duplicate entries for services with same path but different host names
- Bug#35124859 Extraneous arguments accessing an MRS service in the MySQL Shell
- Bug#35124804 Extraneous arguments deleting an MRS service in the MySQL Shell
- Bug#35124746 Extraneous arguments creating an MRS service in MySQL Shell

## Changes in 1.10.1+8.0.32

### Fixes

- Fixes an issue that caused the MySQL REST Service metadata database schema to be auto-created at connection time.

### Additions

- Added an additional confirmation dialog before creating the MySQL REST Service metadata database schema.

## Changes in 1.10.0+8.0.32

### Additions

- JSON/Relational Duality support and SDK generation

### Fixes

- Bug #35115512 Wrong default value for Rest object pagination in MRS
- Bug#35209790 mrs.list.services() incorrectly displays the supported protocols
- Bug #35240130 Current REST Service in Schemas and Objects
- Misc UI layout improvements and bugfixes

## Changes in 1.9.1+8.0.32

### Fixes

- The "Requires Authentication" option should default to FALSE when creating a new MRS schema
- Fixed horizontal layout of action output to become vertical again.
- Fixed size and position of the copy button in action output, which was wrong in script editors (but ok in Notebooks).
- Changed display of open editors in the extension sidebar when only one provider and one connection is open.
- Fixed an error in the MRS interface.
- Fixed the connection refresh regression.
- Fixed action output scroll into view regression.
- Updated tests for the changes.

## Changes in 1.9.0+8.0.32

### Fixes

- Fixed broken auto-completion for database schemas and objects
- Fixed various issues on MRS dialogs.

### Additions

- Added new Open Editors view in sidebar that shows all open MySQL Shell editors and tabs. This view replaces the MySQL Shell Consoles view that is now included in the Open Editors view.
- Added new Execute to Text feature that allows to copy the result as text.
- Made output text selectable and added a Copy to Clipboard overlay icon.
- Added menu item to delete a registered MySQL Router instance from the MRS metadata.

## Changes in 1.8.2+8.0.32

### Fixes

- Fixed a regression that broke the result set display for binary data and the copying of quoted fields
- DB Notebook: Fixed displaying of multiple results in generated from the same operation (i.e. execution of stored procedures)

## Changes in 1.8.1+8.0.32

### Fixes

- Fixed a bug that prevented MySQL Router from starting when there was a space in the absolute file path of the config director
- On the MRS Service dialog the Host Name label was changed to Host Name Filter and a placeholder was put in place to make it more clear that this field should be left empty unless specific host filtering should be applied
- Improved MRS documentation to be more explicit on how to deploy the mrsNotes demo app

## Changes in 1.8.0+8.0.32

### Additions

- Added support for the MySQL REST Service

### Fixes

- Fixed a bug regarding interactive prompts during the opening of a database session

## Changes in 1.7.2+8.0.32

### Fixes

- Because on Windows text can contain both \r\n or just \n line breaks, SQL text read from the code editor was too short sometimes.
- No about block was shown on Windows, when opening a new code editor.
- Duplicate keys were used in the components on the server status page.

## Changes in 1.7.1+8.0.32

### Fixes

- Fixed partial listing of schemas and schema objects.
- Disabled usage of defaults file in Shell instances launched from the GUI.
- Updated default file names for MDS SSH keys.
- Fixed error that prevented updating the SSH private file name in MDS connections.

## Changes in 1.7.0+8.0.32

- Updated MySQL Shell to 8.0.32

### Additions

- New, cleaned up visual appearance of notebooks
- New keyboard short-cuts for navigating Notebooks
  - "ctrl+cmd+up" to move to the beginning of the current statement block or the previous block when on first line
  - "ctrl+cmd+down" to move to the end of the current statement block or the next block when on last line

### Fixes

- Fixed layout issues when word wrap was turned off

## Changes in 1.6.2+8.0.31

### Additions

- Reporting of OCI operation progress in percentage for MySQL Shell Tasks

### Fixes

- Fixed HeatWave support for latest server versions

## Changes in 1.6.1+8.0.31

### Fixes

- Display affected rows for SQL queries
- Enabling line wrapping by default for the SQL Notebook

## Changes in 1.6.0+8.0.31

### Additions

- Upgraded the MySQL Shell to 8.0.31
- Added support OL9

### Fixes

- Fixed Shell crash on connections through Bastion Service when session expired.
- Fixed "Access denied error" on sessions through Bastion Service.
- Fixed reconnection logic on sessions through Bastion Service.
- Improved execution result output of SQL and scripting sessions. Simple status responses are now collected into a central output tab and the lines are clickable to allow navigating to the origin of the output.
- Bug fixes and performance improvements.

## Changes in 1.5.0+8.0.30

### Additions

- Added UI support for HeatWave Auto Parallel Load feature
- Added support for ssh-remote VS Code session making the extension work with VS Code Server
- Added support for MySQL connection compression settings
- Added an error panel when the UI cannot be loaded and a warning panel when not using HTTPS
- Added options to allow HTTP access to the UI in controlled environments

### Fixes

- Fixed an issue that caused connection errors of OCI Bastion session not being displayed correctly
- The MDS tab on the connection dialog was missing when creating an OCI MDS connection
- The color of the min-map in the SQL Notebooks and Script editors was fixed for light mode
- Fixed issues when double-clicking a connection tile in the Connection Browser
- Removal of the default toolbar when not applicable
- Fixed issues with the Administration pages for MySQL connections in the Database Connection tree view

## Changes in 1.4.1+8.0.30

### Additions

- Added automatic MySQL optimizer trace and output when execution on HeatWave fails
- Added dedicated dialog for HeatWave cluster settings

### Fixes

- A new SQL Block is now added directly after the query execution has started (instead of waiting for the query to finish) if requested
- Copy CREATE statement to clipboard in the Connection Tree context menu has been fixed

## Changes in 1.4.0+8.0.30

### Additions

- Dedicated handling for MDS HeatWave instances
- Creation, rescaling and management of HeatWave Clusters
- New toolbar buttons to force execution of SQL queries on HeatWave engine

### Fixes

- Updated autocompletion support for MySQL Server 8.0.30
- Fixed Pie graph rendering
- Fixed KeepAlive functionality for MySQL Sessions through Bastion

## Changes in 1.3.3+8.0.30

### Fixes

- Fixed open_session error after creating a connection in Shell Console.
- Fixed handling of passwords with special characters in the Shell Console.
- Fixed naming to be timestamp based to guarantee uniqueness.

## Changes in 1.3.2+8.0.30

### Fixes

- Improved PieGraph result rendering.
- Fixed deletion of database connections.
- Fixed load of SQL connections in github codespaces.

### Additions

- Upgraded shell to 8.0.30

## Changes in 1.3.1+8.0.29

### Fixes

- Fixed multibyte interpretation of UTF-8 data that resulted in invalid data being inserted on the database.

## Changes in 1.3.0+8.0.29

### Fixes

- Fixed certificate deployment in ArchLinux
- Turned password saving prompts into Yes/No like prompts.

### Additions

- Upgraded shell to 8.0.29
- Added support for Select Prompts introduced in Shell 8.0.29
- Added support for Confirm Prompts introduced in Shell 8.0.29
- Added option to cancel Prompt Dialogs

## Changes in 1.2.2+8.0.28

### Fixes

- Simplified certificate deployment in WSL

## Changes in 1.2.1+8.0.28

### Additions

- Added MS VC++ dependency installation check
- Added certutil dependency installation check (linux)

### Fixes

- Fixed certificate deployment issues
- Fixed linux credential manager

## Changes in 1.1.8+8.0.28

### Fixes

- Fixed broken password dialog

## Changes in 1.1.7+8.0.28

### Fixes

- Fixed Admin API Sandbox operation errors not being shown.

## Changes in 1.1.6+8.0.28

### Fixes

- Removed invalid connection options that caused connections through SSH Tunnel to always show an error.
- Fixed Connection Editor to properly hide/show the SSH Tunnel Tab based on the stored connection options.
- Fixed Connection Editor to properly hide/show the MDS Tab based on the stored connection options.

## Changes in 1.1.5+8.0.28

### Fixes

- Fixed certificate deployment for WSL2.
- Fixed inconsistency detection in certificate deployment.
- Improved the error message when failing to deploy the certificates on linux to provide the user instructions for manual install.

## Changes in 1.1.4+8.0.28

### Fixes

- Fixed extension icon to indicate the preview status of the release
- Fixed Welcome Wizard to display unsupported macOS and Windows versions
- Fixed readme to display how to add a new database connection

## Changes in 1.1.3+8.0.28

### Fixes

- Fixed an issue that caused queries including columns with the same name to return wrong data by adding a count indicator (x) to the column captions

## Changes in 1.1.2+8.0.28

### Fixes

- Fixed MySQL Shell user settings directory creation on Windows that prevented the Welcome Wizard to start

## Changes in 1.1.1+8.0.28

### Fixes

- Fixed README.md not showing correct version number

## Changes in 1.1.0+8.0.28

### Additions

- Added File Bug Report dropdown menu item in Database ... menu.
- Added proper indexing of result set tabs and text output to relate them to statements

### Fixes

- Fixed error on invalid Date/Datetime values stored inside MySQL tables
- Changed order of MDS DB System popup menu items

## Changes in 1.0.31+8.0.28

### Fixes

- Fixed a bug where the result view context menu did not enable any menu item.
- Fixed broken update of status bar when switching result set tabs
- Fixed SQL Notebook default language to be SQL
- Fixed leaking file descriptors

## Changes in 1.0.30+8.0.28

### Additions

- Scripts to handle web certificate installation on Linux
- Option to switch between upper/lower case keyword handling
- Added menu option to set default OCI Profile
- Added menu option to delete MDS DB Systems

### Fixes

- Fixed Auto Completion to net fetch table and column names in some cases
- Fixed Result Set row output not displaying content in some cases
- Fixed SQL Block Decorator size in Python files
- Fixed OCI Bastion handling issues
