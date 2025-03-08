# MySQL Shell for VS Code Change Log

## Changes in 1.19.3+9.2.0

### Additions

- 

### Fixes

- 

## Changes in 1.19.2+9.2.0

### Additions

- Support for MySQL REST Service metadata schema 4.0.0
- Add support for strong password verification

### Fixes

- BUG#37498176 Type checking errors for REST procedure without output parameters
- BUG#37549793 Unexpected MRS authentication error in the Python SDK
- BUG#37492003 MySQL Internal auth: not using SCRAM

## Changes in 1.19.1+9.1.0

### Additions

- Enhanced SHOW CREATE SERVICE to support INCLUDE ALL OBJECTS and to include
  user and role information on the output
- Python SDK: Renamed the upsert() API command to update()
- Added support for dollar quoting for JavaScript stored programs

### Fixes

- BUG#37053871 Unable to generate the MRS SDK for the current service by omission
- BUG#37052936 mrs.dump.sdkServiceFiles() reports no service_id in JSON - but it is there

## Changes in 1.19.0+9.1.0

### Additions

- Switched to improved UI Frontend sidebar handling
- MRS: Added advanced tab sheet to REST service dialog
- MRS: Improved layout of REST Auth App dialog
- MRS: Make URL, APP ID, APP SECRET mandatory when creating OAuth2 REST Auth Apps
- MRS: Added support for MySQL internal authentication in the MRS Client SDK
- MRS: Allow manual selection of PKs for REST objects
- Disable MRS Tree auto-refresh
- Changed MySQL Router logging to INFO level

### Fixes

- Fix icon rendering in various areas of the UI
- Several fixes regarding MRS authentication
- Added missing version string to MRS docs
- Fixed CREATE REST USER and ALTER REST USER commands
- Fix REST object field charset and collation

## Changes in 1.18.1+9.1.0

### Additions

- Added dark theme to MRS OpenAPI UI and improved layout

### Fixes

- BUG#37081659 SDK save() gives Bad Request - camel2snake and reverse
- BUG#37263610 find_first() is not the /first/...
-

## Changes in 1.18.0+9.1.0

### Additions

- Added support for MRS SQL commands ALTER REST AUTH APP, ALTER REST USER
- Added support for OAuth2 settings on MRS SQL commands CREATE REST AUTH APP
- Added support for MRS private state
- Added support for MRS MySQL Internal auth mechanism to Client SDK
- Added support to manually set MRS data mapping view keys for schema views
- Added support for more HeatWave GenAI languages

### Fixes

- BUG#37259058: Python SDK: fails to compare string column with 'Hello world!'
- BUG#37211618 Unable to access individual REST documents originating from a SQL VIEW
- Fixed wrong scrollbar color on Linux when using dark themes
- Changed MRS Router bootstrap log level to INFO
- Fixed MRS REST object dialog layout

## Changes in 1.17.1+9.1.0

### Fixes

- Removing the Preview label

## Changes in 1.17.0+9.1.0

### Additions

- Removed PREVIEW overlay on extension icon indicating GA release
- Change database connection view to include separate overlay icons for opening the connection with either a DB Notebook or DB Script.
- Added menu item to open SQL files directly from VS Code's explorer.
- Changed layout of DB Connection Editor and add a new option to set the default editor for the connection.
- Added MRS Script support and updated MRS metadata schema to 3.0.3.
- Added history of executed statement on DB Notebooks.
- Added MLE performance status in the admin section for a connection
- Updated MySQL Shell to 9.1.0

### Fixes

- Fixed editing of result sets when multiple result tabs are open.
- Improved theme handling.
- Fixed scrolling behavior of DB Notebooks.
- Fixed broken message display while opening a DB Connection.
- BUG#36893025 Directive `importReadOnly` doesn't import read-resources when at least one table object has no READ permissions
- BUG#37154650 Unexpected error whist using a REST VIEW in invoker security context

## Changes in 1.16.4+9.0.1

### Fixes

- Fixed windows packaging for correct certificate installation.

## Changes in 1.16.3+9.0.1

### Fixes

