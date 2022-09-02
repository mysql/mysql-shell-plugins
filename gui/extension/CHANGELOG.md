# MySQL Shell for VS Code Change Log

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
