# MySQL REST Service Plugin for MySQL Shell

This folder contains the code for the MySQL REST Service (short: MRS) Plugin. It is part of the [MySQL Shell Plugins](../readme.md) repository.

# Contributing to MySQL REST Service Plugin

No installation is necessary for this plugin, beside the setup of Visual Studio Code to be able to work on the code.

## Testing

Since this is a MySQL Shell plugin, the tests should run as part of a MySQL Shell session. The test script should be executed within the `mrs_plugin` directory and the required testing dependencies should be installed as follows:

```sh
$ cd mrs_plugin
$ mysqlsh --pym pip install --user -r requirements.txt
```

After the dependencies are installed, the test script can execute as follows:

```sh
$ mysqlsh --py -f run_tests.py
```

To run a single test or test suite, the script provides a `-k` option that allows to specify a test name or a file name.

```sh
$ mysqlsh --py -f run_tests.py -k test_sdk
```

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

Copyright &copy; 2020, 2024, Oracle and/or its affiliates.
