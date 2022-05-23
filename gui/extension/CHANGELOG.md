# MySQL Shell for VS Code Change Log

## Changes in 1.2.2+8.0.28

### Fixes

- Simplified certificate deployment in WSL

## Changes in 1.2.21+8.0.28

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