- Fixed GenAI model list

## Changes in 1.16.2+9.0.1

### Fixes

- Fixed an issue that caused LakeHouse Navigator not to scheduled loading tasks for HeatWave instances that do not have multi-language support enabled
- Fixed the display of source code in the MRS documentation when viewed inside VS Code

## Changes in 1.16.1+9.0.1

### Additions

- Added multi-language support for HeatWave Chat

### Fixes

- BUG#36925323 Type check error in the MRS TypeScript SDK test suite
- BUG#36445530 findUnique() command can be tricked to retrieve multiple records
- Fix naming of REST views, now call them REST data mapping views consistently across all MRS


## Changes in 1.16.0+9.0.1

### Additions

- Added support for MySQL REST Service metadata schema 3.0.0. Please update your MySQL Router installations to 9.0.1 and upgrade the MRS metadata schema when prompted.
- Updated MySQL Shell to 9.0.1
- Updated embedded MySQL Router to 9.0.1

### Fixes

- BUG#36868599 findUnique-type commands not generated as part of the MRS TypeScript SDK
- BUG#36877177 MRS Python SDK find_unique* commands generated for objects without unique fields
- BUG#36886308 MRS SDK "delete" command generated for database objects without unique fields
- BUG#36353086 The MRS SDK "delete()" command can delete multiple items
- BUG#36595270 Extraneous "cursor" option for database objects without potential cursor fields
-

## Changes in 1.15.2+9.0.0

### Fixes

- Fixed windows packaging for correct certificate installation.

## Changes in 1.15.1+9.0.0

### Additions

- Updated MySQL Shell to 9.0.0
- Added new keyboard shortcut: Alt/Option+ArrowUp/Down on DB Notebook moves focus to Result Sets
- Added new keyboard shortcut: Enter starts/ends editing when a Result Set cell holds the focus
- Added new keyboard shortcut: Command+Enter commits changes and Command+Esc rolls back changes when a Result Set Cell holds the focus
- Added new keyboard shortcut: Shift+Enter adds a new line in a text cell

### Fixes

- Fixed several issues related to Result Set editing
- BUG#36798924 Renamed connection-timeout to connect-timeout to match the standard name
- BUG#36798984 Renew the bastion session if expired/deleted

## Changes in 1.15.0+8.4.0

### Additions

- HeatWave Lakehouse Navigator
- HeatWave Chat
- WL#16049 Implement initial editing in result grids
- Upgraded to MySQL Shell 8.4.0

### Improvements

- WL#15718 Simplify application-level interfaces in the MRS SDK
- WL#16158 Improve the MRS SDK API for handling resource collections

### Fixes

- Fixes regression issue about clipboard operations (copy/paste)
- BUG#36027690 Connection error when opening REST Object Request Path in Web Browser
- BUG#36041538 Fix missing status messages during bastion connection
- BUG#36032142 Unexpected error when deleting records with filter containing nullables
- BUG#36173373 Parent class field not accessible in the child class in the TypeScript SDK
- BUG#36211402 Unexpected compilation error when building the VSCode Extension
- BUG#35150090 Missing required options on "mrs.add.schema()" documentation
- BUG#36204648 Syntax error when query filter mixes explicit OR and implicit AND operators
- BUG#36282632 MrsBaseObjectProcedureCall instances yield a type error
- BUG#36286261 TypeScript compiler error for accessing properties in a potential empty object
- BUG#36347569 Links in the front page open dialog to add new REST object
- BUG#36363355 Connection fails with scheme and non-standard port or socket in a Shell Session
- BUG#36508205 Unable to launch VS Code extension in dev mode using latest MySQL Shell
- BUG#36590424 SDK file missing "*Cursors" type declaration
- BUG#36589986 TypeScript SDK file missing required types in the import statement

## Changes in 1.14.2+8.1.1

- Updated MySQL Shell to 8.3.0

### Fixes

- Fixed code completion + semantic highlighting
- Fix SQL code execution to properly wait for the splitter to finish and the execute one statement after another
- Cleanup if websocket request/responds handling

