# MySQL Shell for VS Code 1.15.0+8.3.0 Preview

This extension enables interactive editing and execution of SQL for MySQL Databases and the MySQL HeatWave Service. It integrates the MySQL Shell directly into VS Code development workflows.

__IMPORTANT: Please note that this is a PREVIEW release which is not meant to be used in production.__

![MySQL Shell For VS Code Screenshot](images/screenshots/MySQLShellForVSCodeMain.jpg)

## Community Preview Release

Thanks for your interest in our new Visual Studio Code extension. We created this preview release especially for the MySQL Community to showcase our latest project for MySQL developers. We aim to deliver the best possible integration of MySQL support inside the Visual Studio Code environment.

To reach our goal, we need your help. Please help to test our extension and report any bugs you find, so we can get the project closer to production quality in less time. We would also like to hear about your feature requests to make our extension more complete and cover your needs.

To file a bug report, select the following menu item or go to [bugs.mysql.com](https://bugs.mysql.com/report.php?category=Shell%20VSCode%20Extension).

![File a Bug](images/screenshots/MySQLShellForVSCodeFileBug.gif)

## Supported Platforms

| OS      | Version/Dependency | Architecture |
|---------|--------------------|--------------|
| macOS   | 11 and higher      | arm64, x64   |
| Windows | 10 and higher      | x64          |
| Linux   | glibc 2.12         | arm64, x64   |

### Tested Linux Distributions

| Linux Distribution  | Releases          |
|---------------------|-------------------|
| Debian              | 11                |
| Ubuntu              | 20.04, 22.04      |
| Ubuntu-WSL2         | 20.04             |
| Kubuntu             | 21.10             |
| Oracle Linux/RedHat | 7, 8, 9           |
| Fedora              | 35                |
| Raspberry Pi OS     | January 28th 2022 |

If you have successfully tested the extension on other Linux distributions, please let us know by filing a [bugs report](https://bugs.mysql.com/report.php?category=Shell%20VSCode%20Extension).

## Tutorials

How to Create a New Database Connection

![MySQL Shell For VS Code Screenshot](images/screenshots/MySQLShellForVSCodeNewConnection.gif)

## Feature Highlights

### Full OCI MHS Integration

Browse and manage your MySQL DB Systems on the Oracle Cloud Infrastructure.

Get immediate and secure access to all your MySQL instances on OCI through tunneled Bastion connections.

### Notebook Interface

The embedded DB Editor offers you a fresh way to work interactively with your database.

Switch from SQL to JavaScript or TypeScript to query, manipulate, and visualize your data.

### MySQL Shell GUI Console

Provides the full power of the MySQL Shell inside a notebook-interface-styled editor.

Multi-line command editing, interactive auto-completion, and powerful plugins.

### Tight Workflow Integration

MySQL Shell for VS Code integrates seamlessly into your development workflow.

Takes SQL embedded in your source files and runs it inside the DB Editor. Updates modified SQL in your source file.

### Features Include

- Database Connection Manager:
  - Management of database connections to MySQL Server and MySQL Database Service (MHS) instances.
  - Browse through schema catalog
  - Dump schemas and load schemas with support for MHS instances
  - Open DB Editor for a database connection
  - Open MySQL Shell GUI Console for a database connection
- Oracle Cloud Infrastructure (OCI) Browser
  - Support for standard OCI profile configuration
  - Browse OCI compartments, MySQL DB Systems, Bastions, Compute Instances, and Load Balancers
  - Start/Stop operations for MySQL DB Systems
  - Creation of OCI Bastions and tunneled connections to MHS instance on private OCI networks
- DB Editor to work with live database connections:
  - Notebook Interface
  - Support for SQL, TypeScript, and JavaScript to work with the database
  - Auto-completion for SQL, TypeScript and JavaScript
  - Query result set browsing in a paged result grid
  - Support for multiple result sets in tabbed result grids
  - Support for text output for TypeScript and JavaScript code
  - Support for graphs for TypeScript and JavaScript code
- MySQL Shell GUI Console:
  - Notebook Interface
  - Support for SQL, Python, and JavaScript
  - Query result set browsing in a result grid
- Execute SQL from source files in DB Editor:
  - Execute any selected SQL commands from SQL files
  - Execute multi-line SQL blocks from Python files
    - Update original Python files with changes made in DB Editor

Copyright &copy; 2022, 2024, Oracle and/or its affiliates.
