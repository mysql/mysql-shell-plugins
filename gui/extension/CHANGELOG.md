# MySQL Shell for VS Code Change Log

## Changes in 1.1.3+8.0.28

### Fixes

- Fixed an issue that caused queries including columns with the same name to return wrong data by adding a count indicator to the column captions

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