## Changes in 1.14.1+8.1.1

### Fixes

- Re-enable auto-completion by default. Auto-completion of table columns is still broken and will be fixed in a separate release.
- Fixed MRS autocompletion when the current service had been deleted

## Changes in 1.14.0+8.1.1

### Additions

- Added support for MRS functions
- Added MySQL Router to extension package
- Changed the MRS sample code to make use of SDK
- Added a popup menu item to open the DB Connection on a new VS Code tab when the Alt key is held before opening the DB Connection menu
- Added new feature to execute a single statement on all open DB Notebooks
- Added new feature to convert a DB Notebook to a template that can be used to paste code blocks from

### Fixes

- Fixed broken Copy/Paste function on DB Notebooks
- Fix for breaking OCI SDK change for listing MySQL DB Systems
- Fixed auto-completion for @... decorators for MRS SQL statements
- Fixes in MRS SQL generation

## Changes in 1.13.6+8.1.1

### Fixes

- Improved language switching of code blocks on DB Notebook
- Updated MRS SQL grammar with new, improved syntax
- Replaced MRS SQL @REDUCETO() decorator with @UNNEST for 1:n references

## Changes in 1.13.5+8.1.1

### Fixes

- Fixed MRS SQL generation of REST data mapping views
- Fixed typo in MRS grammar

## Changes in 1.13.4+8.1.1

### Fixes

- Fixed AttributeError in MRS SQL handler
- Extended MRS documentation

## Changes in 1.13.3+8.1.1

### Fixes

- Updated download links for MySQL Router 8.1 MRS Preview 5
- Fixed wrong MRS db object icons on case sensitive file systems

## Changes in 1.13.2+8.1.1

### Fixes

- Fixed MRS TS/JS code execution on DB Notebooks
- Prevent from using duplicated MRS object names on the same REST schema
- Fixed error formatting on DB Notebooks
- Added a forgotten `await` expression in DBConnectionTab when retrieving SQL data as part of a JS/TS script call on DB Notebooks.

## Changes in 1.13.1+8.1.1

### Additions

- Added more MRS DDL commands.

### Fixes

- Fixed MRS DDL railroad diagram error for SCHEMAs vs. SCHEMA.
- Prompt to restart VS Code after MySQL Router installation

## Changes in 1.13.0+8.1.1

### Additions

- MySQL HeadWave Service Endpoint Creation
- Added support for MySQL REST Service (MRS) DDL execution
- Added support for REST data mapping views
- Added new MRS documentation
- Add MRS SDK types for spatial columns
- Added support for custom location of MySQL Router directory by setting environment variable MYSQL_ROUTER_CUSTOM_DIR
- WL#15880 Handle "NOT NULL" constraint in the MRS SDK

### Fixes

- Now the extension uses the proper Editor font size from VS Code
- Current database schema changes are now synced across VS Code sidebar and the extension
- Bug#35782639 - Edit Authentication App - Vendor is not updated
- Bug#35773217 - Change Rest Service Path on schema is not working
- MRS: Fixed getting grants and removing EXECUTE grant for PROCEDURES

## Changes in 1.12.1+8.1.1

### Additions

- WL#15880 Proper handling of NULL column values in the MRS TypeScript SDK
- WL#15912 Add MRS SDK types for spatial columns

### Fixes

- Updated TypeScript MRS SDK and fixed compilation issues
- BUG#35649509 "mrs.add.db_object()" cannot add schema automatically
- BUG#35745272 Excessively deep and possibly infinite type instantiation for GEOMETRY values
- BUG#35797406 Questions that prompt for user action do not have trailing question marks

## Changes in 1.12.0+8.1.1

### Fixes

- Correcting version

## Changes in 1.11.4+8.0.33

### Additions

- Updating MySQL Shell to version 8.1.1

### Fixes

- BUG#35635932 Type-safety and auto-completion not available for MRS SDK find*() commands
- BUG#35645706 Excessively deep and possibly infinite type instantiation in the SDK
- BUG#34140238 Using user only permissions for backend database

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

- REST data mapping view support and SDK generation

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
