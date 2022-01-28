### Copyright (c) 2020, 2021, Oracle and/or its affiliates.

# MySQL REST Service Plugin for MySQL Shell
This folder contains the code for the MySQL REST Service (short: MRS) Plugin.

# VS Code Settings
Include the following settings in your VS Code settings.json file in order to 
allow the Python linter find the referenced packages.

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