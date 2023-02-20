# MySQL REST Service Plugin for MySQL Shell

This folder contains the code for the MySQL REST Service (short: MRS) Plugin. It is part of the [MySQL Shell Plugins](../readme.md) repository.

# Contributing to MySQL REST Service Plugin

No installation is necessary for this plugin, beside the setup of Visual Studio Code to be able to work on the code.

## Visual Studio Code Settings

Include the following settings in your VS Code settings.json file in order to allow the Python linter find the referenced packages.

```json
{
    "python.analysis.extraPaths": [
        "/usr/local/mysql-shell/lib/mysqlsh/python-packages/",
        "${workspaceFolder}\\plugins\\rds_plugin",
        "/usr/local/mysql-shell/lib/mysqlsh/lib/python3.9/site-packages"
    ],
    "python.autoComplete.extraPaths": [
        "/usr/local/mysql-shell/lib/mysqlsh/python-packages/",
        "/usr/local/mysql-shell/lib/mysqlsh/lib/python3.9/site-packages",
        "${workspaceFolder}\\plugins\\rds_plugin"
    ]
}
```

Copyright &copy; 2020, 2023, Oracle and/or its affiliates.
