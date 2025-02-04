# MySQL Schema Management Plugin for MySQL Shell

This folder contains the code for the MySQL Schema Management Plugin. It is part of the [MySQL Shell Plugins](../readme.md) repository.

## Contributing to MySQL Schema Management Plugin

No installation is necessary for this plugin, beside the setup of Visual Studio Code to be able to work on the code.

## Running the Tests

To be able to run the tests, MySQL Shell must be installed and in the path.

### Installing the Python Requirements

When inside the `shell_plugins` folder run the following command on the terminal.

```bash
mysqlsh --pym pip install -r msm_plugin/requirements.txt
```

### Running the Test

The test can be executed by running the `run-pytest` script in the NPM SCRIPTS section of the VS Code sidebar.

To run the tests from the terminal, changing into the `shell_plugins` folder and run the following command.

```bash
mysqlsh --log-level=debug3 --verbose=4 --py -f run_tests.py
```

To run a specific test, use the `-k` option.

```bash
mysqlsh --log-level=debug3 --verbose=4 --py -f run_tests.py -k test_plugin_version
```

Copyright &copy; 2025, Oracle and/or its affiliates.
