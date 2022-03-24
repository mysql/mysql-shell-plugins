# MySQL Shell for VS Code 1.0.31+8.0.28

This extension enables interactive editing and execution of SQL for MySQL Databases and the MySQL Database Service. It integrates the MySQL Shell directly into VS Code development workflows.

__IMPORTANT: Please note that this is a PREVIEW release which is not meant to be used in production.__

![MySQL Shell For VS Code Screenshot](images/screenshots/MySQLShellForVSCodeMain.png)

## Feature Highlights

Feature highlights include:

### Full OCI MDS Integration

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
  - Management of database connections to MySQL Server and MySQL Database Service (MDS) instances.
  - Browse through schema catalog
  - Dump schemas and load schemas with support for MDS instances
  - Open DB Editor for a database connection
  - Open MySQL Shell GUI Console for a database connection
- Oracle Cloud Infrastructure (OCI) Browser
  - Support for standard OCI profile configuration
  - Browse OCI compartments, MySQL DB Systems, Bastions, Compute Instances, and Load Balancers
  - Start/Stop operations for MySQL DB Systems
  - Creation of OCI Bastions and tunneled connections to MDS instance on private OCI networks
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


Copyright &copy; 2022, Oracle and/or its affiliates.
